import {
  ExperimentWithCounts,
  getProgressPercentage,
  getTargetEvaluations,
  getOverallProgress
} from '@/lib/utils/progress'

describe('progress utils', () => {
  const createMockExperiment = (overrides: Partial<ExperimentWithCounts> = {}): ExperimentWithCounts => ({
    id: 'test-experiment',
    evaluationMode: 'comparison',
    config: {
      evaluationsPerComparison: 5
    },
    _count: {
      twoVideoComparisonTasks: 10,
      singleVideoEvaluationTasks: 0,
      twoVideoComparisonSubmissions: 25,
      singleVideoEvaluationSubmissions: 0
    },
    ...overrides
  })

  describe('getProgressPercentage', () => {
    test('calculates progress percentage correctly', () => {
      const experiment = createMockExperiment()
      // 10 tasks * 5 evaluations = 50 target, 25 submissions = 50%
      expect(getProgressPercentage(experiment)).toBe(50)
    })

    test('returns 0 when no tasks exist', () => {
      const experiment = createMockExperiment({
        _count: {
          twoVideoComparisonTasks: 0,
          singleVideoEvaluationTasks: 0,
          twoVideoComparisonSubmissions: 0,
          singleVideoEvaluationSubmissions: 0
        }
      })
      expect(getProgressPercentage(experiment)).toBe(0)
    })

    test('handles mixed task types', () => {
      const experiment = createMockExperiment({
        _count: {
          twoVideoComparisonTasks: 5,
          singleVideoEvaluationTasks: 5,
          twoVideoComparisonSubmissions: 10,
          singleVideoEvaluationSubmissions: 15
        }
      })
      // 10 tasks * 5 evaluations = 50 target, 25 submissions = 50%
      expect(getProgressPercentage(experiment)).toBe(50)
    })

    test('caps progress at 100%', () => {
      const experiment = createMockExperiment({
        _count: {
          twoVideoComparisonTasks: 10,
          singleVideoEvaluationTasks: 0,
          twoVideoComparisonSubmissions: 100, // More than target
          singleVideoEvaluationSubmissions: 0
        }
      })
      expect(getProgressPercentage(experiment)).toBe(100)
    })

    test('handles missing config (current behavior - potential bug)', () => {
      const experiment = createMockExperiment({
        config: undefined
      })
      // Current behavior: uses -1 default, creates negative percentage
      // 10 tasks * -1 = -10 target, 25 submissions / -10 = -250%
      const result = getProgressPercentage(experiment)
      expect(typeof result).toBe('number')
      expect(result).toBe(-250) // Documents current behavior
    })

    test('handles missing evaluationsPerComparison (current behavior - potential bug)', () => {
      const experiment = createMockExperiment({
        config: {}
      })
      // Current behavior: uses -1 default, creates negative percentage
      const result = getProgressPercentage(experiment)
      expect(typeof result).toBe('number')
      expect(result).toBe(-250) // Documents current behavior
    })
  })

  describe('getTargetEvaluations', () => {
    test('calculates target evaluations correctly', () => {
      const experiment = createMockExperiment()
      // 10 tasks * 5 evaluations = 50
      expect(getTargetEvaluations(experiment)).toBe(50)
    })

    test('handles mixed task types', () => {
      const experiment = createMockExperiment({
        _count: {
          twoVideoComparisonTasks: 3,
          singleVideoEvaluationTasks: 7,
          twoVideoComparisonSubmissions: 0,
          singleVideoEvaluationSubmissions: 0
        }
      })
      // (3 + 7) tasks * 5 evaluations = 50
      expect(getTargetEvaluations(experiment)).toBe(50)
    })

    test('returns 0 when no tasks', () => {
      const experiment = createMockExperiment({
        _count: {
          twoVideoComparisonTasks: 0,
          singleVideoEvaluationTasks: 0,
          twoVideoComparisonSubmissions: 0,
          singleVideoEvaluationSubmissions: 0
        }
      })
      expect(getTargetEvaluations(experiment)).toBe(0)
    })

    test('handles missing config gracefully', () => {
      const experiment = createMockExperiment({
        config: undefined
      })
      // 10 tasks * -1 = -10
      expect(getTargetEvaluations(experiment)).toBe(-10)
    })
  })

  describe('getOverallProgress', () => {
    test('calculates overall progress for multiple experiments', () => {
      const experiments = [
        createMockExperiment({
          id: 'exp1',
          _count: {
            twoVideoComparisonTasks: 10,
            singleVideoEvaluationTasks: 0,
            twoVideoComparisonSubmissions: 25,
            singleVideoEvaluationSubmissions: 0
          }
        }),
        createMockExperiment({
          id: 'exp2',
          _count: {
            twoVideoComparisonTasks: 5,
            singleVideoEvaluationTasks: 5,
            twoVideoComparisonSubmissions: 10,
            singleVideoEvaluationSubmissions: 15
          }
        })
      ]

      const result = getOverallProgress(experiments)
      
      // Total submissions: 25 + 10 + 15 = 50
      // Total target: (10 * 5) + (10 * 5) = 100
      // Progress: 50/100 = 50%
      expect(result.totalEvaluations).toBe(50)
      expect(result.totalTargetEvaluations).toBe(100)
      expect(result.progressPercentage).toBe(50)
    })

    test('handles empty experiments array', () => {
      const result = getOverallProgress([])
      
      expect(result.totalEvaluations).toBe(0)
      expect(result.totalTargetEvaluations).toBe(0)
      expect(result.progressPercentage).toBe(0)
    })

    test('handles experiments with zero target evaluations', () => {
      const experiments = [
        createMockExperiment({
          _count: {
            twoVideoComparisonTasks: 0,
            singleVideoEvaluationTasks: 0,
            twoVideoComparisonSubmissions: 0,
            singleVideoEvaluationSubmissions: 0
          }
        })
      ]

      const result = getOverallProgress(experiments)
      
      expect(result.totalEvaluations).toBe(0)
      expect(result.totalTargetEvaluations).toBe(0)
      expect(result.progressPercentage).toBe(0)
    })

    test('caps overall progress at 100%', () => {
      const experiments = [
        createMockExperiment({
          _count: {
            twoVideoComparisonTasks: 10,
            singleVideoEvaluationTasks: 0,
            twoVideoComparisonSubmissions: 100, // Exceeds target
            singleVideoEvaluationSubmissions: 0
          }
        })
      ]

      const result = getOverallProgress(experiments)
      
      expect(result.progressPercentage).toBe(100)
    })

    test('handles mixed progress across experiments', () => {
      const experiments = [
        // Completed experiment
        createMockExperiment({
          id: 'completed',
          _count: {
            twoVideoComparisonTasks: 10,
            singleVideoEvaluationTasks: 0,
            twoVideoComparisonSubmissions: 50,
            singleVideoEvaluationSubmissions: 0
          }
        }),
        // Just started experiment
        createMockExperiment({
          id: 'started',
          _count: {
            twoVideoComparisonTasks: 10,
            singleVideoEvaluationTasks: 0,
            twoVideoComparisonSubmissions: 5,
            singleVideoEvaluationSubmissions: 0
          }
        })
      ]

      const result = getOverallProgress(experiments)
      
      // Total submissions: 50 + 5 = 55
      // Total target: 50 + 50 = 100
      // Progress: 55/100 = 55%
      expect(result.totalEvaluations).toBe(55)
      expect(result.totalTargetEvaluations).toBe(100)
      expect(result.progressPercentage).toBeCloseTo(55, 5) // Handle floating point precision
    })
  })
})