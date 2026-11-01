/**
 * The Workspace card: one project's title, Session count, and the directories
 * it owns. Directories are edited in place — every add and removal saves the
 * new ordered list through the Workspace Remote, whose first entry is the
 * directory a new Session starts in.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import {
  IconCloseFillRegular, IconFolderOpenRegular, IconPlusOutlineRegular, IconQueueOutlineRegular,
  useAnchoredPosition, useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { abbreviateHomePath } from '@deepseek-ai/dsh-util-workspace-path'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import css from './WorkspaceBrowser.module.css'

/** Unplaced portal frame: laid out at the viewport origin but unpainted until measured. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** Inputs of the Workspace card. */
export interface WorkspaceCardProps {
  /** Whether the card is mounted. */
  readonly open: boolean
  /** The Workspace row's title element, which anchors the card and counts as inside for dismissal. */
  readonly anchorRef: RefObject<HTMLElement | null>
  /** The Workspace's display title. */
  readonly label: string
  /** Every directory the Workspace owns, primary first. */
  readonly paths: readonly string[]
  /** Sessions currently grouped under the Workspace. */
  readonly sessionCount: number
  /** Host account home; POSIX home-rooted paths display as `~`. */
  readonly home?: string | undefined
  /** The browser root's locale seat. */
  readonly t: WorkspaceBrowserProps['t']
  /** Dismiss the card. */
  readonly onClose: () => void
  /** Save the replacement directory list; rejection keeps the card open with its message. */
  readonly onChangePaths: (paths: readonly string[]) => Promise<void>
}

/** True when `path` is an absolute POSIX path or a Windows drive/UNC path. */
function absolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path) || path.startsWith('\\\\')
}

/**
 * Render one Workspace card into `document.body`, anchored to its row title.
 *
 * The card is a portal so the tree's `overflow` cannot crop it, and a
 * pointerdown outside both the title and the card dismisses it. Adding a
 * directory appends it; removing drops it and reveals its sessions under the
 * ungrouped bucket (the last directory cannot be removed).
 * @param props - open state, the anchor, the Workspace's title, directories,
 * session count and home directory, the locale seat, and the save/dismiss callbacks.
 * @returns the card while open, and nothing while closed.
 */
export function WorkspaceCard({
  open, anchorRef, label, paths, sessionCount, home, t, onClose, onChangePaths,
}: WorkspaceCardProps): ReactNode {
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useDismissOnOutsidePointer(anchorRef, open, onClose, panelRef)
  const position = useAnchoredPosition({ open, anchorRef, panelRef, gap: 8, margin: 12 })
  useEffect(() => {
    if (!open) return undefined
    setDraft('')
    setError(null)
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  if (!open) return null
  const commit = async (next: readonly string[]): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onChangePaths(next)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }
  const add = (): void => {
    const candidate = draft.trim()
    if (!absolutePath(candidate)) {
      setError(t('folders.absolutePath'))
      return
    }
    if (paths.includes(candidate)) {
      setDraft('')
      return
    }
    setDraft('')
    void commit([...paths, candidate])
  }
  return createPortal(
    <div
      ref={panelRef}
      className={css.card}
      style={position ?? MEASURE_STYLE}
      role="dialog"
      aria-label={label}
      // A click inside the card belongs to the card, not to the row that opened it.
      onClick={(event) => { event.stopPropagation() }}
    >
      <div className={css.cardHeader}>
        <IconFolderOpenRegular size={16} />
        <span className={css.cardTitle}>{label}</span>
      </div>
      <div className={css.cardMeta}>
        <IconQueueOutlineRegular size={14} />
        <span>{t('card.tasks', { n: sessionCount })}</span>
      </div>
      <div className={css.cardDivider} aria-hidden="true" />
      <ul className={css.cardList}>
        {paths.map(path => (
          <li key={path} className={css.cardRow}>
            <IconFolderOpenRegular size={15} />
            <span className={css.cardPath} title={path}>{abbreviateHomePath(path, home)}</span>
            <button
              type="button"
              className={clsx(css.cardRemove)}
              aria-label={t('folders.removeNamed', { path })}
              disabled={busy || paths.length === 1}
              onClick={() => { void commit(paths.filter(owned => owned !== path)) }}
            >
              <IconCloseFillRegular size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className={css.cardAdd}>
        <input
          className={css.cardInput}
          value={draft}
          aria-label={t('folders.addLabel')}
          placeholder={t('folders.addPlaceholder')}
          disabled={busy}
          onChange={(event) => { setDraft(event.target.value); setError(null) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className={css.cardAddButton} disabled={busy || draft.trim() === ''} onClick={add}>
          <IconPlusOutlineRegular size={13} />
          {t('folders.add')}
        </button>
      </div>
      {error !== null && <div className={css.cardError} role="alert">{error}</div>}
    </div>,
    document.body,
  )
}
