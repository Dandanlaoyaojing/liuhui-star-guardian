# Claude Code Game Studios 调研报告

> 类型: 团队内部参考 | 日期: 2026-03-24 | 调研人: Claude Agent

---

## 一、项目概况

**仓库**: [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
**协议**: MIT
**版本**: v0.3.0 (2026-03-09)
**定位**: 把 Claude Code 变成一个完整的游戏开发工作室 — 48 个 AI agent、37 个工作流 skill、8 个自动化 hook，模拟真实游戏工作室的组织架构。

**核心理念**: 独立开发者 + AI 缺乏组织纪律，这个模板补上了质量门禁、决策框架和职能分工，但所有决策仍由人类拍板。

---

## 二、架构详解

### 2.1 三层 Agent 层级

| 层级 | 角色数 | 模型 | 职责 |
|------|--------|------|------|
| Tier 1 — 总监 | 3 | Opus | creative-director, technical-director, producer — 战略决策 |
| Tier 2 — 部门负责人 | 8 | Sonnet | game-designer, lead-programmer, art-director, audio-director, narrative-director, qa-lead, release-manager, localization-lead |
| Tier 3 — 专家 | 37 | Sonnet/Haiku | gameplay-programmer, level-designer, economy-designer, sound-designer, writer, security-engineer 等 |

**协调规则**:
- 纵向: 总监 → 负责人 → 专家，职责链清晰
- 横向: 同层可咨询，不能跨域做决策
- 冲突: 上升到共同上级（设计冲突找 creative-director，技术冲突找 technical-director）
- 文件边界: agent 不修改自己职责域外的文件

### 2.2 引擎支持

内置三套引擎专家 agent:

| 引擎 | 专家 agent 数量 | 覆盖领域 |
|------|----------------|---------|
| Godot 4 | 4 | GDScript, Shader, GDExtension |
| Unity | 5 | DOTS/ECS, Shader/VFX, Addressables, UI Toolkit |
| Unreal Engine 5 | 5 | GAS, Blueprint, Replication, UMG/CommonUI |

**注意: 不支持 Cocos Creator。** 没有 Cocos 相关的 agent 或规则。

### 2.3 Hook 系统 (8 个)

| Hook | 触发时机 | 功能 |
|------|---------|------|
| `validate-commit.sh` | git commit | 检测硬编码值、校验 TODO 格式、验证 JSON |
| `validate-push.sh` | git push | 推送到受保护分支时警告 |
| `validate-assets.sh` | 写入资产文件 | 强制命名规范和 JSON 结构 |
| `session-start.sh` | 会话开始 | 加载 sprint 上下文和最近 git 历史 |
| `detect-gaps.sh` | 会话开始 | 识别新项目和缺失文档 |
| `pre-compact.sh` | 上下文压缩 | 压缩前保留进度笔记 |
| `session-stop.sh` | 会话结束 | 记录本次成果 |
| `log-agent.sh` | agent 派生 | 创建 subagent 调用审计轨迹 |

### 2.4 37 个 Skill/工作流

分 6 大类:

- **评审 (7)**: design-review, code-review, balance-check, asset-audit, scope-check, perf-profile, tech-debt
- **生产管理 (5)**: sprint-plan, milestone-review, estimate, retrospective, bug-report
- **项目管理 (6)**: start, project-stage-detect, reverse-document, gate-check, map-systems, design-system
- **发布 (5)**: release-checklist, launch-checklist, changelog, patch-notes, hotfix
- **创意 (5)**: brainstorm, playtest-report, prototype, onboard, localize
- **团队编排 (7)**: team-combat, team-narrative, team-ui, team-release, team-polish, team-audio, team-level

### 2.5 v0.3.0 新增重点

相比早期版本，v0.3.0 不只是多了两个命令，而是把"工作流产品化"又往前推了一步:

- **`/design-system`**: 以分章节方式协作完成 GDD，逐段批准、逐段写入，降低长文档失控风险
- **`/map-systems`**: 从旧的 `/design-systems` 重命名而来，更强调系统拆解、依赖映射和设计顺序
- **`statusline.sh`**: 在终端底部显示 7 阶段制作流水线 breadcrumb，并读取 `production/stage.txt` / `active.md` 展示当前项目状态
- **`UPGRADING.md`**: 明确说明从旧版本迁移时哪些文件可覆盖、哪些需要手动 merge

**评价**: 这几个更新说明它已经不只是"一堆 agent prompt"，而是在补全长期使用时最容易出问题的地方: 状态可见性、迁移路径、命令改名兼容。

### 2.6 路径作用域编码规则 (11 条)

按目录自动应用不同规范:
- `src/gameplay/`: 数据驱动、dt 时间、不耦合 UI
- `src/core/`: 热路径零分配、线程安全
- `src/ai/`: 性能预算、可调试、数据驱动参数
- `src/networking/`: 服务器权威、消息版本化
- `src/ui/`: 不持有游戏状态、本地化就绪、无障碍
- `design/gdd/`: 必需 8 个章节、公式标注、边界条件
- `tests/`: 命名规范、覆盖率目标
- `prototypes/`: 放宽标准，但要 README + 假设

---

## 三、6 个关键设计模式

### 3.1 Question-First 协议

**流程**: 理解 → 提问 → 给 2-3 个选项 → 推荐 → 等用户拍板

所有 48 个 agent 遵循同一协议: 写文件前必须请求许可 ("May I write this to [filepath]?")，多文件变更需要对完整变更集的显式批准，不会自主执行任何决策。

**评价**: 这是对 Claude 容易"自作主张"问题的系统级解决方案。但对小团队来说可能过于繁琐。

### 3.2 数据驱动

gameplay 值全部外部化到 JSON config，`validate-commit.sh` hook 在提交时扫描硬编码数值并警告。

**评价**: 与我们项目 `puzzle-scripts.md` 规则完全一致。我们已经实现了这个模式。

### 3.3 文件即状态

关键状态写到 `production/session-state/active.md`，不依赖对话上下文。v0.2.0 引入此功能，解决 Claude 上下文窗口清空后丢失进度的问题。

**评价**: 比我们的 `session-start.sh` 方案更完整。我们目前靠 git status + 文件系统扫描重建状态，没有显式的会话状态文件。

### 3.4 语义分块写文档

先写骨架获批 → 再逐节填充 → 每次只保持 3-5k token 活跃。29 个文档模板强制结构化。

**评价**: 我们的 `puzzle-design-template.md` 8 章节结构是简化版本。Game Studios 的模板体系更完整(GDD、ADR、sprint plan、economy model 等 29 个模板)。

### 3.5 双向依赖映射

设计文档标注"什么影响我"和"我影响什么"，变更时由 producer agent 协调跨部门影响。

**评价**: 我们模板第 6 节已实现。Game Studios 用 producer agent 做自动协调，我们没有(也不需要，规模不同)。

### 3.6 设计哲学与安全边界

官方 README 明确写出它背后的方法论不是随意拼接，而是几套成熟框架的组合:

- **MDA Framework**: 用 Mechanics / Dynamics / Aesthetics 组织设计讨论
- **Self-Determination Theory**: 用自主、胜任、联结校准玩家动机
- **Flow State Design**: 用挑战-技能平衡控制体验节奏
- **Bartle Player Types**: 辅助定位目标玩家与验证玩法覆盖
- **Verification-Driven Development**: 先验证、再实现，减少"AI 先写再补救"的返工

同时，它也不是完全放任 agent 自主行动。README 特别强调:

- agent 必须先提问、给选项、等人拍板
- hooks 和 `settings.json` 会自动放行安全操作、拦截危险操作
- 这是一个**协作式系统**，不是 autopilot

**评价**: 这一层很重要。Game Studios 真正想卖的不是"48 个角色扮演 prompt"，而是"一套带方法论和护栏的协作纪律"。

---

## 四、实际使用者反馈

### 4.1 成功案例

一位开发者使用 5-agent 并行团队 (developer, designer, researcher, growth analyst, shipper)，在一个会话中完成 17 项任务中的 9 项，包括游戏手感改进、截图制作、平台调研。

来源: [I Ran a 5-Agent Game Studio with Claude Code Teams](https://dev.to/yurukusa/i-ran-a-5-agent-game-studio-with-claude-code-teams-2lpk)

**有效的部分**:
- 任务依赖 (`blockedBy`) 防止混乱
- 专业化分工消除文件冲突
- 真并行: 5 个独立任务 ≈ 1/5 串行时间

### 4.2 已知问题

| 问题 | 描述 |
|------|------|
| **空闲浪费** | 被阻塞的 agent 无事可做，白耗 token |
| **成本高** | 全部跑 Opus 消耗大量 token，轻量任务应该用便宜模型 |
| **上下文重复** | 每个 agent 独立读共享文件，没有共享记忆 |
| **输出失效** | builder 改了游戏手感后，designer 截的图可能已过时 |
| **AI 设计直觉弱** | 游戏手感、UI/UX 等需要直觉判断的部分，AI 处理不好 |
| **一致性差** | 同样的需求跑 10 次，产出 10 个完全不同的结果 |

来源: [Sukh Sroay on X](https://x.com/sukh_saroy/status/2035385311833047124)

---

## 五、与我们项目的适配分析

### 5.1 项目差异对比

| 维度 | Game Studios | 星图守护者 |
|------|-------------|-----------|
| 引擎 | Godot/Unity/UE5 | **Cocos Creator 3.8+** |
| 语言 | GDScript/C#/C++ | **TypeScript** |
| 规模 | 通用大型项目 | 50 关卡认知解谜 |
| 团队 | 模拟大工作室 | 1-2 人 + AI |
| 平台 | PC/主机 | Web/微信小游戏/移动端 |
| 复杂度 | 需要 48 agent 协调 | 核心循环相对简单 |

### 5.2 不建议直接整套使用的原因

1. **没有 Cocos Creator 支持** — 14 个引擎专家 agent 全部是 Godot/Unity/UE5，对我们的 TypeScript + Cocos 栈零覆盖，需要从头写 Cocos 专家 agent
2. **过度工程** — 48 agent 的协调开销对 50 关卡解谜游戏来说太重。我们不需要 network-programmer、replication-specialist、live-ops-designer
3. **token 成本** — 每个 agent 独立消费上下文，多 agent 并行成本线性增长
4. **维护负担** — 48 个 agent prompt + 37 个 skill + 8 个 hook + 11 条规则，自定义和维护成本高

不过，官方 README 也明确把它定义成 **template**，强调可以:

- 删除不需要的 agent
- 改写 agent prompt
- 只保留部分 skills / hooks / rules
- 不使用任何默认引擎集，只借用流程骨架

所以更准确的判断不是"完全不适合我们"，而是:

**不适合整套照搬，但很适合拆开吸收。**

### 5.3 值得借鉴的部分

| 可借鉴 | 具体内容 | 我们的现状 | 建议 |
|--------|---------|-----------|------|
| **Hook 系统** | validate-commit 检查硬编码值 | 已有类似实现 | 可参考 validate-assets 加强资源校验 |
| **文件即状态** | session-state/active.md | 未实现 | 考虑在 `production/` 下加会话状态文件 |
| **路径作用域规则** | 按目录自动应用不同规范 | 已有 4 条规则文件 | 保持现有规模即可 |
| **文档模板体系** | 29 个结构化模板 | 已有 puzzle-design-template | 可按需增加(shader 设计模板、交互组件模板) |
| **Agent 审计** | log-agent.sh 记录 subagent 调用 | 未实现 | 如果开始用多 agent 并行，值得加 |
| **状态线 / 迁移指南** | status line + UPGRADING.md | 未实现 | 如果后续流程复杂化，这类"长期可维护性工具"很值得借鉴 |

---

## 六、结论与建议

### 判定: 不建议作为基础框架整套使用，但建议拆解吸收

**理由**:
- 引擎不匹配是硬伤，改造成本 > 从头搭建
- 我们已经有了适合项目规模的轻量配置 (4 条规则 + 模板 + hook)
- Game Studios 解决的是"大型项目缺乏组织纪律"的问题，我们的项目规模不存在这个问题
- 但它在状态管理、升级路径、流程护栏方面的设计，仍值得选择性借用

**具体行动项**:

1. **立即可做**: 参考 `validate-assets.sh` 给我们的 hook 加资源命名校验
2. **短期考虑**: 如果上下文丢失成为痛点，引入 `session-state/active.md` 或更轻量的文件即状态方案
3. **中期可借**: 如果工作流开始变长，考虑增加状态线或阶段 breadcrumb，降低"现在做到哪一步了"的不透明感
4. **长期观察**: 当项目进入阶段 3-5 (30+ 关卡) 且需要多人协作时，重新评估是否需要更多 agent 分工

---

## 附录: 参考链接

- [GitHub 仓库](https://github.com/Donchitos/Claude-Code-Game-Studios)
- [5-Agent 实战报告 (DEV Community)](https://dev.to/yurukusa/i-ran-a-5-agent-game-studio-with-claude-code-teams-2lpk)
- [X 上的社区讨论](https://x.com/sukh_saroy/status/2035385311833047124)
- [GitHub Releases](https://github.com/Donchitos/Claude-Code-Game-Studios/releases)
