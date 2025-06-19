'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  SkipBack, 
  SkipForward,
  Maximize2,
  Settings,
  Save,
  CheckCircle,
  Star
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface VideoTask {
  video_task_id: string
  scenario_id: string
  scenario_metadata: {
    name: string
    description: string
  }
  model_name: string
  video_path: string
}

interface DimensionInfo {
  name: string
  prompt: string
  description: string
  sub_questions?: string[]
}

const dimensions = [
  'overall_quality',
  'controllability', 
  'visual_quality',
  'temporal_consistency'
]

const dimensionInfo: Record<string, DimensionInfo> = {
  overall_quality: {
    name: 'Overall Quality',
    prompt: 'How would you rate the overall quality of this video?',
    description: 'Consider the general realism and believability, coherence of the game world, completeness of actions and movements, and how well it looks like actual Minecraft gameplay',
    sub_questions: [
      'How realistic does this video look?',
      'How coherent is the game world?',
      'How complete and natural are the movements?'
    ]
  },
  controllability: {
    name: 'Controllability',
    prompt: 'How well does the video demonstrate controllability?',
    description: 'Evaluate how accurately the character responds to control inputs: movement accuracy, execution of jumps and attacks, camera rotation smoothness, and timing of responses',
    sub_questions: [
      'How accurate are the character movements?',
      'How well does the camera control work?',
      'How responsive are the action commands?'
    ]
  },
  visual_quality: {
    name: 'Visual Quality',
    prompt: 'How would you rate the visual quality?',
    description: 'Focus on visual aspects: image clarity and sharpness, texture quality and detail, lighting and color consistency, absence of visual artifacts or glitches',
    sub_questions: [
      'How clear and sharp are the visuals?',
      'How good is the texture quality?',
      'Are there visual artifacts or glitches?'
    ]
  },
  temporal_consistency: {
    name: 'Temporal Consistency',
    prompt: 'How consistent is the video over time?',
    description: 'Evaluate consistency across time: smooth transitions between frames, stable object appearance, consistent physics and motion, absence of flickering',
    sub_questions: [
      'How smooth is the motion?',
      'How stable do objects appear over time?',
      'How consistent is the physics?'
    ]
  }
}

const ratingLabels = {
  1: 'Poor',
  2: 'Fair', 
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent'
}

export default function EvaluateVideoPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  
  const [videoTask, setVideoTask] = useState<VideoTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [startTime] = useState(Date.now())
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Generate or retrieve session ID for anonymous users
  const getSessionId = useCallback(() => {
    let sessionId = sessionStorage.getItem('anon_session_id')
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('anon_session_id', sessionId)
    }
    return sessionId
  }, [])
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [videoSize, setVideoSize] = useState<'small' | 'medium' | 'large'>('large')

  const fetchVideoTask = useCallback(async () => {
    try {
      const response = await fetch(`/api/video-tasks/${params.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch video task')
      }
      
      const data = await response.json()
      setVideoTask(data)
      
      // Load any existing draft
      const participantId = sessionStorage.getItem('participant_id') || 'anonymous'
      const sessionId = getSessionId()
      const draftResponse = await fetch(`/api/single-video-evaluations/draft?videoTaskId=${data.video_task_id}&participantId=${participantId}&sessionId=${sessionId}`)
      
      if (draftResponse.ok) {
        const draftData = await draftResponse.json()
        if (draftData.draft) {
          // Check if evaluation is already completed
          if (draftData.draft.status === 'completed') {
            toast({
              title: 'Already Completed',
              description: 'You have already submitted an evaluation for this video',
              variant: 'destructive'
            })
            router.push('/thank-you')
            return
          }
          
          if (draftData.draft.status === 'draft') {
            const savedResponses = draftData.draft.dimensionScores || {}
            setResponses(savedResponses)
            setLastSaved(new Date(draftData.draft.lastSavedAt))
            
            toast({
              title: 'Draft Loaded',
              description: 'Your previous progress has been restored',
            })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching video task:', error)
      toast({
        title: 'Error',
        description: 'Failed to load video task',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [params.id, toast, getSessionId])

  // Auto-save functionality
  const saveDraft = useCallback(async () => {
    if (!videoTask || Object.keys(responses).length === 0 || submitting) {
      return
    }
    
    setSaving(true)
    try {
      const participantId = sessionStorage.getItem('participant_id') || 'anonymous'
      const experimentId = sessionStorage.getItem('experiment_id')
      const prolificPid = sessionStorage.getItem('prolific_pid')
      const sessionId = getSessionId()

      const response = await fetch('/api/single-video-evaluations/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoTaskId: videoTask.video_task_id,
          participantId,
          experimentId,
          prolificPid,
          dimensionScores: responses,
          completionTimeSeconds: (Date.now() - startTime) / 1000,
          clientMetadata: {
            userAgent: navigator.userAgent,
            sessionId,
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setLastSaved(new Date(data.lastSavedAt))
        toast({
          title: 'Progress Saved',
          description: 'Your evaluation progress has been saved',
        })
      } else if (response.status === 409) {
        toast({
          title: 'Already Completed',
          description: 'You have already submitted this evaluation',
          variant: 'destructive'
        })
        router.push('/thank-you')
        return
      }
    } catch (error) {
      console.error('Error saving draft:', error)
    } finally {
      setSaving(false)
    }
  }, [videoTask, responses, startTime, getSessionId, toast, router, submitting])

  // Debounced auto-save when responses change
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft()
    }, 2000) // Save after 2 seconds of inactivity
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [responses, saveDraft])

  useEffect(() => {
    fetchVideoTask()
  }, [fetchVideoTask])

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current

    if (video) {
      const handlePlay = () => setPlaying(true)
      const handlePause = () => setPlaying(false)
      const handleTimeUpdate = () => setCurrentTime(video.currentTime)
      const handleLoadedMetadata = () => setDuration(video.duration)

      video.addEventListener('play', handlePlay)
      video.addEventListener('pause', handlePause)
      video.addEventListener('timeupdate', handleTimeUpdate)
      video.addEventListener('loadedmetadata', handleLoadedMetadata)

      return () => {
        video.removeEventListener('play', handlePlay)
        video.removeEventListener('pause', handlePause)
        video.removeEventListener('timeupdate', handleTimeUpdate)
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }
  }, [videoTask])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'spacebar':
          e.preventDefault()
          handlePlayPause()
          break
        case 'arrowleft':
          e.preventDefault()
          handleSeek(Math.max(0, currentTime - 5))
          break
        case 'arrowright':
          e.preventDefault()
          handleSeek(Math.min(duration, currentTime + 5))
          break
        case 'r':
          e.preventDefault()
          handleRestart()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentTime, duration])

  // Video control functions
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setVolume(newVolume)
    }
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
    if (videoRef.current) videoRef.current.playbackRate = speed
  }

  const handleRestart = () => {
    if (videoRef.current) videoRef.current.currentTime = 0
  }

  const getVideoSizeClass = () => {
    switch (videoSize) {
      case 'small': return 'w-full max-w-2xl'
      case 'medium': return 'w-full max-w-4xl'
      default: return 'w-full max-w-6xl'
    }
  }

  const handleRatingChange = (dimension: string, rating: number) => {
    setResponses({ ...responses, [dimension]: rating })
  }

  const handleSubmit = async () => {
    // Check if all dimensions are rated
    const missingDimensions = dimensions.filter(dim => !responses[dim])
    if (missingDimensions.length > 0) {
      toast({
        title: 'Incomplete Evaluation',
        description: 'Please rate all dimensions before submitting',
        variant: 'destructive'
      })
      return
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setSubmitting(true)
    
    try {
      // Get participant info if this is a Prolific session
      const participantId = sessionStorage.getItem('participant_id')
      const experimentId = sessionStorage.getItem('experiment_id')
      const prolificPid = sessionStorage.getItem('prolific_pid')
      const sessionId = getSessionId()
      
      const submitResponse = await fetch('/api/submit-single-video-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_task_id: videoTask?.video_task_id,
          dimension_scores: responses,
          completion_time_seconds: (Date.now() - startTime) / 1000,
          participant_id: participantId,
          experiment_id: experimentId,
          evaluator_id: prolificPid || 'anonymous',
          session_id: sessionId
        })
      })

      const submitResult = await submitResponse.json()

      toast({
        title: 'Success',
        description: 'Your evaluation has been submitted'
      })

      // Check if there's a next video task to evaluate
      if (submitResult.next_video_task_id) {
        toast({
          title: 'Next Video',
          description: 'Loading the next video for evaluation...'
        })
        router.push(`/evaluate-video/${submitResult.next_video_task_id}`)
      } else {
        // Check if this is a Prolific session
        const isProlific = sessionStorage.getItem('is_prolific')
        if (isProlific) {
          router.push('/prolific/complete')
        } else {
          router.push('/thank-you')
        }
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit evaluation',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!videoTask) {
    return (
      <div className="text-center">
        <p>Video task not found</p>
        <Button onClick={() => router.push('/')} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-slate-100">Single Video Evaluation</CardTitle>
            {lastSaved && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                {saving ? (
                  <>
                    <Save className="h-4 w-4 animate-pulse text-cyan-400" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-sm bg-purple-500/20 text-purple-300 border-purple-500/30">
                {videoTask.scenario_metadata.name || videoTask.scenario_id}
              </Badge>
              <Badge variant="outline" className="text-sm">
                {videoTask.model_name}
              </Badge>
              <span className="text-sm text-slate-400">Model</span>
            </div>
            {videoTask.scenario_metadata.description && (
              <p className="text-sm text-slate-300 mt-2">
                {videoTask.scenario_metadata.description}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          
          {/* Keyboard Shortcuts */}
          <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-3 mb-4">
            <details className="cursor-pointer">
              <summary className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Settings className="h-4 w-4 text-cyan-400" />
                Keyboard Shortcuts & Tips
              </summary>
              <div className="mt-2 text-xs text-slate-300 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><kbd className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-600">Space</kbd> Play/Pause</div>
                <div><kbd className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-600">←/→</kbd> Seek ±5s</div>
                <div><kbd className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-600">R</kbd> Restart Video</div>
                <div className="text-slate-400">Watch the full video before rating</div>
              </div>
            </details>
          </div>

          {/* Video Controls Header */}
          <div className="bg-gradient-to-r from-slate-800/60 to-slate-700/60 border border-slate-600/50 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handlePlayPause}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {playing ? (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Play
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleRestart}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restart
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-200">Speed:</Label>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => handleSpeedChange(Number(e.target.value))}
                    className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                  >
                    <option value={0.25}>0.25x</option>
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-200">Size:</Label>
                  <select
                    value={videoSize}
                    onChange={(e) => setVideoSize(e.target.value as 'small' | 'medium' | 'large')}
                    className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Video Display */}
          <div className="flex justify-center mb-6">
            <div className={`relative bg-black rounded-lg overflow-hidden ${getVideoSizeClass()}`}>
              <div className="relative pt-[56.25%]">
                <video
                  ref={videoRef}
                  src={videoTask.video_path}
                  className="absolute inset-0 w-full h-full object-contain"
                  loop
                  playsInline
                />
              
                {/* Video overlay with time */}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                  {Math.floor(currentTime)}s / {Math.floor(duration)}s
                </div>
              </div>
            </div>
          </div>

          {/* Video Controls */}
          <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4 mb-6">
            {/* Progress bar */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Progress</span>
                  <span>{Math.round((currentTime / duration) * 100) || 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer 
                            focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>

              {/* Volume control */}
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-slate-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
                />
                <span className="text-xs text-slate-300 w-8">{Math.round(volume * 100)}%</span>
              </div>

              {/* Quick seek buttons */}
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => handleSeek(Math.max(0, currentTime - 5))}
                  size="sm"
                  variant="outline"
                >
                  <SkipBack className="h-3 w-3 mr-1" />
                  -5s
                </Button>
                <Button
                  onClick={() => handleSeek(Math.min(duration, currentTime + 5))}
                  size="sm"
                  variant="outline"
                >
                  +5s
                  <SkipForward className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Form */}
      {dimensions.map((dimension) => (
        <Card key={dimension}>
          <CardHeader>
            <CardTitle>{dimensionInfo[dimension].name}</CardTitle>
            <CardDescription>
              {dimensionInfo[dimension].prompt}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              {dimensionInfo[dimension].description}
            </p>
            
            {dimensionInfo[dimension].sub_questions && (
              <div className="bg-slate-800/50 border border-slate-600/50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2 text-slate-200">Consider these aspects:</p>
                <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                  {dimensionInfo[dimension].sub_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Star Rating Interface */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200">Rating:</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleRatingChange(dimension, rating)}
                      className={`p-1 rounded-full transition-colors ${
                        responses[dimension] && responses[dimension] >= rating
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      <Star 
                        className={`h-8 w-8 ${
                          responses[dimension] && responses[dimension] >= rating 
                            ? 'fill-current' 
                            : ''
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Rating Labels */}
              <div className="flex justify-between text-xs text-slate-400 px-1">
                {Object.entries(ratingLabels).map(([rating, label]) => (
                  <span key={rating} className="text-center">
                    {label}
                  </span>
                ))}
              </div>
              
              {/* Current Rating Display */}
              {responses[dimension] && (
                <div className="text-center">
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                    {responses[dimension]} - {ratingLabels[responses[dimension] as keyof typeof ratingLabels]}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Submit Button */}
      <div className="flex justify-center py-8">
        <Button
          onClick={handleSubmit}
          size="lg"
          disabled={submitting || Object.keys(responses).length < dimensions.length}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Evaluation'
          )}
        </Button>
      </div>
    </div>
  )
}