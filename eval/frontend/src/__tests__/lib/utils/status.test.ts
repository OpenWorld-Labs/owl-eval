import {
  ExperimentStatus,
  ProlificStatus,
  getMaxStatus,
  shouldUpdateExperimentStatus,
  getStatusColor,
  isVisibleToPublic
} from '@/lib/utils/status'

describe('status utils', () => {
  describe('ExperimentStatus enum', () => {
    test('has expected status values', () => {
      expect(ExperimentStatus.DRAFT).toBe('draft')
      expect(ExperimentStatus.READY).toBe('ready')
      expect(ExperimentStatus.ACTIVE).toBe('active')
      expect(ExperimentStatus.PAUSED).toBe('paused')
      expect(ExperimentStatus.COMPLETED).toBe('completed')
    })
  })

  describe('ProlificStatus enum', () => {
    test('has expected prolific status values', () => {
      expect(ProlificStatus.UNPUBLISHED).toBe('UNPUBLISHED')
      expect(ProlificStatus.DRAFT).toBe('DRAFT')
      expect(ProlificStatus.ACTIVE).toBe('ACTIVE')
      expect(ProlificStatus.RUNNING).toBe('RUNNING')
      expect(ProlificStatus.PAUSED).toBe('PAUSED')
      expect(ProlificStatus.COMPLETED).toBe('COMPLETED')
      expect(ProlificStatus.STOPPED).toBe('STOPPED')
    })
  })

  describe('getMaxStatus', () => {
    test('returns local status when no prolific status provided', () => {
      expect(getMaxStatus('draft')).toBe('draft')
      expect(getMaxStatus('active')).toBe('active')
      expect(getMaxStatus('completed')).toBe('completed')
    })

    test('returns higher hierarchy status between local and prolific', () => {
      // Local is higher
      expect(getMaxStatus('active', 'DRAFT')).toBe('active')
      expect(getMaxStatus('completed', 'ACTIVE')).toBe('completed')
      
      // Prolific is higher
      expect(getMaxStatus('draft', 'ACTIVE')).toBe('active')
      expect(getMaxStatus('ready', 'COMPLETED')).toBe('completed')
    })

    test('handles equal hierarchy statuses', () => {
      expect(getMaxStatus('active', 'RUNNING')).toBe('active')
      expect(getMaxStatus('paused', 'STOPPED')).toBe('paused')
    })

    test('maps prolific statuses correctly', () => {
      expect(getMaxStatus('draft', 'UNPUBLISHED')).toBe('draft')
      expect(getMaxStatus('draft', 'DRAFT')).toBe('draft')
      expect(getMaxStatus('draft', 'ACTIVE')).toBe('active')
      expect(getMaxStatus('draft', 'RUNNING')).toBe('active')
      expect(getMaxStatus('draft', 'PAUSED')).toBe('paused')
      expect(getMaxStatus('draft', 'COMPLETED')).toBe('completed')
      expect(getMaxStatus('draft', 'STOPPED')).toBe('paused')
    })
  })

  describe('shouldUpdateExperimentStatus', () => {
    test('suggests update when prolific status is higher', () => {
      const result = shouldUpdateExperimentStatus('draft', 'ACTIVE')
      
      expect(result.shouldUpdate).toBe(true)
      expect(result.newStatus).toBe('active')
      expect(result.reason).toContain("Prolific status 'ACTIVE' maps to 'active'")
      expect(result.reason).toContain("upgrading from 'draft'")
    })

    test('suggests no update when local status is higher', () => {
      const result = shouldUpdateExperimentStatus('completed', 'ACTIVE')
      
      expect(result.shouldUpdate).toBe(false)
      expect(result.newStatus).toBe('completed')
      expect(result.reason).toContain("Local status 'completed' is already at or above")
    })

    test('handles startedAt timestamp logic', () => {
      const result = shouldUpdateExperimentStatus('draft', 'ACTIVE', false)
      
      expect(result.shouldUpdate).toBe(true)
      expect(result.newStatus).toBe('active')
      expect(result.reason).toContain('will set startedAt timestamp')
    })

    test('does not mention startedAt when already has one', () => {
      const result = shouldUpdateExperimentStatus('draft', 'ACTIVE', true)
      
      expect(result.shouldUpdate).toBe(true)
      expect(result.reason).not.toContain('startedAt')
    })
  })

  describe('getStatusColor', () => {
    test('returns archived color when archived is true', () => {
      const color = getStatusColor('active', true)
      expect(color).toBe('bg-destructive/10 text-destructive border-destructive/20')
    })

    test('returns correct colors for each status', () => {
      expect(getStatusColor('ready')).toBe('bg-green-500/10 text-green-600 border-green-500/20')
      expect(getStatusColor('active')).toBe('bg-blue-500/10 text-blue-600 border-blue-500/20')
      expect(getStatusColor('completed')).toBe('bg-primary/10 text-primary border-primary/20')
      expect(getStatusColor('paused')).toBe('bg-yellow-500/10 text-yellow-600 border-yellow-500/20')
      expect(getStatusColor('draft')).toBe('bg-muted text-muted-foreground border-border')
    })

    test('returns destructive color for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('bg-destructive/10 text-destructive border-destructive/20')
      expect(getStatusColor('')).toBe('bg-destructive/10 text-destructive border-destructive/20')
    })
  })

  describe('isVisibleToPublic', () => {
    test('returns true for public statuses', () => {
      expect(isVisibleToPublic('ready')).toBe(true)
      expect(isVisibleToPublic('active')).toBe(true)
    })

    test('returns false for non-public statuses', () => {
      expect(isVisibleToPublic('draft')).toBe(false)
      expect(isVisibleToPublic('paused')).toBe(false)
      expect(isVisibleToPublic('completed')).toBe(false)
      expect(isVisibleToPublic('unknown')).toBe(false)
    })
  })
})