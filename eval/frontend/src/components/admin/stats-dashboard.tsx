'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Users, 
  FileVideo, 
  BarChart3, 
  Target, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter
} from 'lucide-react'
import { getOverallProgress } from '@/lib/utils/progress'

interface EvaluationStats {
  total_tasks: number
  total_submissions: number
  total_comparison_tasks: number
  total_single_video_tasks: number
  total_comparison_submissions: number
  total_single_video_submissions: number
  evaluations_by_scenario: Record<string, number>
  target_evaluations_per_comparison: number
}

interface EvaluationStatus {
  completed: number
  draft: number
  total: number
  active: number
}

interface StatsDashboardProps {
  stats: EvaluationStats | null
  experiments: any[]
  evaluationStatus: EvaluationStatus | null
  loading?: boolean
  selectedGroup?: string | null
  onGroupChange?: (group: string | null) => void
  includeAnonymous?: boolean
}

export function StatsDashboard({ 
  stats, 
  experiments, 
  evaluationStatus, 
  loading, 
  selectedGroup, 
  onGroupChange,
  includeAnonymous = false
}: StatsDashboardProps) {
  const [localSelectedGroup, setLocalSelectedGroup] = useState<string | null>(selectedGroup || null)
  
  const handleGroupChange = (group: string | null) => {
    setLocalSelectedGroup(group)
    onGroupChange?.(group)
  }
  
  // Defensive checks for props
  const safeExperiments = experiments || []
  const safeStats = stats || null
  const safeEvaluationStatus = evaluationStatus || null
  
  // Get unique groups from experiments
  const uniqueGroups = Array.from(new Set(safeExperiments.map(exp => exp.group).filter(Boolean)))
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Filter experiments by selected group
  const filteredExperiments = selectedGroup
    ? safeExperiments.filter(exp => exp.group === selectedGroup)
    : safeExperiments
    
  const activeExperiments = filteredExperiments.filter(exp => exp.status === 'active').length
  const completedExperiments = filteredExperiments.filter(exp => exp.status === 'completed').length
  const totalParticipants = filteredExperiments.reduce((sum, exp) => sum + (exp._count?.participants || 0), 0)
  
  // Use the new progress calculation that respects individual experiment configs
  const overallProgress = getOverallProgress(filteredExperiments)
  const completionRate = Math.round(overallProgress.progressPercentage)

  return (
    <div className="space-y-6">
      {/* Group Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filter by Group:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {localSelectedGroup || 'All Groups'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleGroupChange(null)}>
                All Groups
              </DropdownMenuItem>
              {uniqueGroups.map((group) => (
                <DropdownMenuItem key={group} onClick={() => handleGroupChange(group)}>
                  {group}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {localSelectedGroup && (
          <Badge variant="secondary" className="text-xs">
            {filteredExperiments.length} experiments in &quot;{localSelectedGroup}&quot;
          </Badge>
        )}
      </div>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/20 border-primary/20 glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-primary">Total Experiments</CardTitle>
              <FileVideo className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-foreground">{filteredExperiments.length}</p>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                  {activeExperiments} active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/20 border-secondary/20 glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-secondary">Total Submissions</CardTitle>
              <BarChart3 className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-foreground">{overallProgress.totalEvaluations}</p>
              <Badge variant="secondary" className="text-xs bg-secondary/20 text-secondary">
                {completionRate}% complete
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 to-accent/20 border-accent/20 glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-accent">Total Participants</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-foreground">{totalParticipants}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-muted to-muted/50 border-border glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-foreground">{filteredExperiments.reduce((sum, exp) => sum + exp._count.twoVideoComparisonTasks + exp._count.singleVideoEvaluationTasks, 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Overall Progress
            </CardTitle>
            <CardDescription>
              Evaluation completion across all experiments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Evaluations Completed</span>
                <span className="font-medium">{overallProgress.totalEvaluations} / {overallProgress.totalTargetEvaluations}</span>
              </div>
              <Progress value={completionRate} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {completionRate >= 100 
                  ? "🎉 All evaluations complete!" 
                  : `${100 - completionRate}% remaining to complete all experiments`
                }
              </p>
            </div>
            
            {safeStats && Object.keys(safeStats.evaluations_by_scenario).length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Evaluations by Scenario</h4>
                <div className="space-y-2">
                  {Object.entries(safeStats.evaluations_by_scenario)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([scenario, count]) => (
                      <div key={scenario} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{scenario}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                        <Progress 
                          value={(count / (overallProgress.totalEvaluations || 1)) * 100} 
                          className="h-2 w-full" 
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary/10 border border-secondary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <span className="text-lg font-bold text-secondary">{safeEvaluationStatus?.completed || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Active</span>
              </div>
              <span className="text-lg font-bold text-primary">{safeEvaluationStatus?.active || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Draft</span>
              </div>
              <span className="text-lg font-bold text-accent">
                {safeEvaluationStatus?.draft || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}