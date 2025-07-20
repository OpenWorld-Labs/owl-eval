import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeAnonymous = searchParams.get('includeAnonymous') === 'true'
    const organizationId = searchParams.get('organizationId')
    
    // Build where clause based on whether to include anonymous participants
    let whereClause: any = includeAnonymous ? {
      status: {
        not: 'returned'  // Always exclude returned participants
      }
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
          status: {
            not: 'returned'  // Always exclude returned participants
          }
        }
      ]
    }
    
    // Add organization filtering if provided
    if (organizationId) {
      whereClause.experiment = {
        organizationId,
        archived: false
      }
    }
    
    // Fetch participants with their demographics and experiment data
    const participants = await prisma.participant.findMany({
      where: whereClause,
      include: {
        experiment: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    })

    // Transform data for the dashboard
    const participantsWithDemographics = participants.map(participant => {
      const metadata = participant.metadata as any
      const demographics = metadata?.demographics || null
      
      return {
        id: participant.id,
        prolificId: participant.prolificId,
        experimentId: participant.experimentId,
        experimentName: participant.experiment.name || participant.experiment.slug,
        status: participant.status,
        completedAt: participant.completedAt,
        demographics: demographics,
        submission: {
          reward: metadata?.reward,
          timeTaken: metadata?.timeTaken,
          totalPayment: metadata?.totalPayment
        }
      }
    })

    // Calculate summary statistics
    const totalParticipants = participants.length
    const participantsWithDemographicsData = participantsWithDemographics.filter(p => p.demographics)
    const participantsWithDemographicsCount = participantsWithDemographicsData.length

    // Age statistics
    const ages = participantsWithDemographicsData
      .map(p => p.demographics?.age)
      .filter(age => age !== undefined && age !== null) as number[]
    const averageAge = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : undefined

    // Payment and time statistics
    const participantsWithPaymentData = participantsWithDemographics.filter(p => 
      p.submission?.totalPayment && p.submission?.timeTaken
    )
    
    // Calculate dollar per hour
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

    // Calculate dollar per evaluation (assuming each participant completes multiple evaluations)
    // We'll need to get the evaluation count from the experiment config or database
    const experiment = await prisma.experiment.findFirst({
      where: { participants: { some: { id: { in: participants.map(p => p.id) } } } },
      include: { _count: { select: { twoVideoComparisonTasks: true } } }
    })
    
    let averageDollarPerEvaluation = undefined
    if (experiment && participantsWithPaymentData.length > 0) {
      // Assuming each participant evaluates all comparisons
      const evaluationsPerParticipant = experiment._count.twoVideoComparisonTasks
      if (evaluationsPerParticipant > 0) {
        const dollarsPerEvaluation = participantsWithPaymentData.map(p => {
          const totalPaymentCents = p.submission!.totalPayment!
          return (totalPaymentCents / 100) / evaluationsPerParticipant
        })
        averageDollarPerEvaluation = dollarsPerEvaluation.reduce((sum, rate) => sum + rate, 0) / dollarsPerEvaluation.length
      }
    }

    // Sex distribution
    const sexDistribution: Record<string, number> = {}
    participantsWithDemographicsData.forEach(p => {
      const sex = p.demographics?.sex || 'Not specified'
      sexDistribution[sex] = (sexDistribution[sex] || 0) + 1
    })

    // Nationality distribution
    const nationalityDistribution: Record<string, number> = {}
    participantsWithDemographicsData.forEach(p => {
      const nationality = p.demographics?.nationality || 'Not specified'
      nationalityDistribution[nationality] = (nationalityDistribution[nationality] || 0) + 1
    })

    // Employment status distribution
    const employmentDistribution: Record<string, number> = {}
    participantsWithDemographicsData.forEach(p => {
      const employment = p.demographics?.employment_status || 'Not specified'
      employmentDistribution[employment] = (employmentDistribution[employment] || 0) + 1
    })

    // Country distribution (country of residence)
    const countryDistribution: Record<string, number> = {}
    participantsWithDemographicsData.forEach(p => {
      const country = p.demographics?.country_of_residence || 'Not specified'
      countryDistribution[country] = (countryDistribution[country] || 0) + 1
    })

    const summary = {
      totalParticipants,
      participantsWithDemographics: participantsWithDemographicsCount,
      averageAge,
      averageDollarPerHour,
      averageDollarPerEvaluation,
      sexDistribution,
      nationalityDistribution,
      employmentDistribution,
      countryDistribution
    }

    return NextResponse.json({
      participants: participantsWithDemographics,
      summary
    })
  } catch (error) {
    console.error('Error fetching demographics data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch demographics data' },
      { status: 500 }
    )
  }
}