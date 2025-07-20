'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink,
  Zap,
  Code,
  Upload,
  Settings,
  Database,
  Users,
  DollarSign
} from 'lucide-react'

interface CLIToolsPanelProps {
  onCopyCommand?: (command: string, id: string) => void
  copiedCommand?: string | null
}

export function CLIToolsPanel({ onCopyCommand, copiedCommand }: CLIToolsPanelProps) {
  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      if (onCopyCommand) {
        onCopyCommand(text, commandId)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const commands = [
    {
      id: 'create-interactive',
      title: 'Create Experiment (Interactive)',
      description: 'Interactive experiment creation with prompts',
      icon: <Terminal className="h-4 w-4" />,
      category: 'Experiments',
      command: './evalctl create',
      explanation: 'Launch interactive mode to create experiments with step-by-step guidance and organization support.'
    },
    {
      id: 'list',
      title: 'List Experiments',
      description: 'List all experiments in your organization',
      icon: <Database className="h-4 w-4" />,
      category: 'Management',
      command: './evalctl list',
      explanation: 'Display all experiments in your organization with their current status and statistics.'
    },
    {
      id: 'stats',
      title: 'Experiment Statistics',
      description: 'Get detailed experiment statistics',
      icon: <Database className="h-4 w-4" />,
      category: 'Management',
      command: './evalctl stats [slug]',
      explanation: 'View detailed statistics for a specific experiment including participants, evaluations, and completion times.'
    },
    {
      id: 'launch',
      title: 'Launch Experiment',
      description: 'Launch experiment for participants',
      icon: <Zap className="h-4 w-4" />,
      category: 'Experiments',
      command: './evalctl launch [slug]',
      explanation: 'Activate an experiment and make it available for participant evaluations.'
    },
    {
      id: 'complete',
      title: 'Complete Experiment',
      description: 'Mark experiment as completed',
      icon: <Check className="h-4 w-4" />,
      category: 'Experiments',
      command: './evalctl complete [slug]',
      explanation: 'Mark an experiment as completed and stop accepting new participants.'
    },
    {
      id: 'launch-prolific',
      title: 'Launch with Prolific Study',
      description: 'Launch experiment and create Prolific study',
      icon: <Users className="h-4 w-4" />,
      category: 'Prolific',
      command: './evalctl launch [slug] --prolific',
      explanation: 'Launch experiment and automatically create a Prolific study for human evaluation recruitment.'
    },
    {
      id: 'prolific-create',
      title: 'Create Prolific Study',
      description: 'Create Prolific study for existing experiment',
      icon: <Users className="h-4 w-4" />,
      category: 'Prolific',
      command: `./evalctl prolific:create [slug] \\
  --title "Custom Study Title" \\
  --description "Study description" \\
  --reward 8.00 --participants 50`,
      explanation: 'Create a customized Prolific study with specific title, description, reward amount, and participant count.'
    },
    {
      id: 'prolific-sync',
      title: 'Sync Prolific Data',
      description: 'Sync participant demographics from Prolific',
      icon: <Users className="h-4 w-4" />,
      category: 'Prolific',
      command: './evalctl prolific:sync [study-id]',
      explanation: 'Sync participant demographics and submission data from Prolific to your database.'
    },
    {
      id: 'list-videos',
      title: 'List Video Library',
      description: 'List all videos in the video library',
      icon: <Upload className="h-4 w-4" />,
      category: 'Management',
      command: './evalctl list-videos',
      explanation: 'Display all videos in your organization\'s video library with metadata and usage information.'
    },
    {
      id: 'create-bulk',
      title: 'Create Bulk Experiments',
      description: 'Create multiple experiments using matrix mode',
      icon: <Settings className="h-4 w-4" />,
      category: 'Experiments',
      command: './evalctl create-bulk --matrix-file experiments.json',
      explanation: 'Create multiple experiments at once using a configuration matrix for systematic testing.'
    },
    {
      id: 'db-tables',
      title: 'List Database Tables',
      description: 'List all tables in the database',
      icon: <Database className="h-4 w-4" />,
      category: 'Development',
      command: './evalctl db:tables',
      explanation: 'Display all database tables with their names and descriptions.'
    },
    {
      id: 'db-count',
      title: 'Count Database Records',
      description: 'Count records in database tables',
      icon: <Database className="h-4 w-4" />,
      category: 'Development',
      command: './evalctl db:count',
      explanation: 'Display record counts for all main database tables or count specific table with --table flag.'
    },
    {
      id: 'bulk-edit-videos',
      title: 'Bulk Edit Videos',
      description: 'Bulk edit video metadata',
      icon: <Settings className="h-4 w-4" />,
      category: 'Management',
      command: './evalctl bulk-edit-videos --tag "new-tag"',
      explanation: 'Bulk edit metadata for videos in your library, such as adding tags or updating descriptions.'
    },
    {
      id: 'assign-videos',
      title: 'Auto-assign Videos',
      description: 'Auto-assign videos to experiment comparisons',
      icon: <Settings className="h-4 w-4" />,
      category: 'Management',
      command: './evalctl assign-videos [slug] --auto',
      explanation: 'Automatically assign videos from your library to experiment comparison tasks.'
    },
    {
      id: 'create-video-tasks',
      title: 'Create Video Tasks',
      description: 'Create video tasks for single video evaluation',
      icon: <Upload className="h-4 w-4" />,
      category: 'Experiments',
      command: './evalctl create-video-tasks [slug]',
      explanation: 'Create single video evaluation tasks for experiments focused on individual video assessment.'
    },
    {
      id: 'prolific-list',
      title: 'List Prolific Studies',
      description: 'List all Prolific studies',
      icon: <Users className="h-4 w-4" />,
      category: 'Prolific',
      command: './evalctl prolific:list',
      explanation: 'Display all Prolific studies associated with your experiments.'
    },
    {
      id: 'prolific-status',
      title: 'Prolific Study Status',
      description: 'Get status of a Prolific study',
      icon: <Users className="h-4 w-4" />,
      category: 'Prolific',
      command: './evalctl prolific:status [study-id]',
      explanation: 'Check the current status, participant count, and completion rate of a Prolific study.'
    },
    {
      id: 'debug-progress',
      title: 'Debug Progress',
      description: 'Debug progress calculation for an experiment',
      icon: <Code className="h-4 w-4" />,
      category: 'Development',
      command: './evalctl debug:progress [slug]',
      explanation: 'Debug and troubleshoot experiment progress calculation issues.'
    },
    {
      id: 'fix-config',
      title: 'Fix Configuration',
      description: 'Fix experiment configuration',
      icon: <Settings className="h-4 w-4" />,
      category: 'Development',
      command: './evalctl fix-config [slug] --evaluations-per-comparison 5',
      explanation: 'Fix or update experiment configuration parameters like evaluations per comparison.'
    },
    {
      id: 'storage-list',
      title: 'List Cloud Storage',
      description: 'List objects in cloud storage',
      icon: <Upload className="h-4 w-4" />,
      category: 'Development',
      command: './evalctl storage:list --detailed',
      explanation: 'List all objects in cloud storage with size, modification date, and storage class information.'
    },
    {
      id: 'studio',
      title: 'Database Studio',
      description: 'Open database admin interface',
      icon: <ExternalLink className="h-4 w-4" />,
      category: 'Development',
      command: 'npm run db:studio',
      explanation: 'Launch Prisma Studio for direct database inspection and management.'
    }
  ]

  const categories = ['Management', 'Experiments', 'Prolific', 'Development']

  const workflowExample = `#!/bin/bash
# List videos in library
./evalctl list-videos

# Create experiment interactively
./evalctl create

# Launch experiment with Prolific study
./evalctl launch my-experiment-slug --prolific \\
  --prolific-title "World Models Evaluation Study" \\
  --prolific-reward 8.00 --prolific-participants 50

# Monitor experiment progress
./evalctl stats my-experiment-slug

# Sync Prolific participant data
./evalctl prolific:sync 123456789abcdef

# Complete experiment when done
./evalctl complete my-experiment-slug`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Terminal className="h-5 w-5" />
          CLI Tools & Commands
        </CardTitle>
        <CardDescription className="text-slate-300">
          Unified TypeScript CLI for experiment management, Prolific integration, and database operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Commands by Category */}
        {categories.map((category) => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-200">{category}</h3>
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                {commands.filter(cmd => cmd.category === category).length} commands
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {commands
                .filter(cmd => cmd.category === category)
                .map((cmd) => (
                  <div key={cmd.id} className="border border-slate-600/50 bg-slate-800/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{cmd.icon}</span>
                        <h4 className="font-medium text-slate-200">{cmd.title}</h4>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(cmd.command, cmd.id)}
                        className="flex-shrink-0 hover:bg-slate-700"
                      >
                        {copiedCommand === cmd.id ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                    
                    <p className="text-sm text-slate-300">{cmd.description}</p>
                    
                    <div className="relative">
                      <pre className="bg-slate-700/50 border border-slate-600/50 p-3 rounded text-xs overflow-x-auto font-mono text-slate-200">
                        <code>{cmd.command}</code>
                      </pre>
                    </div>
                    
                    <p className="text-xs text-slate-400">{cmd.explanation}</p>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {/* Automated Workflow */}
        <div className="border-t border-slate-600/50 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-slate-200">Automated Workflow Example</h3>
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
              End-to-End
            </Badge>
          </div>
          
          <p className="text-sm text-slate-300 mb-4">
            Complete workflow from experiment creation to completion with Prolific integration:
          </p>
          
          <div className="relative">
            <pre className="bg-slate-800/50 border border-slate-600/50 text-slate-200 p-4 rounded-lg text-sm overflow-x-auto font-mono">
              <code>{workflowExample}</code>
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              onClick={() => copyToClipboard(workflowExample, 'full-workflow')}
            >
              {copiedCommand === 'full-workflow' ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <h4 className="text-sm font-medium text-cyan-300 mb-2">Workflow Steps:</h4>
            <ol className="text-sm text-cyan-200 space-y-1">
              <li>1. Check available videos in your library</li>
              <li>2. Create a new experiment with interactive setup</li>
              <li>3. Launch the experiment with automated Prolific study creation</li>
              <li>4. Monitor experiment progress and participant engagement</li>
              <li>5. Sync participant demographics from Prolific</li>
              <li>6. Complete the experiment when sufficient data is collected</li>
            </ol>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="border-t border-slate-600/50 pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-200">
            <Terminal className="h-5 w-5" />
            Quick Reference
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-200">Common Flags</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <code className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-200">--help</code>
                  <span className="text-slate-400">Show command help</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-200">--verbose</code>
                  <span className="text-slate-400">Detailed output</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-200">--dry-run</code>
                  <span className="text-slate-400">Preview changes</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-200">Environment</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <code className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-200">NODE_ENV</code>
                  <span className="text-slate-400">Runtime environment</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-200">DEBUG</code>
                  <span className="text-slate-400">Debug mode</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-200">DATABASE_URL</code>
                  <span className="text-slate-400">Database connection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}