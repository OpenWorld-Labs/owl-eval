'use client';

import React from 'react';
import { useOrganization } from '@/lib/organization-context';
import { useUser } from '@stackframe/stack';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Loader2 } from 'lucide-react';

export default function OrganizationSelectPage() {
  const user = useUser();
  const router = useRouter();
  const { organizations, switchOrganization, loading } = useOrganization();

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!user) {
      router.push('/handler/sign-in');
    }
  }, [user, router]);

  // Auto-redirect if user has only one organization
  React.useEffect(() => {
    if (!loading && organizations.length === 1) {
      const org = organizations[0];
      router.push(`/${org.slug}/dashboard`);
    }
  }, [loading, organizations, router]);

  // Auto-redirect if user has no organizations
  React.useEffect(() => {
    if (!loading && organizations.length === 0) {
      router.push('/onboarding/create-organization');
    }
  }, [loading, organizations, router]);

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <Loader2 className="h-8 w-8" />
        </div>
      </div>
    );
  }

  if (organizations.length <= 1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <Loader2 className="h-8 w-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Select Organization</h1>
          <p className="text-muted-foreground mt-2">
            Choose which organization you&apos;d like to work with today.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {organizations.map((org) => (
            <Card 
              key={org.id} 
              className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => switchOrganization(org.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                      {org.description && (
                        <CardDescription className="mt-1">
                          {org.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {org.role.toLowerCase()}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <Button className="w-full" onClick={() => switchOrganization(org.id)}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Enter {org.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={() => router.push('/onboarding/create-organization')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Organization
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>You can switch between organizations anytime using the organization switcher.</p>
        </div>
      </div>
    </div>
  );
}