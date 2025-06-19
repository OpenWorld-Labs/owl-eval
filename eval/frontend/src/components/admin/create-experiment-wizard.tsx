'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScenarioSelector } from '@/components/scenario-selector'
import { toast } from '@/components/ui/use-toast'
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Play,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface CreateExperimentWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploadedVideos: Array<{
    url: string
    name: string
    uploadedAt: Date
    key: string
    size: number
  }>
  onRefresh?: () => void
}

interface Comparison {
  id: string
  scenarioId: string
  modelA: string
  modelB: string
  videoAUrl: string
  videoBUrl: string
  metadata: any
}

interface ExperimentData {
  name: string
  description: string
  slug: string
  group: string
  evaluationMode: 'comparison' | 'single_video'
  comparisons: Comparison[]
}

const getSteps = (evaluationMode: 'comparison' | 'single_video') => [
  { id: 'details', title: 'Experiment Details', description: 'Basic information about your experiment' },
  { 
    id: 'tasks', 
    title: evaluationMode === 'comparison' ? 'Add Comparisons' : 'Add Video Tasks', 
    description: evaluationMode === 'comparison' 
      ? 'Define model comparisons and scenarios' 
      : 'Define individual video evaluation tasks'
  },
  { id: 'review', title: 'Review & Create', description: 'Review your experiment before creation' }
]

export function CreateExperimentWizard({ 
  open, 
  onOpenChange, 
  uploadedVideos,
  onRefresh 
}: CreateExperimentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [experiment, setExperiment] = useState<ExperimentData>({
    name: '',
    description: '',
    slug: '',
    group: '',
    evaluationMode: 'comparison',
    comparisons: []
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 50)
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}
    
    switch (step) {
      case 0: // Details
        if (!experiment.name.trim()) {
          newErrors.name = 'Experiment name is required'
        }
        if (!experiment.slug.trim()) {
          newErrors.slug = 'Slug is required'
        }
        break
      case 1: // Comparisons
        if (experiment.comparisons.length === 0) {
          newErrors.comparisons = 'At least one comparison is required'
        }
        experiment.comparisons.forEach((comp, index) => {
          if (!comp.scenarioId) {
            newErrors[`comp-${index}-scenario`] = 'Scenario is required'
          }
          if (!comp.modelA) {
            newErrors[`comp-${index}-modelA`] = 'Model A is required'
          }
          if (!comp.modelB) {
            newErrors[`comp-${index}-modelB`] = 'Model B is required'
          }
          if (!comp.videoAUrl) {
            newErrors[`comp-${index}-videoA`] = 'Video A is required'
          }
          if (!comp.videoBUrl) {
            newErrors[`comp-${index}-videoB`] = 'Video B is required'
          }
        })
        break
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const steps = getSteps(experiment.evaluationMode)
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const addComparison = () => {
    const newComparison: Comparison = {
      id: `comp-${Date.now()}`,
      scenarioId: '',
      modelA: '',
      modelB: '',
      videoAUrl: '',
      videoBUrl: '',
      metadata: {}
    }
    setExperiment(prev => ({
      ...prev,
      comparisons: [...prev.comparisons, newComparison]
    }))
  }

  const updateComparison = (id: string, field: keyof Comparison, value: string) => {
    setExperiment(prev => ({
      ...prev,
      comparisons: prev.comparisons.map(comp => 
        comp.id === id ? { ...comp, [field]: value } : comp
      )
    }))
  }

  const removeComparison = (id: string) => {
    setExperiment(prev => ({
      ...prev,
      comparisons: prev.comparisons.filter(comp => comp.id !== id)
    }))
  }

  const createExperiment = async () => {
    if (!validateStep(currentStep)) return

    setIsCreating(true)
    
    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(experiment)
      })

      if (!response.ok) {
        throw new Error('Failed to create experiment')
      }

      const result = await response.json()
      
      toast({
        title: 'Experiment created',
        description: `Experiment "${experiment.name}" created successfully`,
      })

      // Reset form and close dialog
      setExperiment({
        name: '',
        description: '',
        slug: '',
        group: '',
        evaluationMode: 'comparison',
        comparisons: []
      })
      setCurrentStep(0)
      setErrors({})
      onOpenChange(false)
      
      if (onRefresh) {
        onRefresh()
      }
      
    } catch (error) {
      console.error('Create experiment error:', error)
      toast({
        title: 'Creation failed',
        description: 'Failed to create experiment',
        variant: 'destructive'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const getStepProgress = () => {
    const steps = getSteps(experiment.evaluationMode)
    return ((currentStep + 1) / steps.length) * 100
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return experiment.name.trim() && experiment.slug.trim()
      case 1:
        return experiment.comparisons.length > 0 && 
               experiment.comparisons.every(comp => 
                 comp.scenarioId && comp.modelA && comp.modelB && comp.videoAUrl && comp.videoBUrl
               )
      case 2:
        return true
      default:
        return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create New Experiment
            <Badge variant="outline" className="ml-2">
              Step {currentStep + 1} of {getSteps(experiment.evaluationMode).length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {getSteps(experiment.evaluationMode)[currentStep].description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            {getSteps(experiment.evaluationMode).map((step, index) => (
              <span 
                key={step.id}
                className={`font-medium ${
                  index <= currentStep ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </span>
            ))}
          </div>
          <Progress value={getStepProgress()} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-6 px-1">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp-name">
                    Experiment Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="exp-name"
                    placeholder="e.g., Winter 2025 Model Comparison"
                    value={experiment.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setExperiment(prev => ({
                        ...prev,
                        name,
                        slug: prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug
                      }))
                    }}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-slug">
                    URL Slug <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="exp-slug"
                    placeholder="auto-generated from name"
                    value={experiment.slug}
                    onChange={(e) => setExperiment(prev => ({ ...prev, slug: e.target.value }))}
                    className={errors.slug ? 'border-red-500' : ''}
                  />
                  {errors.slug && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.slug}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Used in URLs: /evaluate/{experiment.slug}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-group">Group (optional)</Label>
                <Input
                  id="exp-group"
                  placeholder="e.g., research-phase-1, pilot-study"
                  value={experiment.group}
                  onChange={(e) => setExperiment(prev => ({ ...prev, group: e.target.value }))}
                />
                <p className="text-xs text-gray-500">
                  Group experiments together for organization and filtering
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evaluation-mode">
                  Evaluation Mode <span className="text-red-500">*</span>
                </Label>
                <select
                  id="evaluation-mode"
                  value={experiment.evaluationMode}
                  onChange={(e) => setExperiment(prev => ({ 
                    ...prev, 
                    evaluationMode: e.target.value as 'comparison' | 'single_video' 
                  }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="comparison">Comparison Mode (A vs B)</option>
                  <option value="single_video">Single Video Mode (Absolute Rating)</option>
                </select>
                <p className="text-xs text-gray-500">
                  {experiment.evaluationMode === 'comparison' 
                    ? 'Participants compare two videos side-by-side and choose which is better'
                    : 'Participants evaluate individual videos on absolute rating scales (1-5)'
                  }
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-description">Description</Label>
                <Textarea
                  id="exp-description"
                  placeholder="Describe what this experiment is testing..."
                  value={experiment.description}
                  onChange={(e) => setExperiment(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  Comparisons ({experiment.comparisons.length})
                </h3>
                <Button onClick={addComparison} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Comparison
                </Button>
              </div>

              {errors.comparisons && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.comparisons}
                </p>
              )}

              {experiment.comparisons.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-4">No comparisons yet</p>
                  <Button onClick={addComparison} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Comparison
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {experiment.comparisons.map((comparison, index) => (
                    <div key={comparison.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Comparison {index + 1}</h4>
                        <Button 
                          onClick={() => removeComparison(comparison.id)}
                          size="sm"
                          variant="outline"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Scenario <span className="text-red-500">*</span></Label>
                          <ScenarioSelector
                            value={comparison.scenarioId}
                            onChange={(value) => updateComparison(comparison.id, 'scenarioId', value)}
                            placeholder="Select or create scenario"
                          />
                          {errors[`comp-${index}-scenario`] && (
                            <p className="text-xs text-red-500">{errors[`comp-${index}-scenario`]}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Model A <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g., diamond-1b"
                            value={comparison.modelA}
                            onChange={(e) => updateComparison(comparison.id, 'modelA', e.target.value)}
                            className={errors[`comp-${index}-modelA`] ? 'border-red-500' : ''}
                          />
                          {errors[`comp-${index}-modelA`] && (
                            <p className="text-xs text-red-500">{errors[`comp-${index}-modelA`]}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Model B <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g., genie-2b"
                            value={comparison.modelB}
                            onChange={(e) => updateComparison(comparison.id, 'modelB', e.target.value)}
                            className={errors[`comp-${index}-modelB`] ? 'border-red-500' : ''}
                          />
                          {errors[`comp-${index}-modelB`] && (
                            <p className="text-xs text-red-500">{errors[`comp-${index}-modelB`]}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Model A Video <span className="text-destructive">*</span></Label>
                          <select
                            value={comparison.videoAUrl}
                            onChange={(e) => updateComparison(comparison.id, 'videoAUrl', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md text-sm bg-background text-foreground ${
                              errors[`comp-${index}-videoA`] ? 'border-destructive' : 'border-border'
                            }`}
                          >
                            <option value="">Select video for Model A</option>
                            {uploadedVideos.map((video) => (
                              <option key={video.key} value={video.url}>
                                {video.name}
                              </option>
                            ))}
                          </select>
                          {errors[`comp-${index}-videoA`] && (
                            <p className="text-xs text-destructive">{errors[`comp-${index}-videoA`]}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Model B Video <span className="text-destructive">*</span></Label>
                          <select
                            value={comparison.videoBUrl}
                            onChange={(e) => updateComparison(comparison.id, 'videoBUrl', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md text-sm bg-background text-foreground ${
                              errors[`comp-${index}-videoB`] ? 'border-destructive' : 'border-border'
                            }`}
                          >
                            <option value="">Select video for Model B</option>
                            {uploadedVideos.map((video) => (
                              <option key={video.key} value={video.url}>
                                {video.name}
                              </option>
                            ))}
                          </select>
                          {errors[`comp-${index}-videoB`] && (
                            <p className="text-xs text-red-500">{errors[`comp-${index}-videoB`]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-secondary" />
                  <h3 className="font-semibold text-secondary">Ready to Create</h3>
                </div>
                <p className="text-sm text-secondary">
                  Review your experiment details below and click &quot;Create Experiment&quot; when ready.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Experiment Details</h4>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Name:</span>
                      <span className="text-sm font-medium">{experiment.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Slug:</span>
                      <code className="text-sm bg-muted px-1 rounded">{experiment.slug}</code>
                    </div>
                    {experiment.group && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Group:</span>
                        <span className="text-sm font-medium">{experiment.group}</span>
                      </div>
                    )}
                    {experiment.description && (
                      <div className="pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Description:</span>
                        <p className="text-sm mt-1">{experiment.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">
                    Comparisons ({experiment.comparisons.length})
                  </h4>
                  <div className="space-y-2">
                    {experiment.comparisons.map((comp, index) => (
                      <div key={comp.id} className="bg-muted/30 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {comp.modelA} vs {comp.modelB}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Scenario: {comp.scenarioId}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={currentStep === 0 ? () => onOpenChange(false) : prevStep}
          >
            {currentStep === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </>
            )}
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button 
              onClick={nextStep}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={createExperiment}
              disabled={isCreating || !canProceed()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Create Experiment
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}