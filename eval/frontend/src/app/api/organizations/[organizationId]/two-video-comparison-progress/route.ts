import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { getUserOrganizations } from '@/lib/organization';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface ComparisonProgress {
  id: string;
  scenarioId: string;
  modelA: string;
  modelB: string;
  evaluationCount: number;
  targetEvaluations: number;
  progressPercentage: number;
}

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

    const comparisons = await prisma.twoVideoComparisonTask.findMany({
      where: {
        experiment: {
          organizationId
        }
      },
      include: {
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
        },
        experiment: {
          select: {
            config: true
          }
        }
      },
      orderBy: {
        scenarioId: 'asc'
      }
    });

    const progressData: ComparisonProgress[] = comparisons.map(comparison => {
      let targetEvaluations = 0;

      if (comparison.experiment?.config) {
        try {
          const config = typeof comparison.experiment.config === 'string'
            ? JSON.parse(comparison.experiment.config)
            : comparison.experiment.config;

          if (typeof config.evaluationsPerComparison === 'number') {
            targetEvaluations = config.evaluationsPerComparison;
          }
        } catch (e) {
          console.warn('Invalid JSON in experiment.config for comparison', comparison.id);
        }
      }

      return {
        id: comparison.id,
        scenarioId: comparison.scenarioId,
        modelA: comparison.modelA,
        modelB: comparison.modelB,
        evaluationCount: comparison._count.twoVideoComparisonSubmissions,
        targetEvaluations,
        progressPercentage: targetEvaluations > 0
          ? Math.round((comparison._count.twoVideoComparisonSubmissions / targetEvaluations) * 100)
          : 0
      };
    });

    return NextResponse.json(progressData);
  } catch (error) {
    console.error('Error fetching organization comparison progress:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}