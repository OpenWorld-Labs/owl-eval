'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  RefreshCw, 
  Users, 
  Briefcase, 
  GraduationCap, 
  Filter, 
  X
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { ModelPerformanceChart } from './model-performance-chart'

interface ModelPerformance {
  model: string
  dimension: string
  scenario?: string
  win_rate: number
  num_evaluations: number
  experimentId: string
  evaluationType: 'comparison' | 'single_video'
  quality_score?: number // For single video evaluations (1-5 scale)
  detailed_scores?: {
    A_much_better: number
    A_slightly_better: number
    Equal: number
    B_slightly_better: number
    B_much_better: number
  }
  score_distribution?: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

interface ParticipantDemographics {
  id: string
  prolificId: string
  experimentId: string
  experimentName: string
  status: string
  completedAt: string | null
  demographics: {
    age?: number
    sex?: string
    nationality?: string
    language?: string
    country_of_birth?: string
    country_of_residence?: string
    fluent_languages?: string[]
    employment_status?: string
    student_status?: string
  } | null
  submission?: {
    reward?: number
    timeTaken?: number
    totalPayment?: number
  }
}

interface DemographicsSummary {
  totalParticipants: number
  participantsWithDemographics: number
  averageAge?: number
  averageDollarPerHour?: number
  averageDollarPerEvaluation?: number
  sexDistribution: Record<string, number>
  nationalityDistribution: Record<string, number>
  employmentDistribution: Record<string, number>
  countryDistribution: Record<string, number>
}

interface FilteredSummary {
  totalParticipants: number
  participantsWithDemographics: number
  experimentTotalParticipants: number
  averageAge?: number
  averageDollarPerHour?: number
  averageDollarPerEvaluation?: number
}

interface EnhancedAnalyticsProps {
  loading?: boolean
  selectedGroup?: string | null
  onGroupChange?: (group: string | null) => void
  experiments?: Array<{
    id: string
    name: string
    createdAt: string
    prolificStudyId?: string | null
    group?: string | null
  }>
  onRefresh?: () => void
  selectedExperiment?: string | null
  onExperimentChange?: (experimentId: string) => void
  currentOrganization?: {
    id: string
    name: string
    slug: string
    description?: string
    role: string
  } | null
}

export function EnhancedAnalyticsDashboard({ 
  loading: externalLoading = false,
  selectedGroup,
  onGroupChange,
  experiments = [],
  onRefresh,
  selectedExperiment,
  onExperimentChange,
  currentOrganization
}: EnhancedAnalyticsProps) {
  const [participants, setParticipants] = useState<ParticipantDemographics[]>([])
  const [allParticipants, setAllParticipants] = useState<ParticipantDemographics[]>([])
  const [filteredPerformance, setFilteredPerformance] = useState<ModelPerformance[]>([])
  const [demographicsSummary, setDemographicsSummary] = useState<DemographicsSummary | null>(null)
  const [demographicsLoading, setDemographicsLoading] = useState(true)

  // Filter state
  const [filters, setFilters] = useState({
    ageMin: 18,
    ageMax: 80,
    sex: 'all',
    country: 'all',
    experimentGroup: selectedGroup || ''
  })
  const [includeAnonymous, setIncludeAnonymous] = useState(true)
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [availableSexes, setAvailableSexes] = useState<string[]>([])
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  
  // Debouncing for API calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchDemographicsData = useCallback(async () => {
    if (!currentOrganization) return;
    
    try {
      setDemographicsLoading(true)
      const demographicsResponse = await fetch(`/api/demographics?includeAnonymous=${includeAnonymous}&organizationId=${currentOrganization.id}`)
      if (!demographicsResponse.ok) {
        throw new Error('Failed to fetch demographics data')
      }
      const demographicsData = await demographicsResponse.json()
      const allParticipantData = demographicsData.participants || []
      
      setAllParticipants(allParticipantData)
      setDemographicsSummary(demographicsData.summary || null)
      
      // Extract available filter options
      const countryValues: string[] = []
      const sexValues: string[] = []
      
      allParticipantData.forEach((p: ParticipantDemographics) => {
        if (p.demographics?.country_of_residence) {
          countryValues.push(p.demographics.country_of_residence)
        }
        if (p.demographics?.sex) {
          sexValues.push(p.demographics.sex)
        }
      })
      
      const countries = Array.from(new Set(countryValues))
      const sexes = Array.from(new Set(sexValues))
      const groups = Array.from(new Set(experiments.map(exp => exp.group).filter((group): group is string => Boolean(group))))
      
      setAvailableCountries(countries)
      setAvailableSexes(sexes)
      setAvailableGroups(groups)
      
      // Set initial age range based on actual data (only if not already set)
      if (filters.ageMin === 18 && filters.ageMax === 80) {
        const ages = allParticipantData
          .map((p: ParticipantDemographics) => p.demographics?.age)
          .filter((age: number | undefined): age is number => age !== undefined && age !== null)
        
        if (ages.length > 0) {
          const minAge = Math.min(...ages)
          const maxAge = Math.max(...ages)
          setFilters(prev => ({
            ...prev,
            ageMin: minAge,
            ageMax: maxAge,
            experimentGroup: selectedGroup || (groups.length > 0 ? groups[0] : '')
          }))
        }
      }
      
    } catch (error) {
      console.error('Error fetching demographics data:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch demographics data. Please try refreshing.',
        variant: 'destructive'
      })
    } finally {
      setDemographicsLoading(false)
    }
  }, [selectedGroup, includeAnonymous, experiments, filters.ageMin, filters.ageMax, currentOrganization])

  // Apply local filters immediately (for participant count updates)
  const applyLocalFilters = useCallback(() => {
    let filtered = allParticipants.filter(participant => {
      const demographics = participant.demographics
      if (!demographics) return false

      // Specific experiment filter first (if selected)
      if (selectedExperiment && participant.experimentId !== selectedExperiment) {
        return false
      }

      // Age filter
      if (demographics.age) {
        if (demographics.age < filters.ageMin || demographics.age > filters.ageMax) {
          return false
        }
      }

      // Sex filter
      if (filters.sex !== 'all' && demographics.sex !== filters.sex) {
        return false
      }

      // Country filter
      if (filters.country !== 'all' && demographics.country_of_residence !== filters.country) {
        return false
      }

      return true
    })

    setParticipants(filtered)

    // Update group selection if changed
    if (filters.experimentGroup !== selectedGroup && onGroupChange) {
      onGroupChange(filters.experimentGroup === '' ? null : filters.experimentGroup)
    }
  }, [allParticipants, filters, selectedGroup, onGroupChange, selectedExperiment])

  // Debounced API call for performance data
  const fetchPerformanceData = useCallback(async () => {
    if (!currentOrganization) {
      console.log('🔍 Analytics: No current organization, clearing performance data');
      setFilteredPerformance([]);
      return;
    }
    
    console.log('🔍 Analytics: Fetching performance data', { 
      selectedExperiment, 
      filters, 
      includeAnonymous,
      organizationId: currentOrganization.id
    });
    
    try {
      const performanceResponse = await fetch(`/api/filtered-performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filters,
          selectedExperiment: selectedExperiment,
          includeAnonymous: includeAnonymous,
          organizationId: currentOrganization.id
        })
      })
      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json()
        console.log('🔍 Analytics: Received performance data', { 
          dataLength: performanceData?.length || 0,
          data: performanceData 
        });
        setFilteredPerformance(performanceData || [])
      } else {
        console.log('🔍 Analytics: Performance response not OK', performanceResponse.status);
        setFilteredPerformance([])
      }
    } catch (error) {
      console.error('Error fetching filtered performance data:', error)
      setFilteredPerformance([])
    }
  }, [filters, selectedExperiment, includeAnonymous, currentOrganization])

  // Debounced version of performance data fetching
  const debouncedFetchPerformanceData = useCallback(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      fetchPerformanceData()
    }, 500) // 500ms delay
  }, [fetchPerformanceData])

  // Apply local filters immediately when filter state changes
  useEffect(() => {
    if (allParticipants.length > 0) {
      applyLocalFilters()
      debouncedFetchPerformanceData()
    }
  }, [filters, allParticipants, applyLocalFilters, debouncedFetchPerformanceData])

  // Handle experiment changes separately (immediate fetch)
  useEffect(() => {
    if (allParticipants.length > 0) {
      const fetchData = async () => {
        try {
          const performanceResponse = await fetch('/api/filtered-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              filters,
              selectedExperiment: selectedExperiment,
              includeAnonymous: includeAnonymous
            })
          })
          if (performanceResponse.ok) {
            const performanceData = await performanceResponse.json()
            setFilteredPerformance(performanceData || [])
          }
        } catch (error) {
          console.error('Error fetching filtered performance data:', error)
          setFilteredPerformance([])
        }
      }
      fetchData()
    }
  }, [selectedExperiment, allParticipants.length, includeAnonymous, filters])

  // Initial performance data load when component mounts
  useEffect(() => {
    const loadInitialPerformance = async () => {
      try {
        const performanceResponse = await fetch('/api/filtered-performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filters: {
              ageMin: 18,
              ageMax: 80,
              sex: 'all',
              country: 'all',
              experimentGroup: selectedGroup || ''
            },
            selectedExperiment: selectedExperiment,
            includeAnonymous: includeAnonymous
          })
        })
        if (performanceResponse.ok) {
          const performanceData = await performanceResponse.json()
          setFilteredPerformance(performanceData || [])
        }
      } catch (error) {
        console.error('Error fetching initial performance data:', error)
      }
    }

    loadInitialPerformance()
  }, [selectedGroup, selectedExperiment, includeAnonymous])

  // Update group filter when external selectedGroup changes
  useEffect(() => {
    if (selectedGroup !== filters.experimentGroup) {
      setFilters(prev => ({ ...prev, experimentGroup: selectedGroup || '' }))
    }
  }, [selectedGroup, filters.experimentGroup])

  const clearFilters = () => {
    setFilters({
      ageMin: 18,
      ageMax: 80,
      sex: 'all',
      country: 'all',
      experimentGroup: availableGroups.length > 0 ? availableGroups[0] : ''
    })
    
    // Reset experiment to latest when clearing filters
    if (experiments.length > 0 && onExperimentChange) {
      const sortedExperiments = [...experiments].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      onExperimentChange(sortedExperiments[0].id)
    }
  }

  const handleRefresh = async () => {
    await fetchDemographicsData()
    onRefresh?.()
  }

  // Fetch demographics data on mount
  useEffect(() => {
    fetchDemographicsData()
  }, [fetchDemographicsData])

  // Auto-select latest experiment when experiments are loaded, or clear when no experiments
  useEffect(() => {
    console.log('🔍 Analytics: Experiment selection logic', { 
      experimentsLength: experiments.length, 
      selectedExperiment,
      hasOnExperimentChange: !!onExperimentChange 
    });
    
    if (onExperimentChange) {
      if (experiments.length > 0 && !selectedExperiment) {
        // Auto-select latest experiment
        const sortedExperiments = [...experiments].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        console.log('🔍 Analytics: Auto-selecting experiment:', sortedExperiments[0].id);
        onExperimentChange(sortedExperiments[0].id)
      } else if (experiments.length === 0 && selectedExperiment) {
        // Clear selection when no experiments available
        console.log('🔍 Analytics: Clearing experiment selection (no experiments available)');
        onExperimentChange('')
      }
    }
  }, [experiments.length, onExperimentChange, experiments, selectedExperiment])

  // Clear analytics data when no experiments are available
  useEffect(() => {
    console.log('🔍 Analytics: Data clearing logic', { 
      experimentsLength: experiments.length,
      currentPerformanceDataLength: filteredPerformance.length,
      currentParticipantsLength: participants.length 
    });
    
    if (experiments.length === 0) {
      console.log('🔍 Analytics: Clearing analytics data (no experiments)');
      setFilteredPerformance([])
      setParticipants([])
    }
  }, [experiments.length, filteredPerformance.length, participants.length])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Calculate filtered summary
  const getFilteredSummary = (): FilteredSummary | null => {
    if (participants.length === 0) return null

    // Get total participants for the selected experiment (for percentage calculation)
    const experimentParticipants = selectedExperiment 
      ? allParticipants.filter(p => p.experimentId === selectedExperiment)
      : allParticipants

    const participantsWithDemographics = participants.filter(p => p.demographics)
    
    // Age statistics
    const ages = participantsWithDemographics
      .map(p => p.demographics?.age)
      .filter(age => age !== undefined && age !== null) as number[]
    const averageAge = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : undefined

    // Payment and time statistics
    const participantsWithPaymentData = participants.filter(p => 
      p.submission?.totalPayment && p.submission?.timeTaken
    )
    
    let averageDollarPerHour = undefined
    if (participantsWithPaymentData.length > 0) {
      const dollarsPerHour = participantsWithPaymentData.map(p => {
        const totalPaymentCents = p.submission!.totalPayment!
        const timeTakenSeconds = p.submission!.timeTaken!
        const dollarPerHour = (totalPaymentCents / 100) / (timeTakenSeconds / 3600)
        return dollarPerHour
      })
      averageDollarPerHour = dollarsPerHour.reduce((sum, rate) => sum + rate, 0) / dollarsPerHour.length
    }

    // Calculate average dollar per evaluation from filtered participants
    let averageDollarPerEvaluation = undefined
    if (participantsWithPaymentData.length > 0) {
      const dollarsPerEvaluation = participantsWithPaymentData.map(p => {
        const totalPaymentCents = p.submission!.totalPayment!
        const dollarPerEvaluation = totalPaymentCents / 100
        return dollarPerEvaluation
      })
      averageDollarPerEvaluation = dollarsPerEvaluation.reduce((sum, rate) => sum + rate, 0) / dollarsPerEvaluation.length
    }

    return {
      totalParticipants: participants.length,
      participantsWithDemographics: participantsWithDemographics.length,
      experimentTotalParticipants: experimentParticipants.length,
      averageAge,
      averageDollarPerHour,
      averageDollarPerEvaluation,
    }
  }

  const filteredSummary = getFilteredSummary()

  if (demographicsLoading && allParticipants.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Enhanced Analytics</h2>
            <p className="text-muted-foreground">Model performance with demographic filtering</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enhanced Analytics</h2>
          <p className="text-muted-foreground">Model performance with demographic filtering</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={demographicsLoading || externalLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${demographicsLoading || externalLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Analytics Filters
          </CardTitle>
          <CardDescription>
            Filter all analytics by participant demographics and experiment groups. 
            Showing data for {participants.length} of {allParticipants.length} participants
            {selectedExperiment && (
              <span> from experiment: <strong>{experiments.find(exp => exp.id === selectedExperiment)?.name || 'Unknown'}</strong></span>
            )}.
            {includeAnonymous ? ' (Including anonymous participants)' : ' (Excluding anonymous participants)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Participant Type Toggle */}
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Participant Data</Label>
                <p className="text-xs text-muted-foreground">
                  {includeAnonymous 
                    ? 'Including all participants (anonymous sessions and Prolific users)'
                    : 'Only Prolific participants (excluding anonymous test sessions)'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant={!includeAnonymous ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIncludeAnonymous(false)}
                  className="text-xs"
                >
                  Prolific Only
                </Button>
                <Button
                  variant={includeAnonymous ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIncludeAnonymous(true)}
                  className="text-xs"
                >
                  All
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Age Range Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Age Range</Label>
              <div className="space-y-2">
                <div className="relative h-8">
                  {/* Background track */}
                  <div className="absolute top-3 w-full h-2 bg-gray-200 rounded-lg"></div>
                  
                  {/* Active range track */}
                  <div 
                    className="absolute top-3 h-2 bg-primary rounded-lg"
                    style={{
                      left: `${((filters.ageMin - 18) / (80 - 18)) * 100}%`,
                      width: `${((filters.ageMax - filters.ageMin) / (80 - 18)) * 100}%`
                    }}
                  ></div>
                  
                  {/* Min range slider */}
                  <input
                    type="range"
                    min="18"
                    max="80"
                    value={filters.ageMin}
                    onChange={(e) => {
                      const newMin = Number(e.target.value)
                      setFilters(prev => ({ 
                        ...prev, 
                        ageMin: Math.min(newMin, prev.ageMax - 1)
                      }))
                    }}
                    className="absolute w-full bg-transparent appearance-none cursor-pointer range-slider-thumb range-slider-min"
                  />
                  
                  {/* Max range slider */}
                  <input
                    type="range"
                    min="18"
                    max="80"
                    value={filters.ageMax}
                    onChange={(e) => {
                      const newMax = Number(e.target.value)
                      setFilters(prev => ({ 
                        ...prev, 
                        ageMax: Math.max(newMax, prev.ageMin + 1)
                      }))
                    }}
                    className="absolute w-full bg-transparent appearance-none cursor-pointer range-slider-thumb range-slider-max"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm bg-background border rounded px-2 py-1">{filters.ageMin}</span>
                  <span className="text-xs text-muted-foreground">
                    {filters.ageMin} - {filters.ageMax} years
                  </span>
                  <span className="text-sm bg-background border rounded px-2 py-1">{filters.ageMax}</span>
                </div>
              </div>
            </div>

            {/* Sex Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sex</Label>
              <Select value={filters.sex} onValueChange={(value) => setFilters(prev => ({ ...prev, sex: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableSexes.map(sex => (
                    <SelectItem key={sex} value={sex}>{sex}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Country Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Country</Label>
              <Select value={filters.country} onValueChange={(value) => setFilters(prev => ({ ...prev, country: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {availableCountries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Experiment Group Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Experiment Group</Label>
              <Select value={filters.experimentGroup} onValueChange={(value) => setFilters(prev => ({ ...prev, experimentGroup: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.length > 0 ? (
                    availableGroups.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-groups" disabled>No groups available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Specific Experiment Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Specific Experiment</Label>
              <Select value={selectedExperiment || ''} onValueChange={(value) => onExperimentChange?.(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select experiment" />
                </SelectTrigger>
                <SelectContent>
                  {experiments.length > 0 ? (
                    experiments
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(experiment => (
                        <SelectItem key={experiment.id} value={experiment.id}>
                          {experiment.name} {experiment.prolificStudyId && '(Prolific)'}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="no-experiments" disabled>No experiments available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Actions</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {filteredSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {selectedExperiment ? 'Experiment Participants' : 'Filtered Participants'}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredSummary.totalParticipants}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((filteredSummary.totalParticipants / filteredSummary.experimentTotalParticipants) * 100)}% of {selectedExperiment ? 'experiment total' : 'all participants'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Age</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredSummary.averageAge ? Math.round(filteredSummary.averageAge) : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedExperiment ? 'In this experiment' : 'Years old'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg $/Hour</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredSummary.averageDollarPerHour ? `$${filteredSummary.averageDollarPerHour.toFixed(2)}` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedExperiment ? 'For filtered participants' : 'Per hour worked'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">$/Evaluation</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredSummary.averageDollarPerEvaluation ? `$${filteredSummary.averageDollarPerEvaluation.toFixed(2)}` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedExperiment ? 'From filtered data' : 'Per evaluation'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Model Performance Chart Component with Filtered Data */}
      <ModelPerformanceChart 
        performance={filteredPerformance}
        loading={externalLoading}
      />
    </div>
  )
}