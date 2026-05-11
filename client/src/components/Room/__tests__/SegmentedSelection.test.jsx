import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import SegmentedSelection from '../SegmentedSelection'

describe('SegmentedSelection', () => {
  const options = [
    { value: 'quick', label: 'Quick Mode' },
    { value: 'classic', label: 'Classic Mode' },
  ]

  it('renders all options and highlights the active value', () => {
    render(<SegmentedSelection value="quick" options={options} onChange={vi.fn()} />)

    const quickButton = screen.getByRole('button', { name: 'Quick Mode' })
    const classicButton = screen.getByRole('button', { name: 'Classic Mode' })

    expect(quickButton).toHaveClass('bg-[linear-gradient(135deg,#4A5EED_0%,#7B5EED_100%)]')
    expect(classicButton).toHaveClass('text-muted-foreground')
  })

  it('calls onChange with clicked option value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<SegmentedSelection value="quick" options={options} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Classic Mode' }))

    expect(onChange).toHaveBeenCalledWith('classic')
  })

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<SegmentedSelection value="quick" options={options} onChange={onChange} disabled />)

    await user.click(screen.getByRole('button', { name: 'Classic Mode' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
