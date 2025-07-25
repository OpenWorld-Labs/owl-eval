import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params

    // First try to find it as a two-video comparison task
    const comparisonTask = await prisma.twoVideoComparisonTask.findUnique({
      where: { id: taskId },
      include: {
        experiment: {
          select: {
            id: true,
            name: true,
            config: true,
          }
        }
      }
    })

    if (comparisonTask) {
      // Transform the data to match the expected Comparison interface
      const transformedTask = {
        comparison_id: comparisonTask.id,
        scenario_id: comparisonTask.scenarioId,
        scenario_metadata: {
          name: (comparisonTask.metadata as any)?.scenario?.name || comparisonTask.scenarioId,
          description: (comparisonTask.metadata as any)?.scenario?.description || ''
        },
        model_a_video_path: comparisonTask.videoAPath,
        model_b_video_path: comparisonTask.videoBPath,
        randomized_labels: {
          A: comparisonTask.modelA,
          B: comparisonTask.modelB
        },
        experiment: comparisonTask.experiment
      }

      return NextResponse.json({
        type: 'comparison',
        task: transformedTask
      })
    }

    // If not found, try as a single video evaluation task
    const videoTask = await prisma.singleVideoEvaluationTask.findUnique({
      where: { id: taskId },
      include: {
        experiment: {
          select: {
            id: true,
            name: true,
            config: true,
          }
        }
      }
    })

    if (videoTask) {
      return NextResponse.json({
        type: 'single_video',
        task: videoTask
      })
    }

    // Neither task type found
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )

  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}