import { generateSlug, isValidSlug, slugify } from '@/lib/utils/slug'

// Mock nanoid to make tests deterministic
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock123'
}))

describe('slug utils', () => {
  describe('generateSlug', () => {
    test('generates a slug with the expected format', () => {
      const slug = generateSlug()
      expect(slug).toMatch(/^[a-z]+-[a-z]+-mock123$/)
    })

    test('generates different slugs on multiple calls', () => {
      // Since we mock the random part, we need to mock Math.random too
      const originalRandom = Math.random
      let callCount = 0
      Math.random = jest.fn(() => {
        callCount++
        return callCount === 1 ? 0.1 : 0.5
      })

      const slug1 = generateSlug()
      const slug2 = generateSlug()
      
      expect(slug1).not.toBe(slug2)
      
      Math.random = originalRandom
    })
  })

  describe('isValidSlug', () => {
    test('validates correct slugs', () => {
      expect(isValidSlug('valid-slug')).toBe(true)
      expect(isValidSlug('another-valid-slug-123')).toBe(true)
      expect(isValidSlug('simple')).toBe(true)
      expect(isValidSlug('a1-b2-c3')).toBe(true)
    })

    test('rejects invalid slugs', () => {
      expect(isValidSlug('Invalid-Slug')).toBe(false) // uppercase
      expect(isValidSlug('invalid_slug')).toBe(false) // underscore
      expect(isValidSlug('invalid slug')).toBe(false) // space
      expect(isValidSlug('invalid.slug')).toBe(false) // dot
      expect(isValidSlug('invalid@slug')).toBe(false) // special char
      expect(isValidSlug('-invalid')).toBe(false) // leading hyphen
      expect(isValidSlug('invalid-')).toBe(false) // trailing hyphen
      expect(isValidSlug('')).toBe(false) // empty
    })
  })

  describe('slugify', () => {
    test('converts text to valid slug', () => {
      expect(slugify('Hello World')).toBe('hello-world')
      expect(slugify('Multiple   Spaces')).toBe('multiple-spaces')
      expect(slugify('  Leading and trailing  ')).toBe('leading-and-trailing')
    })

    test('handles special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world')
      expect(slugify('Test@Email.com')).toBe('testemailcom')
      expect(slugify('Under_score & Hyphen-test')).toBe('under-score-hyphen-test')
    })

    test('handles edge cases', () => {
      expect(slugify('')).toBe('')
      expect(slugify('   ')).toBe('')
      expect(slugify('---')).toBe('')
      expect(slugify('a')).toBe('a')
      expect(slugify('123')).toBe('123')
    })

    test('removes multiple consecutive hyphens', () => {
      expect(slugify('test---multiple---hyphens')).toBe('test-multiple-hyphens')
      expect(slugify('test___underscores')).toBe('test-underscores')
    })
  })
})