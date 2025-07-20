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
    const includeAnonymous = searchParams.get('includeAnonymous') === 'true';
    
    // Build participant filter based on anonymous inclusion
    const participantFilter = includeAnonymous ? {
      participant: {
        status: {
          not: 'returned'  // Always exclude returned participants
        }
      },
      twoVideoComparisonTask: {
        experiment: {
          organizationId
        }
      }
    } : {
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
      },
      twoVideoComparisonTask: {
        experiment: {
          organizationId
        }
      }
    };

    const singleVideoParticipantFilter = includeAnonymous ? {
      participant: {
        status: {
          not: 'returned'  // Always exclude returned participants
        }
      },
      singleVideoEvaluationTask: {
        experiment: {
          organizationId
        }
      }
    } : {
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
      },
      singleVideoEvaluationTask: {
        experiment: {
          organizationId
        }
      }
    };
    
    // Get evaluation counts by status for both evaluation types
    const [completed, draft, total, singleVideoCompleted, singleVideoDraft, singleVideoTotal] = await Promise.all([
      prisma.twoVideoComparisonSubmission.count({
        where: { 
          status: 'completed',
          ...participantFilter
        }
      }),
      prisma.twoVideoComparisonSubmission.count({
        where: { 
          status: 'draft',
          ...participantFilter
        }
      }),
      prisma.twoVideoComparisonSubmission.count({
        where: participantFilter
      }),
      prisma.singleVideoEvaluationSubmission.count({
        where: { 
          status: 'completed',
          ...singleVideoParticipantFilter
        }
      }),
      prisma.singleVideoEvaluationSubmission.count({
        where: { 
          status: 'draft',
          ...singleVideoParticipantFilter
        }
      }),
      prisma.singleVideoEvaluationSubmission.count({
        where: singleVideoParticipantFilter
      })
    ]);

    return NextResponse.json({
      completed: completed + singleVideoCompleted,
      draft: draft + singleVideoDraft,
      total: total + singleVideoTotal,
      active: 0 // We don't track "active" evaluations, only draft and completed
    });
  } catch (error) {
    console.error('Error fetching organization submission status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}