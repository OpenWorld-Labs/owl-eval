'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RefreshCw, Users, Globe, MapPin, Briefcase, GraduationCap } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

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

interface DemographicsDashboardProps {
  currentOrganization?: {
    id: string
    name: string
    slug: string
    description?: string
    role: string
  } | null
}

export function DemographicsDashboard({ currentOrganization }: DemographicsDashboardProps) {
  const [participants, setParticipants] = useState<ParticipantDemographics[]>([])
  const [summary, setSummary] = useState<DemographicsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [includeAnonymous, setIncludeAnonymous] = useState(false)

  const fetchDemographicsData = useCallback(async () => {
    if (!currentOrganization) {
      setParticipants([])
      setSummary(null)
      setLoading(false)
      setRefreshing(false)
      return
    }
    
    try {
      const response = await fetch(`/api/demographics?organizationId=${currentOrganization.id}&includeAnonymous=${includeAnonymous}`)
      if (!response.ok) {
        throw new Error('Failed to fetch demographics data')
      }
      const data = await response.json()
      setParticipants(data.participants || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error('Error fetching demographics:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch demographics data. Please try refreshing.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentOrganization, includeAnonymous])


  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDemographicsData()
  }

  useEffect(() => {
    fetchDemographicsData()
  }, [fetchDemographicsData])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Demographics Dashboard</h2>
            <p className="text-muted-foreground">View participant demographic data from Prolific</p>
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
          <h2 className="text-2xl font-bold">Demographics Details</h2>
          <p className="text-muted-foreground">
            Detailed participant demographic information and payment data. 
            <br />
            <span className="text-sm">💡 Use the Analytics tab to filter demographics data and see filtered performance metrics</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Include Anonymous Users Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="include-anonymous"
              checked={includeAnonymous}
              onCheckedChange={setIncludeAnonymous}
            />
            <Label htmlFor="include-anonymous" className="text-sm font-medium">
              Include Anonymous Users
            </Label>
            <div className="text-xs text-muted-foreground">
              {includeAnonymous ? 'Showing all users (Prolific + Anonymous)' : 'Prolific users only'}
            </div>
          </div>
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
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalParticipants}</div>
              <p className="text-xs text-muted-foreground">
                {summary.participantsWithDemographics} with demographics
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
                {summary.averageAge ? Math.round(summary.averageAge) : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Years old
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Countries</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(summary.countryDistribution).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Unique countries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Coverage</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalParticipants > 0 
                  ? Math.round((summary.participantsWithDemographics / summary.totalParticipants) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Have demographics
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
                {summary.averageDollarPerHour ? `$${summary.averageDollarPerHour.toFixed(2)}` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per hour worked
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
                {summary.averageDollarPerEvaluation ? `$${summary.averageDollarPerEvaluation.toFixed(2)}` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per evaluation
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Demographics Breakdown */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sex Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sex Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.sexDistribution).map(([sex, count]) => (
                  <div key={sex} className="flex justify-between items-center">
                    <span className="capitalize">{sex || 'Not specified'}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employment Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Employment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.employmentDistribution).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm">{status || 'Not specified'}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Countries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Countries (Top 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.countryDistribution)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([country, count]) => (
                  <div key={country} className="flex justify-between items-center">
                    <span className="text-sm">{country || 'Not specified'}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Participants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Participants Demographics</CardTitle>
          <CardDescription>
            Detailed demographic information for each participant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No participant demographics data found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Demographics data is fetched when syncing with Prolific studies.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {participants.map((participant) => (
                <div key={participant.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium">Prolific ID: {participant.prolificId}</h4>
                      <p className="text-sm text-muted-foreground">
                        Experiment: {participant.experimentName}
                      </p>
                      <Badge variant={participant.status === 'approved' ? 'default' : 'secondary'}>
                        {participant.status}
                      </Badge>
                    </div>
                    {participant.completedAt && (
                      <p className="text-sm text-muted-foreground">
                        Completed: {new Date(participant.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  {participant.demographics ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      {participant.demographics.age && (
                        <div>
                          <span className="font-medium">Age:</span> {participant.demographics.age}
                        </div>
                      )}
                      {participant.demographics.sex && (
                        <div>
                          <span className="font-medium">Sex:</span> {participant.demographics.sex}
                        </div>
                      )}
                      {participant.demographics.nationality && (
                        <div>
                          <span className="font-medium">Nationality:</span> {participant.demographics.nationality}
                        </div>
                      )}
                      {participant.demographics.country_of_residence && (
                        <div>
                          <span className="font-medium">Country:</span> {participant.demographics.country_of_residence}
                        </div>
                      )}
                      {participant.demographics.employment_status && (
                        <div>
                          <span className="font-medium">Employment:</span> {participant.demographics.employment_status}
                        </div>
                      )}
                      {participant.demographics.student_status && (
                        <div>
                          <span className="font-medium">Student Status:</span> {participant.demographics.student_status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No demographic data available for this participant.
                    </p>
                  )}
                  
                  {participant.submission && (
                    <>
                      <div className="border-t my-3" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {participant.submission.reward && (
                          <div>
                            <span className="font-medium">Reward:</span> ${(participant.submission.reward / 100).toFixed(2)}
                          </div>
                        )}
                        {participant.submission.timeTaken && (
                          <div>
                            <span className="font-medium">Time:</span> {Math.round(participant.submission.timeTaken / 60)} min
                          </div>
                        )}
                        {participant.submission.totalPayment && (
                          <div>
                            <span className="font-medium">Total Payment:</span> ${(participant.submission.totalPayment / 100).toFixed(2)}
                          </div>
                        )}
                        {participant.submission.totalPayment && participant.submission.timeTaken && (
                          <div>
                            <span className="font-medium">$/Hour:</span> ${((participant.submission.totalPayment / 100) / (participant.submission.timeTaken / 60)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}