# Agent Note: A Workspace owns several directories

Status: implemented

English | [中文](2026-11-01-workspace-multiple-folders.zh.md)

## Problem

A Workspace was one canonical directory: it grouped the Sessions whose recorded `cwd` equalled that path, and the sandbox policy resolved one writable root from the Session's own `cwd`. Work that spans repositories — a service, its deployment manifests, and a shared schema package — therefore needed one Workspace per repository, which split one project's conversations across unrelated sidebar entries and let each repository see only itself as writable. Codex solves the same problem with project grouping: a project lists roots, and a thread snapshots the roots it starts with.

## Decision

- The Workspace domain record keeps `path` as the primary directory and appends `extraPaths`; `Workspace.paths` reports the ordered list as `[path, ...extraPaths]`. The domain version moves to 3 with `compatibleVersions: [2]`, so version 2 records read as single-directory Workspaces and are rewritten as version 3 on their next write.
- `WorkspaceRegistry.setPaths(id, paths)` is the only public mutation of the list. It canonicalizes each entry with the registry's `realpath` canon, rejects a non-directory, collapses repeats to their first position, and rejects a directory another Workspace already owns with `WorkspacePathConflictError`. The entity keeps a package-private write for it because ownership is a registry-wide question: an entity cannot see its siblings.
- Membership follows the list. Attaching a Session requires its canonical `cwd` to be one of the Workspace's paths, and a path change prunes the Sessions whose directory it no longer owns without touching their logs. The registry's header index, bootstrap, and candidate filtering all compare against the full list, so a Session in any owned directory resolves to the same Workspace.
- `SessionHeader.workspaceRoots` snapshots the list when the Session is created, primary first, and `SessionStore.fork` copies it. The sandbox policy derives `additionalWritableRoots` from that snapshot: deployment-configured roots first, then every snapshot entry except the Session's own `cwd`. A Session created without a snapshot keeps the previous single-directory behavior.
- The snapshot is the reason the policy stays replayable. Reading the Workspace registry while resolving a Session's sandbox policy would make a model-visible permission depend on mutable state outside the Session log, which the "model-visible ⟺ logged" rule forbids. Reuse therefore requires an identical snapshot: a blank Session whose recorded roots differ is replaced by a freshly minted one rather than silently widened or narrowed.
- `workspace.create` accepts `extraPaths`, `workspace.setPaths` replaces the list, and `WorkspaceView.paths` publishes it. The Client model upserts the returned row like every other unary mutation. A conflict surfaces as `workspace/path-conflict` carrying the owning Workspace id, which the dialog reports next to the folder it tried to add.
- The UI opens an Edit project dialog from the Workspace card: it lists the directories, removes one at a time but never the last, and adds one through the Host chooser that every other add-Workspace affordance uses. Saving sends the complete ordered list, so the Host stays authoritative about canonicalization and conflicts.

## Alternatives considered

**Read the registry when resolving the sandbox policy.** This is the smallest code: no header field, no persistence change, no snapshot comparison. It makes a model-visible permission depend on state that is not in the Session log, so replaying a transcript could produce a different writable set than the run it records, and a fork would inherit permissions that never existed when its source ran. The snapshot costs one optional header field and the persistence record that documents it.

**Adopt the current directories on reuse instead of requiring a match.** Reusing a blank Session and applying the Workspace's current list would keep more drafts reusable. It would also change a Session's permissions after creation, which the model may already have been told about in an earlier request, and which a forked or resumed Session could never reproduce. Minting a fresh Session keeps every Session's writable set what its own record says.

**A separate project entity above Workspaces, as Codex does.** A project object with its own id, roots, and metadata, with Workspaces or threads referencing it, separates grouping from execution more cleanly and would support renaming a group without touching a directory. It also adds a second level of durable identity, a migration for existing records, and a sidebar that groups groups. Extending the existing record keeps one identity per project and reuses every existing operation — ordering, pinning, archiving, removal — unchanged.

**Union every Workspace's directories into one writable set.** This needs no Session field and no UI change. It grants a Session write access to repositories it was never started in, which is both a security regression and a wrong statement to the model about the task at hand.

**Let each Session keep its own additional roots list in the UI.** This is more flexible than project-level grouping. Users would then repeat the same set for every conversation in a project, and the sidebar could not show which directories a project covers.

## Consequences

- Older builds reject a Session header carrying `workspaceRoots` because unknown header fields are validation errors. They refuse such a Session instead of interpreting it with a narrower writable set, which is why the persistence record uses the same version rather than a version bump.
- A Session created before its Workspace gained directories keeps its narrower set; only new Sessions see the added directories. The UI does not warn about this, and the contract is that the writable set is fixed at creation.
- A directory belongs to at most one Workspace, so moving a repository between projects requires removing it from one list before adding it to another. The conflict error names the owner rather than moving it silently.
- Removing a directory from a Workspace ungroups the Sessions recorded there. Their histories, order, and logs survive, and re-adding the directory attaches them again.
- The folder dialog edits the path list the Host reported; canonicalization and conflict rejection stay Host-side, and the dialog refreshes from the returned row rather than from its own draft.

## Testing

`packages/workspace/workspace/tests/workspace.spec.ts` covers multi-directory ownership, dedupe, empty/missing/foreign rejection, pruning, and reload. `packages/core/session/tests/session.spec.ts` and `fork.spec.ts` cover header validation and the create and fork snapshots. `packages/sandbox/sandbox-policy/tests/policy.spec.ts` covers root merging, deployment-root precedence, and the rendered policy text. `packages/api/session-controller/tests/commands-create-fork.host.spec.ts` pins the `cwd`/`workspaceRoots` pair a Workspace-placed Session receives; `session-presets.host.spec.ts` pins snapshot-matched reuse. `packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` drives the folders dialog through the row menu.
