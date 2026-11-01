# Agent Note: The composer recalls submitted prompts with the arrow keys

Status: implemented

English | [中文](2026-11-01-composer-prompt-recall.zh.md)

## Problem

The composer could only resend something by retyping it. Every other terminal-style entry point the operator knows (shell history, Codex, Claude Code) answers ↑ with the previous prompt, and a long prompt that needs a small tweak was otherwise the most expensive thing to reproduce.

## Decision

↑ and ↓ walk the Session's submitted prompts, newest first, writing each one into the draft.

- `ComposerHistory` (`SessionInputDeps.history`) is the record: `entries()` oldest-first plus `record(text)`, and the InputHub owns one per Session binding. The hub appends on submit and skips a blank draft and an immediate repeat, so a double send does not create two identical stops in the walk.
- `SessionInputShell.history(direction)` owns the walk state: the cursor, the operator's own draft, and the text the walk last wrote. Entering the walk needs an empty draft, so ↑ inside a half-typed prompt still moves the caret; ↓ past the newest prompt restores that half-typed draft; an edit that is not the walk itself ends it (`onEditorUpdate` compares the projection against the recalled text).
- The composer keymap offers the arrows to an open menu first (`arbitrate`), then to `history()`, and only falls through to the caret when both pass. Modified arrows (Shift/Alt/Meta/Ctrl) and composition keydowns never reach the walk, so text selection and IME candidates keep their native behavior.
- Submitting, and any press of a locked/frozen composer, ends the walk rather than leaving a stale position behind.

## Alternatives considered

**Derive the history from the Session transcript on every keypress.** It is the durable record and would survive a reload, but the composer would then depend on the conversation projection (images, quotes, and command chips all have their own node shapes) just to answer which plain texts were submitted. The hub's append-only list keeps the gesture local to the composer and identical for every origin, including submissions made from another view of the same Session.

**A separate recall list persisted per Session.** It would duplicate facts the Session log already owns and would need its own invalidation when a queued message is deleted or edited. Recall is a typing convenience, not conversation state; it does not belong in the log.

**Recall on `Ctrl+P`/`Alt+↑` to avoid clashing with caret motion.** The clash is real but solvable locally (empty draft and caret-at-start rules), and a modifier makes the gesture undiscoverable next to the tools this one is modeled on.

## Consequences

↑ on an empty composer fills the previous prompt; further presses go back, and ↓ returns to where the operator was. Recall never touches the draft's references, quotes, or attachments: it writes plain text, so a recalled prompt that mentioned a file comes back as text the operator can edit, not as a live chip. The walk survives view remounts inside one Session because the hub owns it, and is dropped when the Session binding is released.

## Testing

`packages/client/ui-conversation/tests/input-history.client.spec.ts` drives the real shell: walking older prompts, stopping at the oldest, restoring the draft past the newest, refusing to start over a typed draft, ending the walk on an operator edit, and recording a submitted draft while skipping a blank one. `packages/client/ui-conversation/tests/keymap-routing.client.spec.tsx` covers the gesture at the DOM boundary: ↑/↓ reach the recall, a modified arrow and a menu claim do not.
