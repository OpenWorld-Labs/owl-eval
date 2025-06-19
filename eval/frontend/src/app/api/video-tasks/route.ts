import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Get experiment ID from session storage if this is a Prolific participant
    const url = new URL(request.url)
    const experimentId = url.searchParams.get('experimentId')
    
    let videoTasks
    
    if (experimentId) {
      // Get video tasks for specific experiment
      videoTasks = await prisma.videoTask.findMany({
        where: { experimentId },
        include: {
          _count: {
            select: { 
              singleVideoEvals: {
                where: {
                  status: 'completed'
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } else {
      // Get all active experiments' video tasks for non-Prolific users
      const activeExperiments = await prisma.experiment.findMany({
        where: { 
          status: 'active',
          evaluationMode: 'single_video'
        },
        select: { id: true }
      })
      
      videoTasks = await prisma.videoTask.findMany({
        where: {
          experimentId: {
            in: activeExperiments.map(e => e.id)
          }
        },
        include: {
          _count: {
            select: { 
              singleVideoEvals: {
                where: {
                  status: 'completed'
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    }
    
    const videoTaskList = videoTasks.map(videoTask => ({
      video_task_id: videoTask.id,
      scenario_id: videoTask.scenarioId,
      model_name: videoTask.modelName,
      video_path: videoTask.videoPath,
      created_at: videoTask.createdAt.toISOString(),
      num_evaluations: videoTask._count.singleVideoEvals,
      evaluation_url: `/evaluate-video/${videoTask.id}`
    }))
    
    return NextResponse.json(videoTaskList)
  } catch (error) {
    console.error('Error fetching video tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch video tasks' }, { status: 500 })
  }
}