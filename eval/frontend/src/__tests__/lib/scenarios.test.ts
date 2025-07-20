import {
  PREDEFINED_SCENARIOS,
  SCENARIO_CATEGORIES,
  COMMON_TAGS,
  getScenarioById,
  getScenariosByCategory,
  getScenariosByTag,
  isValidScenarioId,
  createCustomScenario
} from '@/lib/scenarios'

describe('scenarios', () => {
  describe('PREDEFINED_SCENARIOS', () => {
    test('contains expected number of scenarios', () => {
      expect(PREDEFINED_SCENARIOS.length).toBeGreaterThan(0)
      expect(Array.isArray(PREDEFINED_SCENARIOS)).toBe(true)
    })

    test('each scenario has required properties', () => {
      PREDEFINED_SCENARIOS.forEach(scenario => {
        expect(scenario).toHaveProperty('id')
        expect(scenario).toHaveProperty('name')
        expect(scenario).toHaveProperty('description')
        expect(scenario).toHaveProperty('category')
        expect(scenario).toHaveProperty('evaluationFocus')
        
        expect(typeof scenario.id).toBe('string')
        expect(typeof scenario.name).toBe('string')
        expect(typeof scenario.description).toBe('string')
        expect(typeof scenario.category).toBe('string')
        expect(Array.isArray(scenario.evaluationFocus)).toBe(true)
        
        expect(scenario.id.length).toBeGreaterThan(0)
        expect(scenario.name.length).toBeGreaterThan(0)
        expect(scenario.description.length).toBeGreaterThan(0)
      })
    })

    test('has unique scenario IDs', () => {
      const ids = PREDEFINED_SCENARIOS.map(s => s.id)
      const uniqueIds = [...new Set(ids)]
      expect(ids.length).toBe(uniqueIds.length)
    })

    test('contains scenarios from each category', () => {
      const categories = PREDEFINED_SCENARIOS.map(s => s.category)
      expect(categories).toContain('basic')
      expect(categories).toContain('complex')
      expect(categories).toContain('edge_case')
      expect(categories).toContain('performance')
    })
  })

  describe('SCENARIO_CATEGORIES', () => {
    test('contains expected categories', () => {
      expect(SCENARIO_CATEGORIES.length).toBe(5)
      
      const categoryIds = SCENARIO_CATEGORIES.map(c => c.id)
      expect(categoryIds).toEqual(['basic', 'complex', 'edge_case', 'performance', 'custom'])
    })

    test('each category has required properties', () => {
      SCENARIO_CATEGORIES.forEach(category => {
        expect(category).toHaveProperty('id')
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('description')
        
        expect(typeof category.id).toBe('string')
        expect(typeof category.name).toBe('string')
        expect(typeof category.description).toBe('string')
        
        expect(category.id.length).toBeGreaterThan(0)
        expect(category.name.length).toBeGreaterThan(0)
        expect(category.description.length).toBeGreaterThan(0)
      })
    })
  })

  describe('COMMON_TAGS', () => {
    test('is an array of strings', () => {
      expect(Array.isArray(COMMON_TAGS)).toBe(true)
      expect(COMMON_TAGS.length).toBeGreaterThan(0)
      
      COMMON_TAGS.forEach(tag => {
        expect(typeof tag).toBe('string')
        expect(tag.length).toBeGreaterThan(0)
      })
    })

    test('has unique tags', () => {
      const uniqueTags = [...new Set(COMMON_TAGS)]
      expect(COMMON_TAGS.length).toBe(uniqueTags.length)
    })
  })

  describe('getScenarioById', () => {
    test('returns scenario for valid ID', () => {
      const firstScenario = PREDEFINED_SCENARIOS[0]
      const result = getScenarioById(firstScenario.id)
      
      expect(result).toBeDefined()
      expect(result?.id).toBe(firstScenario.id)
      expect(result?.name).toBe(firstScenario.name)
    })

    test('returns undefined for invalid ID', () => {
      expect(getScenarioById('nonexistent')).toBeUndefined()
      expect(getScenarioById('')).toBeUndefined()
    })

    test('finds specific known scenarios', () => {
      // Test a few specific scenarios that should exist
      expect(getScenarioById('simple_task')).toBeDefined()
      expect(getScenarioById('multi_step_task')).toBeDefined()
      expect(getScenarioById('ambiguous_input')).toBeDefined()
    })
  })

  describe('getScenariosByCategory', () => {
    test('returns scenarios for valid category', () => {
      const basicScenarios = getScenariosByCategory('basic')
      
      expect(Array.isArray(basicScenarios)).toBe(true)
      expect(basicScenarios.length).toBeGreaterThan(0)
      
      basicScenarios.forEach(scenario => {
        expect(scenario.category).toBe('basic')
      })
    })

    test('returns empty array for invalid category', () => {
      expect(getScenariosByCategory('nonexistent')).toEqual([])
      expect(getScenariosByCategory('')).toEqual([])
    })

    test('returns different counts for different categories', () => {
      const basic = getScenariosByCategory('basic')
      const complex = getScenariosByCategory('complex')
      const edgeCase = getScenariosByCategory('edge_case')
      const performance = getScenariosByCategory('performance')
      
      expect(basic.length).toBeGreaterThan(0)
      expect(complex.length).toBeGreaterThan(0)
      expect(edgeCase.length).toBeGreaterThan(0)
      expect(performance.length).toBeGreaterThan(0)
    })
  })

  describe('getScenariosByTag', () => {
    test('returns scenarios with specified tag', () => {
      const basicTagged = getScenariosByTag('basic')
      
      expect(Array.isArray(basicTagged)).toBe(true)
      basicTagged.forEach(scenario => {
        expect(scenario.tags).toContain('basic')
      })
    })

    test('returns empty array for non-existent tag', () => {
      expect(getScenariosByTag('nonexistent')).toEqual([])
      expect(getScenariosByTag('')).toEqual([])
    })

    test('handles scenarios without tags', () => {
      // Should not crash and should work correctly
      const result = getScenariosByTag('some-tag')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('isValidScenarioId', () => {
    test('accepts valid scenario IDs', () => {
      expect(isValidScenarioId('valid_id')).toBe(true)
      expect(isValidScenarioId('valid-id')).toBe(true)
      expect(isValidScenarioId('validId123')).toBe(true)
      expect(isValidScenarioId('123')).toBe(true)
      expect(isValidScenarioId('a')).toBe(true)
      expect(isValidScenarioId('test_scenario-123')).toBe(true)
    })

    test('rejects invalid scenario IDs', () => {
      expect(isValidScenarioId('')).toBe(false)
      expect(isValidScenarioId('invalid id')).toBe(false) // space
      expect(isValidScenarioId('invalid.id')).toBe(false) // dot
      expect(isValidScenarioId('invalid@id')).toBe(false) // special char
      expect(isValidScenarioId('invalid/id')).toBe(false) // slash
      expect(isValidScenarioId('invalid+id')).toBe(false) // plus
    })
  })

  describe('createCustomScenario', () => {
    test('creates custom scenario with required properties', () => {
      const scenario = createCustomScenario(
        'custom_test',
        'Custom Test Scenario',
        'A test scenario for custom functionality'
      )
      
      expect(scenario.id).toBe('custom_test')
      expect(scenario.name).toBe('Custom Test Scenario')
      expect(scenario.description).toBe('A test scenario for custom functionality')
      expect(scenario.category).toBe('custom')
      expect(scenario.evaluationFocus).toEqual([])
      expect(scenario.tags).toBeUndefined()
    })

    test('creates custom scenario with tags', () => {
      const scenario = createCustomScenario(
        'custom_with_tags',
        'Custom Tagged Scenario',
        'A test scenario with tags',
        ['tag1', 'tag2']
      )
      
      expect(scenario.tags).toEqual(['tag1', 'tag2'])
    })

    test('handles empty or undefined tags', () => {
      const scenario1 = createCustomScenario('test1', 'Test', 'Desc', [])
      const scenario2 = createCustomScenario('test2', 'Test', 'Desc', undefined)
      
      expect(scenario1.tags).toEqual([])
      expect(scenario2.tags).toBeUndefined()
    })
  })
})