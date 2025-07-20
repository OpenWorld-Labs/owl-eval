# Defensive Programming Improvements

## Overview
This document tracks the defensive programming and reliability improvements made to the OWL Evaluation Framework, focusing on database resilience, error handling, and Prolific integration robustness.

## Issues Identified & Fixed

### 1. Database Connection Reliability

**Problem**: Free-tier database connections would timeout, causing UI crashes and failed operations.

**Root Cause**: 
- No retry logic for database connection timeouts
- No connection pool configuration
- Generic error handling that didn't distinguish recoverable errors

**Solution Applied**:
- Added connection pool configuration in `src/lib/prisma.ts`:
  ```typescript
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=20&connect_timeout=60',
    },
  }
  ```
- Implemented retry logic in API routes with exponential backoff
- Added specific error handling for Prisma error codes (P1001, P1008, P1017, P2024)

**Files Modified**:
- `src/lib/prisma.ts` - Connection pool configuration
- `src/app/api/experiments/route.ts` - Retry logic for experiments endpoint
- `src/app/api/two-video-comparison-tasks/route.ts` - Retry logic for comparison tasks
- `src/app/api/submit-two-video-comparison/route.ts` - Retry logic for submissions

### 2. Frontend Error Handling

**Problem**: UI components would crash with `experiments.map is not a function` when API calls failed.

**Root Cause**:
- Components assumed props would always be arrays
- No defensive checks for undefined/null data
- Frontend fetch logic didn't handle failed responses gracefully

**Solution Applied**:
- Added defensive checks in React components
- Updated `fetchAllData` in admin page to handle failed responses
- Added safe defaults for all data props

**Files Modified**:
- `src/components/admin/stats-dashboard.tsx` - Defensive checks for experiments, stats, evaluationStatus
- `src/app/admin/page.tsx` - Better error handling in fetchAllData function

### 3. Prolific Integration Issues

**Problem**: Prolific participant flow would break during testing and had sessionStorage key mismatches.

**Root Cause**:
- SessionStorage key inconsistency (`prolific_id` vs `prolific_pid`)
- No dry run mode for testing without launching live studies
- Unique constraint violations when testing multiple experiments with same mock IDs

**Solution Applied**:
- Fixed sessionStorage key consistency across all components
- Added dry run mode that bypasses "active" status requirement in development
- Implemented unique ID generation for dry run testing using hash approach

**Files Modified**:
- `src/app/prolific/page.tsx` - Stores session data with consistent keys
- `src/app/screening/[mode]/page.tsx` - Fixed prolific_id → prolific_pid mismatch
- `src/app/api/prolific/session/route.ts` - Added dry run mode and unique ID handling

## Defensive Programming Patterns Implemented

### 1. Database Retry Pattern
```typescript
async function withDatabaseRetry<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const isRetryableError = error instanceof PrismaClientKnownRequestError && 
      ['P1001', 'P1008', 'P1017', 'P2024'].includes(error.code)
    
    if (isRetryableError && retryCount < 2) {
      console.warn(`Database operation failed (attempt ${retryCount + 1}/3). Retrying...`, error.code)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
      return withDatabaseRetry(operation, retryCount + 1)
    }
    
    throw error
  }
}
```

### 2. Safe Props Pattern
```typescript
// Defensive checks for props
const safeExperiments = experiments || []
const safeStats = stats || null
const safeEvaluationStatus = evaluationStatus || null

// Usage with safe access
const totalParticipants = filteredExperiments.reduce((sum, exp) => sum + (exp._count?.participants || 0), 0)
```

### 3. Error Response Pattern
```typescript
} catch (error) {
  console.error('Error fetching data:', error)
  
  if (error instanceof PrismaClientKnownRequestError) {
    const errorMessage = error.code === 'P1001' ? 'Database connection timeout' : 'Database error'
    return NextResponse.json({ error: errorMessage }, { status: 503 })
  }
  
  return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
}
```

### 4. Dry Run Testing Pattern
```typescript
// For development testing without affecting production constraints
if (isDryRun && process.env.NODE_ENV === 'development') {
  const prolificHash = require('crypto').createHash('md5').update(prolificPid + studyId).digest('hex')
  const sessionHash = require('crypto').createHash('md5').update(sessionId + studyId).digest('hex')
  prolificPid = prolificHash.substring(0, 24)
  sessionId = sessionHash.substring(0, 24)
}
```

## Testing Strategy

### Current Test Setup
- **Framework**: Jest with Next.js integration
- **Test Scripts**: `npm test`, `npm run test:watch`, `npm run test:coverage`
- **Existing Tests**: 
  - API route tests (`__tests__/app/api/health/route.test.ts`)
  - Component tests (`__tests__/components/ui/button.test.tsx`)
  - Utility tests (`__tests__/lib/utils.test.ts`, `__tests__/lib/utils/slug.test.ts`)

### Planned Testing Approach

#### 1. Unit Tests (No Infrastructure)
- Test utility functions in isolation
- Test component rendering with mocked props
- Test validation logic and error handling functions

#### 2. Integration Tests (Test Database)
- Test API routes with real database operations
- Test Prolific session flow end-to-end
- Test database retry logic with simulated failures

#### 3. Environment Strategy
```
DEVELOPMENT (local)     → DEV (staging)        → PRODUCTION
├── localhost:3000      ├── dev.yourapp.com    ├── yourapp.com
├── Local PostgreSQL    ├── Neon Dev DB        ├── Neon Prod DB  
├── Local file storage  ├── Tigris Dev Bucket  ├── Tigris Prod Bucket
├── Mock Prolific       ├── Prolific Sandbox   ├── Prolific Live
└── No real users       └── Internal testing   └── Real participants
```

## Dry Run Testing Links

### Single Video Experiment
```
http://localhost:3000/prolific?PROLIFIC_PID=507f1f77bcf86cd799439011&SESSION_ID=60d0fe4f5311236168a109ca&STUDY_ID=6860adb294d8d860ac486d68&experiment_id=cmcfofpge0005xm6i0nsvger8&dry_run=true
```

### Two Video Comparison Experiment  
```
http://localhost:3000/prolific?PROLIFIC_PID=507f1f77bcf86cd799439011&SESSION_ID=60d0fe4f5311236168a109ca&STUDY_ID=6860adbcc3d22010e8107bf0&experiment_id=cmcfoexd60002xm6iv367kq1h&dry_run=true
```

## Next Steps

1. **Unit Testing**: Add tests for defensive programming functions
2. **Environment Setup**: Create dev/staging infrastructure 
3. **Integration Testing**: Test with separate test database
4. **Monitoring**: Add observability for database connection health
5. **Documentation**: Update deployment and development guides

## Key Learnings

1. **Database timeouts are common with free tiers** - Always implement retry logic
2. **Frontend components must handle undefined props** - Never assume data structure
3. **Testing needs isolated environments** - Don't contaminate production/development data
4. **Unique constraints apply globally** - Consider all use cases, including testing
5. **SessionStorage keys must be consistent** - Easy to miss during refactoring