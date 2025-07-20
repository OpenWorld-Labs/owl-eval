# Testing Guide

This guide covers testing in the OWL Evaluation Framework frontend application.

## Overview

The frontend uses **Jest** with **React Testing Library** for comprehensive testing of components, utilities, and API routes.

**Current test status**: 4 test suites, 28 tests passing ✅

## Running Tests

### Basic Commands

```bash
# Navigate to frontend directory first
cd eval/frontend

# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Advanced Jest Options

```bash
# Run specific test file
npm test -- utils.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="slug"

# Run tests in a specific directory
npm test -- src/__tests__/lib/

# Run tests in verbose mode (shows individual test names)
npm test -- --verbose

# Update snapshots (if you have any)
npm test -- --updateSnapshot
```

### Watch Mode Interactive Commands

When you run `npm run test:watch`, you get an interactive menu:
- **`a`** - Run all tests
- **`f`** - Run only failed tests  
- **`p`** - Filter by filename pattern
- **`t`** - Filter by test name pattern
- **`q`** - Quit watch mode

### Coverage Reports

```bash
npm run test:coverage
```

This generates a coverage report in the `coverage/` directory. Open `coverage/lcov-report/index.html` in your browser to view detailed coverage information.

## Test Structure

Tests are organized in the `src/__tests__/` directory, mirroring the source code structure:

```
src/__tests__/
├── app/
│   └── api/
│       └── health/
│           └── route.test.ts        # API route tests
├── components/
│   └── ui/
│       └── button.test.tsx          # Component tests
└── lib/
    ├── utils.test.ts                # Utility tests
    └── utils/
        └── slug.test.ts             # Specific utility tests
```

## Testing Patterns

### API Route Testing

```typescript
/**
 * @jest-environment node
 */
import { GET } from '@/app/api/health/route'

describe('/api/health', () => {
  test('returns health status', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('status', 'healthy')
  })
})
```

**Key points:**
- Use `@jest-environment node` for API routes
- Test functions directly (no HTTP mocking needed)
- Test response status and data structure
- Test environment variable handling

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  test('handles click events', async () => {
    const user = userEvent.setup()
    const handleClick = jest.fn()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    const button = screen.getByRole('button')
    
    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

**Key points:**
- Use `render` and `screen` from React Testing Library
- Test user interactions with `userEvent`
- Test different props and variants
- Test accessibility (roles, labels)

### Utility Function Testing

```typescript
import { slugify } from '@/lib/utils/slug'

// Mock external dependencies
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock123'
}))

describe('slug utils', () => {
  test('handles edge cases', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
    expect(slugify('---')).toBe('')
  })
})
```

**Key points:**
- Mock external dependencies for deterministic tests
- Test edge cases thoroughly
- Test both success and failure scenarios

## Configuration

### Jest Configuration (`jest.config.js`)

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
```

### Setup File (`jest.setup.js`)

```javascript
import '@testing-library/jest-dom'
```

## Best Practices

### What to Test

**High Priority:**
- **Utility functions** - Business logic, data transformations
- **API routes** - Request/response handling, data validation
- **Component logic** - State management, user interactions
- **Error handling** - Edge cases, validation failures

**Medium Priority:**
- **UI components** - Props, variants, accessibility
- **Integration** - Component interactions, data flow

### Writing Good Tests

1. **Descriptive test names** - Clearly state what is being tested
2. **Arrange, Act, Assert** - Structure tests clearly
3. **Test behavior, not implementation** - Focus on what the code does
4. **Mock external dependencies** - Keep tests isolated and fast
5. **Test edge cases** - Empty inputs, error conditions, boundary values

### Test Organization

- **One test file per source file** - Mirror the source structure
- **Group related tests** - Use `describe` blocks for organization
- **Keep tests focused** - One assertion per test when possible
- **Use meaningful assertions** - Prefer specific matchers over generic ones

## Adding New Tests

### For Utilities

1. Create test file: `src/__tests__/lib/your-utility.test.ts`
2. Import the function to test
3. Mock any external dependencies
4. Test normal cases and edge cases

### For Components

1. Create test file: `src/__tests__/components/your-component.test.tsx`
2. Import component and testing utilities
3. Test rendering, props, and user interactions
4. Test accessibility features

### For API Routes

1. Create test file: `src/__tests__/app/api/your-route/route.test.ts`
2. Add `@jest-environment node` comment
3. Import route handler directly
4. Test request/response scenarios

## Continuous Integration

Tests run automatically in CI/CD pipelines. Ensure all tests pass before merging:

```bash
# Run full test suite
npm test

# Check linting
npm run lint

# Verify build
npm run build
```

## Debugging Tests

### Common Issues

- **Module not found**: Check path aliases in `jest.config.js`
- **Environment errors**: Ensure correct Jest environment (node vs jsdom)
- **Async test failures**: Use `await` for async operations
- **Mock issues**: Verify mock implementations match real APIs

### Debugging Tips

```bash
# Run single test with debug info
npm test -- --verbose your-test.test.ts

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand your-test.test.ts
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)