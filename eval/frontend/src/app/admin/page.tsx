'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { LogOut, RefreshCw } from 'lucide-react'

// Import new admin components
import { StatsDashboard } from '@/components/admin/stats-dashboard'
import { ExperimentTable } from '@/components/admin/experiment-table'
import { VideoLibraryManager } from '@/components/admin/video-library-manager'
import { CLIToolsPanel } from '@/components/admin/cli-tools-panel'
import { CreateExperimentWizard } from '@/components/admin/create-experiment-wizard'
import { BulkExperimentWizard } from '@/components/admin/bulk-experiment-wizard'
import { ModelPerformanceChart } from '@/components/admin/model-performance-chart'
import { ProgressTracker } from '@/components/admin/progress-tracker'
import { ProlificDialog } from '@/components/admin/prolific-dialog'
import { Breadcrumbs } from '@/components/navigation'

interface EvaluationStats {
  total_comparisons: number
  total_evaluations: number
  evaluations_by_scenario: Record<string, number>
  target_evaluations_per_comparison: number
}

interface ModelPerformance {
  model: string
  dimension: string
  win_rate: number
  num_evaluations: number
}

interface Experiment {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  archived: boolean
  archivedAt: string | null
  group: string | null
  prolificStudyId: string | null
  config: any
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  comparisons?: Array<any>
  _count: {
    comparisons: number
    participants: number
    evaluations: number
  }
}

interface ComparisonProgress {
  id: string
  scenarioId: string
  modelA: string
  modelB: string
  evaluationCount: number
  targetEvaluations: number
  progressPercentage: number
}

interface UploadedVideo {
  id: string
  key: string
  name: string
  url: string
  size: number
  duration?: number
  tags: string[]
  groups: string[]
  modelName?: string
  scenarioId?: string
  uploadedAt: Date
  metadata?: any
}

export default function AdminPage() {
  // Data state
  const [stats, setStats] = useState<EvaluationStats | null>(null)
  const [evaluationStatus, setEvaluationStatus] = useState<any>(null)
  const [performance, setPerformance] = useState<ModelPerformance[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [comparisonProgress, setComparisonProgress] = useState<ComparisonProgress[]>([])
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [showBulkWizard, setShowBulkWizard] = useState(false)
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [prolificDialogOpen, setProlificDialogOpen] = useState(false)
  const [selectedExperimentForProlific, setSelectedExperimentForProlific] = useState<Experiment | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  // Check if Stack Auth is configured (client-side check)
  const isStackAuthConfigured = typeof window !== 'undefined' && 
    process.env.NEXT_PUBLIC_STACK_PROJECT_ID && 
    process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY

  const fetchAllData = useCallback(async () => {
    try {
      const groupParam = selectedGroup ? `?group=${encodeURIComponent(selectedGroup)}` : ''
      const [statsRes, evalStatusRes, perfRes, expRes, progressRes] = await Promise.all([
        fetch(`/api/evaluation-stats${groupParam}`),
        fetch('/api/evaluation-status'),
        fetch(`/api/model-performance${groupParam}`),
        fetch('/api/experiments'),
        fetch('/api/comparison-progress')
      ])
      
      const [statsData, evalStatusData, perfData, expData, progressData] = await Promise.all([
        statsRes.json(),
        evalStatusRes.json(),
        perfRes.json(),
        expRes.json(),
        progressRes.json()
      ])
      
      setStats(statsData)
      setEvaluationStatus(evalStatusData)
      setPerformance(perfData || [])
      setExperiments(expData || [])
      setComparisonProgress(progressData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch data. Please try refreshing.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedGroup])

  useEffect(() => {
    fetchAllData()
  }, [selectedGroup, fetchAllData])
  
  useEffect(() => {
    const dataInterval = setInterval(fetchAllData, 30000) // Refresh every 30 seconds
    
    return () => {
      clearInterval(dataInterval)
    }
  }, [selectedGroup, fetchAllData])

  const fetchVideoLibrary = async () => {
    try {
      const response = await fetch('/api/videos')
      if (response.ok) {
        const videos = await response.json()
        const videosWithDates = videos.map((video: any) => ({
          ...video,
          uploadedAt: new Date(video.uploadedAt),
          tags: video.tags || [],
          groups: video.groups || []
        }))
        setUploadedVideos(videosWithDates)
      }
    } catch (error) {
      console.error('Error fetching video library:', error)
    }
  }

  useEffect(() => {
    fetchVideoLibrary()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAllData()
    await fetchVideoLibrary()
  }

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    for (const file of files) {
      if (!file.type.startsWith('video/')) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a video file`,
          variant: 'destructive'
        })
        continue
      }

      try {
        const formData = new FormData()
        formData.append('video', file)
        formData.append('libraryUpload', 'true')

        const response = await fetch('/api/video-library/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const data = await response.json()
        
        setUploadedVideos(prev => [...prev, {
          id: data.id || data.key,
          url: data.videoUrl,
          name: file.name,
          uploadedAt: new Date(),
          key: data.key,
          size: file.size,
          tags: [],
          groups: []
        }])

        toast({
          title: 'Upload successful',
          description: `${file.name} uploaded to library`,
        })
      } catch (error) {
        console.error('Upload error:', error)
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive'
        })
      }
    }
  }

  const handleVideoSelect = (videoKey: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(videoKey)) {
        newSet.delete(videoKey)
      } else {
        newSet.add(videoKey)
      }
      return newSet
    })
  }

  const handleSelectAllVideos = () => {
    setSelectedVideos(new Set(uploadedVideos.map(v => v.key)))
  }

  const handleClearSelection = () => {
    setSelectedVideos(new Set())
  }

  const handleCopySelectedUrls = async () => {
    if (selectedVideos.size === 0) {
      toast({
        title: 'No videos selected',
        description: 'Please select videos to copy URLs',
        variant: 'destructive'
      })
      return
    }

    const selectedUrls = uploadedVideos
      .filter(video => selectedVideos.has(video.key))
      .map(video => video.url)
      .join('\n')

    try {
      await navigator.clipboard.writeText(selectedUrls)
      toast({
        title: 'Copied',
        description: `${selectedVideos.size} video URLs copied to clipboard`,
      })
    } catch (err) {
      console.error('Failed to copy:', err)
      toast({
        title: 'Copy failed',
        description: 'Failed to copy URLs to clipboard',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteSelectedVideos = async () => {
    if (selectedVideos.size === 0) {
      toast({
        title: 'No videos selected',
        description: 'Please select videos to delete',
        variant: 'destructive'
      })
      return
    }

    const selectedKeys = Array.from(selectedVideos)
    
    try {
      const response = await fetch('/api/video-library/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keys: selectedKeys })
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      const result = await response.json()
      
      setUploadedVideos(prev => prev.filter(video => !selectedVideos.has(video.key)))
      setSelectedVideos(new Set())

      toast({
        title: 'Videos deleted',
        description: `${result.deleted} video(s) deleted successfully`,
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: 'Failed to delete selected videos',
        variant: 'destructive'
      })
    }
  }

  const handleCopyCommand = (_command: string, commandId: string) => {
    setCopiedCommand(commandId)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const handleCreateProlificStudy = (experimentId: string) => {
    const experiment = experiments.find(exp => exp.id === experimentId)
    if (experiment) {
      setSelectedExperimentForProlific(experiment)
      setProlificDialogOpen(true)
    }
  }

  const handleUpdateVideo = async (videoId: string, updates: Partial<UploadedVideo>) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Update failed')
      }

      const updatedVideo = await response.json()
      
      setUploadedVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, ...updatedVideo, uploadedAt: new Date(updatedVideo.uploadedAt) }
          : video
      ))

      toast({
        title: 'Video updated',
        description: 'Video metadata has been updated successfully',
      })
    } catch (error) {
      console.error('Update video error:', error)
      toast({
        title: 'Update failed',
        description: 'Failed to update video metadata',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: 'Home', href: '/' },
            { label: 'Admin Dashboard' }
          ]}
          className="mb-6"
        />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage experiments, monitor progress, and analyze model performance
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isStackAuthConfigured && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/handler/sign-out'}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="experiments">Experiments</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="tools">CLI Tools</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <StatsDashboard 
              stats={stats} 
              experiments={experiments}
              evaluationStatus={evaluationStatus}
              loading={refreshing}
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
            />
            <ProgressTracker 
              stats={stats}
              comparisonProgress={comparisonProgress}
              loading={refreshing}
            />
          </TabsContent>
          
          <TabsContent value="experiments">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowCreateWizard(true)}
                  variant="default"
                >
                  Create Experiment (Manual)
                </Button>
                <Button 
                  onClick={() => setShowBulkWizard(true)}
                  variant="default"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Create Bulk Experiment
                </Button>
              </div>
              <ExperimentTable 
                experiments={experiments}
                loading={refreshing}
                onCreateNew={() => setShowCreateWizard(true)}
                onRefresh={handleRefresh}
                onCreateProlificStudy={handleCreateProlificStudy}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="videos">
            <VideoLibraryManager
              uploadedVideos={uploadedVideos}
              selectedVideos={selectedVideos}
              onVideoSelect={handleVideoSelect}
              onSelectAll={handleSelectAllVideos}
              onClearSelection={handleClearSelection}
              onUpload={handleVideoUpload}
              onCopyUrls={handleCopySelectedUrls}
              onDeleteSelected={handleDeleteSelectedVideos}
              onRefresh={fetchVideoLibrary}
              onUpdateVideo={handleUpdateVideo}
              loading={refreshing}
            />
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-6">
            <ModelPerformanceChart 
              performance={performance}
              loading={refreshing}
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
              experiments={experiments}
            />
          </TabsContent>
          
          <TabsContent value="tools">
            <CLIToolsPanel 
              onCopyCommand={handleCopyCommand}
              copiedCommand={copiedCommand}
            />
          </TabsContent>
        </Tabs>

        {/* Create Experiment Wizard */}
        <CreateExperimentWizard
          open={showCreateWizard}
          onOpenChange={setShowCreateWizard}
          uploadedVideos={uploadedVideos.map(v => ({
            url: v.url,
            name: v.name,
            uploadedAt: v.uploadedAt,
            key: v.key,
            size: v.size
          }))}
          onRefresh={fetchAllData}
        />
        
        {/* Bulk Experiment Wizard */}
        <BulkExperimentWizard
          open={showBulkWizard}
          onOpenChange={setShowBulkWizard}
          uploadedVideos={uploadedVideos}
          onRefresh={fetchAllData}
        />

        {/* Prolific Dialog */}
        <ProlificDialog
          open={prolificDialogOpen}
          onOpenChange={setProlificDialogOpen}
          experiment={selectedExperimentForProlific}
          onSuccess={fetchAllData}
        />
      </div>
    </div>
  )
}