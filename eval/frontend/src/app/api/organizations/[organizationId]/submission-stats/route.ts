import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { getUserOrganizations } from '@/lib/organization';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Verify user has access to this organization
    const userOrganizations = await getUserOrganizations(user.id);
    const hasAccess = userOrganizations.some(org => org.organization.id === organizationId);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get filters from URL params
    const { searchParams } = new URL(request.url);
    const groupFilter = searchParams.get('group');
    const includeAnonymous = searchParams.get('includeAnonymous') === 'true';
    
    // Build where clause for filtering - must include organizationId
    const whereClause = {
      experiment: {
        organizationId,
        archived: false,
        ...(groupFilter && { group: groupFilter })
      }
    };
    
    // Build where clause for evaluations based on anonymous inclusion
    const evaluationWhereClause = includeAnonymous ? {
      ...whereClause,
      participant: {
        status: {
          not: 'returned'  // Always exclude returned participants
        }
      }
    } : {
      ...whereClause,
      participant: {
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
    };
    
    // Get total counts - only completed evaluations from non-archived experiments
    const [totalComparisons, totalEvaluations, totalVideoTasks, totalSingleVideoEvaluations] = await Promise.all([
      prisma.twoVideoComparisonTask.count({
        where: whereClause
      }),
      prisma.twoVideoComparisonSubmission.count({
        where: {
          status: 'completed',
          ...evaluationWhereClause
        }
      }),
      prisma.singleVideoEvaluationTask.count({
        where: whereClause
      }),
      prisma.singleVideoEvaluationSubmission.count({
        where: {
          status: 'completed',
          ...evaluationWhereClause
        }
      })
    ]);

    // Get evaluations by scenario for both comparison and single video evaluations
    const [comparisons, videoTasks] = await Promise.all([
      prisma.twoVideoComparisonTask.findMany({
        where: whereClause,
        select: {
          id: true,
          scenarioId: true,
          _count: {
            select: {
              twoVideoComparisonSubmissions: includeAnonymous ? {
                where: {
                  status: 'completed',
                  participant: {
                    status: {
                      not: 'returned'  // Always exclude returned participants
                    }
                  }
                }
              } : {
                where: {
                  status: 'completed',
                  participant: {
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
                }
              }
            }
          }
        }
      }),
      prisma.singleVideoEvaluationTask.findMany({
        where: whereClause,
        select: {
          id: true,
          scenarioId: true,
          _count: {
            select: {
              singleVideoEvaluationSubmissions: includeAnonymous ? {
                where: {
                  status: 'completed',
                  participant: {
                    status: {
                      not: 'returned'  // Always exclude returned participants
                    }
                  }
                }
              } : {
                where: {
                  status: 'completed',
                  participant: {
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
                }
              }
            }
          }
        }
      })
    ]);

    const evaluationsByScenario: Record<string, number> = {};
    
    // Add comparison evaluations by scenario
    for (const comparison of comparisons) {
      const scenario = comparison.scenarioId;
      if (!evaluationsByScenario[scenario]) {
        evaluationsByScenario[scenario] = 0;
      }
      evaluationsByScenario[scenario] += comparison._count.twoVideoComparisonSubmissions;
    }
    
    // Add single video evaluations by scenario
    for (const videoTask of videoTasks) {
      const scenario = videoTask.scenarioId;
      if (!evaluationsByScenario[scenario]) {
        evaluationsByScenario[scenario] = 0;
      }
      evaluationsByScenario[scenario] += videoTask._count.singleVideoEvaluationSubmissions;
    }
    
    return NextResponse.json({
      total_tasks: totalComparisons + totalVideoTasks,
      total_submissions: totalEvaluations + totalSingleVideoEvaluations,
      total_comparison_tasks: totalComparisons,
      total_single_video_tasks: totalVideoTasks,
      total_comparison_submissions: totalEvaluations,
      total_single_video_submissions: totalSingleVideoEvaluations,
      evaluations_by_scenario: evaluationsByScenario,
      target_evaluations_per_comparison: 5 // Default target
    });
  } catch (error) {
    console.error('Error fetching organization submission stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}