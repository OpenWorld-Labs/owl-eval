import { getUserOrganizations } from './organization';

// Determine where to redirect user after sign-in based on their organizations
export async function determineUserFlow(userId: string): Promise<string> {
  try {
    const userOrganizations = await getUserOrganizations(userId);
    
    if (userOrganizations.length === 0) {
      // No organizations - redirect to create first organization
      return '/onboarding/create-organization';
    } else if (userOrganizations.length === 1) {
      // Single organization - auto-select and redirect to dashboard
      const org = userOrganizations[0].organization;
      return `/${org.slug}/dashboard`;
    } else {
      // Multiple organizations - show organization picker
      return '/organizations/select';
    }
  } catch (error) {
    console.error('Error determining user flow:', error);
    // Fallback to onboarding
    return '/onboarding/create-organization';
  }
}

// Check if user needs onboarding
export async function userNeedsOnboarding(userId: string): Promise<boolean> {
  try {
    const userOrganizations = await getUserOrganizations(userId);
    return userOrganizations.length === 0;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return true; // Err on the side of showing onboarding
  }
}

// Get user's default organization (first one they joined)
export async function getUserDefaultOrganization(userId: string) {
  try {
    const userOrganizations = await getUserOrganizations(userId);
    return userOrganizations[0]?.organization || null;
  } catch (error) {
    console.error('Error getting default organization:', error);
    return null;
  }
}

// Validate organization access for routing
export async function validateOrganizationAccess(
  orgSlug: string,
  userId: string
): Promise<{ hasAccess: boolean; organization?: any; role?: string }> {
  try {
    const userOrganizations = await getUserOrganizations(userId);
    const membership = userOrganizations.find(
      m => m.organization.slug === orgSlug
    );
    
    if (membership) {
      return {
        hasAccess: true,
        organization: membership.organization,
        role: membership.role
      };
    }
    
    return { hasAccess: false };
  } catch (error) {
    console.error('Error validating organization access:', error);
    return { hasAccess: false };
  }
}