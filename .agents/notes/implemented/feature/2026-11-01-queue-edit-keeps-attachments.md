# Agent Note: Editing a queued message keeps its attachments

Status: implemented

English | [中文](2026-11-01-queue-edit-keeps-attachments.zh.md)

## Problem

The queue dock let a pending message be edited in place, but only when every content block was text: `textOf` returned `null` for a message carrying an image, and the edit button rendered disabled with a hint that non-text content was unsupported. The host enforced the same rule with `QUEUE_EDIT_NON_TEXT`, and a client edit replaced the whole content list, so submitting text for an image message would have dropped the image.

That makes the common case awkward: a user queues "看图" plus a screenshot, notices a typo, and can only delete the message and rebuild it — which means staging the image again.

## Decision

An edit carries text only and describes a replacement for the message's text, not for its attachments.

- `QueueAction`'s edit content stays `readonly TextBlock[]`; its JSDoc now states that image blocks the queued message already carries stay in place.
- `mergeEditedText` in `packages/api/session-controller/src/commands.ts` composes the stored message: a message without attachment blocks becomes exactly the submitted text; otherwise non-text blocks keep their positions, the submitted text takes the first text position, later text positions collapse into it, an empty edit removes the text entirely, and a message that had no text gets the text appended.
- The "content must include non-whitespace text" rule now applies to the merged result through `hasMessageContent`, so a text-only message still cannot be emptied while an image message can lose its caption. The text-only payload rule and `QUEUE_EDIT_NON_TEXT` remain, because a client has no durable reference to send for an attachment it does not own.
- `QueueDock`'s `textOf` joins the message's text blocks and always returns a string, so the edit action is enabled for every mutable row; the disabled hint and its `queue.edit.unsupported` copy in all eight dictionaries are gone.

## Alternatives considered

**Send the whole content list from the client, attachments included.** The dock does hold the durable image references it renders thumbnails from, so it could echo them back. But then the host trusts a client-supplied attachment list for a message the host already owns: a stale or reordered list would silently change which images the model receives, and a client that dropped a block would look like an intentional removal rather than a bug. Editing text is the only user intent here.

**Add a separate `text` field to the edit action.** It reads better than reusing `content`, but it would duplicate the wire shape of every other prompt-carrying action and require a migration for a field whose semantics are identical — text blocks are already the only block type an edit may carry.

**Leave the feature as unsupported and let users re-stage.** Correct but wasteful: the attachment is already durable and addressed by the message, and requeueing re-uploads bytes the store already has.

## Consequences

Editing an image message now changes only its words; the images it carries are byte-for-byte the same blocks, so the agent receives the same attachments in the same order. A caption-less image message can gain text, and losing all text from an image message is allowed while losing it from a text-only message is still refused. Removing the message remains the only way to drop its attachments.

The merge is a host invariant rather than a client convention, so any Remote caller that sends `{ kind: 'edit', content: [text] }` gets the same behavior.

## Testing

`packages/api/session-controller/tests/commands-queue-attachment.host.spec.ts` covers a message whose text precedes an image, an image-only message that gains and then loses a caption, and a message with a second text block after an image that collapses into the first position. `packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` covers the enabled edit action on an image row, the text-only command it submits, and that every queued row now exposes an enabled edit action.
