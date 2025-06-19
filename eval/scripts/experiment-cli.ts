#!/usr/bin/env node

import { Command } from 'commander';
import { generateSlug, isValidSlug, slugify } from '../frontend/src/lib/utils/slug';
import * as readline from 'readline';
import { promisify } from 'util';
import * as path from 'path';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { requireAuth, clearAuth } from './auth';
import { prisma } from './prisma-client';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../frontend/.env.local') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

// Create readline interface lazily to avoid conflicts with auth
let rl: readline.Interface | null = null;
let question: (prompt: string) => Promise<string>;

function getReadline() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    question = promisify(rl.question).bind(rl);
  }
  return { rl, question };
}

const program = new Command();

program
  .name('experiment-cli')
  .description('CLI for managing evaluation experiments')
  .version('1.0.0');

// Create new experiment command
program
  .command('create')
  .description('Create a new experiment interactively')
  .option('-n, --name <name>', 'Experiment name')
  .option('-s, --slug <slug>', 'URL-friendly slug (auto-generated if not provided)')
  .option('-d, --description <description>', 'Experiment description')
  .option('-g, --group <group>', 'Experiment group for organization')
  .action(async (options) => {
    await requireAuth('create experiments', async (auth) => {
      console.log(chalk.blue.bold('\n🧪 Creating a new experiment\n'));

      try {
      const { question } = getReadline();
      
      // Interactive prompts
      const name = options.name || await question(chalk.cyan('Experiment name: '));
      
      let slug = options.slug;
      if (!slug) {
        const suggestedSlug = generateSlug();
        const useGenerated = await question(
          chalk.cyan(`Slug (press Enter for "${chalk.yellow(suggestedSlug)}"): `)
        );
        slug = useGenerated || suggestedSlug;
      }
      
      // Validate slug
      if (!isValidSlug(slug)) {
        console.log(chalk.red('Invalid slug. Converting to valid format...'));
        slug = slugify(slug);
      }
      
      const description = options.description || 
        await question(chalk.cyan('Description (optional): '));
      
      const group = options.group || 
        await question(chalk.cyan('Group (optional): '));
      
      // Evaluation mode selection
      console.log(chalk.blue('\n⚖️  Evaluation Mode'));
      console.log(chalk.gray('1. Comparison Mode (A vs B) - Compare two videos side-by-side'));
      console.log(chalk.gray('2. Single Video Mode (Absolute Rating) - Rate individual videos 1-5 scale'));
      const modeInput = await question(chalk.cyan('Select evaluation mode (1 or 2): '));
      const evaluationMode = modeInput === '2' ? 'single_video' : 'comparison';
      
      // Model configuration
      console.log(chalk.blue('\n📊 Model Configuration'));
      
      let models: string[] = [];
      let scenarios: string[] = [];
      
      if (evaluationMode === 'comparison') {
        const modelsInput = await question(
          chalk.cyan('Models to compare (comma-separated, e.g., "model1,model2"): ')
        );
        models = modelsInput.split(',').map((m: string) => m.trim());
      } else {
        const modelsInput = await question(
          chalk.cyan('Models to evaluate (comma-separated, e.g., "model1,model2,model3"): ')
        );
        models = modelsInput.split(',').map((m: string) => m.trim());
      }
      
      // Scenario configuration
      const scenariosInput = await question(
        chalk.cyan('Scenarios (comma-separated, e.g., "forest,desert,ocean"): ')
      );
      scenarios = scenariosInput.split(',').map((s: string) => s.trim());
      
      // Create experiment
      const experiment = await prisma.experiment.create({
        data: {
          name,
          slug,
          description: description || null,
          group: group || null,
          status: 'draft',
          evaluationMode,
          createdBy: auth.userId,
          config: {
            models,
            scenarios,
            evaluationsPerComparison: evaluationMode === 'comparison' ? 5 : 3,
            dimensions: [
              'overall_quality',
              'controllability',
              'visual_quality',
              'temporal_consistency'
            ]
          }
        }
      });
      
      console.log(chalk.green.bold('\n✅ Experiment created successfully!\n'));
      console.log(chalk.white('ID:'), chalk.yellow(experiment.id));
      console.log(chalk.white('Slug:'), chalk.yellow(experiment.slug));
      console.log(chalk.white('Status:'), chalk.yellow(experiment.status));
      console.log(chalk.white('Mode:'), chalk.yellow(experiment.evaluationMode));
      if (experiment.group) {
        console.log(chalk.white('Group:'), chalk.yellow(experiment.group));
      }
      
      const evaluationUrl = experiment.evaluationMode === 'single_video' 
        ? `https://yourdomain.com/evaluate-video/${experiment.slug}`
        : `https://yourdomain.com/evaluate/${experiment.slug}`;
      console.log(chalk.white('\nEvaluation URL:'), chalk.blue.underline(evaluationUrl));
      
      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray('1. Upload videos using: experiment-cli upload-videos --dir <directory>'));
      if (experiment.evaluationMode === 'single_video') {
        console.log(chalk.gray('2. Create video tasks using: experiment-cli create-video-tasks --experiment <slug>'));
      } else {
        console.log(chalk.gray('2. Assign videos using: experiment-cli assign-videos --experiment <slug>'));
      }
      console.log(chalk.gray('3. Launch experiment using: experiment-cli launch'));
      
      } catch (error) {
        console.error(chalk.red('Error creating experiment:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true); // Require admin permissions
  });

// List experiments command
program
  .command('list')
  .description('List all experiments')
  .option('-s, --status <status>', 'Filter by status (draft, active, completed, archived)')
  .action(async (options) => {
    try {
      const where = options.status ? { status: options.status } : {};
      const experiments = await prisma.experiment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              comparisons: true,
              videoTasks: true,
              participants: true,
              evaluations: true,
              singleVideoEvals: true,
            }
          }
        }
      });
      
      console.log(chalk.blue.bold('\n📋 Experiments\n'));
      
      if (experiments.length === 0) {
        console.log(chalk.gray('No experiments found.'));
      } else {
        experiments.forEach((exp) => {
          const statusColor = {
            draft: 'gray',
            active: 'green',
            completed: 'blue',
            archived: 'red'
          }[exp.status] || 'white';
          
          console.log(chalk.bold.white(`${exp.name} (${exp.slug})`));
          console.log(chalk[statusColor](`  Status: ${exp.status}`));
          console.log(chalk.blue(`  Mode: ${exp.evaluationMode}`));
          if (exp.group) {
            console.log(chalk.gray(`  Group: ${exp.group}`));
          }
          console.log(chalk.gray(`  Created: ${exp.createdAt.toLocaleDateString()}`));
          
          if (exp.evaluationMode === 'single_video') {
            console.log(chalk.gray(`  Video Tasks: ${exp._count.videoTasks}`));
            console.log(chalk.gray(`  Single Video Evaluations: ${exp._count.singleVideoEvals}`));
          } else {
            console.log(chalk.gray(`  Comparisons: ${exp._count.comparisons}`));
            console.log(chalk.gray(`  Evaluations: ${exp._count.evaluations}`));
          }
          console.log(chalk.gray(`  Participants: ${exp._count.participants}`));
          
          if (exp.prolificStudyId) {
            console.log(chalk.cyan(`  Prolific Study: ${exp.prolificStudyId}`));
          }
          console.log();
        });
      }
    } catch (error) {
      console.error(chalk.red('Error listing experiments:'), error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Launch experiment command
program
  .command('launch <slug>')
  .description('Launch an experiment (change status to active and optionally create Prolific study)')
  .option('-p, --prolific', 'Create a Prolific study')
  .option('--prolific-title <title>', 'Prolific study title')
  .option('--prolific-description <description>', 'Prolific study description')
  .option('--prolific-reward <reward>', 'Reward per participant (USD)', '8.00')
  .option('--prolific-participants <count>', 'Number of participants', '50')
  .action(async (slug, options) => {
    await requireAuth('launch experiments', async (auth) => {
      try {
        // First get the experiment
        const experiment = await prisma.experiment.findUnique({
          where: { slug },
          include: {
            _count: {
              select: {
                comparisons: true
              }
            }
          }
        });
        
        if (!experiment) {
          console.log(chalk.red(`Experiment "${slug}" not found`));
          return;
        }
        
        let prolificStudyId: string | null = null;
        let prolificUrl: string | null = null;
        
        // Create Prolific study if requested
        if (options.prolific) {
          console.log(chalk.blue('\n🌐 Creating Prolific study...\n'));
          
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;
            if (!baseUrl) {
              throw new Error('NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_BASE_URL, or BASE_URL must be set');
            }
            
            const prolificData = {
              experimentId: experiment.id,
              title: options.prolificTitle || `Evaluate ${experiment.name}`,
              description: options.prolificDescription || `Help us evaluate AI model outputs for ${experiment.name}`,
              reward: parseFloat(options.prolificReward),
              totalParticipants: parseInt(options.prolificParticipants)
            };
            
            const response = await fetch(`${baseUrl}/api/prolific/studies`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(prolificData)
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to create Prolific study');
            }
            
            const result = await response.json();
            prolificStudyId = result.studyId;
            prolificUrl = `https://app.prolific.co/researcher/studies/${prolificStudyId}`;
            
            console.log(chalk.green('✅ Prolific study created successfully!'));
            console.log(chalk.white('Study ID:'), chalk.cyan(prolificStudyId));
            
          } catch (error) {
            console.log(chalk.red('❌ Failed to create Prolific study:'), error.message);
            console.log(chalk.gray('You can create it manually later through the admin interface.'));
          }
        }
        
        // Update experiment status
        const updateData: any = { 
          status: 'active', 
          startedAt: new Date()
        };
        
        if (prolificStudyId) {
          updateData.prolificStudyId = prolificStudyId;
        }
        
        const updatedExperiment = await prisma.experiment.update({
          where: { slug },
          data: updateData,
        });
        
        console.log(chalk.green.bold('\n🚀 Experiment launched!\n'));
        console.log(chalk.white('Name:'), chalk.yellow(updatedExperiment.name));
        console.log(chalk.white('Status:'), chalk.green('active'));
        console.log(chalk.white('Started:'), chalk.yellow(updatedExperiment.startedAt?.toLocaleString()));
        
        if (updatedExperiment.prolificStudyId) {
          const studyUrl = prolificUrl || `https://app.prolific.co/researcher/studies/${updatedExperiment.prolificStudyId}`;
          console.log(chalk.white('\nProlific Study:'), chalk.cyan.underline(studyUrl));
        }
        
        const evaluationUrl = `https://${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/evaluate/${updatedExperiment.slug}`;
        console.log(chalk.white('Evaluation URL:'), chalk.blue.underline(evaluationUrl));
        
      } catch (error) {
        console.error(chalk.red('Error launching experiment:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true); // Require admin permissions
  });

// Complete experiment command
program
  .command('complete <slug>')
  .description('Mark an experiment as completed')
  .action(async (slug) => {
    await requireAuth('complete experiments', async () => {
      try {
        const experiment = await prisma.experiment.update({
        where: { slug },
        data: { 
          status: 'completed',
          completedAt: new Date()
        },
      });
      
      console.log(chalk.green.bold('\n✅ Experiment completed!\n'));
      console.log(chalk.white('Name:'), chalk.yellow(experiment.name));
        console.log(chalk.white('Completed:'), chalk.yellow(experiment.completedAt?.toLocaleString()));
        
      } catch (error) {
        console.error(chalk.red('Error completing experiment:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true); // Require admin permissions
  });

// Stats command
program
  .command('stats <slug>')
  .description('Show experiment statistics')
  .action(async (slug) => {
    await requireAuth('view experiment stats', async () => {
      try {
        const experiment = await prisma.experiment.findUnique({
        where: { slug },
        include: {
          _count: {
            select: {
              comparisons: true,
              videoTasks: true,
              participants: true,
              evaluations: true,
              singleVideoEvals: true,
            }
          },
          evaluations: {
            select: {
              dimensionScores: true,
              completionTimeSeconds: true,
            }
          },
          singleVideoEvals: {
            select: {
              dimensionScores: true,
              completionTimeSeconds: true,
            }
          }
        }
      });
      
      if (!experiment) {
        console.log(chalk.red('Experiment not found'));
        return;
      }
      
      console.log(chalk.blue.bold(`\n📊 Statistics for "${experiment.name}"\n`));
      console.log(chalk.white('Status:'), chalk.yellow(experiment.status));
      console.log(chalk.white('Mode:'), chalk.yellow(experiment.evaluationMode));
      console.log(chalk.white('Total Participants:'), chalk.yellow(experiment._count.participants));
      
      if (experiment.evaluationMode === 'single_video') {
        console.log(chalk.white('Total Video Tasks:'), chalk.yellow(experiment._count.videoTasks));
        console.log(chalk.white('Total Single Video Evaluations:'), chalk.yellow(experiment._count.singleVideoEvals));
        
        if (experiment._count.videoTasks > 0) {
          const avgEvaluationsPerTask = 
            experiment._count.singleVideoEvals / experiment._count.videoTasks;
          console.log(chalk.white('Avg Evaluations/Task:'), 
            chalk.yellow(avgEvaluationsPerTask.toFixed(2)));
        }
        
        if (experiment.singleVideoEvals.length > 0) {
          const avgCompletionTime = experiment.singleVideoEvals
            .filter(e => e.completionTimeSeconds)
            .reduce((sum, e) => sum + (e.completionTimeSeconds || 0), 0) / 
            experiment.singleVideoEvals.filter(e => e.completionTimeSeconds).length;
          
          console.log(chalk.white('Avg Completion Time:'), 
            chalk.yellow(`${(avgCompletionTime / 60).toFixed(1)} minutes`));
        }
      } else {
        console.log(chalk.white('Total Comparisons:'), chalk.yellow(experiment._count.comparisons));
        console.log(chalk.white('Total Evaluations:'), chalk.yellow(experiment._count.evaluations));
        
        if (experiment._count.comparisons > 0) {
          const avgEvaluationsPerComparison = 
            experiment._count.evaluations / experiment._count.comparisons;
          console.log(chalk.white('Avg Evaluations/Comparison:'), 
            chalk.yellow(avgEvaluationsPerComparison.toFixed(2)));
        }
        
        if (experiment.evaluations.length > 0) {
          const avgCompletionTime = experiment.evaluations
            .filter(e => e.completionTimeSeconds)
            .reduce((sum, e) => sum + (e.completionTimeSeconds || 0), 0) / 
            experiment.evaluations.filter(e => e.completionTimeSeconds).length;
          
          console.log(chalk.white('Avg Completion Time:'), 
            chalk.yellow(`${(avgCompletionTime / 60).toFixed(1)} minutes`));
        }
      }
        
      } catch (error) {
        console.error(chalk.red('Error getting stats:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true); // Require admin permissions
  });

// List video library command with enhanced filtering
program
  .command('list-videos')
  .description('List all videos in the video library')
  .option('--model <model>', 'Filter by model name')
  .option('--scenario <scenario>', 'Filter by scenario')
  .option('--tag <tag>', 'Filter by tag')
  .option('--group <group>', 'Filter by group')
  .action(async (options) => {
    await requireAuth('list videos', async () => {
      try {
        console.log(chalk.blue.bold('\n📹 Video Library\n'));
        
        // Use new videos API with metadata support
        let url = 'http://localhost:3000/api/videos';
        const params = new URLSearchParams();
        
        if (options.model) params.append('model', options.model);
        if (options.scenario) params.append('scenario', options.scenario);
        if (options.tag) params.append('tag', options.tag);
        if (options.group) params.append('group', options.group);
        
        if (params.toString()) {
          url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const videos = await response.json();
        
        if (videos.length === 0) {
          console.log(chalk.gray('No videos found in library.'));
          console.log(chalk.gray('Upload videos using: experiment-cli upload-videos --dir <directory>'));
          return;
        }
        
        console.log(chalk.white(`Found ${videos.length} videos:\n`));
        
        videos.forEach((video: any, index: number) => {
          console.log(chalk.white(`${index + 1}. ${video.name}`));
          console.log(chalk.gray(`   Uploaded: ${new Date(video.uploadedAt).toLocaleDateString()}`));
          console.log(chalk.gray(`   Size: ${(video.size / (1024 * 1024)).toFixed(1)} MB`));
          
          if (video.modelName) {
            console.log(chalk.cyan(`   Model: ${video.modelName}`));
          }
          if (video.scenarioId) {
            console.log(chalk.cyan(`   Scenario: ${video.scenarioId}`));
          }
          if (video.tags && video.tags.length > 0) {
            console.log(chalk.magenta(`   Tags: ${video.tags.join(', ')}`));
          }
          if (video.groups && video.groups.length > 0) {
            console.log(chalk.blue(`   Groups: ${video.groups.join(', ')}`));
          }
          
          console.log(chalk.gray(`   URL: ${video.url || video.path}\n`));
        });
        
      } catch (error) {
        console.error(chalk.red('Error listing videos:'), error);
      }
    }, true);
  });

// Bulk edit videos command
program
  .command('bulk-edit-videos')
  .description('Bulk edit video metadata')
  .option('--pattern <pattern>', 'File name pattern to match')
  .option('--model <model>', 'Filter by existing model name')
  .option('--scenario <scenario>', 'Filter by existing scenario')
  .option('--set-model <model>', 'Set model name')
  .option('--set-scenario <scenario>', 'Set scenario ID')
  .option('--add-tags <tags>', 'Add tags (comma-separated)')
  .option('--remove-tags <tags>', 'Remove tags (comma-separated)')
  .option('--add-groups <groups>', 'Add groups (comma-separated)')
  .option('--remove-groups <groups>', 'Remove groups (comma-separated)')
  .option('--operation <op>', 'Operation mode (add|replace|remove)', 'add')
  .action(async (options) => {
    await requireAuth('bulk edit videos', async () => {
      try {
        console.log(chalk.blue.bold('\n✏️  Bulk editing videos\n'));
        
        // Get videos to edit
        let url = 'http://localhost:3000/api/videos';
        const params = new URLSearchParams();
        
        if (options.model) params.append('model', options.model);
        if (options.scenario) params.append('scenario', options.scenario);
        
        if (params.toString()) {
          url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch videos: ${response.status}`);
        }
        
        let videos = await response.json();
        
        // Filter by pattern if provided
        if (options.pattern) {
          const pattern = new RegExp(options.pattern.replace(/\*/g, '.*'), 'i');
          videos = videos.filter((v: any) => pattern.test(v.name));
        }
        
        if (videos.length === 0) {
          console.log(chalk.yellow('No videos match the specified criteria.'));
          return;
        }
        
        console.log(chalk.white(`Found ${videos.length} videos to edit:\n`));
        videos.forEach((video: any, index: number) => {
          console.log(chalk.gray(`${index + 1}. ${video.name}`));
        });
        
        // Prepare bulk edit data
        const updates: any = {};
        const operation = options.operation;
        
        if (options.setModel) updates.modelName = options.setModel;
        if (options.setScenario) updates.scenarioId = options.setScenario;
        
        if (options.addTags) {
          updates.tags = {
            operation,
            values: options.addTags.split(',').map((t: string) => t.trim())
          };
        }
        
        if (options.removeTags) {
          updates.tags = {
            operation: 'remove',
            values: options.removeTags.split(',').map((t: string) => t.trim())
          };
        }
        
        if (options.addGroups) {
          updates.groups = {
            operation,
            values: options.addGroups.split(',').map((g: string) => g.trim())
          };
        }
        
        if (options.removeGroups) {
          updates.groups = {
            operation: 'remove',
            values: options.removeGroups.split(',').map((g: string) => g.trim())
          };
        }
        
        if (Object.keys(updates).length === 0) {
          console.log(chalk.yellow('No updates specified. Use --set-model, --add-tags, etc.'));
          return;
        }
        
        // Apply bulk edits
        const videoIds = videos.map((v: any) => v.id);
        const bulkEditResponse = await fetch('http://localhost:3000/api/videos/bulk-edit', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoIds,
            updates
          })
        });
        
        if (!bulkEditResponse.ok) {
          const error = await bulkEditResponse.json();
          throw new Error(error.error || 'Failed to bulk edit videos');
        }
        
        const result = await bulkEditResponse.json();
        console.log(chalk.green.bold(`\n✅ Updated ${result.updatedCount} videos successfully!`));
        
      } catch (error) {
        console.error(chalk.red('Error bulk editing videos:'), error);
      }
    }, true);
  });

// Create video tasks command
program
  .command('create-video-tasks')
  .description('Create video tasks for single video evaluation experiments')
  .option('-e, --experiment <slug>', 'Experiment slug')
  .option('--strategy <strategy>', 'Assignment strategy (auto|random|manual)', 'auto')
  .option('--seed <seed>', 'Random seed for reproducible assignment')
  .action(async (options) => {
    await requireAuth('create video tasks', async () => {
      try {
        console.log(chalk.blue.bold('\n🎬 Creating Video Tasks\n'));
        
        let experimentSlug = options.experiment;
        if (!experimentSlug) {
          const { question } = getReadline();
          experimentSlug = await question(chalk.cyan('Experiment slug: '));
        }
        
        // Get experiment
        const experiment = await prisma.experiment.findUnique({
          where: { slug: experimentSlug },
          include: { videoTasks: true }
        });
        
        if (!experiment) {
          console.log(chalk.red(`Experiment "${experimentSlug}" not found.`));
          return;
        }
        
        if (experiment.evaluationMode !== 'single_video') {
          console.log(chalk.red(`Experiment "${experimentSlug}" is not in single video mode.`));
          return;
        }
        
        // Get video library
        const response = await fetch('http://localhost:3000/api/videos');
        if (!response.ok) {
          throw new Error(`Failed to fetch video library: ${response.status}`);
        }
        const videos = await response.json();
        
        if (videos.length === 0) {
          console.log(chalk.red('No videos found in library.'));
          console.log(chalk.gray('Upload videos first using: experiment-cli upload-videos --dir <directory>'));
          return;
        }
        
        console.log(chalk.white(`Found experiment: ${experiment.name}`));
        console.log(chalk.white(`Available videos: ${videos.length}`));
        
        const config = experiment.config as any;
        const models = config?.models || [];
        const scenarios = config?.scenarios || [];
        
        const videoTasks: any[] = [];
        
        console.log(chalk.blue('\n🤖 Auto-creating video tasks based on metadata...\n'));
        
        for (const scenario of scenarios) {
          for (const model of models) {
            // Find video by metadata first, fallback to filename patterns
            let video = videos.find((v: any) => 
              v.modelName === model && v.scenarioId === scenario
            );
            
            // Fallback to filename patterns if metadata not available
            if (!video) {
              video = videos.find((v: any) => 
                v.name.toLowerCase().includes(scenario.toLowerCase()) && 
                v.name.toLowerCase().includes(model.toLowerCase())
              );
            }
            
            if (video) {
              videoTasks.push({
                experimentId: experiment.id,
                scenarioId: scenario,
                modelName: model,
                videoPath: video.url || video.path,
                videoId: video.id,
                metadata: {
                  videoName: video.name,
                  videoSize: video.size,
                  videoDuration: video.duration
                }
              });
              
              console.log(chalk.green(`✓ ${scenario}: ${model}`));
              console.log(chalk.gray(`  Video: ${video.name}\n`));
            } else {
              console.log(chalk.yellow(`⚠ ${scenario}: ${model} - video not found`));
            }
          }
        }
        
        if (videoTasks.length > 0) {
          // Create video tasks
          await prisma.videoTask.createMany({
            data: videoTasks
          });
          
          console.log(chalk.green.bold(`\n✅ Created ${videoTasks.length} video tasks!`));
          console.log(chalk.white('Tasks created for:'));
          videoTasks.forEach(task => {
            console.log(chalk.gray(`  - ${task.scenarioId}: ${task.modelName}`));
          });
        } else {
          console.log(chalk.red('\nNo matching videos found. Check your video metadata or filename patterns.'));
          console.log(chalk.gray('Expected: videos with modelName and scenarioId metadata, or pattern {scenario}_{model}.mp4'));
        }
        
      } catch (error) {
        console.error(chalk.red('Error creating video tasks:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true);
  });

// Bulk experiment creation command
program
  .command('create-bulk')
  .description('Create multiple experiments using matrix mode')
  .option('-m, --models <models>', 'Comma-separated list of models')
  .option('-s, --scenarios <scenarios>', 'Comma-separated list of scenarios')
  .option('-g, --group <group>', 'Experiment group for organization')
  .option('--mode <mode>', 'Evaluation mode (comparison|single_video)', 'comparison')
  .option('--strategy <strategy>', 'Video assignment strategy (auto|random|manual)', 'auto')
  .option('--seed <seed>', 'Random seed for reproducible assignment')
  .option('--randomize-order', 'Randomize comparison order')
  .option('--randomize-positions', 'Randomize model positions (A/B swapping)')
  .action(async (options) => {
    await requireAuth('create bulk experiments', async (auth) => {
      console.log(chalk.blue.bold('\n🧪 Creating bulk experiments with matrix mode\n'));
      
      try {
        const { question } = getReadline();
        
        // Get models and scenarios
        const modelsInput = options.models || await question(
          chalk.cyan('Models to compare (comma-separated): ')
        );
        const models = modelsInput.split(',').map((m: string) => m.trim());
        
        const scenariosInput = options.scenarios || await question(
          chalk.cyan('Scenarios (comma-separated): ')
        );
        const scenarios = scenariosInput.split(',').map((s: string) => s.trim());
        
        const group = options.group || await question(
          chalk.cyan('Experiment group (optional): ')
        );
        
        const evaluationMode = options.mode;
        const strategy = options.strategy;
        const seed = options.seed ? parseInt(options.seed) : undefined;
        
        // Call bulk creation API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/experiments/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            models,
            scenarios,
            group: group || null,
            evaluationMode,
            videoAssignmentStrategy: strategy,
            randomSeed: seed,
            randomizeOrder: options.randomizeOrder || false,
            randomizePositions: options.randomizePositions || false,
            createdBy: auth.userId
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create bulk experiments');
        }
        
        const result = await response.json();
        
        console.log(chalk.green.bold('\n✅ Bulk experiments created successfully!\n'));
        console.log(chalk.white('Created:'), chalk.yellow(`${result.experiments.length} experiments`));
        console.log(chalk.white('Mode:'), chalk.yellow(evaluationMode));
        
        if (evaluationMode === 'single_video') {
          console.log(chalk.white('Total video tasks:'), chalk.yellow(result.totalVideoTasks || 0));
        } else {
          console.log(chalk.white('Total comparisons:'), chalk.yellow(result.totalComparisons || 0));
        }
        
        if (result.videoAssignments) {
          console.log(chalk.white('Videos assigned:'), chalk.yellow(result.videoAssignments));
        }
        
        console.log(chalk.blue('\n📋 Created experiments:'));
        result.experiments.forEach((exp: any) => {
          console.log(chalk.white(`- ${exp.name} (${exp.slug})`));
        });
        
        if (result.warnings && result.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          result.warnings.forEach((warning: string) => {
            console.log(chalk.yellow(`- ${warning}`));
          });
        }
        
      } catch (error) {
        console.error(chalk.red('Error creating bulk experiments:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true); // Require admin permissions
  });

// Auto-assign videos to experiment
program
  .command('assign-videos')
  .description('Auto-assign videos from library to experiment comparisons')
  .option('-e, --experiment <slug>', 'Experiment slug')
  .option('--strategy <strategy>', 'Assignment strategy (auto|random|manual)', 'auto')
  .option('--seed <seed>', 'Random seed for reproducible assignment')
  .action(async (options) => {
    await requireAuth('assign videos', async () => {
      try {
        console.log(chalk.blue.bold('\n🎯 Assigning Videos to Experiment\n'));
        
        let experimentSlug = options.experiment;
        if (!experimentSlug) {
          const { question } = getReadline();
          experimentSlug = await question(chalk.cyan('Experiment slug: '));
        }
        
        // Get experiment
        const experiment = await prisma.experiment.findUnique({
          where: { slug: experimentSlug },
          include: { comparisons: true }
        });
        
        if (!experiment) {
          console.log(chalk.red(`Experiment "${experimentSlug}" not found.`));
          return;
        }
        
        // Get video library
        const response = await fetch('http://localhost:3000/api/video-library');
        if (!response.ok) {
          throw new Error(`Failed to fetch video library: ${response.status}`);
        }
        const videos = await response.json();
        
        if (videos.length === 0) {
          console.log(chalk.red('No videos found in library.'));
          console.log(chalk.gray('Upload videos first using: npm run upload-videos --dir <directory>'));
          return;
        }
        
        console.log(chalk.white(`Found experiment: ${experiment.name}`));
        console.log(chalk.white(`Available videos: ${videos.length}`));
        
        const strategy = options.strategy || 'auto';
        const seed = options.seed ? parseInt(options.seed) : undefined;
        
        if (strategy === 'auto') {
          // Auto-assign based on video metadata
          console.log(chalk.blue('\n🤖 Auto-assigning videos based on metadata...\n'));
          
          // Use new video library API that supports metadata
          const videoResponse = await fetch('http://localhost:3000/api/videos');
          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video library: ${videoResponse.status}`);
          }
          const videosWithMetadata = await videoResponse.json();
          
          const config = experiment.config as any;
          const models = config?.models || [];
          const scenarios = config?.scenarios || [];
          
          const comparisons: any[] = [];
          
          for (const scenario of scenarios) {
            for (let i = 0; i < models.length; i++) {
              for (let j = i + 1; j < models.length; j++) {
                const modelA = models[i];
                const modelB = models[j];
                
                // Find videos by metadata first, fallback to filename patterns
                let videoA = videosWithMetadata.find((v: any) => 
                  v.modelName === modelA && v.scenarioId === scenario
                );
                let videoB = videosWithMetadata.find((v: any) => 
                  v.modelName === modelB && v.scenarioId === scenario
                );
                
                // Fallback to filename patterns if metadata not available
                if (!videoA) {
                  videoA = videosWithMetadata.find((v: any) => 
                    v.name.toLowerCase().includes(scenario.toLowerCase()) && 
                    v.name.toLowerCase().includes(modelA.toLowerCase())
                  );
                }
                if (!videoB) {
                  videoB = videosWithMetadata.find((v: any) => 
                    v.name.toLowerCase().includes(scenario.toLowerCase()) && 
                    v.name.toLowerCase().includes(modelB.toLowerCase())
                  );
                }
                
                if (videoA && videoB) {
                  comparisons.push({
                    scenarioId: scenario,
                    modelA,
                    modelB,
                    videoAPath: videoA.url || videoA.path,
                    videoBPath: videoB.url || videoB.path,
                    metadata: {
                      videoAName: videoA.name,
                      videoBName: videoB.name,
                      videoAId: videoA.id,
                      videoBId: videoB.id
                    }
                  });
                  
                  console.log(chalk.green(`✓ ${scenario}: ${modelA} vs ${modelB}`));
                  console.log(chalk.gray(`  A: ${videoA.name}`));
                  console.log(chalk.gray(`  B: ${videoB.name}\n`));
                } else {
                  console.log(chalk.yellow(`⚠ ${scenario}: ${modelA} vs ${modelB} - videos not found`));
                }
              }
            }
          }
          
          if (comparisons.length > 0) {
            // Create comparisons
            await prisma.comparison.createMany({
              data: comparisons.map(comp => ({
                scenarioId: comp.scenarioId,
                modelA: comp.modelA,
                modelB: comp.modelB,
                videoAPath: comp.videoAPath,
                videoBPath: comp.videoBPath,
                metadata: comp.metadata,
                experimentId: experiment.id
              }))
            });
            
            console.log(chalk.green.bold(`\n✅ Created ${comparisons.length} comparisons!`));
          } else {
            console.log(chalk.red('\nNo matching videos found. Check your video metadata or filename patterns.'));
            console.log(chalk.gray('Expected: videos with modelName and scenarioId metadata, or pattern {scenario}_{model}.mp4'));
          }
          
        } else if (strategy === 'random') {
          console.log(chalk.blue('\n🎲 Random video assignment...\n'));
          
          // Get videos with metadata
          const videoResponse = await fetch('http://localhost:3000/api/videos');
          if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video library: ${videoResponse.status}`);
          }
          await videoResponse.json();
          
          if (seed) {
            console.log(chalk.gray(`Using random seed: ${seed}`));
          }
          
          // Implement random assignment logic here
          console.log(chalk.yellow('Random assignment implementation coming soon'));
          
        } else {
          // Interactive assignment
          console.log(chalk.blue('\n📋 Interactive video assignment (coming soon)'));
          console.log(chalk.gray('Use --strategy auto for automatic assignment based on metadata or filename patterns'));
        }
        
      } catch (error) {
        console.error(chalk.red('Error assigning videos:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true);
  });

// Logout command
program
  .command('logout')
  .description('Clear stored authentication')
  .action(async () => {
    await clearAuth();
  });

program.parse();