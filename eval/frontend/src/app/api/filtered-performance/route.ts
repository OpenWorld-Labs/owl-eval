import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { filters, selectedExperiment, includeAnonymous, organizationId } = await request.json()
    
    // If organizationId is provided and selectedExperiment is specified, 
    // verify the experiment belongs to the organization
    if (organizationId && selectedExperiment) {
      const experiment = await prisma.experiment.findFirst({
        where: {
          id: selectedExperiment,
          organizationId,
          archived: false
        }
      })
      
      if (!experiment) {
        // Experiment doesn't belong to this organization or doesn't exist
        return NextResponse.json([])
      }
    }
    
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
    
    // Add organization filtering to participant query if provided
    if (organizationId) {
      if (whereClause.AND) {
        whereClause.AND.push({
          experiment: {
            organizationId,
            archived: false
          }
        })
      } else {
        whereClause.experiment = {
          organizationId,
          archived: false
        }
      }
    }
    
    // First, get participants that match the demographic filters
    const participants = await prisma.participant.findMany({
      where: whereClause,
      include: {
        experiment: {
          select: {
            id: true,
            group: true,
            evaluationMode: true
          }
        }
      }
    })

    // Get all experiments to filter by group if needed
    let validExperimentIds: string[] = []
    if (filters.experimentGroup && filters.experimentGroup !== 'all' && filters.experimentGroup !== '') {
      const groupExperiments = await prisma.experiment.findMany({
        where: { 
          group: filters.experimentGroup,
          ...(organizationId && { 
            organizationId,
            archived: false 
          })
        },
        select: { id: true }
      })
      validExperimentIds = groupExperiments.map(exp => exp.id)
    }

    // Filter participants based on demographics and experiment group
    const filteredParticipants = participants.filter(participant => {
      const metadata = participant.metadata as any
      const demographics = metadata?.demographics
      
      if (!demographics) return false

      // Experiment group filter
      if (validExperimentIds.length > 0 && !validExperimentIds.includes(participant.experimentId)) {
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

    // Further filter by specific experiment if provided
    const finalFilteredParticipants = selectedExperiment 
      ? filteredParticipants.filter(p => p.experimentId === selectedExperiment)
      : filteredParticipants


    // Get the experiment IDs from filtered participants
    const filteredExperimentIds = Array.from(new Set(finalFilteredParticipants.map(p => p.experimentId)))
    
    // Only return early if no participants AND no specific experiment selected
    if (filteredExperimentIds.length === 0 && !selectedExperiment) {
      return NextResponse.json([])
    }

    // Get experiment details to determine evaluation modes
    let experiments: any[] = []
    let evaluationModes: string[] = []
    
    if (selectedExperiment) {
      // If a specific experiment is selected, get that experiment directly
      const specificExperiment = await prisma.experiment.findUnique({
        where: { id: selectedExperiment }
      })
      
      if (specificExperiment) {
        experiments = [specificExperiment]
        evaluationModes = [(specificExperiment as any).evaluationMode || 'comparison']
      }
    } else {
      // Otherwise get experiments from filtered participants
      const experimentIds = Array.from(new Set(finalFilteredParticipants.map(p => p.experimentId)))
      experiments = await prisma.experiment.findMany({
        where: { id: { in: experimentIds } }
      })
      evaluationModes = Array.from(new Set(
        experiments.map(exp => (exp as any).evaluationMode || 'comparison')
      ))
    }

    const performance = []

    // Handle Comparison Evaluations (A vs B)
    if (evaluationModes.includes('comparison')) {
      // Build evaluation query - if specific experiment selected, filter by experiment directly
      let evaluationWhere: any = {
        status: 'completed',
        clientMetadata: {
          not: Prisma.JsonNull
        }
      }

      if (selectedExperiment) {
        // If specific experiment selected, filter by experiment through twoVideoComparisonTask
        evaluationWhere.twoVideoComparisonTask = {
          experimentId: selectedExperiment
        }
      } else {
        // Otherwise filter by participant IDs as before
        evaluationWhere.participantId = { in: finalFilteredParticipants.map(p => p.id) }
      }

      const comparisonEvaluations = await prisma.twoVideoComparisonSubmission.findMany({
        where: evaluationWhere,
        include: {
          twoVideoComparisonTask: {
            select: {
              modelA: true,
              modelB: true,
              scenarioId: true,
              experimentId: true
            }
          },
          participant: {
            select: {
              id: true,
              experimentId: true,
              status: true,
              metadata: true
            }
          }
        }
      })


      // Process comparison evaluations
      const comparisonStatsMap: Record<string, {
        A_much_better: number;
        A_slightly_better: number;
        Equal: number;
        B_slightly_better: number;
        B_much_better: number;
        total: number;
        modelA: string;
        modelB: string;
        experimentId: string;
      }> = {}

      for (const evaluation of comparisonEvaluations) {
        // If we queried by experiment directly, we need to apply demographic filters here
        if (selectedExperiment && evaluation.participant) {
          // Check for anonymous participants first
          if (!includeAnonymous && evaluation.participant.id.startsWith('anon-session-')) {
            continue
          }
          
          // Check for returned participants - they should be excluded from counts
          if (evaluation.participant.status === 'returned') {
            continue
          }
          
          const participantMetadata = evaluation.participant.metadata as any
          const demographics = participantMetadata?.demographics
          
          // Apply demographic filters
          if (demographics && demographics.sex !== 'CONSENT_REVOKED') {
            // Age filter
            if (demographics.age && (demographics.age < filters.ageMin || demographics.age > filters.ageMax)) {
              continue
            }
            // Sex filter
            if (filters.sex !== 'all' && demographics.sex !== filters.sex) {
              continue
            }
            // Country filter
            if (filters.country !== 'all' && demographics.country_of_residence !== filters.country) {
              continue
            }
          } else if (filters.sex !== 'all' || filters.country !== 'all') {
            // If demographic filters are set but participant has no demographics or revoked consent, skip
            continue
          }
        }

        const modelA = evaluation.twoVideoComparisonTask.modelA
        const modelB = evaluation.twoVideoComparisonTask.modelB
        const clientMetadata = evaluation.clientMetadata as any

        if (!clientMetadata || typeof clientMetadata !== 'object') continue
        
        const detailedRatings = clientMetadata.detailedRatings
        if (!detailedRatings || typeof detailedRatings !== 'object') continue

        // Process each dimension in the detailedRatings
        for (const [dimension, score] of Object.entries(detailedRatings)) {
          if (typeof score !== 'string') continue
          
          // Use comparison.experimentId instead of evaluation.experimentId
          const experimentId = evaluation.twoVideoComparisonTask.experimentId
          const dimensionKey = `${dimension}_${experimentId}`
          
          if (!comparisonStatsMap[dimensionKey]) {
            comparisonStatsMap[dimensionKey] = {
              A_much_better: 0, A_slightly_better: 0, Equal: 0, 
              B_slightly_better: 0, B_much_better: 0, total: 0,
              modelA: modelA,
              modelB: modelB,
              experimentId: experimentId
            }
          }

          // Map score to detailed format
          let mappedScore: keyof typeof comparisonStatsMap[string] | null = null
          switch (score) {
            case 'A_much_better':
            case 'A_Much_Better':
              mappedScore = 'A_much_better'
              break
            case 'A_slightly_better':
            case 'A_Slightly_Better':
            case 'A':
              mappedScore = 'A_slightly_better'
              break
            case 'Equal':
            case 'equal':
              mappedScore = 'Equal'
              break
            case 'B_slightly_better':
            case 'B_Slightly_Better':
            case 'B':
              mappedScore = 'B_slightly_better'
              break
            case 'B_much_better':
            case 'B_Much_Better':
              mappedScore = 'B_much_better'
              break
          }

          if (mappedScore && mappedScore in comparisonStatsMap[dimensionKey]) {
            comparisonStatsMap[dimensionKey][mappedScore]++
            comparisonStatsMap[dimensionKey].total++
          }
        }
      }

      // Convert comparison stats to performance format
      for (const [dimensionKey, stats] of Object.entries(comparisonStatsMap)) {
        if (stats.total > 0) {
          const dimension = dimensionKey.split('_').slice(0, -1).join('_')
          const modelAWins = stats.A_much_better + stats.A_slightly_better
          const modelBWins = stats.B_much_better + stats.B_slightly_better
          const ties = stats.Equal
          
          // Calculate win rate including ties as 50% (wins + 0.5 * ties) / total
          const modelAWinRate = (modelAWins + 0.5 * ties) / stats.total
          const modelBWinRate = (modelBWins + 0.5 * ties) / stats.total
          
          // Model A performance - from Model A's perspective
          performance.push({
            model: stats.modelA,
            dimension: dimension,
            scenario: undefined,
            win_rate: modelAWinRate,
            num_twoVideoComparisonSubmissions: stats.total,
            experimentId: stats.experimentId,
            evaluationType: 'comparison',
            detailed_scores: {
              A_much_better: stats.A_much_better,
              A_slightly_better: stats.A_slightly_better,
              Equal: stats.Equal,
              B_slightly_better: stats.B_slightly_better,
              B_much_better: stats.B_much_better
            }
          })
          
          // Model B performance - from Model B's perspective (flipped scores)
          performance.push({
            model: stats.modelB,
            dimension: dimension,
            scenario: undefined,
            win_rate: modelBWinRate,
            num_twoVideoComparisonSubmissions: stats.total,
            experimentId: stats.experimentId,
            evaluationType: 'comparison',
            detailed_scores: {
              A_much_better: stats.B_much_better,
              A_slightly_better: stats.B_slightly_better,
              Equal: stats.Equal,
              B_slightly_better: stats.A_slightly_better,
              B_much_better: stats.A_much_better
            }
          })
        }
      }
    }

    // Handle Single Video Evaluations
    if (evaluationModes.includes('single_video')) {
      // Build single video evaluation query
      let singleVideoWhere: any = {
        status: 'completed',
        dimensionScores: { not: null }
      }

      if (selectedExperiment) {
        // If specific experiment selected, filter by experiment through singleVideoEvaluationTask
        singleVideoWhere.singleVideoEvaluationTask = {
          experimentId: selectedExperiment
        }
        // Don't pre-filter by participant when using selectedExperiment - we'll filter manually later
      } else {
        // Otherwise filter by participant IDs as before
        singleVideoWhere.participantId = { in: finalFilteredParticipants.map(p => p.id) }
      }

      const singleVideoEvaluations = await prisma.singleVideoEvaluationSubmission.findMany({
        where: singleVideoWhere,
        include: {
          singleVideoEvaluationTask: {
            select: {
              modelName: true,
              scenarioId: true
            }
          },
          participant: selectedExperiment ? {
            select: {
              id: true,
              experimentId: true,
              status: true,
              metadata: true
            }
          } : undefined
        }
      })

      // Process single video evaluations
      const singleVideoStatsMap: Record<string, {
        totalScore: number;
        count: number;
        scores: number[];
        modelName: string;
        experimentId: string;
      }> = {}

      for (const evaluation of singleVideoEvaluations) {
        // If we queried by experiment directly, we need to apply demographic filters here
        if (selectedExperiment && evaluation.participant) {
          // Check for anonymous participants first
          if (!includeAnonymous && evaluation.participant.id.startsWith('anon-session-')) {
            continue
          }
          
          // Check for returned participants - they should be excluded from counts
          if (evaluation.participant.status === 'returned') {
            continue
          }
          
          const participantMetadata = evaluation.participant.metadata as any
          const demographics = participantMetadata?.demographics
          
          // Apply demographic filters
          if (demographics && demographics.sex !== 'CONSENT_REVOKED') {
            // Age filter
            if (demographics.age && (demographics.age < filters.ageMin || demographics.age > filters.ageMax)) {
              continue
            }
            // Sex filter
            if (filters.sex !== 'all' && demographics.sex !== filters.sex) {
              continue
            }
            // Country filter
            if (filters.country !== 'all' && demographics.country_of_residence !== filters.country) {
              continue
            }
          } else if (filters.sex !== 'all' || filters.country !== 'all') {
            // If demographic filters are set but participant has no demographics or revoked consent, skip
            continue
          }
        }

        const modelName = evaluation.singleVideoEvaluationTask.modelName
        const dimensionScores = evaluation.dimensionScores as any

        if (!dimensionScores || typeof dimensionScores !== 'object') continue

        // Process each dimension score (1-5 scale)
        for (const [dimension, score] of Object.entries(dimensionScores)) {
          if (typeof score !== 'number' || score < 1 || score > 5) continue
          
          // Use the actual experiment ID - check if it's directly on evaluation or needs to be passed differently
          const experimentId = selectedExperiment || evaluation.experimentId
          const dimensionKey = `${dimension}_${experimentId}_${modelName}`
          
          if (!singleVideoStatsMap[dimensionKey]) {
            singleVideoStatsMap[dimensionKey] = {
              totalScore: 0,
              count: 0,
              scores: [],
              modelName: modelName,
              experimentId: experimentId
            }
          }

          singleVideoStatsMap[dimensionKey].totalScore += score
          singleVideoStatsMap[dimensionKey].count++
          singleVideoStatsMap[dimensionKey].scores.push(score)
        }
      }

      // Convert single video stats to performance format
      for (const [dimensionKey, stats] of Object.entries(singleVideoStatsMap)) {
        if (stats.count > 0) {
          const keyParts = dimensionKey.split('_')
          const dimension = keyParts.slice(0, -2).join('_') // Remove experimentId and modelName
          const averageScore = stats.totalScore / stats.count
          
          // Convert 1-5 scale to 0-1 "quality score" (4-5 considered good)
          const qualityRate = stats.scores.filter(s => s >= 4).length / stats.scores.length
          
          performance.push({
            model: stats.modelName,
            dimension: dimension,
            scenario: undefined,
            win_rate: qualityRate, // For single video, "win rate" = proportion of high scores
            quality_score: averageScore, // Average 1-5 rating
            num_singleVideoEvaluationSubmissions: stats.count,
            experimentId: stats.experimentId,
            evaluationType: 'single_video',
            score_distribution: {
              1: stats.scores.filter(s => s === 1).length,
              2: stats.scores.filter(s => s === 2).length,
              3: stats.scores.filter(s => s === 3).length,
              4: stats.scores.filter(s => s === 4).length,
              5: stats.scores.filter(s => s === 5).length
            }
          })
        }
      }
    }

    return NextResponse.json(performance)
  } catch (error) {
    console.error('Error fetching filtered performance data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filtered performance data' },
      { status: 500 }
    )
  }
}