### **OWL Evaluation Platform - Multitenancy Design**

---

### **Overview**

This document outlines the multitenancy architecture for the OWL Evaluation Platform, leveraging StackAuth's Teams/Organizations feature. The design enables multiple research teams, companies, or institutions to independently conduct video evaluation experiments on a shared platform infrastructure.

---

### **Architecture Approach**

#### **Tenant Model: Organization-Based Multitenancy**

* **Organizations** represent tenant boundaries (research labs, companies, teams).
* **Users** can belong to multiple organizations with different roles.
* **Data isolation** at the organization level with shared infrastructure.
* **Resource sharing** for common assets like video libraries (optional).

---

### **Database Schema Changes**

#### **New Models**

##### **Organization**

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String   @unique
  slug        String   @unique
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Settings
  settings    Json     @default("{}")
  
  // Stack Auth integration
  stackTeamId String?  @unique // Maps to Stack Auth team
  
  // Relationships
  members     OrganizationMember[]
  experiments Experiment[]
  videos      Video[]
  invitations OrganizationInvitation[]
  
  @@map("organizations")
}
```

##### **OrganizationMember**

```prisma
model OrganizationMember {
  id             String           @id @default(cuid())
  organizationId String
  stackUserId    String           // Stack Auth user ID
  role           OrganizationRole @default(MEMBER)
  joinedAt       DateTime         @default(now())
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, stackUserId])
  @@map("organization_members")
}

enum OrganizationRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

##### **OrganizationInvitation**

```prisma
model OrganizationInvitation {
  id             String           @id @default(cuid())
  organizationId String
  email          String
  role           OrganizationRole @default(MEMBER)
  token          String           @unique
  createdAt      DateTime         @default(now())
  expiresAt      DateTime
  acceptedAt     DateTime?
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, email])
  @@map("organization_invitations")
}
```

#### **Updated Existing Models**

##### **Experiment (Add organization scoping)**

```prisma
model Experiment {
  // ... existing fields
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  @@index([organizationId])
}
```

##### **Video (Add organization scoping)**

```prisma
model Video {
  // ... existing fields
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])
  isShared       Boolean       @default(false) // Allow shared video library
  
  @@index([organizationId])
}
```

---

### **Stack Auth Integration**

#### **Teams Configuration**

1. **Enable Stack Auth Teams** in the Stack Auth dashboard.
2. **Sync organizations** with Stack Auth teams.
3. **Map user roles** between Stack Auth and internal organization roles.

#### **Implementation Example**

```typescript
// lib/stack.ts
import { StackServerApp } from "@stackframe/stack";

export const stackApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
  // ... other config
});

// Organization management with Stack Auth teams
export async function createOrganizationWithTeam(
  name: string,
  creatorUserId: string
) {
  // Create Stack Auth team
  const team = await stackApp.createTeam({
    displayName: name,
    creatorUserId: creatorUserId,
  });
  
  // Create internal organization
  const organization = await prisma.organization.create({
    data: {
      name,
      slug: generateSlug(name),
      stackTeamId: team.id,
      members: {
        create: {
          stackUserId: creatorUserId,
          role: 'OWNER'
        }
      }
    }
  });
  
  return organization;
}
```

---

### **Permission System**

#### **Role Hierarchy**

* **OWNER**: Full organization control, billing, delete organization.
* **ADMIN**: Manage members, create/delete experiments, manage settings.
* **MEMBER**: Create/manage own experiments, view organization experiments.
* **VIEWER**: Read-only access to organization experiments.

#### **Permission Matrix**

| Action                | Owner | Admin | Member | Viewer |
| --------------------- | ----- | ----- | ------ | ------ |
| Manage billing        | ✅     | ❌     | ❌      | ❌      |
| Delete organization   | ✅     | ❌     | ❌      | ❌      |
| Manage members        | ✅     | ✅     | ❌      | ❌      |
| Organization settings | ✅     | ✅     | ❌      | ❌      |
| Create experiments    | ✅     | ✅     | ✅      | ❌      |
| Delete any experiment | ✅     | ✅     | ❌      | ❌      |
| Edit own experiments  | ✅     | ✅     | ✅      | ❌      |
| View experiments      | ✅     | ✅     | ✅      | ✅      |
| Upload videos         | ✅     | ✅     | ✅      | ❌      |
| View analytics        | ✅     | ✅     | ✅      | ✅      |

---

### **API Architecture**

#### **Middleware for Organization Context**

```typescript
// middleware/organization.ts
export async function withOrganization(
  req: NextRequest,
  handler: (req: NextRequest, org: Organization) => Promise<Response>
) {
  const user = await stackApp.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  
  const orgId = req.headers.get('x-organization-id') || 
                 req.nextUrl.searchParams.get('orgId');
  
  if (!orgId) return new Response('Organization required', { status: 400 });
  
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_stackUserId: {
        organizationId: orgId,
        stackUserId: user.id
      }
    },
    include: { organization: true }
  });
  
  if (!membership) return new Response('Forbidden', { status: 403 });
  
  return handler(req, membership.organization);
}
```

#### **Data Access Patterns**

```typescript
// lib/data-access.ts
export class ExperimentService {
  static async getExperiments(organizationId: string, userId: string) {
    await this.verifyAccess(organizationId, userId, 'VIEWER');
    
    return prisma.experiment.findMany({
      where: { organizationId },
      include: { organization: true }
    });
  }
  
  static async createExperiment(
    data: CreateExperimentData,
    organizationId: string,
    userId: string
  ) {
    await this.verifyAccess(organizationId, userId, 'MEMBER');
    
    return prisma.experiment.create({
      data: {
        ...data,
        organizationId,
        createdBy: userId
      }
    });
  }
}
```

---

### **UI Components & User Experience**

#### **Organization Switcher (Header Integration)**

The organization switcher will be integrated into the main navigation header, allowing seamless switching between organizations for admin users.

```typescript
// components/OrganizationSwitcher.tsx
import { useUser } from "@stackframe/stack";
import { Building2, Plus } from "lucide-react";

export function OrganizationSwitcher() {
  const [currentOrg, setCurrentOrg] = useOrganization();
  const [organizations, setOrganizations] = useState([]);

  return (
    <Select value={currentOrg?.id} onValueChange={switchOrganization}>
      <SelectTrigger className="w-48 bg-gray-800 border-gray-700">
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4" />
          <SelectValue placeholder="Select organization" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {organizations.map(org => (
          <SelectItem key={org.id} value={org.id}>
            <div className="flex items-center space-x-2">
              <span>{org.name}</span>
              <Badge variant="outline">{org.role}</Badge>
            </div>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="create-org">
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
```

#### **Updated Navigation Header**

```typescript
// components/navigation.tsx - Enhanced with organization switching
export function Navigation() {
  const user = useUser();
  
  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-white">Owl Eval</h1>
          </div>
          
          {/* Organization Switcher & User Menu (for authenticated users) */}
          {user && (
            <div className="flex items-center space-x-4">
              <OrganizationSwitcher />
              <UserMenu />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

#### **Organization-Scoped Admin Dashboard**

```typescript
// app/[orgSlug]/dashboard/page.tsx
export default function AdminDashboard() {
  const { organization } = useOrganization();
  
  return (
    <div className="space-y-6">
      {/* Organization Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{organization.name}</h1>
          <p className="text-gray-600">Manage your organization's experiments</p>
        </div>
        <OrganizationSettingsDropdown />
      </div>

      {/* Organization-scoped tabs (existing admin interface) */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="experiments">Experiments</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        {/* Existing tab content but filtered by organizationId */}
      </Tabs>
    </div>
  );
}
```

#### **First-Time User Experience**

```typescript
// lib/organization-flow.ts
export function determineUserFlow(user: User) {
  if (user.organizations.length === 0) {
    // Redirect to create first organization
    return '/onboarding/create-organization';
  } else if (user.organizations.length === 1) {
    // Auto-select single organization
    return `/${user.organizations[0].slug}/dashboard`;
  } else {
    // Show organization picker
    return '/admin'; // Organization selection page
  }
}
```

#### **Organization Management Dashboard**

```typescript
// app/[orgSlug]/settings/members/page.tsx
export default function OrganizationMembersPage() {
  const { organization } = useOrganization();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Team Members</h1>
        <InviteMemberDialog organizationId={organization.id} />
      </div>
      
      <MembersTable members={members} />
      <PendingInvitationsTable invitations={invitations} />
    </div>
  );
}
```

#### **Organization Quick Actions**

The organization switcher dropdown includes:
- **Switch Organization** (primary function)
- **Organization Settings** (for owners/admins)
- **Invite Members** (quick action)
- **Create New Organization** (if user has permission)
- **Role Badge** showing user's role in each organization

---

### **URL Structure**

#### **Organization-scoped Routes**

```
/[orgSlug]/experiments          # Organization experiments
/[orgSlug]/experiments/[id]     # Specific experiment
/[orgSlug]/videos               # Organization video library  
/[orgSlug]/analytics            # Organization analytics
/[orgSlug]/settings             # Organization settings
/[orgSlug]/settings/members     # Member management
/[orgSlug]/settings/billing     # Billing (if applicable)

/evaluate/[experimentId]        # Public evaluation URLs (no org scoping)
/admin                          # Platform admin (super admin only)
```

---

### **Migration Strategy**

#### **Phase 1: Database Schema Migration**

1. Add organization-related tables.
2. Create default organization for existing data.
3. Migrate existing experiments to default organization.

#### **Phase 2: Stack Auth Teams Integration**

1. Configure Stack Auth teams.
2. Create team for default organization.
3. Implement organization creation/management.

#### **Phase 3: UI Updates**

1. Add organization selector to navigation.
2. Implement organization management pages.
3. Update all experiment/video listings to be organization-scoped.

#### **Phase 4: API Migration**

1. Update all API routes to require organization context.
2. Implement permission checks.
3. Add organization-aware data access layer.

---

### **Scalability & Performance Strategy**

#### **Database Scalability**

* **Connection pooling**: Optimize Prisma connection management for multi-tenant queries.
* **Query optimization**: Index on `organizationId` for all tenant-scoped tables.
* **Read replicas**: Use Neon's read replicas for analytics and reporting queries.
* **Horizontal scaling**: Prepare for tenant sharding if individual organizations grow large.

---

### **API Rate Limiting & Resource Management**

```typescript
// middleware/rate-limiting.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 h"),
  analytics: true,
});

export async function withRateLimit(organizationId: string, userId: string) {
  const identifier = `${organizationId}:${userId}`;
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
    throw new Error(`Rate limit exceeded. Limit: ${limit}, Reset: ${new Date(reset)}`);
  }
  
  return { remaining, reset };
}
```

---

### **Security Considerations**

#### **Data Isolation & Encryption**

* **Row-level security**: All queries filtered by organization with strict validation.
* **Data encryption**: At rest and in transit for all tenant data.
* **API validation**: Verify user access to organization before any data access.
* **File storage**: Organization-scoped S3 prefixes with access policies.
* **Audit logging**: Comprehensive access logging per organization.

---

### **Future Enhancements**

1. **Advanced Permissions**: Custom roles and fine-grained permissions with attribute-based access control.
2. **Organization Templates**: Pre-configured experiment templates and workflows per org.
3. **Cross-Organization Collaboration**: Secure data sharing and joint experiments.
4. **Advanced Analytics**: Real-time dashboards, predictive analytics, and custom reporting.
5. **White-label Support**: Custom branding, domains, and UI themes per organization.
6. **API Keys**: Organization-scoped API access with rate limiting and usage tracking.
7. **ML Pipeline Integration**: Native MLOps workflow integration per organization.
8. **Data Export/Import**: Secure data migration and backup tools.
9. **Compliance Tools**: GDPR, HIPAA, and other regulatory compliance features.
10. **Resource Quotas**: Configurable limits and auto-scaling per organization.

---

This updated and organized architecture document provides all the necessary details for your engineering team to implement the **StackAuth-based authentication** and **RBAC** system with **multi-tenancy** for the OWL Evaluation Platform.