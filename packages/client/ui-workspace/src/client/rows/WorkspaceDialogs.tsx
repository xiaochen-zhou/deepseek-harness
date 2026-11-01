/** Workspace rename, removal, and directory-set dialogs, keyed by their captured request. */
import { useEffect, useRef, useState } from 'react'
import {
  Button, IconCloseFillRegular, IconFolderOpenRegular, IconPlusOutlineRegular, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { WorkspaceActionRequest, WorkspaceBrowserProps } from '../contract/slots.ts'
import css from './WorkspaceBrowser.module.css'

/** Last path segment of a directory, for a row that shows the full path on hover. */
function folderName(path: string): string {
  const parts = path.split(/[\\/]/).filter(part => part !== '')
  return parts[parts.length - 1] ?? path
}

type Props = Pick<
  WorkspaceBrowserProps,
  'renameWorkspace' | 'deleteWorkspace' | 'setWorkspacePaths' | 'settleWorkspaceAction' | 'requestWorkspaceAction' | 't'
> & {
  request: WorkspaceActionRequest
  workspaces: readonly WorkspaceView[]
}

/** @param props - captured request, current Workspace list, and existing mutations. @returns the active dialog. */
export function WorkspaceDialogs({
  request, workspaces, renameWorkspace, deleteWorkspace, setWorkspacePaths, settleWorkspaceAction, requestWorkspaceAction, t,
}: Props) {
  const composingRef = useRef(false)
  const renameTarget = request.action === 'rename' ? request : null
  const [renameDraft, setRenameDraft] = useState(request.displayTitle)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameTrimmed = renameDraft.trim()
  // Self is excluded by identity, not by title: the draft is seeded with the
  // localized label, which for an automatically titled Workspace equals its
  // own displayed title without being a conflict with itself.
  const renameDuplicate = renameTarget !== null && renameTrimmed !== ''
    && workspaces.some(w => w.workspaceId !== renameTarget.workspaceId && w.title === renameTrimmed)
  const renameBlocked = renaming || renameTrimmed === ''
    || renameTarget === null || renameTrimmed === renameTarget.storedTitle || renameDuplicate
  const closeRename = () => {
    if (renaming) return
    settleWorkspaceAction()
    setRenameError(null)
  }
  const confirmRename = () => {
    if (renameBlocked) return
    setRenaming(true)
    setRenameError(null)
    renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
      setRenaming(false)
      settleWorkspaceAction()
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const deleteTarget = request.action === 'delete' ? request : null
  const [deleting, setDeleting] = useState(false)
  const [deleteCommittedId, setDeleteCommittedId] = useState<WorkspaceId | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  useEffect(() => {
    if (deleteCommittedId === null
      || workspaces.some(workspace => workspace.workspaceId === deleteCommittedId)) return
    setDeleting(false)
    setDeleteCommittedId(null)
    settleWorkspaceAction()
  }, [deleteCommittedId, workspaces, settleWorkspaceAction])
  const closeDelete = () => {
    if (deleting) return
    settleWorkspaceAction()
    setDeleteError(null)
  }
  const confirmDelete = () => {
    /* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteCommittedId(null)
    setDeleteError(null)
    deleteWorkspace(deleteTarget.workspaceId).then(() => {
      // Keep the confirmation pending until this component has rendered the
      // committed list projection without the deleted id. Closing earlier
      // exposes one stale React frame to the next Create Workspace gesture.
      setDeleteCommittedId(deleteTarget.workspaceId)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const foldersTarget = request.action === 'folders' ? request : null
  const [nameDraft, setNameDraft] = useState(request.storedTitle)
  const [folderDraft, setFolderDraft] = useState<readonly string[]>(request.paths)
  const [folderInput, setFolderInput] = useState('')
  const [savingFolders, setSavingFolders] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const foldersChanged = folderDraft.length !== request.paths.length
    || folderDraft.some((path, index) => path !== request.paths[index])
  const nameTrimmed = nameDraft.trim()
  const nameChanged = nameTrimmed !== '' && nameTrimmed !== request.storedTitle
  const folderTrimmed = folderInput.trim()
  const canAddFolder = folderTrimmed !== '' && !folderDraft.includes(folderTrimmed) && !savingFolders
  const addFolder = () => {
    if (!canAddFolder) return
    setFolderDraft([...folderDraft, folderTrimmed])
    setFolderInput('')
    setFolderError(null)
  }
  const removeFolder = (path: string) => {
    if (folderDraft.length === 1) {
      setFolderError(t('folders.keepOne'))
      return
    }
    setFolderDraft(folderDraft.filter(entry => entry !== path))
    setFolderError(null)
  }
  const closeFolders = () => {
    if (savingFolders) return
    settleWorkspaceAction()
    setFolderError(null)
  }
  const saveFolders = () => {
    if (savingFolders || foldersTarget === null || (!foldersChanged && !nameChanged)) return
    const workspaceId = foldersTarget.workspaceId
    setSavingFolders(true)
    setFolderError(null)
    void (async () => {
      try {
        if (nameChanged) await renameWorkspace(workspaceId, nameTrimmed)
        if (foldersChanged) await setWorkspacePaths(workspaceId, folderDraft)
        setSavingFolders(false)
        settleWorkspaceAction()
      } catch (reason: unknown) {
        setSavingFolders(false)
        setFolderError(reason instanceof Error ? reason.message : String(reason))
      }
    })()
  }
  // The card's edit action removes the project through the same confirmation
  // every other removal uses.
  const removeProject = () => {
    /* v8 ignore next -- the control is disabled while a save runs, and the dialog only opens with a target. */
    if (savingFolders || foldersTarget === null) return
    const { workspaceId, displayTitle } = foldersTarget
    settleWorkspaceAction()
    requestWorkspaceAction(workspaceId, displayTitle, 'delete')
  }

  return <>
    <Modal
      open={renameTarget !== null}
      onClose={closeRename}
      closeLabel={t('close')}
      title={t('rename.workspace.title')}
      footer={(
        <>
          <Button variant="outline" disabled={renaming} onClick={closeRename}>{t('cancel')}</Button>
          <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('rename')}</Button>
        </>
      )}
    >
      <input
        className={css.renameInput}
        value={renameDraft}
        aria-label={t('field.workspaceName')}
        data-modal-autofocus
        disabled={renaming}
        onFocus={(e) => { e.target.select() }}
        onChange={(e) => { setRenameDraft(e.target.value); setRenameError(null) }}
        onCompositionStart={() => { composingRef.current = true }}
        onCompositionEnd={() => { composingRef.current = false }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !composingRef.current) {
            e.preventDefault()
            confirmRename()
          }
        }}
      />
      {renameDuplicate && (
        <div className={css.renameError} role="alert">{t('conflict.named', { name: renameTrimmed })}</div>
      )}
      {renameError !== null && <div className={css.renameError} role="alert">{renameError}</div>}
    </Modal>

    <Modal
      open={deleteTarget !== null}
      onClose={closeDelete}
      closeLabel={t('close')}
      title={t('delete.workspace')}
      {...deleteTarget === null
        ? {}
        : { description: t('delete.desc', { name: deleteTarget.displayTitle }) }}
      footer={(
        <>
          <Button variant="outline" disabled={deleting} onClick={closeDelete}>{t('cancel')}</Button>
          <Button
            variant="outline"
            className={css.deleteAction}
            disabled={deleting}
            onClick={confirmDelete}
          >
            {t('delete.workspace')}
          </Button>
        </>
      )}
    >
      {deleting && <div className={css.deleteStatus} role="status">{t('delete.pending')}</div>}
      {deleteError !== null && <div className={css.renameError} role="alert">{deleteError}</div>}
    </Modal>

    <Modal
      open={foldersTarget !== null}
      onClose={closeFolders}
      closeLabel={t('close')}
      title={t('edit.title')}
      footer={(
        <div className={css.editFooter}>
          <Button
            variant="outline"
            className={css.deleteAction}
            disabled={savingFolders}
            onClick={removeProject}
          >
            {t('edit.removeProject')}
          </Button>
          <div className={css.editActions}>
            <Button variant="outline" disabled={savingFolders} onClick={closeFolders}>{t('cancel')}</Button>
            <Button variant="primary" onClick={saveFolders}>
              {t('save')}
            </Button>
          </div>
        </div>
      )}
    >
      <div className={css.editName}>
        <IconFolderOpenRegular size={16} />
        <input
          className={css.editNameInput}
          value={nameDraft}
          aria-label={t('edit.name')}
          disabled={savingFolders}
          onChange={(event) => { setNameDraft(event.target.value); setFolderError(null) }}
        />
      </div>
      <div className={css.editLabel}>{t('edit.sourceFolders')}</div>
      <ul className={css.folderList}>
        {folderDraft.map((path, index) => (
          <li key={path} className={css.folderRow}>
            <IconFolderOpenRegular size={15} />
            <span className={css.folderName} title={path}>{folderName(path)}</span>
            {index === 0 && <span className={css.folderPrimary}>{t('edit.primary')}</span>}
            <button
              type="button"
              className={css.folderRemove}
              aria-label={t('folders.removeNamed', { path })}
              disabled={savingFolders}
              onClick={() => { removeFolder(path) }}
            >
              <IconCloseFillRegular size={12} />
            </button>
          </li>
        ))}
        <li className={css.folderAdd}>
          <IconPlusOutlineRegular size={14} />
          <input
            className={css.editAddInput}
            value={folderInput}
            aria-label={t('folders.addLabel')}
            placeholder={t('edit.addFolder')}
            disabled={savingFolders}
            onChange={(event) => { setFolderInput(event.target.value); setFolderError(null) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addFolder()
              }
            }}
          />
          <Button variant="outline" disabled={!canAddFolder} onClick={addFolder}>{t('folders.add')}</Button>
        </li>
      </ul>
      {folderError !== null && <div className={css.renameError} role="alert">{folderError}</div>}
    </Modal>
  </>
}
