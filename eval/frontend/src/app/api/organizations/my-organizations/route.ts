import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { getUserOrganizations } from '@/lib/organization';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organizations
    const organizations = await getUserOrganizations(user.id);

    return NextResponse.json({
      success: true,
      organizations: organizations.map(membership => ({
        id: membership.id,
        role: membership.role,
        joinedAt: membership.joinedAt,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          description: membership.organization.description,
          createdAt: membership.organization.createdAt,
          stackTeamId: membership.organization.stackTeamId,
        }
      }))
    });

  } catch (error) {
    console.error('Error fetching user organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}