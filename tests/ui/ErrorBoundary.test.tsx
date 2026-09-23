// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../../src/components/ErrorBoundary/ErrorBoundary'

afterEach(cleanup)

function BrokenComponent(): never {
  throw new Error('deliberate render failure')
}

describe('ErrorBoundary', () => {
  it('shows a recovery screen instead of a blank page when rendering throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: '页面遇到了意外问题' })).toBeTruthy()
    expect(screen.getByText('RENDER_FAILED')).toBeTruthy()
    expect(screen.getByRole('button', { name: '尝试恢复' })).toBeTruthy()

    // The fallback remains interactive. A persistent child error is caught again.
    await user.click(screen.getByRole('button', { name: '尝试恢复' }))
    expect(screen.getByRole('heading', { name: '页面遇到了意外问题' })).toBeTruthy()

    consoleSpy.mockRestore()
  })
})
