---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-01-session-workspace-roots

English | [中文](2026-11-01-session-workspace-roots.zh.md)

## Summary

Adds an optional Session header field listing the directories the Session may modify, primary first.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-01-session-workspace-roots
baseline: false
changes:
  - root: "SessionHeader"
    previous: "2026-09-16-session-format-v4"
    after: "c7ad0c427daff1acfa599d58e0fffd9e0e3dcba9531e7c3b2c2f0a9db605c794"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Sessions created before this change carry no workspaceRoots and keep resolving a single writable directory from their cwd. New readers admit both forms. Older builds reject a header carrying the unknown field, so they refuse such a Session instead of interpreting it with a narrower writable set; no accepted record changes meaning. The field is a snapshot taken at creation and never rewritten, so replay and fork reproduce the same sandbox policy.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/core/session/tests/session.spec.ts packages/core/session/tests/fork.spec.ts: 102 tests passed, covering the new validation cases and both create and fork snapshots. packages/sandbox/sandbox-policy/tests/policy.spec.ts: 27 tests passed, covering root merging and rendered policy text.

<a id="dev-note"></a>
## Dev Note

None.
