// @vitest-environment jsdom
/** Direct rendering of the Workspace card: the portal shell, the closed state, and failure text. */
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { WorkspaceBrowserProps } from '../src/client/contract/slots.ts'
import { WorkspaceCard } from '../src/client/rows/WorkspaceCard.tsx'
import { zh } from '../src/client/locales.ts'

const t: WorkspaceBrowserProps['t'] = makeTranslate(zh, commonZh)

/** A detached anchor stands in for the row title a click would pass. */
function anchor(): HTMLElement {
  const element = document.createElement('span')
  document.body.append(element)
  return element
}

afterEach(() => { cleanup() })

describe('WorkspaceCard', () => {
  it('renders nothing while closed', () => {
    render(<WorkspaceCard
      open={false}
      anchorRef={createRef<HTMLElement>()}
      label="Alpha"
      paths={['/projects/alpha']}
      sessionCount={0}
      t={t}
      onClose={() => {}}
      onChangePaths={async () => {}}
    />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a directory without a home abbreviation and reports non-Error failures as text', async () => {
    const onChangePaths = vi.fn(async () => { throw 'folder conflict' })
    render(<WorkspaceCard
      open
      anchorRef={{ current: anchor() }}
      label="Alpha"
      paths={['/projects/alpha']}
      sessionCount={1}
      t={t}
      onClose={() => {}}
      onChangePaths={onChangePaths}
    />)
    expect(screen.getByRole('dialog').textContent).toContain('/projects/alpha')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '从工作区移除 /projects/alpha' }).disabled).toBe(true)
    const input = screen.getByLabelText<HTMLInputElement>('文件夹路径')
    fireEvent.change(input, { target: { value: '/projects/other' } })
    // Only Enter submits the add row.
    fireEvent.keyDown(input, { key: 'a' })
    expect(onChangePaths).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    await act(async () => {})
    expect(screen.getByRole('alert').textContent).toBe('folder conflict')
  })

  it('disables the add controls while a save is in flight', async () => {
    let settle: () => void = () => {}
    const onChangePaths = vi.fn(() => new Promise<void>((resolve) => { settle = resolve }))
    render(<WorkspaceCard
      open
      anchorRef={{ current: anchor() }}
      label="Alpha"
      paths={['/projects/alpha']}
      sessionCount={1}
      t={t}
      onClose={() => {}}
      onChangePaths={onChangePaths}
    />)
    const input = screen.getByLabelText<HTMLInputElement>('文件夹路径')
    fireEvent.change(input, { target: { value: '/projects/other' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    expect(input.disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '添加' }).disabled).toBe(true)
    await act(async () => { settle() })
    expect(input.disabled).toBe(false)
  })
})
