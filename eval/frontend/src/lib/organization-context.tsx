'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@stackframe/stack';
import { useRouter } from 'next/navigation';

type Organization = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

type OrganizationContextType = {
  currentOrganization: Organization | null;
  organizations: Organization[];
  switchOrganization: (organizationId: string) => void;
  loading: boolean;
  switching: boolean;
  refetchOrganizations: () => Promise<void>;
};

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Fetch user's organizations
  const fetchOrganizations = useCallback(async () => {
    if (!user?.id) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/organizations/my-organizations');
      
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      
      const data = await response.json();
      const userOrgs = data.organizations.map((membership: any) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        description: membership.organization.description,
        role: membership.role,
      }));
      
      setOrganizations(userOrgs);
      
      // Auto-select organization based on stored preference or first available
      const storedOrgId = localStorage.getItem('currentOrganizationId');
      const targetOrg = storedOrgId 
        ? userOrgs.find((org: Organization) => org.id === storedOrgId)
        : userOrgs[0];
      
      if (targetOrg) {
        setCurrentOrganization(targetOrg);
        localStorage.setItem('currentOrganizationId', targetOrg.id);
      }
      
      setSwitching(false);
      
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      setOrganizations([]);
      setCurrentOrganization(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Switch to different organization
  const switchOrganization = (organizationId: string) => {
    const organization = organizations.find(org => org.id === organizationId);
    if (organization) {
      setSwitching(true);
      setCurrentOrganization(organization);
      localStorage.setItem('currentOrganizationId', organizationId);
      
      // Stay on the current page - don't redirect
      setSwitching(false);
    }
  };

  // Refetch organizations (for when new ones are created)
  const refetchOrganizations = async () => {
    setLoading(true);
    await fetchOrganizations();
  };

  // Fetch organizations when user changes
  useEffect(() => {
    fetchOrganizations();
  }, [user?.id, fetchOrganizations]);

  return (
    <OrganizationContext.Provider 
      value={{
        currentOrganization,
        organizations,
        switchOrganization,
        loading,
        switching,
        refetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

// Custom hook to use organization context
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

// Hook to get current organization or redirect to onboarding
export function useRequireOrganization() {
  const { currentOrganization, organizations, loading } = useOrganization();
  const user = useUser();

  useEffect(() => {
    if (!loading && user && organizations.length === 0) {
      // User has no organizations, redirect to onboarding
      window.location.href = '/onboarding/create-organization';
    }
  }, [loading, user, organizations.length]);

  return { currentOrganization, loading };
}