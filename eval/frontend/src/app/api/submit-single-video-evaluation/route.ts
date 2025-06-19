import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Validate required fields
    if (!data.video_task_id || !data.dimension_scores) {
      return NextResponse.json({ 
        error: 'Missing required fields: video_task_id and dimension_scores' 
      }, { status: 400 })
    }

    // Get the video task to extract the experimentId
    const videoTask = await prisma.videoTask.findUnique({
      where: { id: data.video_task_id },
    });

    if (!videoTask) {
      return NextResponse.json(
        { error: 'Video task not found' },
        { status: 404 }
      );
    }

    const actualExperimentId = data.experiment_id || videoTask.experimentId;

    // Handle anonymous users - use consistent participant ID per session
    let actualParticipantId = data.participant_id;
    
    if (!data.participant_id || data.participant_id === 'anonymous') {
      // Generate session-based participant ID for anonymous users
      const sessionId = data.session_id || 'anon-session';
      actualParticipantId = `anon-${sessionId}`;
      
      // Check if we need to create an anonymous participant record
      const existingParticipant = await prisma.participant.findUnique({
        where: { id: actualParticipantId },
      });
      
      if (!existingParticipant) {
        // Get all video tasks for this experiment to assign them all
        const allVideoTasks = await prisma.videoTask.findMany({
          where: { experimentId: actualExperimentId },
          select: { id: true }
        });
        
        // Create an anonymous participant record with all video tasks assigned
        await prisma.participant.create({
          data: {
            id: actualParticipantId,
            prolificId: data.evaluator_id || `anon-${Date.now()}`,
            experimentId: actualExperimentId,
            sessionId: sessionId,
            status: 'active',
            assignedComparisons: [], // Empty for single video mode
            assignedVideoTasks: allVideoTasks.map(vt => vt.id),
          },
        });
      }
    }

    // Check if there's already a completed evaluation for this participant/video task
    const existingCompleteEvaluation = await prisma.singleVideoEvaluation.findUnique({
      where: {
        videoTaskId_participantId: {
          videoTaskId: data.video_task_id,
          participantId: actualParticipantId,
        },
      },
    });

    // If there's already a completed evaluation, prevent duplicate submission
    if (existingCompleteEvaluation && existingCompleteEvaluation.status === 'completed') {
      return NextResponse.json(
        { error: 'Evaluation already completed for this participant' },
        { status: 409 }
      );
    }
    
    // Update existing draft or create new evaluation
    const evaluation = await prisma.singleVideoEvaluation.upsert({
      where: {
        videoTaskId_participantId: {
          videoTaskId: data.video_task_id,
          participantId: actualParticipantId
        }
      },
      update: {
        dimensionScores: data.dimension_scores,
        completionTimeSeconds: data.completion_time_seconds || null,
        clientMetadata: {
          evaluatorId: data.evaluator_id || 'anonymous',
          submittedAt: new Date().toISOString()
        },
        status: 'completed',
        lastSavedAt: new Date()
      },
      create: {
        videoTaskId: data.video_task_id,
        participantId: actualParticipantId,
        experimentId: actualExperimentId,
        dimensionScores: data.dimension_scores,
        completionTimeSeconds: data.completion_time_seconds || null,
        clientMetadata: {
          evaluatorId: data.evaluator_id || 'anonymous',
          submittedAt: new Date().toISOString()
        },
        status: 'completed'
      }
    })
    
    // If this is a Prolific participant, check if they've completed all assigned video tasks
    if (data.participant_id) {
      const participant = await prisma.participant.findUnique({
        where: { id: data.participant_id },
        include: {
          singleVideoEvals: true
        }
      })
      
      if (participant) {
        const assignedVideoTasks = participant.assignedVideoTasks as string[]
        const completedVideoTasks = participant.singleVideoEvals
          .filter(e => e.status === 'completed')
          .map(e => e.videoTaskId)
        
        // Check if all assigned video tasks are completed
        const allCompleted = assignedVideoTasks.every(taskId => 
          completedVideoTasks.includes(taskId)
        )
        
        if (allCompleted && participant.status !== 'completed') {
          await prisma.participant.update({
            where: { id: data.participant_id },
            data: {
              status: 'completed',
              completedAt: new Date()
            }
          })
        }
      }
    }
    
    // Check if there are more video tasks available in this experiment
    let nextVideoTask = null;
    if (!data.participant_id || data.participant_id === 'anonymous') {
      // Get all video tasks in this experiment
      const allVideoTasks = await prisma.videoTask.findMany({
        where: { 
          experimentId: actualExperimentId
        },
        orderBy: { createdAt: 'asc' }
      });

      // Find video tasks that haven't been evaluated by this user
      for (const task of allVideoTasks) {
        const existingEval = await prisma.singleVideoEvaluation.findUnique({
          where: {
            videoTaskId_participantId: {
              videoTaskId: task.id,
              participantId: actualParticipantId
            }
          }
        });
        
        if (!existingEval || existingEval.status !== 'completed') {
          nextVideoTask = task.id;
          break;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      evaluation_id: evaluation.id,
      next_video_task_id: nextVideoTask
    })
  } catch (error) {
    console.error('Error submitting single video evaluation:', error)
    return NextResponse.json({ 
      error: 'Failed to submit evaluation' 
    }, { status: 500 })
  }
}