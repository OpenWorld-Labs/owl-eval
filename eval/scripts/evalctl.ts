#!/usr/bin/env tsx

import { Command } from 'commander';
import * as readline from 'readline';
import { promisify } from 'util';
import * as path from 'path';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables FIRST before any imports that use them
// The script runs from the frontend directory via the wrapper
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

import { generateSlug, isValidSlug, slugify } from '../frontend/src/lib/utils/slug';
import { requireAuth, clearAuth } from './auth';
import { prisma } from './prisma-client';
import { prolificService } from '../frontend/src/lib/services/prolific';
// Don't import ExperimentService - it uses frontend prisma client
// import { ExperimentService } from '../frontend/src/lib/experiment-service';
import { getUserOrganizations } from './cli-organization';

// Ensure DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error(chalk.red('❌ DATABASE_URL not found in environment variables'));
  console.error(chalk.yellow('💡 Make sure .env.development or .env.local contains DATABASE_URL'));
  process.exit(1);
}

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

// Helper function to select organization for CLI operations
async function selectOrganization(auth: any): Promise<string> {
  const userOrganizations = await getUserOrganizations(auth.id);
  
  if (userOrganizations.length === 0) {
    console.log(chalk.red('❌ No organizations found. You need to create or join an organization first.'));
    process.exit(1);
  }
  
  if (userOrganizations.length === 1) {
    const org = userOrganizations[0].organization;
    console.log(chalk.gray(`Using organization: ${chalk.cyan(org.name)} (${org.slug})`));
    return org.id;
  }
  
  // Multiple organizations - let user choose
  console.log(chalk.blue('\n📋 Select an organization:\n'));
  userOrganizations.forEach((membership, index) => {
    const org = membership.organization;
    console.log(chalk.white(`${index + 1}. ${org.name} (${org.slug}) - ${membership.role}`));
  });
  
  const { rl, question } = getReadline();
  const choice = await question(chalk.cyan('\nEnter organization number: '));
  const index = parseInt(choice) - 1;
  
  // Close readline interface
  rl.close();
  
  if (index < 0 || index >= userOrganizations.length) {
    console.log(chalk.red('❌ Invalid selection'));
    process.exit(1);
  }
  
  const selectedOrg = userOrganizations[index].organization;
  console.log(chalk.gray(`Selected: ${chalk.cyan(selectedOrg.name)}\n`));
  return selectedOrg.id;
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
      console.log(chalk.white('\nEvaluation URL:'), 
        chalk.blue.underline(`localhost:3000/evaluate/${experiment.slug}`));
      
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
  .description('List experiments in your organization')
  .option('-s, --status <status>', 'Filter by status (draft, active, completed, archived)')
  .option('-g, --group <group>', 'Filter by group')
  .option('--include-anonymous', 'Include anonymous participants in counts')
  .action(async (options) => {
    await requireAuth('list experiments', async (auth) => {
      try {
        const organizationId = await selectOrganization(auth);
        
        // Get experiments first to check which have Prolific integration
        const experimentsForFilter = await prisma.experiment.findMany({
          where: {
            organizationId,
            archived: false,
            ...(options.group && { group: options.group }),
          },
          select: {
            id: true,
            prolificStudyId: true
          }
        });
        
        // Build participant filter based on includeAnonymous setting and Prolific integration
        // For Prolific experiments, only count approved participants
        // For non-Prolific experiments, count active/completed/approved participants
        const participantFilter = options.includeAnonymous ? {
          AND: [
            {
              OR: experimentsForFilter.map(exp => ({
                AND: [
                  { experimentId: exp.id },
                  {
                    status: {
                      in: exp.prolificStudyId ? ['approved'] : ['active', 'completed', 'approved']
                    }
                  }
                ]
              }))
            },
            {
              OR: [
                { prolificId: { not: null } },  // Prolific participants
                { sessionId: { startsWith: 'anon-session-' } }  // Anonymous participants
              ]
            }
          ]
        } : {
          AND: [
            {
              id: {
                not: {
                  startsWith: 'anon-session-'
                }
              }
            },
            {
              OR: experimentsForFilter.map(exp => ({
                AND: [
                  { experimentId: exp.id },
                  {
                    status: {
                      in: exp.prolificStudyId ? ['approved'] : ['active', 'completed', 'approved']
                    }
                  }
                ]
              }))
            },
            {
              prolificId: { not: null }  // Only Prolific participants, exclude anonymous
            }
          ]
        };
        
        const experiments = await prisma.experiment.findMany({
          where: {
            organizationId,
            archived: false,
            ...(options.group && { group: options.group }),
          },
          include: {
            _count: {
              select: {
                twoVideoComparisonTasks: true,
                singleVideoEvaluationTasks: true,
                participants: {
                  where: participantFilter
                },
                twoVideoComparisonSubmissions: true,
                singleVideoEvaluationSubmissions: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
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
            console.log(chalk.gray(`  Single Video Tasks: ${exp._count.singleVideoEvaluationTasks}`));
            console.log(chalk.gray(`  Single Video Submissions: ${exp._count.singleVideoEvaluationSubmissions}`));
          } else {
            console.log(chalk.gray(`  Two Video Comparison Tasks: ${exp._count.twoVideoComparisonTasks}`));
            console.log(chalk.gray(`  Two Video Comparison Submissions: ${exp._count.twoVideoComparisonSubmissions}`));
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
      }
    });
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
                twoVideoComparisonTasks: true
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
        // First get experiment to check if it has Prolific integration
        const baseExperiment = await prisma.experiment.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            status: true,
            evaluationMode: true,
            prolificStudyId: true,
            config: true,
            createdAt: true,
            startedAt: true,
            completedAt: true
          }
        });
        
        if (!baseExperiment) {
          console.log(chalk.red('Experiment not found'));
          return;
        }
        
        // Determine participant status filter based on Prolific integration
        const participantStatusFilter = baseExperiment.prolificStudyId 
          ? ['approved']  // For Prolific experiments, only count approved
          : ['active', 'completed', 'approved'];  // For non-Prolific experiments, count all valid statuses
        
        const experiment = await prisma.experiment.findUnique({
        where: { slug },
        include: {
          _count: {
            select: {
              twoVideoComparisonTasks: true,
              singleVideoEvaluationTasks: true,
              participants: {
                where: {
                  AND: [
                    {
                      status: {
                        in: participantStatusFilter
                      }
                    },
                    {
                      prolificId: { not: null }  // Only Prolific participants, exclude anonymous
                    }
                  ]
                }
              },
              twoVideoComparisonSubmissions: true,
              singleVideoEvaluationSubmissions: true,
            }
          },
          twoVideoComparisonSubmissions: {
            select: {
              dimensionScores: true,
              completionTimeSeconds: true,
            }
          },
          singleVideoEvaluationSubmissions: {
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
        console.log(chalk.white('Total Single Video Tasks:'), chalk.yellow(experiment._count.singleVideoEvaluationTasks));
        console.log(chalk.white('Total Single Video Submissions:'), chalk.yellow(experiment._count.singleVideoEvaluationSubmissions));
        
        if (experiment._count.singleVideoEvaluationTasks > 0) {
          const avgEvaluationsPerTask = 
            experiment._count.singleVideoEvaluationSubmissions / experiment._count.singleVideoEvaluationTasks;
          console.log(chalk.white('Avg Evaluations/Task:'), 
            chalk.yellow(avgEvaluationsPerTask.toFixed(2)));
        }
        
        if (experiment.singleVideoEvaluationSubmissions.length > 0) {
          const avgCompletionTime = experiment.singleVideoEvaluationSubmissions
            .filter(e => e.completionTimeSeconds)
            .reduce((sum, e) => sum + (e.completionTimeSeconds || 0), 0) / 
            experiment.singleVideoEvaluationSubmissions.filter(e => e.completionTimeSeconds).length;
          
          console.log(chalk.white('Avg Completion Time:'), 
            chalk.yellow(`${(avgCompletionTime / 60).toFixed(1)} minutes`));
        }
      } else {
        console.log(chalk.white('Total Two Video Comparison Tasks:'), chalk.yellow(experiment._count.twoVideoComparisonTasks));
        console.log(chalk.white('Total Two Video Comparison Submissions:'), chalk.yellow(experiment._count.twoVideoComparisonSubmissions));
        
        if (experiment._count.twoVideoComparisonTasks > 0) {
          const avgEvaluationsPerComparison = 
            experiment._count.twoVideoComparisonSubmissions / experiment._count.twoVideoComparisonTasks;
          console.log(chalk.white('Avg Evaluations/Comparison:'), 
            chalk.yellow(avgEvaluationsPerComparison.toFixed(2)));
        }
        
        if (experiment.twoVideoComparisonSubmissions.length > 0) {
          const avgCompletionTime = experiment.twoVideoComparisonSubmissions
            .filter(e => e.completionTimeSeconds)
            .reduce((sum, e) => sum + (e.completionTimeSeconds || 0), 0) / 
            experiment.twoVideoComparisonSubmissions.filter(e => e.completionTimeSeconds).length;
          
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
        console.log(chalk.blue.bold('\n🎬 Creating Single Video Evaluation Tasks\n'));
        
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

// Prolific Commands
program
  .command('prolific:create')
  .description('Create a Prolific study for an experiment')
  .option('-e, --experiment <slug>', 'Experiment slug')
  .option('-t, --title <title>', 'Study title')
  .option('-d, --description <description>', 'Study description')
  .option('-r, --reward <amount>', 'Reward amount in USD', '8.00')
  .option('-p, --participants <count>', 'Number of participants', '50')
  .action(async (options) => {
    await requireAuth('create Prolific studies', async () => {
      try {
        console.log(chalk.blue.bold('\n🌍 Creating Prolific Study\n'));
        
        const { question } = getReadline();
        
        // Get experiment
        let experimentSlug = options.experiment;
        if (!experimentSlug) {
          experimentSlug = await question(chalk.cyan('Experiment slug: '));
        }
        
        const experiment = await prisma.experiment.findUnique({
          where: { slug: experimentSlug },
          include: {
            _count: { select: { twoVideoComparisonTasks: true } }
          }
        });
        
        if (!experiment) {
          console.log(chalk.red(`Experiment "${experimentSlug}" not found.`));
          return;
        }
        
        if (experiment.prolificStudyId) {
          console.log(chalk.yellow(`Experiment already has a Prolific study: ${experiment.prolificStudyId}`));
          const proceed = await question(chalk.cyan('Create another study? (y/N): '));
          if (proceed.toLowerCase() !== 'y') {
            return;
          }
        }
        
        // Get study details
        const title = options.title || await question(
          chalk.cyan(`Study title (${chalk.gray(`Evaluate ${experiment.name}`)}): `)
        ) || `Evaluate ${experiment.name}`;
        
        const description = options.description || await question(
          chalk.cyan(`Description (${chalk.gray('Help us evaluate AI model outputs')}): `)
        ) || `Help us evaluate AI model outputs for ${experiment.name}`;
        
        const reward = parseFloat(options.reward);
        const totalParticipants = parseInt(options.participants);
        
        console.log(chalk.gray('\n📊 Study Summary:'));
        console.log(chalk.gray(`  Experiment: ${experiment.name} (${experimentSlug})`));
        console.log(chalk.gray(`  Two Video Comparison Tasks: ${experiment._count.twoVideoComparisonTasks}`));
        console.log(chalk.gray(`  Estimated time: ~${Math.ceil(experiment._count.twoVideoComparisonTasks * 2)} minutes`));
        console.log(chalk.gray(`  Reward: $${reward.toFixed(2)}`));
        console.log(chalk.gray(`  Participants: ${totalParticipants}`));
        console.log(chalk.gray(`  Total cost: ~$${(reward * totalParticipants).toFixed(2)} (+ Prolific fees)`));
        
        const confirm = await question(chalk.cyan('\nCreate study? (Y/n): '));
        if (confirm.toLowerCase() === 'n') {
          console.log(chalk.gray('Study creation cancelled.'));
          return;
        }
        
        console.log(chalk.yellow('\n🔄 Creating study on Prolific...'));
        
        const prolificStudy = await prolificService.instance.instance.createStudy({
          experimentId: experiment.id,
          title,
          description,
          reward,
          totalParticipants
        });
        
        console.log(chalk.green.bold('\n✅ Prolific study created successfully!\n'));
        console.log(chalk.white('Study ID:'), chalk.yellow(prolificStudy.id));
        console.log(chalk.white('Status:'), chalk.yellow(prolificStudy.status));
        console.log(chalk.white('External URL:'), chalk.blue.underline(prolificStudy.external_study_url));
        console.log(chalk.white('Prolific Dashboard:'), 
          chalk.blue.underline(`https://app.prolific.co/researcher/studies/${prolificStudy.id}`));
        
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray(`1. Review study on Prolific dashboard`));
        console.log(chalk.gray(`2. Publish study: experiment-cli prolific:publish --study ${prolificStudy.id}`));
        console.log(chalk.gray(`3. Monitor progress: experiment-cli prolific:status --study ${prolificStudy.id}`));
        
      } catch (error) {
        console.error(chalk.red('Error creating Prolific study:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true);
  });

program
  .command('prolific:list')
  .description('List all Prolific studies')
  .action(async () => {
    await requireAuth('list Prolific studies', async () => {
      try {
        console.log(chalk.blue.bold('\n🌍 Prolific Studies\n'));
        
        const experiments = await prisma.experiment.findMany({
          where: {
            prolificStudyId: { not: null }
          },
          select: {
            id: true,
            name: true,
            prolificStudyId: true,
            status: true,
            createdAt: true,
            _count: {
              select: {
                participants: {
                  where: {
                    id: {
                      not: {
                        startsWith: 'anon-session-'
                      }
                    }
                  }
                },
                twoVideoComparisonSubmissions: true,
                twoVideoComparisonTasks: true
              }
            }
          }
        });
        
        if (experiments.length === 0) {
          console.log(chalk.gray('No experiments with Prolific studies found.'));
          return;
        }
        
        console.log(chalk.yellow('🔄 Fetching study details from Prolific...'));
        
        for (const exp of experiments) {
          try {
            const study = await prolificService.instance.getStudy(exp.prolificStudyId!);
            
            const statusColor = {
              'UNPUBLISHED': 'gray',
              'ACTIVE': 'green',
              'PAUSED': 'yellow',
              'COMPLETED': 'blue',
              'AWAITING_REVIEW': 'cyan'
            }[study.status] || 'white';
            
            console.log(chalk.bold.white(`${exp.name}`));
            console.log(chalk.gray(`  Experiment ID: ${exp.id}`));
            console.log(chalk.gray(`  Study ID: ${exp.prolificStudyId}`));
            console.log(chalk[statusColor](`  Status: ${study.status}`));
            console.log(chalk.gray(`  Participants: ${study.number_of_submissions}/${study.total_available_places}`));
            console.log(chalk.gray(`  Reward: $${(study.reward / 100).toFixed(2)}`));
            console.log(chalk.gray(`  Created: ${new Date(study.date_created).toLocaleDateString()}`));
            console.log(chalk.blue.underline(`  Dashboard: https://app.prolific.co/researcher/studies/${exp.prolificStudyId}`));
            console.log();
          } catch (error) {
            console.log(chalk.bold.white(`${exp.name}`));
            console.log(chalk.red(`  Error: Failed to fetch study details`));
            console.log(chalk.gray(`  Study ID: ${exp.prolificStudyId}`));
            console.log();
          }
        }
        
      } catch (error) {
        console.error(chalk.red('Error listing Prolific studies:'), error);
      } finally {
        await prisma.$disconnect();
      }
    });
  });

program
  .command('prolific:status')
  .description('Get status of a Prolific study')
  .option('-s, --study <studyId>', 'Prolific study ID')
  .action(async (options) => {
    await requireAuth('check Prolific study status', async () => {
      try {
        const { question } = getReadline();
        
        let studyId = options.study;
        if (!studyId) {
          studyId = await question(chalk.cyan('Prolific study ID: '));
        }
        
        console.log(chalk.yellow('🔄 Fetching study status...'));
        
        const study = await prolificService.instance.getStudy(studyId);
        const submissions = await prolificService.instance.getSubmissions(studyId);
        
        const statusColor = {
          'UNPUBLISHED': 'gray',
          'ACTIVE': 'green',
          'PAUSED': 'yellow',
          'COMPLETED': 'blue',
          'AWAITING_REVIEW': 'cyan'
        }[study.status] || 'white';
        
        console.log(chalk.blue.bold('\n📊 Study Status\n'));
        console.log(chalk.white('Study ID:'), chalk.yellow(studyId));
        console.log(chalk.white('Name:'), chalk.white(study.name));
        console.log(chalk.white('Status:'), chalk[statusColor](study.status));
        console.log(chalk.white('Participants:'), chalk.yellow(`${study.number_of_submissions}/${study.total_available_places}`));
        console.log(chalk.white('Reward:'), chalk.green(`$${(study.reward / 100).toFixed(2)}`));
        console.log(chalk.white('Created:'), chalk.gray(new Date(study.date_created).toLocaleDateString()));
        
        if (submissions.results.length > 0) {
          console.log(chalk.blue('\n📋 Submissions:'));
          const submissionCounts = submissions.results.reduce((acc, sub) => {
            acc[sub.status] = (acc[sub.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          Object.entries(submissionCounts).forEach(([status, count]) => {
            const color = {
              'ACTIVE': 'yellow',
              'AWAITING_REVIEW': 'cyan',
              'APPROVED': 'green',
              'REJECTED': 'red',
              'RETURNED': 'gray'
            }[status] || 'white';
            console.log(chalk[color](`  ${status}: ${count}`));
          });
        }
        
        console.log(chalk.blue.underline(`\nProlific Dashboard: https://app.prolific.co/researcher/studies/${studyId}`));
        
      } catch (error) {
        console.error(chalk.red('Error fetching study status:'), error);
      } finally {
        if (rl) {
          rl.close();
        }
        await prisma.$disconnect();
      }
    });
  });

program
  .command('prolific:publish')
  .description('Publish a Prolific study')
  .option('-s, --study <studyId>', 'Prolific study ID')
  .action(async (options) => {
    await requireAuth('publish Prolific studies', async () => {
      try {
        const { question } = getReadline();
        
        let studyId = options.study;
        if (!studyId) {
          studyId = await question(chalk.cyan('Prolific study ID to publish: '));
        }
        
        // Get current status
        const study = await prolificService.instance.getStudy(studyId);
        
        if (study.status !== 'UNPUBLISHED') {
          console.log(chalk.yellow(`Study is already ${study.status.toLowerCase()}. Cannot publish.`));
          return;
        }
        
        console.log(chalk.gray('\n📊 Study to publish:'));
        console.log(chalk.gray(`  Name: ${study.name}`));
        console.log(chalk.gray(`  Participants: ${study.total_available_places}`));
        console.log(chalk.gray(`  Reward: $${(study.reward / 100).toFixed(2)}`));
        console.log(chalk.gray(`  Total cost: ~$${((study.reward / 100) * study.total_available_places).toFixed(2)} (+ Prolific fees)`));
        
        const confirm = await question(chalk.cyan('\nPublish study? (Y/n): '));
        if (confirm.toLowerCase() === 'n') {
          console.log(chalk.gray('Study publication cancelled.'));
          return;
        }
        
        console.log(chalk.yellow('🔄 Publishing study...'));
        
        // Make API call directly to avoid frontend prisma issues
        const response = await fetch(`https://api.prolific.com/api/v1/studies/${studyId}/transition/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.PROLIFIC_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'PUBLISH' })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Prolific API error (${response.status}): ${JSON.stringify(error)}`);
        }
        
        const updatedStudy = await response.json();
        
        console.log(chalk.green.bold('\n✅ Study published successfully!'));
        console.log(chalk.white('Status:'), chalk.green(updatedStudy.status));
        console.log(chalk.blue.underline(`Dashboard: https://app.prolific.co/researcher/studies/${studyId}`));
        
      } catch (error) {
        console.error(chalk.red('Error publishing study:'), error);
      } finally {
        if (rl) {
          rl.close();
        }
        await prisma.$disconnect();
      }
    }, true);
  });

program
  .command('prolific:start')
  .description('Start a paused Prolific study')
  .option('-s, --study <studyId>', 'Prolific study ID')
  .action(async (options) => {
    await requireAuth('start Prolific study', async () => {
      try {
        const { question } = getReadline();
        
        let studyId = options.study;
        if (!studyId) {
          studyId = await question(chalk.cyan('Prolific study ID to start: '));
        }
        
        console.log(chalk.yellow('🔄 Starting study...'));
        
        // Make API call directly to avoid frontend prisma issues
        const response = await fetch(`https://api.prolific.com/api/v1/studies/${studyId}/transition/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.PROLIFIC_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'START' })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Prolific API error (${response.status}): ${JSON.stringify(error)}`);
        }
        
        const updatedStudy = await response.json();
        
        console.log(chalk.green.bold('\n✅ Study started successfully!'));
        console.log(chalk.white('Status:'), chalk.green(updatedStudy.status));
        console.log(chalk.blue.underline(`Dashboard: https://app.prolific.co/researcher/studies/${studyId}`));
        
      } catch (error) {
        console.error(chalk.red('Error starting study:'), error);
      } finally {
        if (rl) {
          rl.close();
        }
        await prisma.$disconnect();
      }
    }, true);
  });

program
  .command('prolific:pause')
  .description('Pause a running Prolific study')
  .option('-s, --study <studyId>', 'Prolific study ID')
  .action(async (options) => {
    await requireAuth('pause Prolific study', async () => {
      try {
        const { question } = getReadline();
        
        let studyId = options.study;
        if (!studyId) {
          studyId = await question(chalk.cyan('Prolific study ID to pause: '));
        }
        
        console.log(chalk.yellow('🔄 Pausing study...'));
        
        // Make API call directly to avoid frontend prisma issues
        const response = await fetch(`https://api.prolific.com/api/v1/studies/${studyId}/transition/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.PROLIFIC_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'PAUSE' })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Prolific API error (${response.status}): ${JSON.stringify(error)}`);
        }
        
        const updatedStudy = await response.json();
        
        console.log(chalk.green.bold('\n✅ Study paused successfully!'));
        console.log(chalk.white('Status:'), chalk.green(updatedStudy.status));
        console.log(chalk.blue.underline(`Dashboard: https://app.prolific.co/researcher/studies/${studyId}`));
        
      } catch (error) {
        console.error(chalk.red('Error pausing study:'), error);
      } finally {
        if (rl) {
          rl.close();
        }
        await prisma.$disconnect();
      }
    }, true);
  });

program
  .command('prolific:stop')
  .description('Stop a Prolific study (cannot be restarted)')
  .option('-s, --study <studyId>', 'Prolific study ID')
  .action(async (options) => {
    await requireAuth('stop Prolific study', async () => {
      try {
        const { question } = getReadline();
        
        let studyId = options.study;
        if (!studyId) {
          studyId = await question(chalk.cyan('Prolific study ID to stop: '));
        }
        
        const confirm = await question(chalk.red('⚠️  Stopping a study is permanent. Continue? (y/N): '));
        if (confirm.toLowerCase() !== 'y') {
          console.log(chalk.gray('Study stop cancelled.'));
          return;
        }
        
        console.log(chalk.yellow('🔄 Stopping study...'));
        
        // Make API call directly to avoid frontend prisma issues
        const response = await fetch(`https://api.prolific.com/api/v1/studies/${studyId}/transition/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.PROLIFIC_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'STOP' })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Prolific API error (${response.status}): ${JSON.stringify(error)}`);
        }
        
        const updatedStudy = await response.json();
        
        console.log(chalk.green.bold('\n✅ Study stopped successfully!'));
        console.log(chalk.white('Status:'), chalk.green(updatedStudy.status));
        console.log(chalk.blue.underline(`Dashboard: https://app.prolific.co/researcher/studies/${studyId}`));
        
      } catch (error) {
        console.error(chalk.red('Error stopping study:'), error);
      } finally {
        if (rl) {
          rl.close();
        }
        await prisma.$disconnect();
      }
    }, true);
  });

program
  .command('prolific:sync')
  .description('Sync Prolific study data with database including participant demographics')
  .option('-s, --study <studyId>', 'Prolific study ID')
  .option('--all', 'Sync all studies')
  .action(async (options) => {
    await requireAuth('sync Prolific data', async () => {
      try {
        if (options.all) {
          console.log(chalk.blue.bold('\n🔄 Syncing All Prolific Studies\n'));
          
          const experiments = await prisma.experiment.findMany({
            where: {
              prolificStudyId: { not: null }
            },
            select: {
              id: true,
              name: true,
              prolificStudyId: true,
              status: true,
              createdAt: true,
              _count: {
                select: {
                  participants: {
                    where: {
                      id: {
                        not: {
                          startsWith: 'anon-session-'
                        }
                      }
                    }
                  },
                  twoVideoComparisonSubmissions: true,
                  twoVideoComparisonTasks: true
                }
              }
            }
          });
          
          if (experiments.length === 0) {
            console.log(chalk.gray('No experiments with Prolific studies found.'));
            return;
          }
          
          let totalSynced = 0;
          
          for (const exp of experiments) {
            try {
              console.log(chalk.yellow(`📡 Syncing ${exp.name} (${exp.prolificStudyId})...`));
              
              const result = await prolificService.instance.syncStudyWithDatabase(exp.prolificStudyId!);
              
              console.log(chalk.green(`  ✅ Synced ${result.syncedParticipants} participants`));
              console.log(chalk.gray(`  📊 Study status: ${result.study.status}`));
              console.log(chalk.gray(`  👥 Submissions: ${result.submissions.length}`));
              
              totalSynced += result.syncedParticipants;
              
            } catch (error) {
              console.log(chalk.red(`  ❌ Failed to sync ${exp.name}: ${error}`));
            }
          }
          
          console.log(chalk.green.bold(`\n✅ Sync complete! Total participants synced: ${totalSynced}`));
          
        } else {
          const { question } = getReadline();
          
          let studyId = options.study;
          if (!studyId) {
            studyId = await question(chalk.cyan('Prolific study ID to sync: '));
          }
          
          console.log(chalk.blue.bold('\n🔄 Syncing Prolific Study\n'));
          console.log(chalk.yellow(`📡 Syncing study ${studyId}...`));
          
          const result = await prolificService.instance.syncStudyWithDatabase(studyId);
          
          console.log(chalk.green.bold('\n✅ Sync complete!\n'));
          console.log(chalk.white('Study:'), chalk.yellow(result.study.name));
          console.log(chalk.white('Status:'), chalk.yellow(result.study.status));
          console.log(chalk.white('Participants synced:'), chalk.green(result.syncedParticipants));
          console.log(chalk.white('Total submissions:'), chalk.yellow(result.submissions.length));
          
          // Show demographic summary from synced participants
          console.log(chalk.blue('\n📊 Participant Summary:'));
          console.log(chalk.gray(`  Total submissions: ${result.submissions.length}`));
          
          // Find the experiment for this study
          const experiment = await prisma.experiment.findFirst({
            where: { prolificStudyId: studyId }
          });
          
          // Get detailed participant data from database
          const syncedParticipants = experiment ? await prisma.participant.findMany({
            where: { 
              experimentId: experiment.id
            },
            select: { metadata: true, prolificId: true }
          }).then(participants => participants.filter(p => p.prolificId)) : [];
          
          if (syncedParticipants.length > 0) {
            console.log(chalk.gray(`  Synced with demographics: ${syncedParticipants.length}`));
            
            // Extract demographics from metadata
            const demographics = syncedParticipants
              .map(p => p.metadata as any)
              .filter(m => m && (m.age || m.sex || m.nationality));
            
            if (demographics.length > 0) {
              console.log(chalk.blue('\n📈 Demographics Summary:'));
              
              // Age distribution
              const ages = demographics.filter(d => d.age).map(d => Number(d.age));
              if (ages.length > 0) {
                const avgAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
                console.log(chalk.gray(`  Age: ${Math.min(...ages)}-${Math.max(...ages)} (avg: ${avgAge})`));
              }
              
              // Gender distribution
              const genders = demographics.filter(d => d.sex).reduce((acc, d) => {
                acc[d.sex] = (acc[d.sex] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              if (Object.keys(genders).length > 0) {
                const genderStr = Object.entries(genders)
                  .map(([gender, count]) => `${gender}: ${count}`)
                  .join(', ');
                console.log(chalk.gray(`  Gender: ${genderStr}`));
              }
              
              // Top nationalities
              const nationalities = demographics.filter(d => d.nationality).reduce((acc, d) => {
                acc[d.nationality] = (acc[d.nationality] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              if (Object.keys(nationalities).length > 0) {
                const topNationalities = Object.entries(nationalities)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .slice(0, 3)
                  .map(([nat, count]) => `${nat}: ${count}`)
                  .join(', ');
                console.log(chalk.gray(`  Top nationalities: ${topNationalities}`));
              }
            }
          }
        }
        
      } catch (error) {
        console.error(chalk.red('Error syncing Prolific data:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true);
  });

// Debug command
program
  .command('debug:progress <slug>')
  .description('Debug progress calculation for an experiment')
  .action(async (slug) => {
    try {
      // First get experiment to check if it has Prolific integration
      const baseExperiment = await prisma.experiment.findUnique({
        where: { slug },
        select: {
          prolificStudyId: true
        }
      });
      
      if (!baseExperiment) {
        console.log(chalk.red(`Experiment "${slug}" not found.`));
        return;
      }
      
      // Determine participant status filter based on Prolific integration
      const participantStatusFilter = baseExperiment.prolificStudyId 
        ? ['approved']  // For Prolific experiments, only count approved
        : ['active', 'completed', 'approved'];  // For non-Prolific experiments, count all valid statuses
      
      const experiment = await prisma.experiment.findUnique({
        where: { slug },
        include: {
          _count: {
            select: {
              twoVideoComparisonTasks: true,
              participants: {
                where: {
                  AND: [
                    {
                      status: {
                        in: participantStatusFilter
                      }
                    },
                    {
                      prolificId: { not: null }  // Only Prolific participants, exclude anonymous
                    }
                  ]
                }
              },
              twoVideoComparisonSubmissions: true
            }
          }
        }
      });
      
      if (!experiment) {
        console.log(chalk.red(`Experiment "${slug}" not found.`));
        return;
      }
      
      console.log(chalk.blue.bold('\n🔍 Progress Debug for "' + experiment.name + '"\n'));
      
      console.log(chalk.white('Database Counts:'));
      console.log(chalk.gray(`  Two Video Comparison Tasks: ${experiment._count.twoVideoComparisonTasks}`));
      console.log(chalk.gray(`  Participants: ${experiment._count.participants}`));
      console.log(chalk.gray(`  Two Video Comparison Submissions: ${experiment._count.twoVideoComparisonSubmissions}`));
      
      console.log(chalk.white('\nExperiment Config:'));
      console.log(chalk.gray(JSON.stringify(experiment.config, null, 2)));
      
      // Calculate progress the same way the frontend does
      const evaluationsPerComparison = experiment.config?.evaluationsPerComparison || 5;
      const targetEvaluations = experiment._count.twoVideoComparisonTasks * evaluationsPerComparison;
      const progressPercentage = Math.min((experiment._count.twoVideoComparisonSubmissions / targetEvaluations) * 100, 100);
      
      console.log(chalk.white('\nProgress Calculation:'));
      console.log(chalk.gray(`  evaluationsPerComparison from config: ${experiment.config?.evaluationsPerComparison}`));
      console.log(chalk.gray(`  evaluationsPerComparison used: ${evaluationsPerComparison}`));
      console.log(chalk.gray(`  targetEvaluations: ${experiment._count.twoVideoComparisonTasks} × ${evaluationsPerComparison} = ${targetEvaluations}`));
      console.log(chalk.gray(`  actual evaluations: ${experiment._count.twoVideoComparisonSubmissions}`));
      console.log(chalk.yellow(`  progressPercentage: ${experiment._count.twoVideoComparisonSubmissions}/${targetEvaluations} = ${Math.round(progressPercentage)}%`));
      
      if (progressPercentage !== 100 && experiment._count.twoVideoComparisonSubmissions > 0) {
        console.log(chalk.red('\n⚠️  Progress is not 100%. Possible issues:'));
        if (!experiment.config?.evaluationsPerComparison) {
          console.log(chalk.red('  - Missing evaluationsPerComparison in config (defaulting to 5)'));
          
          // Auto-fix suggestion
          if (experiment._count.twoVideoComparisonTasks > 0) {
            const actualEvaluationsPerComparison = Math.round(experiment._count.twoVideoComparisonSubmissions / experiment._count.twoVideoComparisonTasks);
            console.log(chalk.yellow(`\n💡 Auto-fix suggestion:`));
            console.log(chalk.yellow(`  Based on current data, this experiment appears to need ${actualEvaluationsPerComparison} evaluations per comparison`));
            console.log(chalk.yellow(`  Run: npm run experiment -- fix-config ${slug} --evaluations-per-comparison ${actualEvaluationsPerComparison}`));
          }
        }
        if (experiment._count.twoVideoComparisonSubmissions < targetEvaluations) {
          console.log(chalk.red(`  - Need ${targetEvaluations - experiment._count.twoVideoComparisonSubmissions} more evaluations`));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Error debugging experiment:'), error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Debug participants command
program
  .command('debug:participants <slug>')
  .description('Show detailed participant information for an experiment')
  .action(async (slug) => {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { slug },
        include: {
          participants: {
            select: {
              id: true,
              prolificId: true,
              prolificSubmissionId: true,
              status: true,
              startedAt: true,
              completedAt: true,
              metadata: true
            }
          }
        }
      });
      
      if (!experiment) {
        console.log(chalk.red(`Experiment "${slug}" not found.`));
        return;
      }
      
      console.log(chalk.blue.bold('\n🔍 Participant Debug for "' + experiment.name + '"\n'));
      
      console.log(chalk.white(`Total participants: ${experiment.participants.length}\n`));
      
      experiment.participants.forEach((participant, index) => {
        console.log(chalk.yellow(`Participant ${index + 1}:`));
        console.log(chalk.gray(`  ID: ${participant.id}`));
        console.log(chalk.gray(`  Prolific ID: ${participant.prolificId || 'null'}`));
        console.log(chalk.gray(`  Submission ID: ${participant.prolificSubmissionId || 'null'}`));
        console.log(chalk.gray(`  Status: ${participant.status}`));
        console.log(chalk.gray(`  Started: ${participant.startedAt}`));
        console.log(chalk.gray(`  Completed: ${participant.completedAt || 'null'}`));
        
        if (participant.metadata) {
          const metadata = participant.metadata as any;
          if (metadata.submissionStatus) {
            console.log(chalk.gray(`  Prolific Status: ${metadata.submissionStatus}`));
          }
          if (metadata.demographics) {
            console.log(chalk.gray(`  Demographics: ${JSON.stringify(metadata.demographics)}`));
          }
        }
        console.log();
      });
      
      // Count by status
      const statusCounts = experiment.participants.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(chalk.white('Status breakdown:'));
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(chalk.gray(`  ${status}: ${count}`));
      });
      
      // Show filtered count (what the CLI would count)
      const participantStatusFilter = experiment.prolificStudyId 
        ? ['approved']  // For Prolific experiments, only count approved
        : ['active', 'completed', 'approved'];  // For non-Prolific experiments, count all valid statuses
        
      const validParticipants = experiment.participants.filter(p => 
        participantStatusFilter.includes(p.status) && p.prolificId
      );
      
      console.log(chalk.cyan(`\nFiltered count (${participantStatusFilter.join('/')} with prolificId): ${validParticipants.length}`));
      
    } catch (error) {
      console.error(chalk.red('Error debugging participants:'), error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Debug submissions command
program
  .command('debug:submissions <slug>')
  .description('Show detailed submission information for an experiment')
  .action(async (slug) => {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { slug },
        include: {
          singleVideoEvaluationSubmissions: {
            include: {
              participant: {
                select: {
                  id: true,
                  prolificId: true,
                  status: true
                }
              },
              singleVideoEvaluationTask: {
                select: {
                  id: true,
                  scenarioId: true,
                  modelName: true
                }
              }
            }
          },
          singleVideoEvaluationTasks: {
            select: {
              id: true,
              scenarioId: true,
              modelName: true,
              videoPath: true
            }
          }
        }
      });
      
      if (!experiment) {
        console.log(chalk.red(`Experiment "${slug}" not found.`));
        return;
      }
      
      console.log(chalk.blue.bold('\n🔍 Submissions Debug for "' + experiment.name + '"\n'));
      
      console.log(chalk.white(`Tasks: ${experiment.singleVideoEvaluationTasks.length}`));
      experiment.singleVideoEvaluationTasks.forEach((task, index) => {
        console.log(chalk.gray(`  Task ${index + 1}: ${task.scenarioId} - ${task.modelName}`));
      });
      
      console.log(chalk.white(`\nSubmissions: ${experiment.singleVideoEvaluationSubmissions.length}`));
      
      // Group submissions by participant
      const submissionsByParticipant = experiment.singleVideoEvaluationSubmissions.reduce((acc, sub) => {
        const participantId = sub.participant.id;
        if (!acc[participantId]) {
          acc[participantId] = {
            participant: sub.participant,
            submissions: []
          };
        }
        acc[participantId].submissions.push(sub);
        return acc;
      }, {} as Record<string, { participant: any, submissions: any[] }>);
      
      Object.values(submissionsByParticipant).forEach(({ participant, submissions }) => {
        console.log(chalk.yellow(`\nParticipant ${participant.prolificId || participant.id}:`));
        console.log(chalk.gray(`  Status: ${participant.status}`));
        console.log(chalk.gray(`  Submissions: ${submissions.length}`));
        
        submissions.forEach((sub, index) => {
          console.log(chalk.gray(`    ${index + 1}. Task: ${sub.singleVideoEvaluationTask.scenarioId} - ${sub.singleVideoEvaluationTask.modelName}`));
          console.log(chalk.gray(`       Status: ${sub.status}, Created: ${sub.createdAt}`));
        });
      });
      
      // Count valid submissions (from approved participants only for Prolific experiments)
      const validParticipantIds = Object.values(submissionsByParticipant)
        .filter(({ participant }) => {
          if (experiment.prolificStudyId) {
            return participant.status === 'approved' && participant.prolificId;
          } else {
            return ['active', 'completed', 'approved'].includes(participant.status);
          }
        })
        .map(({ participant }) => participant.id);
      
      const validSubmissions = experiment.singleVideoEvaluationSubmissions.filter(sub => 
        validParticipantIds.includes(sub.participantId)
      );
      
      console.log(chalk.cyan(`\nValid submissions (from valid participants): ${validSubmissions.length}`));
      console.log(chalk.cyan(`Expected submissions: ${experiment.singleVideoEvaluationTasks.length} tasks × ${validParticipantIds.length} participants = ${experiment.singleVideoEvaluationTasks.length * validParticipantIds.length}`));
      
    } catch (error) {
      console.error(chalk.red('Error debugging submissions:'), error);
    } finally {
      await prisma.$disconnect();
    }
  });

// Fix config command
program
  .command('fix-config <slug>')
  .description('Fix experiment configuration')
  .option('--evaluations-per-comparison <number>', 'Set evaluations per comparison')
  .action(async (slug, options) => {
    await requireAuth('fix experiment config', async () => {
      try {
        const experiment = await prisma.experiment.findUnique({
          where: { slug }
        });
        
        if (!experiment) {
          console.log(chalk.red(`Experiment "${slug}" not found.`));
          return;
        }
        
        const updatedConfig = {
          ...experiment.config,
        };
        
        if (options.evaluationsPerComparison) {
          updatedConfig.evaluationsPerComparison = parseInt(options.evaluationsPerComparison);
        }
        
        await prisma.experiment.update({
          where: { slug },
          data: { config: updatedConfig }
        });
        
        console.log(chalk.green.bold('\n✅ Configuration updated successfully!\n'));
        console.log(chalk.white('Updated config:'));
        console.log(chalk.gray(JSON.stringify(updatedConfig, null, 2)));
        
      } catch (error) {
        console.error(chalk.red('Error fixing config:'), error);
      } finally {
        await prisma.$disconnect();
      }
    }, true);
  });

// Logout command
// Database management commands
program
  .command('db:tables')
  .description('List all database tables')
  .action(async () => {
    await requireAuth('view database tables', async () => {
      try {
        const result = await prisma.$queryRaw`
          SELECT 
            table_name,
            COALESCE(obj_description(c.oid), '') as comment
          FROM information_schema.tables t
          LEFT JOIN pg_class c ON c.relname = t.table_name
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `;
        
        console.log(chalk.blue.bold('\n📋 Database Tables\n'));
        if (Array.isArray(result) && result.length > 0) {
          result.forEach((table: any) => {
            console.log(chalk.white(`• ${table.table_name}`) + 
              (table.comment ? chalk.gray(` - ${table.comment}`) : ''));
          });
        } else {
          console.log(chalk.gray('No tables found'));
        }
      } catch (error) {
        console.error(chalk.red('Error listing tables:'), error);
      }
    });
  });

program
  .command('db:count')
  .description('Count records in database tables')
  .option('-t, --table <table>', 'Specific table to count')
  .action(async (options) => {
    await requireAuth('view database counts', async () => {
      try {
        if (options.table) {
          // Count specific table
          const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${options.table}"`);
          const count = Array.isArray(result) ? result[0]?.count : 0;
          console.log(chalk.blue(`📊 ${options.table}: ${Number(count).toLocaleString()} records`));
        } else {
          // Count all main tables
          console.log(chalk.blue.bold('\n📊 Record Counts\n'));
          
          const tables = [
            'Experiment',
            'TwoVideoComparisonTask', 
            'TwoVideoComparisonSubmission',
            'SingleVideoEvaluationTask',
            'SingleVideoEvaluationSubmission',
            'Participant',
            'Video',
            'organizations',
            'organization_members'
          ];
          
          for (const table of tables) {
            try {
              const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`);
              const count = Array.isArray(result) ? result[0]?.count : 0;
              console.log(chalk.white(`${table}: `) + chalk.yellow(Number(count).toLocaleString()));
            } catch (error) {
              console.log(chalk.white(`${table}: `) + chalk.red('Error'));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red('Error counting records:'), error);
      }
    });
  });

// Storage management commands
program
  .command('storage:list')
  .description('List objects in cloud storage')
  .option('-p, --prefix <prefix>', 'Filter by prefix (e.g., experiments/)', '')
  .option('-b, --bucket <bucket>', 'Bucket name (uses env TIGRIS_BUCKET_NAME if not specified)')
  .option('-d, --detailed', 'Show detailed information')
  .action(async (options) => {
    await requireAuth('view storage', async () => {
      try {
        const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
        
        const client = new S3Client({
          endpoint: process.env.AWS_ENDPOINT_URL_S3 || 'https://fly.storage.tigris.dev',
          region: process.env.AWS_REGION || 'auto',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
        
        const bucketName = options.bucket || process.env.TIGRIS_BUCKET_NAME || 'eval-data';
        
        console.log(chalk.blue.bold(`\n📁 Listing objects in bucket '${bucketName}'`));
        if (options.prefix) {
          console.log(chalk.gray(`   with prefix '${options.prefix}'`));
        }
        console.log();
        
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: options.prefix,
        });
        
        const response = await client.send(command);
        
        if (!response.Contents || response.Contents.length === 0) {
          console.log(chalk.gray('No objects found'));
          return;
        }
        
        let totalSize = 0;
        
        response.Contents.forEach((obj) => {
          const sizeMB = (obj.Size || 0) / (1024 * 1024);
          totalSize += obj.Size || 0;
          
          if (options.detailed) {
            const modified = obj.LastModified?.toISOString().slice(0, 16).replace('T', ' ') || 'Unknown';
            console.log(chalk.white(`${obj.Key}`));
            console.log(chalk.gray(`  Size: ${sizeMB.toFixed(2)} MB`));
            console.log(chalk.gray(`  Modified: ${modified}`));
            console.log(chalk.gray(`  Storage: ${obj.StorageClass || 'STANDARD'}`));
            console.log();
          } else {
            console.log(chalk.white(`${obj.Key} `) + chalk.yellow(`(${sizeMB.toFixed(2)} MB)`));
          }
        });
        
        console.log(chalk.blue(`\n📊 Total: ${response.Contents.length} objects, ${(totalSize / (1024 * 1024)).toFixed(2)} MB`));
        
      } catch (error) {
        console.error(chalk.red('Error listing storage objects:'), error);
      }
    });
  });

program
  .command('logout')
  .description('Clear stored authentication')
  .action(async () => {
    await clearAuth();
  });

// Cleanup function
async function cleanup() {
  try {
    await prisma.$disconnect();
    if (rl) {
      rl.close();
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Handle process exit
process.on('exit', () => {
  if (rl) {
    rl.close();
  }
});

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Create organization command
program
  .command('create-organization')
  .description('Create a new organization and add current user as owner')
  .option('-n, --name <name>', 'Organization name')
  .option('-s, --slug <slug>', 'Organization slug')
  .option('-d, --description <description>', 'Organization description')
  .action(async (options) => {
    try {
      const auth = await requireAuth('create organization', async (authData) => {
        console.log(chalk.blue('🏢 Creating a new organization...'));
        
        // Initialize readline
        const rl = getReadline();
        const question = promisify(rl.question).bind(rl);
        
        // Get organization details
        const name = options.name || await question('Organization name: ');
        const slug = options.slug || slugify(name);
        const description = options.description || await question('Description (optional): ') || null;
        
        // Check if slug is available
        const existing = await prisma.organization.findUnique({
          where: { slug }
        });
        
        if (existing) {
          console.log(chalk.red(`❌ Organization with slug "${slug}" already exists`));
          process.exit(1);
        }
        
        // Create organization
        const organization = await prisma.organization.create({
          data: {
            name,
            slug,
            description,
            stackTeamId: null // Will be set when Stack Auth integration is added
          }
        });
        
        console.log(chalk.green(`✅ Created organization: ${name} (${slug})`));
        
        // Add current user as owner
        await prisma.organizationMember.create({
          data: {
            stackUserId: authData.userId,
            organizationId: organization.id,
            role: 'OWNER'
          }
        });
        
        console.log(chalk.green(`✅ Added you as owner of the organization`));
        console.log(chalk.blue(`\n🎉 Organization setup complete!`));
        console.log(chalk.gray(`   You can now access the admin dashboard with full permissions.`));
        
        return organization;
      });
      
      if (!auth) {
        console.log(chalk.red('❌ Authentication failed'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to create organization:'), error);
      process.exit(1);
    } finally {
      await cleanup();
    }
  });

program.parse();

// Cleanup after parsing is complete
process.nextTick(async () => {
  await cleanup();
});