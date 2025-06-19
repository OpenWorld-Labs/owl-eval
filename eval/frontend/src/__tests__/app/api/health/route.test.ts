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
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('environment')
    expect(data).toHaveProperty('dataDir')
  })

  test('includes valid timestamp', async () => {
    const before = new Date()
    const response = await GET()
    const after = new Date()
    const data = await response.json()

    const timestamp = new Date(data.timestamp)
    expect(timestamp).toBeInstanceOf(Date)
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  test('includes environment information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(typeof data.environment).toBe('string')
    expect(['development', 'production', 'test']).toContain(data.environment)
  })

  test('includes data directory', async () => {
    const response = await GET()
    const data = await response.json()

    expect(typeof data.dataDir).toBe('string')
    expect(data.dataDir).toBeTruthy()
  })

  test('respects DATA_DIR environment variable', async () => {
    const originalDataDir = process.env.DATA_DIR
    process.env.DATA_DIR = '/custom/data/path'

    const response = await GET()
    const data = await response.json()

    expect(data.dataDir).toBe('/custom/data/path')

    // Restore original value
    if (originalDataDir) {
      process.env.DATA_DIR = originalDataDir
    } else {
      delete process.env.DATA_DIR
    }
  })
})