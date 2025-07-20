import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { createOrganizationWithTeam } from '@/lib/organization';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { name, description } = await request.json();

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Organization name must be less than 100 characters' },
        { status: 400 }
      );
    }

    // Create organization with Stack Auth team
    const organization = await createOrganizationWithTeam(
      name.trim(),
      description?.trim() || '',
      user.id
    );

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
        createdAt: organization.createdAt,
        stackTeamId: organization.stackTeamId,
        role: 'OWNER' // Creator is always owner
      }
    });

  } catch (error) {
    console.error('Organization creation error:', error);
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'An organization with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}