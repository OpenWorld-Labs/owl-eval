import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  test('renders with default variant', () => {
    render(<Badge>Default Badge</Badge>)
    const badge = screen.getByText('Default Badge')
    
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full', 'border')
    expect(badge).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  test('renders different variants', () => {
    const { rerender } = render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText('Secondary')).toHaveClass('bg-secondary', 'text-secondary-foreground')

    rerender(<Badge variant="destructive">Destructive</Badge>)
    expect(screen.getByText('Destructive')).toHaveClass('bg-destructive', 'text-destructive-foreground')

    rerender(<Badge variant="outline">Outline</Badge>)
    expect(screen.getByText('Outline')).toHaveClass('text-foreground')

    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText('Success')).toHaveClass('bg-green-500', 'text-white')
  })

  test('accepts custom className', () => {
    render(<Badge className="custom-class">Custom Badge</Badge>)
    const badge = screen.getByText('Custom Badge')
    
    expect(badge).toHaveClass('custom-class')
    expect(badge).toHaveClass('inline-flex') // Still has base classes
  })

  test('forwards HTML attributes', () => {
    render(
      <Badge data-testid="test-badge" title="Test Badge">
        Test
      </Badge>
    )
    
    const badge = screen.getByTestId('test-badge')
    expect(badge).toHaveAttribute('title', 'Test Badge')
  })

  test('renders as div element', () => {
    render(<Badge>Test Badge</Badge>)
    const badge = screen.getByText('Test Badge')
    
    expect(badge.tagName).toBe('DIV')
  })

  test('applies hover styles', () => {
    render(<Badge variant="default">Hover Badge</Badge>)
    const badge = screen.getByText('Hover Badge')
    
    expect(badge).toHaveClass('hover:bg-primary/80')
  })

  test('applies focus styles', () => {
    render(<Badge variant="default">Focus Badge</Badge>)
    const badge = screen.getByText('Focus Badge')
    
    expect(badge).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-ring')
  })

  test('has correct typography classes', () => {
    render(<Badge>Typography Badge</Badge>)
    const badge = screen.getByText('Typography Badge')
    
    expect(badge).toHaveClass('text-xs', 'font-semibold')
  })

  test('has correct spacing classes', () => {
    render(<Badge>Spacing Badge</Badge>)
    const badge = screen.getByText('Spacing Badge')
    
    expect(badge).toHaveClass('px-2.5', 'py-0.5')
  })

  test('has transition classes', () => {
    render(<Badge>Transition Badge</Badge>)
    const badge = screen.getByText('Transition Badge')
    
    expect(badge).toHaveClass('transition-colors')
  })
})