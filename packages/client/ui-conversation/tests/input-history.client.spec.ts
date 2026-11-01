// @vitest-environment jsdom
/**
 * Composer prompt recall: the ↑/↓ walk over a Session's submitted prompts,
 * through the real input shell (editor, draft machine, and the hub's history
 * contract).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, onTestFinished } from 'vitest'
import type { ComposerHistory } from '../src/client/input/facade.ts'
import { SessionInputShell } from '../src/client/input/facade.ts'
import type { SubmitOutcome } from '../src/client/contract/input.ts'

/** The hub's contract: an append-only list, newest last. */
function historyOf(...entries: readonly string[]): ComposerHistory & { readonly recorded: string[] } {
  const recorded = [...entries]
  return {
    recorded,
    entries: () => recorded,
    record: (text) => { recorded.push(text) },
  }
}

function makeShell(history: ComposerHistory): SessionInputShell {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const shell = new SessionInputShell({
    actx: ctx,
    defaultSink: () => Promise.resolve<SubmitOutcome>({ kind: 'success' }),
    commandAttachments: {
      serialize: () => Promise.resolve([]),
      release: () => {},
      unsupportedNotice: token => token,
    },
    history,
  })
  onTestFinished(() => { shell.dispose() })
  shell.refreshLexiconSubscription()
  return shell
}

describe('composer prompt recall', () => {
  it('walks older prompts, stops at the oldest, and restores the draft past the newest', () => {
    const shell = makeShell(historyOf('one', 'two'))
    shell.setDraft('')
    expect(shell.history('previous')).toBe(true)
    expect(shell.snapshot.draft).toBe('two')
    expect(shell.history('previous')).toBe(true)
    expect(shell.snapshot.draft).toBe('one')
    // The oldest prompt is the end of the line: the key is consumed, the text stays.
    expect(shell.history('previous')).toBe(true)
    expect(shell.snapshot.draft).toBe('one')
    expect(shell.history('next')).toBe(true)
    expect(shell.snapshot.draft).toBe('two')
    // Past the newest prompt the operator's own draft comes back.
    expect(shell.history('next')).toBe(true)
    expect(shell.snapshot.draft).toBe('')
    // Nothing left to walk: the caret owns the key again.
    expect(shell.history('next')).toBe(false)
    expect(shell.history('previous')).toBe(true)
    expect(shell.snapshot.draft).toBe('two')
  })

  it('leaves a draft under edit to the caret and ignores an empty history', () => {
    const empty = makeShell(historyOf())
    empty.setDraft('')
    expect(empty.history('previous')).toBe(false)

    const shell = makeShell(historyOf('one'))
    shell.setDraft('half typed')
    expect(shell.history('previous')).toBe(false)
    expect(shell.snapshot.draft).toBe('half typed')
  })

  it('ends the walk when the operator edits the recalled text', () => {
    const shell = makeShell(historyOf('one', 'two'))
    shell.setDraft('')
    shell.history('previous')
    expect(shell.snapshot.draft).toBe('two')
    shell.setDraft('two, edited')
    // The walk is over, so ↓ no longer rewinds and ↑ starts from the newest prompt again.
    expect(shell.history('next')).toBe(false)
    expect(shell.history('previous')).toBe(false)
  })

  it('records a submitted draft and skips a blank one', () => {
    const history = historyOf()
    const shell = makeShell(history)
    shell.setDraft('ask this')
    shell.submit('queue', 'enter')
    expect(history.recorded).toEqual(['ask this'])
    shell.setDraft('   ')
    shell.submit('queue', 'enter')
    expect(history.recorded).toEqual(['ask this'])
  })
})
