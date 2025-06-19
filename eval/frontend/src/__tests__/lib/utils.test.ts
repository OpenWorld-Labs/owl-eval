import { cn } from '@/lib/utils'

describe('utils', () => {
  describe('cn', () => {
    test('merges class names correctly', () => {
      const result = cn('px-2 py-1', 'bg-red text-white')
      expect(result).toBe('px-2 py-1 bg-red text-white')
    })

    test('handles conflicting Tailwind classes', () => {
      const result = cn('px-2 px-4', 'py-1 py-2')
      expect(result).toBe('px-4 py-2')
    })

    test('handles conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
      expect(result).toBe('base-class conditional-class')
    })

    test('handles array of classes', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    test('handles empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    test('handles undefined and null values', () => {
      const result = cn('valid-class', undefined, null, 'another-class')
      expect(result).toBe('valid-class another-class')
    })
  })
})