import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ErrorToast from '../ErrorToast'

describe('ErrorToast', () => {
  it('renders null when message is empty', () => {
    const { container } = render(<ErrorToast message="" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders message with alert semantics', () => {
    render(<ErrorToast message="Network unavailable" />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Network unavailable')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  it('auto dismisses after duration when onDismiss is provided', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()

    render(<ErrorToast message="Timeout" duration={800} onDismiss={onDismiss} />)

    vi.advanceTimersByTime(799)
    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
