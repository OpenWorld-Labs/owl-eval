import { prisma } from './prisma-client';

// CLI-specific organization functions without Stack Auth dependencies

// Get user's organizations (CLI version)
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

// Get single organization by slug (CLI version)
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

// Check if user has access to organization (CLI version)
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

// Utility function to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}