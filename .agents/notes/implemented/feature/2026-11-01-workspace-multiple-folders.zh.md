# Agent Note: 一个 Workspace 拥有多个目录

Status: implemented

[English](2026-11-01-workspace-multiple-folders.md) | 中文

## Problem

Workspace 之前只对应一个规范目录：它把记录的工作目录（`cwd`）等于该路径的 Session 归入分组，沙箱策略也只从 Session 自己的 `cwd` 解析出一个可写根目录。跨仓库的工作——一个服务、它的部署清单，以及共享的 schema 包——因此需要为每个仓库建立一个 Workspace，把一个项目的会话拆散到互不相关的侧边栏条目里，并且每个仓库只能看到自己可写。Codex 用项目分组解决同一问题：项目列出多个根目录，线程在启动时快照它使用的根目录。

## Decision

- Workspace 领域记录保留 `path` 作为主目录，并追加 `extraPaths`；`Workspace.paths` 以 `[path, ...extraPaths]` 的形式返回有序列表。领域版本升到 3 并声明 `compatibleVersions: [2]`，因此版本 2 记录会按单目录 Workspace 读取，并在下一次写入时改写为版本 3。
- `WorkspaceRegistry.setPaths(id, paths)` 是列表唯一的公开变更入口。它用注册表的 `realpath` 规范逐一规范化条目，拒绝非目录，把重复目录折叠到首次出现的位置，并以 `WorkspacePathConflictError` 拒绝已被其他 Workspace 拥有的目录。实体保留一个包内可见的写入口，因为所有权是注册表范围的问题：单个实体看不到同级实体。
- 成员资格跟随该列表。挂接 Session 要求其规范 `cwd` 是 Workspace 的某个路径；更改路径会剪除不再被拥有的目录上的 Session，但不触碰它们的日志。注册表的头部索引、历史引导与候选过滤都按完整列表比较，因此任一已拥有目录中的 Session 都解析到同一个 Workspace。
- `SessionHeader.workspaceRoots` 在创建 Session 时快照该列表（主目录在前），`SessionStore.fork` 会复制它。沙箱策略从该快照推导 `additionalWritableRoots`：先是部署配置的根目录，然后是快照中除 Session 自身 `cwd` 之外的每个条目。没有快照的 Session 保持原有的单目录行为。
- 快照正是策略可回放的原因。在解析 Session 的沙箱策略时读取 Workspace 注册表，会让一个对模型可见的权限依赖 Session 日志之外的可变状态，而“对模型可见 ⟺ 已记录”规则禁止这样做。因此复用要求快照完全相同：记录根目录不同的空 Session 会被新铸造的 Session 取代，而不是被悄悄放宽或收窄。
- `workspace.create` 接受 `extraPaths`，`workspace.setPaths` 替换列表，`WorkspaceView.paths` 发布它。Client 模型像处理其他单次变更一样 upsert 返回的行。冲突以 `workspace/path-conflict` 暴露并携带拥有者的 Workspace id，对话框会在它尝试添加的文件夹旁报告该错误。
- UI 从 Workspace 卡片打开“编辑项目”对话框：它列出目录，可逐个移除但不会移除最后一个，新增目录走 Host 选择器（与其它添加 Workspace 的入口一致）。保存时发送完整的有序列表，因此规范化与冲突判定仍由 Host 负责。

## Alternatives considered

**在解析沙箱策略时读取注册表。** 这是改动最小的方案：不需要头部字段、不需要持久化变更、也不需要快照比较。但它让对模型可见的权限依赖不在 Session 日志中的状态，重放一份记录可能得到与该次运行不同的可写集合，fork 也会继承其来源运行时不存在的权限。快照的代价是一个可选头部字段与记录它的持久化变更。

**在复用时采纳当前目录而不是要求匹配。** 复用空 Session 并套用 Workspace 当前列表能让更多草稿被复用。但它会在创建之后改变 Session 的权限，而模型可能已在更早的请求中被告知旧权限，被 fork 或恢复的 Session 也无法复现该变化。铸造新 Session 能让每个 Session 的可写集合与其自身记录一致。

**像 Codex 那样在 Workspace 之上增加独立的项目实体。** 带独立 id、根目录与元数据的项目对象，加上引用它的 Workspace 或线程，能更干净地把分组与执行分开，并支持在不触碰目录的情况下重命名分组。它也引入第二层持久身份、既有记录的迁移，以及分组再分组的侧边栏。扩展现有记录让每个项目只有一个身份，并原样复用排序、置顶、归档、移除等全部既有操作。

**把所有 Workspace 的目录并成一个可写集合。** 这不需要 Session 字段，也不需要 UI 改动。但它给 Session 授予了它从未在其中启动过的仓库的写权限，既是安全退化，也是对模型关于当前任务的错误陈述。

**让每个 Session 在 UI 中维护自己的附加根目录列表。** 这比项目级分组更灵活。但用户要为项目中的每个会话重复同一组目录，侧边栏也无法展示项目覆盖了哪些目录。

## Consequences

- 旧版本会因未知头部字段是校验错误而拒绝携带 `workspaceRoots` 的 Session。它们拒绝该 Session，而不是用更窄的可写集合解释它，这也是持久化变更选择同版本而非提升版本号的原因。
- 在 Workspace 增加目录之前创建的 Session 保持其较窄的集合；只有新 Session 能看到新增目录。UI 不会就此提示，约定是：可写集合在创建时固定。
- 一个目录最多属于一个 Workspace，因此把仓库在项目之间移动需要先从一个列表移除再加入另一个列表。冲突错误会指明拥有者，而不是静默移动。
- 从 Workspace 移除目录会把记录在该目录上的 Session 变为未分组。它们的历史、顺序与日志都会保留，重新添加该目录会再次挂接它们。
- 文件夹对话框编辑 Host 返回的路径列表；规范化与冲突拒绝都在 Host 侧完成，对话框以返回的行为准刷新，而不是以自己的草稿为准。

## Testing

`packages/workspace/workspace/tests/workspace.spec.ts` 覆盖多目录拥有、去重、空/缺失/他人拥有时的拒绝、剪除与重新加载。`packages/core/session/tests/session.spec.ts` 与 `fork.spec.ts` 覆盖头部校验以及创建与 fork 的快照。`packages/sandbox/sandbox-policy/tests/policy.spec.ts` 覆盖根目录合并、部署根目录优先级与渲染出的策略文本。`packages/api/session-controller/tests/commands-create-fork.host.spec.ts` 固定了 Workspace 放置的 Session 收到的 `cwd`/`workspaceRoots` 组合；`session-presets.host.spec.ts` 固定了快照匹配时才复用。`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` 通过行菜单驱动文件夹对话框。
