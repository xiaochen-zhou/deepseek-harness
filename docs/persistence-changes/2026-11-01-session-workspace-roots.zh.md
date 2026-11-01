---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-01-session-workspace-roots

[English](2026-11-01-session-workspace-roots.md) | 中文

## 概述

为 Session header 增加一个可选字段，按顺序记录该 Session 可修改的目录，主目录在前。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

本次变更前创建的 Session 不含 workspaceRoots，仍按其 cwd 解析唯一的可写目录；新读者同时接受两种形式。旧版本会因未知字段拒绝带该字段的 header，从而拒绝这类 Session，而不是用更窄的可写集合去解释它；已接受记录的含义不变。该字段在创建时快照、之后不再改写，因此回放与分叉得到相同的沙箱策略。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/core/session/tests/session.spec.ts packages/core/session/tests/fork.spec.ts：102 个测试通过，覆盖新增校验用例以及创建与分叉时的快照。packages/sandbox/sandbox-policy/tests/policy.spec.ts：27 个测试通过，覆盖目录合并与渲染出的策略文本。

<a id="dev-note"></a>
## 开发备注

无。
