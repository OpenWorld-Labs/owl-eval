import { PrismaClient } from '@prisma/client';
import { stackServerApp } from '@/stack';

const prisma = new PrismaClient();

// Utility function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

// App-driven organization creation (industry standard approach)
export async function createOrganizationWithTeam(
  name: string,
  description: string,
  creatorUserId: string
) {
  console.log('🏗️ Creating organization:', name, 'for user:', creatorUserId);
  
  try {
    // Step 1: Create organization in our database first
    const slug = generateSlug(name);
    
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description,
        settings: {
          experimentLimit: 10, // Default limits
          videoLimit: 100,
          memberLimit: 5,
        },
        // Stack Auth team will be linked after creation
        stackTeamId: null,
        members: {
          create: {
            stackUserId: creatorUserId,
            role: 'OWNER'
          }
        }
      },
      include: {
        members: true
      }
    });
    
    console.log('✅ Organization created in database:', organization.id);
    
    // Step 2: Create corresponding Stack Auth team
    try {
      const stackTeam = await stackServerApp.createTeam({
        displayName: name,
        creatorUserId: creatorUserId,
      });
      
      console.log('✅ Stack Auth team created:', stackTeam.id);
      
      // Step 3: Link them together
      const updatedOrganization = await prisma.organization.update({
        where: { id: organization.id },
        data: { stackTeamId: stackTeam.id },
        include: {
          members: true
        }
      });
      
      console.log('✅ Organization linked to Stack Auth team');
      return updatedOrganization;
      
    } catch (stackError) {
      console.error('❌ Stack Auth team creation failed:', stackError);
      
      // Don't fail the organization creation - just log the error
      // The organization can still work without Stack Auth team
      console.log('⚠️ Organization created without Stack Auth team link');
      return organization;
    }
    
  } catch (error) {
    console.error('❌ Organization creation failed:', error);
    throw new Error(`Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get user's organizations
export async function getUserOrganizations(userId: string) {
  return await prisma.organizationMember.findMany({
    where: { stackUserId: userId },
    include: {
      organization: true
    },
    orderBy: {
      joinedAt: 'asc'
    }
  });
}

// Get single organization by slug
export async function getOrganizationBySlug(slug: string) {
  return await prisma.organization.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          organization: true
        }
      }
    }
  });
}

// Check if user has access to organization
export async function checkOrganizationAccess(
  organizationId: string,
  userId: string,
  requiredRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_stackUserId: {
        organizationId,
        stackUserId: userId
      }
    }
  });
  
  if (!membership) return false;
  
  if (!requiredRole) return true;
  
  // Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
  const roleHierarchy = {
    'VIEWER': 0,
    'MEMBER': 1,
    'ADMIN': 2,
    'OWNER': 3
  };
  
  return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
}

// Add member to organization
export async function addOrganizationMember(
  organizationId: string,
  userId: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'
) {
  // Check if organization exists and has Stack Auth team
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });
  
  if (!organization) {
    throw new Error('Organization not found');
  }
  
  // Add to our database
  const member = await prisma.organizationMember.create({
    data: {
      organizationId,
      stackUserId: userId,
      role
    }
  });
  
  // Add to Stack Auth team if linked
  if (organization.stackTeamId) {
    try {
      // TODO: Implement Stack Auth team member addition
      // await stackServerApp.addTeamMember({
      //   teamId: organization.stackTeamId,
      //   userId: userId,
      // });
      console.log('✅ Would add user to Stack Auth team (not implemented yet)');
    } catch (error) {
      console.error('⚠️ Failed to add user to Stack Auth team:', error);
      // Don't fail the operation - member is still added to our database
    }
  }
  
  return member;
}

// Remove member from organization
export async function removeOrganizationMember(
  organizationId: string,
  userId: string
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });
  
  if (!organization) {
    throw new Error('Organization not found');
  }
  
  // Remove from our database
  await prisma.organizationMember.delete({
    where: {
      organizationId_stackUserId: {
        organizationId,
        stackUserId: userId
      }
    }
  });
  
  // Remove from Stack Auth team if linked
  if (organization.stackTeamId) {
    try {
      // TODO: Implement Stack Auth team member removal
      // await stackServerApp.removeTeamMember({
      //   teamId: organization.stackTeamId,
      //   userId: userId,
      // });
      console.log('✅ Would remove user from Stack Auth team (not implemented yet)');
    } catch (error) {
      console.error('⚠️ Failed to remove user from Stack Auth team:', error);
    }
  }
}

export { generateSlug };