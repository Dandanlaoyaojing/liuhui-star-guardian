# 迁移到 Unity 引擎 —— 计划

状态:**2026-07-12 用户拍板从 Cocos Creator 3.8 迁到 Unity。** 本文是执行计划。

## 决策与留痕

- **驱动**:光效工具天花板(想要 URP 2D 光照 + Bloom 后处理)+ 站主流引擎、后续省心。
- **诚实备注(避免基于错误前提)**:
  - **2D 物理不是有效理由**——Cocos 与 Unity 的 2D 物理都是 Box2D 系;项目里的 Verlet 绳是手写、引擎无关。后续关的复杂 **2D** 物理 Cocos 一样能扛。Unity 的物理优势在 3D。
  - **迁移前那次 Cocos glow 实验没渲染成功,是无头预览的坑**(隐藏标签页 `document.hidden` 令 RAF 暂停 + 画布初始化未跑),**不是** Cocos 画不出光的证据。
- **备份(退路已焊死)**:Cocos 完整状态在 origin tag `cocos-engine-final-2026-07-12` + 分支 `archive/cocos-engine`(= `e725ae4`,M01 完成 + M02 进行中)。

## 量级(别低估)

| | 现状(Cocos/TS) | 迁移代价 |
|---|---|---|
| 生产代码 | 45 文件 / 15,112 行 TS | 逐行重写 C# |
| 测试 | 42 文件 / 9,494 行 vitest | 重写 Unity Test Framework |
| 物理 | 手写 Verlet + Box2D 调参 | Unity 2D 物理重调,常量归零 |
| shader | 1 `.effect` + 大量代码生成纹理 | ShaderLab / Shader Graph 重写 |
| **已修 bug** | 记忆里一长串玩法坑(旋转账本/吸附语义/拾片门控/物理重座…) | **以等价形式在 C# 重现,需重 debug** |

**多月、多会话的重写。** 这台 Mac 能跑 Unity 编辑器 + 出 Mac/iOS 包;Steam **Windows** 包仍需 Win 机/CI(与 Cocos 时代同,躲不掉),最终人肉验收需真机。

## 可复用 vs 必重写

- **复用**:802 个原始美术/音视频文件(PNG 帧/mp4/mp3,Unity 直接导入)、设计文档(vision/spec/plans,语言引擎无关)、config JSON 的**数据**(schema/loader 重写)、全部玩法设计知识。
- **必重写**:所有 TS→C#、物理调参、shader、工具链(Cocos MCP/预览/帧动画管线/CI)、测试。

## 目标环境

- **Unity 6.3 LTS,锁定 `6000.3.19f1`**(2026-07-12 用户装定;**别中途跳到别的版本/Tech Stream**,跨版本升工程易炸),**2D URP 模板**——URP 才有 2D Lights + Bloom 后处理(**迁移的核心目的,别选内置渲染管线**)。模块:iOS Build Support + Mac Build Support (IL2CPP)(Hub → Installs → ⋯ → Add Modules 随后可补)。
- C# + Unity Test Framework(EditMode 跑纯逻辑、PlayMode 跑交互)。
- 平台:iOS(IL2CPP)+ Steam(Win/Mac Standalone)。**桌面视频洞在 Unity 里自动消失**(VideoPlayer 原生支持桌面)——原 `m01-completion-ffmpeg-decoder-plan.md` 随之作废。

## 迁移顺序 —— 先验 payoff,再搬大头

> 原则:**别盲搬 24k 行**。先用一个垂直切片证明"换引擎真能给到你要的光",再决定是否投多月搬全部。万一 Unity 的光也没到你要的,只花一个 slice、不是几个月(Cocos 完整版在 tag 里可回)。

| Phase | 内容 | 闸门 |
|---|---|---|
| **0 环境** | 装 Unity Hub + 6 LTS + 2D URP;建工程 + git;接 iOS/Steam 构建目标空跑一次 | 需用户:Unity 账号 + 许可 |
| **1 光效垂直切片(go/no-go)** | 在 Unity 用 **URP 2D Light + Bloom** 重建 M2 星网一个光效(呼吸光带 + 节点辉光),**人肉确认光质到位** | ⛔ **不达标就停**,回滚成本仅一个 slice |
| **2 纯逻辑移植** | 引擎无关规则/状态机(M01 Session/CutsceneTiming、M02 PrologueSession/StarNetworkModel、config 校验)→ C#。**先搬 vitest 测试当规格**,逐个 TDD 红→绿 | 测试全绿 |
| **3 M01 垂直切片** | 拼片/吸附旋转/手电/物理(Box2D→Unity 2D 重调)/过场(VideoPlayer 直播母版 mp4)/莱米帧动画(802 帧导入) | 编辑器 + 对抗审 |
| **4 M02 垂直切片** | 星网 + 序章 + 用 Phase 1 光效方案铺满 | 同上 |
| **5 系统** | 存档、ToolCard、UI、音频、场景流 | — |
| **6 打包验收** | iOS + Steam Win/Mac 出包,人肉过关 + 对抗审 | 与 iOS 一致 |

## 立即卡点

**Phase 0 卡在"装 Unity"**(本机当前无 Unity)——需要用户:装 Unity Hub + Unity 6 LTS,建一个 **2D URP** 工程。装好后,Phase 1 的光效切片是第一件要做、也是最该先做的事(它验证整个迁移的前提)。
