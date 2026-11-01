/**
 * The Workspace card shown while a Workspace row is hovered: its Session count,
 * every directory it owns, and the way into the edit dialog.
 */
import type { ReactNode } from 'react'
import {
  IconFolderOpenRegular, IconQueueOutlineRegular, IconSlidersTwoOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { abbreviateHomePath } from '@deepseek-ai/dsh-util-workspace-path'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import css from './WorkspaceBrowser.module.css'

/** Inputs of the hovered Workspace card. */
export interface WorkspaceCardProps {
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
  /** Open the edit dialog for this Workspace. */
  readonly onEdit: () => void
}

/**
 * Render the hovered Workspace card.
 *
 * The card is readable and selectable while the pointer rests on it, so its
 * directories can be scanned and its edit action used without the row losing
 * the pointer.
 * @param props - the Workspace's title, directories, Session count, the home
 * directory, the locale seat, and the edit action.
 * @returns the card contents.
 */
export function WorkspaceCard({ label, paths, sessionCount, home, t, onEdit }: WorkspaceCardProps): ReactNode {
  return (
    <div className={css.card}>
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
          </li>
        ))}
      </ul>
      <div className={css.cardDivider} aria-hidden="true" />
      <button type="button" className={css.cardEdit} onClick={onEdit}>
        <IconSlidersTwoOutlineRegular size={15} />
        {t('edit.title')}
      </button>
    </div>
  )
}
