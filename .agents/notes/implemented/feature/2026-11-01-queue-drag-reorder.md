# Agent Note: Queued messages reorder by dragging

Status: implemented

English | [中文](2026-11-01-queue-drag-reorder.zh.md)

## Problem

A queue holding several pending prompts could only be edited or removed one row at a time, so the order the Session would run them in stayed the order they were typed. The operator's cheapest workaround was deleting a row and retyping it at the end.

## Decision

A queued row is dragged onto another row; the half of the target the pointer is over decides whether it lands above or below, and a marker line shows that landing position before the drop.

- `QueueAction` gains `{ kind: 'move'; before: MessageId | null }`, where `before: null` appends. The controller splices within the row's own pending list (`next-turn` or `next-step`), so ordinary prompts and steering input reorder independently of each other.
- Positions are computed against the list without the moved item, so a downward move lands where the marker showed rather than one row short.
- A move that asks for the position the row already occupies records no splice, and an unknown anchor fails as `session/queue-item-not-found`, the same code every other stale queue edit returns.
- Dragging is offered only while the queue is mutable, holds at least two rows, and has no open inline edit or in-flight action: a row cannot be dragged and edited at once, and a row mid-request has no settled order to show.

## Alternatives considered

**Up and down buttons on every row.** They would put two more controls on a row that already carries edit, remove, and steer, and moving a row three places would take three round trips; the drag states the destination in one gesture.

**A numeric priority the operator types.** It exposes an internal ordering concept the queue does not have, and asks the operator to compute positions instead of pointing at one.

**Reorder by resending.** Dropping the queued item and re-enqueuing it at the end would re-run attachment intake and lose the row's identity, so a moved prompt would arrive as a new submission rather than the same pending message.

## Consequences

The queue's visible order is the order the Session runs it in, and changing that order is one gesture. The queue keeps its own pending lists on the Host, so a reorder survives a client reload like every other queue edit, and a row whose anchor was removed meanwhile fails loudly instead of landing somewhere unexpected.

## Testing

`packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` drives the dock: dragging a row onto the lower half of the row above it issues one `move` before that row, dragging onto the upper half of a lower row issues a `move` before its predecessor, and the gesture is withheld while an edit is open or the queue holds one row. `packages/api/session-controller/tests/commands-queue-attachment.host.spec.ts` covers the controller: a downward move lands at the marked position, a move onto itself writes no splice, and an unknown anchor returns `session/queue-item-not-found`.
