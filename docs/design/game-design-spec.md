# 《流辉美慧号：星图守护者》游戏设计规格书

> 版本: 1.0 | 日期: 2026-03-18 | 状态: 设计阶段

---

## 一、项目概述

### 1.1 游戏定位

面向 6-12 岁儿童的认知成长解谜游戏。玩家扮演小兔子"莱米"，驾驶飞船"流辉美慧号"穿越星海，修复 50 颗故障星星，在解谜过程中习得从基础分类到元认知的思维能力。

### 1.2 核心体验

- **修复即学习**：每颗星星的故障对应一种认知技能，修复过程就是思维训练
- **无文字压力**：核心交互靠视觉和操作，文字提示为辅助
- **渐进复杂度**：5 个阶段从具象操作逐步过渡到抽象思维
- **奖励探索**：智慧结晶收集系统，鼓励反思和回顾

### 1.3 平台与技术选型

| 项目 | 选择 |
|------|------|
| 引擎 | Cocos Creator 3.8+ |
| 语言 | TypeScript |
| 导出平台 | Web(H5)、微信小游戏、iOS、Android |
| 架构 | 纯客户端（MVP），预留后端接口 |
| 角色动画 | Spine Pro |
| 数据存储 | LocalStorage / IndexedDB（MVP），预留云同步接口 |
| 美术风格 | 保罗·克利画风 + 机械迷城风格 |

---

## 二、五阶段认知进阶体系（全局结构）

### 2.1 阶段总览

| 阶段 | 名称 | 关卡 | 认知主题 | 交互复杂度 | 视觉风格演进 |
|------|------|------|---------|-----------|-------------|
| 1 | 秩序之基 | M01-M10 | 基础思维工具 | 拖拽、点击、滑块 | 具象、明亮、机械感 |
| 2 | 洞察之弓 | M11-M20 | 高阶工具 | 组合操作、多步骤 | 半抽象、暖色调 |
| 3 | 系统之舞 | M21-M30 | 动态复杂性 | 动态系统、实时交互 | 抽象、流动、冷暖交织 |
| 4 | 认知之镜 | M31-M40 | 元认知 | 间接控制、多视角切换 | 高度抽象、光影为主 |
| 5 | 演化之巅 | M41-M50 | 自我超越 | 规则重构、开放式 | 极简 + 万花筒 |

### 2.2 阶段叙事线

- **阶段 1**：莱米成为"星空维修工"，学会让事物恢复秩序与和谐
- **阶段 2**：晋升为"星际工程师"，能看透表象发现深层联系
- **阶段 3**：成为"星空导航家"，学会在动态复杂系统中做决策
- **阶段 4**：进化为"星空哲学家"，理解认知的建构性和可塑性
- **阶段 5**：达到"星空建筑师"，获得重新定义规则和创造意义的能力

### 2.3 50 关完整索引

#### 第一阶段：秩序之基（M01-M10）

| 编号 | 谜题名称 | 核心思考工具 | 关键交互 |
|------|---------|------------|---------|
| M01 | 记忆齿轮的卡顿 | 分类与归纳 | 过滤器拖拽 + 吸盘分拣 |
| M02 | 沉默的共鸣钟 | 模式匹配与排除 | 音障拖拽/旋转 + 波形观察 |
| M03 | 迷失的导航罗盘 | 系统校准与参照 | 模型对齐 + 环旋转 |
| M04 | 熵增的星沙漏 | 路径规划与分拣 | 隔板滑动 + 路径设计 |
| M05 | 冻结的星之河 | 间接策略与资源管理 | 透镜聚焦 + 导流板控制 |
| M06 | 失序的颜色交响乐 | 排序与序列 | 音阶拖拽排序 + 颜色混合 |
| M07 | 纠缠的星际信号 | 信号分离与过滤 | 频率旋钮调节 + 信号线路 |
| M08 | 断裂的平衡星盘 | 等价与平衡 | 砝码拖拽 + 天平交互 |
| M09 | 休眠的因果链 | 因果推理 | 齿轮/多米诺连接 |
| M10 | 过载的守护水晶 | 阈值判断与分流 | 阀门/管道调节 |

#### 第二阶段：洞察之弓（M11-M20）

| 编号 | 谜题名称 | 核心思考工具 |
|------|---------|------------|
| M11 | 隐藏的星座蓝图 | 抽象提取与表征 |
| M12 | 共生的寄居蟹星 | 互利关系与双赢 |
| M13 | 坍缩的维度走廊 | 降维与信息压缩 |
| M14 | 回溯的时间沙画 | 逆向推理与溯因 |
| M15 | 锈蚀的类比转轴 | 类比推理与知识迁移 |
| M16 | 过载的愿望交换机 | 优先级排序与取舍 |
| M17 | 分裂的镜像双生星 | 对称与互补思维 |
| M18 | 淤积的灵感蓄水池 | 发散与收敛思维 |
| M19 | 短路的预测回路 | 假设检验与修正 |
| M20 | 沉寂的协同蜂巢 | 分工与协作优化 |

#### 第三阶段：系统之舞（M21-M30）

| 编号 | 谜题名称 | 核心思考工具 |
|------|---------|------------|
| M21 | 无限画廊的策展人 | 框架效应与视角选择 |
| M22 | 博弈森林的护火者 | 非零和博弈与协作演化 |
| M23 | 湍流河川的摆渡人 | 复杂系统干预与二阶效应 |
| M24 | 悖论果园的园丁 | 处理矛盾与悖论思维 |
| M25 | 时序档案馆的管理员 | 时间感知与时机决策 |
| M26 | 概率云室的观测者 | 概率思维与不确定性导航 |
| M27 | 反馈回音壁的调音师 | 反馈循环识别与调节 |
| M28 | 递归迷宫的解构者 | 递归思维与自相似结构 |
| M29 | 维度折叠的裁缝 | 升维思考与降维解决 |
| M30 | 信念生态园的守护者 | 信念系统的生态平衡 |

#### 第四阶段：认知之镜（M31-M40）

| 编号 | 谜题名称 | 核心思考工具 |
|------|---------|------------|
| M31 | 观测者坍缩的光子星 | 观察者效应与实在论 |
| M32 | 语言巴别塔的编译桥 | 符号、语义与翻译 |
| M33 | 模因池的演化筛选 | 模因学与思想流行病 |
| M34 | 拉普拉斯妖的沙盘 | 决定论、混沌与自由意志 |
| M35 | 代价函数山谷的攀登者 | 优化、局部最优与探索 |
| M36 | 叙事织布机的断纬 | 叙事谬误与故事重建 |
| M37 | 意识剧场的光影师 | 注意力、意识与后台进程 |
| M38 | 边界溶解的模糊国 | 范畴化、连续谱与模糊逻辑 |
| M39 | 迭代锻造炉的淬火匠 | 迭代、渐进与突变 |
| M40 | 意义之网的编织者 | 联结主义与意义生成 |

#### 第五阶段：演化之巅（M41-M50）

| 编号 | 谜题名称 | 核心思考工具 |
|------|---------|------------|
| M41 | 自我指涉的叹息之墙 | 自指悖论与系统边界 |
| M42 | 可能世界之树的园丁 | 反事实推理与模态思维 |
| M43 | 感知滤光器的校准员 | 认知偏差识别与感知塑造 |
| M44 | 递归深渊的阶梯匠 | 无限递归与基础公理 |
| M45 | 因果密度场的测绘师 | 多因交织与贡献度分析 |
| M46 | 隐喻熔炉的炼金术士 | 概念融合与创造性类比 |
| M47 | 时间晶体的雕刻师 | 非线性时间感知与节奏设计 |
| M48 | 心智寄生体的检疫官 | 思维病毒识别与认知免疫 |
| M49 | 涌现漩涡的冲浪者 | 整体论、涌现属性与层级跃迁 |
| M50 | 元游戏棋盘的玩家 | 游戏规则反思与范式转换 |

---

## 三、技术架构

### 3.1 架构总览

```
┌─────────────────────────────────────────────────┐
│                 导出平台层                        │
│   Web(H5)  │  微信小游戏  │  iOS  │  Android     │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│            Cocos Creator 3.8+ (TypeScript)       │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │              游戏框架层                       │ │
│  │  GameManager  │ SceneLoader │ EventBus       │ │
│  │  AudioManager │ InputManager │ ProgressStore │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │              谜题系统层                       │ │
│  │  PuzzleEngine  (配置驱动的谜题主控)          │ │
│  │  InteractionKit (拖拽/旋转/滑块/连线)        │ │
│  │  GoalChecker   (胜利条件检测)                │ │
│  │  HintSystem    (分级提示)                    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │              表现层                           │ │
│  │  ShaderLib     (星光/粒子/万花筒/概率云)     │ │
│  │  SpineRuntime  (角色骨骼动画)                │ │
│  │  AudioEngine   (BGM/SFX/语音)                │ │
│  │  CameraEffects (镜头动画)                    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │              数据层                           │ │
│  │  PuzzleConfig  (JSON关卡定义)                │ │
│  │  ProgressStore (进度/成就 - LocalStorage)    │ │
│  │  [预留] ICloudSync  (云存档接口)             │ │
│  │  [预留] IPersonalize (个性化系统接口)        │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 3.2 项目目录结构

```
liuhui-star-guardian/
├── assets/
│   ├── scenes/                # 场景文件
│   │   ├── Boot.scene              # 启动/加载
│   │   ├── Home.scene              # 主界面（星图地图）
│   │   ├── Puzzle.scene            # 通用谜题场景（动态加载）
│   │   └── Journal.scene           # 智慧日志本
│   ├── prefabs/
│   │   ├── interaction/            # 交互组件预制体
│   │   ├── effects/                # 特效预制体
│   │   ├── ui/                     # UI预制体
│   │   └── characters/             # 角色预制体
│   ├── scripts/
│   │   ├── core/                   # 框架层
│   │   │   ├── GameManager.ts
│   │   │   ├── SceneLoader.ts
│   │   │   ├── EventBus.ts
│   │   │   ├── AudioManager.ts
│   │   │   └── InputManager.ts
│   │   ├── puzzle/                 # 谜题引擎
│   │   │   ├── PuzzleEngine.ts
│   │   │   ├── PuzzleConfig.ts
│   │   │   ├── GoalChecker.ts
│   │   │   └── HintSystem.ts
│   │   ├── interaction/            # 交互组件
│   │   │   ├── DragHandler.ts
│   │   │   ├── RotateHandler.ts
│   │   │   ├── SliderControl.ts
│   │   │   ├── SnapZone.ts
│   │   │   ├── Connector.ts
│   │   │   ├── FilterSystem.ts
│   │   │   ├── ViewSwitcher.ts
│   │   │   └── ParamPanel.ts
│   │   ├── effects/                # 视觉效果
│   │   │   ├── ShaderLib.ts
│   │   │   ├── ParticlePresets.ts
│   │   │   └── CameraEffects.ts
│   │   ├── data/                   # 数据层
│   │   │   ├── ProgressStore.ts
│   │   │   ├── AchievementStore.ts
│   │   │   ├── ICloudSync.ts
│   │   │   └── IPersonalize.ts
│   │   ├── ui/                     # UI逻辑
│   │   │   ├── StarMap.ts
│   │   │   ├── JournalUI.ts
│   │   │   └── DialogSystem.ts
│   │   └── levels/                 # 各关卡特定逻辑
│   │       ├── stage1/
│   │       ├── stage2/
│   │       ├── stage3/
│   │       ├── stage4/
│   │       └── stage5/
│   ├── resources/
│   │   ├── configs/                # 关卡JSON配置
│   │   │   ├── puzzles.json
│   │   │   └── stage1/
│   │   ├── i18n/                   # 多语言(预留)
│   │   ├── spine/                  # Spine动画数据
│   │   └── audio/                  # 音频资源
│   ├── textures/                   # 图片资源
│   │   ├── characters/
│   │   ├── stars/
│   │   ├── tools/
│   │   ├── effects/
│   │   └── ui/
│   └── shaders/                    # 自定义Shader
│       ├── star-glow.effect
│       ├── particle-flow.effect
│       ├── color-filter.effect
│       ├── wave-propagation.effect
│       ├── hologram.effect
│       ├── fluid-sim.effect
│       ├── probability-cloud.effect
│       ├── kaleidoscope.effect
│       └── dissolve.effect
├── docs/
│   └── design/
│       └── game-design-spec.md
└── package.json
```

### 3.3 谜题引擎 — 数据驱动核心

每个关卡由 JSON 配置驱动，引擎负责解析和执行。简单关卡只需配置；复杂关卡在 `levels/` 下写自定义 TypeScript 逻辑。

#### 关卡配置结构

```typescript
interface PuzzleConfig {
  id: string;                    // "m01"
  name: string;                  // "记忆齿轮的卡顿"
  stage: number;                 // 1
  cognitiveSkill: string;        // "分类与归纳"
  wisdomCrystal: string;         // 儿童版智慧结晶文本

  scene: {
    background: string;          // 背景资源路径
    ambientAudio: string;        // 环境音
    camera: CameraDef;           // 镜头初始设置
    entities: EntityDef[];       // 场景实体
  };

  interactions: InteractionDef[]; // 交互规则
  goals: GoalDef[];              // 胜利条件
  hints: HintDef[];              // 分级提示（3级）
  repair: RepairSequenceDef;     // 修复成功动画序列
}

interface EntityDef {
  id: string;
  type: "draggable" | "slot" | "rotatable" | "emitter"
      | "static" | "animated" | "particle" | "slider";
  sprite: string;
  position: { x: number; y: number };
  scale?: number;
  rotation?: number;
  properties: Record<string, any>;
  tags: string[];
}

interface InteractionDef {
  trigger: string;     // "drag:filter_red -> slot:gear_slot_1"
  condition?: string;  // 可选前置条件
  effect: string;      // "highlight:tag:red | dim:tag:!red"
  audio?: string;
  animation?: string;
}

interface GoalDef {
  type: "all_sorted" | "all_connected" | "threshold"
      | "sequence" | "alignment" | "custom";
  params: Record<string, any>;
  customScript?: string;  // levels/stage1/M01_MemoryGear.ts
}

interface HintDef {
  level: 1 | 2 | 3;       // 1=轻提示 2=方向提示 3=操作提示
  delay: number;           // 等待秒数后可解锁
  text: string;
  highlight?: string[];    // 高亮的实体ID
}

interface RepairSequenceDef {
  steps: {
    type: "camera_zoom" | "particle_burst" | "entity_animate"
        | "audio_play" | "screen_flash" | "text_show";
    params: Record<string, any>;
    duration: number;
    delay: number;
  }[];
}
```

### 3.4 交互组件库（InteractionKit）

50 关中交互原语的复用分析：

| 交互原语 | 组件 | 覆盖关卡数 | 关卡示例 |
|---------|------|-----------|---------|
| 拖拽到目标区域 | `DragHandler` + `SnapZone` | ~25 | M01,M04,M06,M08... |
| 旋转/对齐 | `RotateHandler` | ~12 | M02,M03,M07,M17... |
| 滑块/旋钮调节 | `SliderControl` | ~10 | M05,M10,M16,M26... |
| 连线/路径 | `Connector` | ~8 | M04,M08,M13,M20... |
| 过滤器/分类 | `FilterSystem` | ~6 | M01,M04,M06,M33... |
| 视角切换 | `ViewSwitcher` | ~8 | M21,M28,M29,M31... |
| 参数面板 | `ParamPanel` | ~10 | M22,M26,M27,M33... |

### 3.5 Shader 库

按全游戏需求规划，MVP 阶段实现前 6 个：

| Shader | 用途 | 首次出现 | 复用度 | MVP |
|--------|------|---------|--------|-----|
| `star-glow` | 星光发光、脉动 | M01 | 全局 | Yes |
| `particle-flow` | 星沙/光尘流动 | M01 | ~20关 | Yes |
| `color-filter` | 颜色过滤/高亮 | M01 | ~15关 | Yes |
| `wave-propagation` | 波/声波传播 | M02 | ~8关 | Yes |
| `hologram` | 全息投影/3D星航道 | M03 | ~5关 | Yes |
| `fluid-sim` | 简化流体/河流 | M05 | ~6关 | Yes |
| `probability-cloud` | 概率雾/模糊区域 | M26 | ~4关 | No |
| `kaleidoscope` | 万花筒/分形 | M28 | ~3关 | No |
| `dissolve` | 边界溶解/过渡 | M38 | ~3关 | No |

### 3.6 数据存储与进度系统

```typescript
interface PlayerProgress {
  currentStage: number;
  puzzles: Record<string, PuzzleProgress>;
  journal: WisdomCrystal[];
  shipUpgrades: string[];
  totalPlayTime: number;
  settings: PlayerSettings;
}

interface PuzzleProgress {
  status: "locked" | "available" | "completed";
  stars: 0 | 1 | 2 | 3;   // 评价：提示次数越少星越多
  hintsUsed: number;
  completionTime: number;
  attempts: number;
}

interface WisdomCrystal {
  puzzleId: string;
  text: string;
  unlockedAt: number;       // timestamp
}

interface PlayerSettings {
  musicVolume: number;
  sfxVolume: number;
  language: string;
}

// 预留云同步接口
interface ICloudSync {
  save(progress: PlayerProgress): Promise<void>;
  load(): Promise<PlayerProgress | null>;
  isAvailable(): boolean;
}

// MVP 实现
class LocalStorageSync implements ICloudSync {
  // 使用 sys.localStorage (Cocos) 实现
}
```

### 3.7 音频架构

| 层 | 内容 | 技术方案 |
|----|------|---------|
| BGM | 每阶段主题曲 + 每关环境音变体 | AudioSource，交叉淡入淡出 |
| SFX | 交互音效（拖拽、吸附、旋转、成功） | 对象池复用 |
| 旁白 | 智慧结晶朗读、关键提示 | MVP 用文字，预留 TTS 接口 |
| 反馈音 | 修复成功序列、星光迸发 | 分层混音 |

---

## 四、美术风格体系

### 4.1 总体风格

- **基调**：保罗·克利画风 — 几何化形态、诗意的色彩层叠、线条带有手绘温度
- **质感**：机械迷城风格的精密感 — 黄铜齿轮、透镜、罗盘、管道
- **氛围**：深邃星空 + 温暖光源，既有宇宙的神秘感又不恐怖

### 4.2 色彩演进

| 阶段 | 主色调 | 辅色调 | 情绪 |
|------|-------|-------|------|
| 1 秩序之基 | 金铜色、暖黄 | 深蓝星空 | 温暖、安全、秩序 |
| 2 洞察之弓 | 翠绿、琥珀 | 紫罗兰 | 好奇、发现、联结 |
| 3 系统之舞 | 深蓝、银白 | 橙红点缀 | 动感、张力、平衡 |
| 4 认知之镜 | 靛蓝、玫瑰金 | 半透明光晕 | 内省、宁静、深邃 |
| 5 演化之巅 | 纯白、彩虹光谱 | 黑色虚空 | 自由、创造、超越 |

### 4.3 角色设计

**莱米（主角）**
- 几何化的小兔子，圆润的三角耳朵，大眼睛
- Spine 骨骼动画：待机、行走、操作、思考、开心、困惑 6 个状态
- 穿飞行员夹克，随阶段升级徽章

**流辉美慧号（飞船）**
- 黄铜 + 水晶材质，齿轮和透镜装饰
- 功能模块可见：吸盘、聚光透镜、引擎喷口
- 每阶段完成后外观升级（新模块、新装饰）

**星星**
- 每颗独特造型，但遵循"发光晶体外壳 + 精密机械内部"的统一设计语言
- 故障状态：暗淡、碎裂、停转
- 修复后：明亮、完整、运转

### 4.4 UI 设计

- 手绘风按钮和边框，与游戏世界风格统一
- 星图地图：俯视星空，已完成的星星发光连线
- 智慧日志本：翻页效果，收集的智慧结晶以手写体呈现
- HUD 极简：仅显示当前关卡名、提示按钮、暂停按钮

---

## 五、MVP 详细设计 — 第一阶段 10 关

### 5.1 MVP 范围

- 10 个完整可玩关卡（M01-M10）
- 启动场景 + 星图地图 + 谜题场景 + 智慧日志
- 核心交互组件：DragHandler, SnapZone, RotateHandler, SliderControl, FilterSystem, Connector
- 6 个基础 Shader
- 本地存储进度
- 占位美术（后期替换 AI 生成 + 精修的正式资产）

### 5.2 M01：记忆齿轮的卡顿

**认知目标**：分类与归纳

**场景描述**：
一颗巨大的齿轮状星星，齿槽里塞满五彩斑斓、形状各异的"记忆碎片"。齿轮侧面有三个空着的彩色插槽（红、蓝、黄）。远处漂浮着对应的过滤器原型。齿轮因卡死而静默，星光暗淡。

**视觉要素**：
- 金属质感齿轮，暗淡无光
- 五彩碎片散落在齿槽中（至少 3 种颜色 × 3 种形状 = 9 个碎片）
- 三个发光的彩色过滤器浮在远处
- 中央收纳盘

**交互流程**：
1. 拖拽红色过滤器 → 插入插槽 → 非红色碎片变暗（`color-filter` shader）
2. 用飞船吸盘（长按拖拽）吸取闪亮的红色碎片 → 拖到收纳盘
3. 同形状碎片自动叠放（`SnapZone` 吸附）
4. 更换过滤器，重复流程
5. 全部分类完成 → 修复动画

**使用的组件**：`DragHandler`, `SnapZone`, `FilterSystem`
**使用的 Shader**：`star-glow`, `color-filter`, `particle-flow`

**胜利条件**：`{ type: "all_sorted", params: { groups: ["red", "blue", "yellow"] } }`

**修复动画**：齿轮转动 → 碎片以漩涡状喷出 → 化为持续星光 → 镜头拉远展示修复后的星星

**智慧结晶**："把混乱的朋友们，送回各自颜色的家，世界就有序啦。"

### 5.3 M02：沉默的共鸣钟

**认知目标**：模式匹配与排除

**场景描述**：
两颗玻璃钟形星星，由光链悬挂，面对面静止。之间漂浮着数个半透明"音障"（实心圆、镂空三角、星形网格）。一颗钟是水波纹，一颗是山脉纹。

**视觉要素**：
- 晶莹剔透的钟体，微弱内部发光
- 半透明音障，有柔和折射光
- 静谧深空背景
- 敲击时发出光波（`wave-propagation` shader）

**交互流程**：
1. 点击左钟 → 发出环形波 → 观察哪个音障可通过
2. 点击右钟 → 发出锯齿波 → 观察
3. 拖拽/旋转音障重新排列 → 为两种波清出无障碍通道
4. 双钟交替鸣响 → 修复

**使用的组件**：`DragHandler`, `RotateHandler`
**使用的 Shader**：`wave-propagation`, `star-glow`

**胜利条件**：`{ type: "all_connected", params: { paths: ["bell_left->bell_right", "bell_right->bell_left"] } }`

**智慧结晶**："为不同的声音，找到它能穿过的门，它们就能合唱了。"

### 5.4 M03：迷失的导航罗盘

**认知目标**：系统校准与参照

**场景描述**：
古老观测台内部，中央是多层嵌套的青铜星象罗盘，各层圆环刻着符号（日、月、云、箭），彼此错位。漂浮着发光实物模型：小太阳、小月亮、云、风向标。

**交互流程**：
1. 抓取小太阳模型 → 靠近罗盘 → 太阳符号环自动旋转对齐
2. 同理校准月亮、云
3. 用飞船引擎向风向标吹气 → 旋转指向
4. 根据指向手动旋转最外层空白环
5. 所有环校准 → 投射三维星航道图

**使用的组件**：`DragHandler`, `SnapZone`, `RotateHandler`
**使用的 Shader**：`star-glow`, `hologram`

**胜利条件**：`{ type: "alignment", params: { rings: ["sun", "moon", "cloud", "outer"], tolerance: 5 } }`

**智慧结晶**："先对准真正的太阳和月亮，罗盘才会告诉你正确的方向。"

### 5.5 M04：熵增的星沙漏

**认知目标**：路径规划与分拣

**场景描述**：
巨大沙漏，星沙淤积在上半部。中央通道被可滑动隔板阻塞。底部有不同图案滤网的收集槽。星沙有快、中、慢三种闪烁频率。

**交互流程**：
1. 观察星沙闪烁频率 → 对应底部收集槽图案
2. 拖动/移除隔板，设计分拣路径
3. 蜿蜒窄道 → 快闪沙；平缓宽道 → 慢闪沙
4. 全部归位 → 沙漏自动翻转

**使用的组件**：`DragHandler`, `SliderControl`
**使用的 Shader**：`particle-flow`, `star-glow`

**胜利条件**：`{ type: "all_sorted", params: { groups: ["fast", "medium", "slow"], method: "path" } }`

**智慧结晶**："为跑得快和走得慢的沙粒，设计不同的滑梯，它们就能愉快地流动了。"

### 5.6 M05：冻结的星之河

**认知目标**：间接策略与资源管理

**场景描述**：
星星表面冻结的"光之液"河道，矗立着不透明的"情绪浮冰"。飞船有聚光透镜。河床下有导流板控制开关。

**交互流程**：
1. 聚光透镜照射浮冰 → 融化但释放有色气体
2. 红气使河水激荡，蓝气使局部重新凝结
3. 策略：先融中性气体冰 → 打开河道段
4. 操作导流板引导融水绕过危险冰块
5. 河道贯通 → 光之液流动

**使用的组件**：`DragHandler`（透镜方向）, `SliderControl`（导流板）
**使用的 Shader**：`fluid-sim`, `star-glow`, `particle-flow`

**胜利条件**：`{ type: "threshold", params: { metric: "river_flow_rate", target: 0.8 } }`

**智慧结晶**："有时，用流动的水去推开冰，比用光去融化它，更聪明。"

### 5.7 M06：失序的颜色交响乐

**认知目标**：排序与序列

**场景描述**：
星星内部是一个巨大的管风琴，每根管子对应一个颜色和音阶。管子顺序被打乱，颜色和音高不匹配，奏出刺耳噪音。

**交互流程**：
1. 点击管子 → 听到音高 + 看到颜色脉动
2. 拖拽管子调整顺序
3. 按频率从低到高排列 → 颜色自然形成彩虹渐变
4. 完成排序 → 管风琴奏出和弦

**使用的组件**：`DragHandler`, `SnapZone`
**使用的 Shader**：`color-filter`, `star-glow`

**胜利条件**：`{ type: "sequence", params: { order: "ascending", attribute: "frequency" } }`

### 5.8 M07：纠缠的星际信号

**认知目标**：信号分离与过滤

**场景描述**：
通讯塔星星，多个频率的信号纠缠成噪音。有频率旋钮、带通滤波器和信号路由板。

**交互流程**：
1. 旋转频率旋钮 → 可视化频谱中不同信号的峰值
2. 调节带通滤波器宽度 → 分离出单一信号
3. 将分离的信号路由到对应的接收天线
4. 所有信号正确路由 → 通讯恢复

**使用的组件**：`RotateHandler`, `SliderControl`, `Connector`
**使用的 Shader**：`wave-propagation`, `star-glow`

**胜利条件**：`{ type: "all_connected", params: { signals: ["alpha", "beta", "gamma"], receivers: ["ant_1", "ant_2", "ant_3"] } }`

### 5.9 M08：断裂的平衡星盘

**认知目标**：等价与平衡

**场景描述**：
巨大天平星星，两端悬挂着不同重量和颜色的星石。天平严重倾斜，核心轴承因不平衡而发热变红。

**交互流程**：
1. 观察星石的重量标记和颜色
2. 拖拽星石在两端之间移动
3. 需要考虑颜色组合规则（同色相邻会产生额外重力）
4. 达到平衡 → 轴承冷却，天平水平

**使用的组件**：`DragHandler`, `SnapZone`
**使用的 Shader**：`star-glow`, `color-filter`

**胜利条件**：`{ type: "threshold", params: { metric: "balance_delta", target: 0, tolerance: 0.05 } }`

### 5.10 M09：休眠的因果链

**认知目标**：因果推理

**场景描述**：
星星内部是一条断裂的"因果链" — 一系列齿轮、杠杆、管道组成的鲁布·戈德堡机械。几个关键节点断开或缺失零件。

**交互流程**：
1. 观察机械链条的走向和断裂点
2. 从零件箱中选取正确零件填补断裂处
3. 连接零件时需考虑传动方向（齿轮旋转方向）
4. 激活起点 → 链式反应沿正确路径传递 → 终点亮起

**使用的组件**：`DragHandler`, `SnapZone`, `Connector`
**使用的 Shader**：`star-glow`, `particle-flow`

**胜利条件**：`{ type: "sequence", params: { chain: ["start", "gear_1", "lever_2", "pipe_3", "end"], propagation: true } }`

### 5.11 M10：过载的守护水晶

**认知目标**：阈值判断与分流

**场景描述**：
星星核心是一颗巨大的守护水晶，输入管道灌入过量能量导致过载发红。需要通过阀门和分流管道将能量分配到安全阈值内。

**交互流程**：
1. 观察能量仪表盘 — 总输入量和各管道阈值
2. 调节主阀门减少总输入
3. 调节分流阀将能量分配到多条支线
4. 每条支线有不同容量上限，需计算分配
5. 所有支线在安全范围内 → 水晶恢复蓝色

**使用的组件**：`SliderControl`, `ParamPanel`
**使用的 Shader**：`star-glow`, `color-filter`, `particle-flow`

**胜利条件**：`{ type: "threshold", params: { channels: ["a", "b", "c"], maxOverflow: 0 } }`

---

## 六、游戏流程与 UI

### 6.1 场景流转

```
Boot (加载) → Home (星图地图) → Puzzle (谜题) → Home (返回地图)
                                      ↕
                               Journal (智慧日志)
```

### 6.2 星图地图（Home）

- 俯视星空视角，10 颗星星散布（第一阶段）
- 已完成的星星发出明亮星光，连线形成星座雏形
- 点击可用星星 → 进入谜题
- 锁定的星星显示暗淡 + 锁图标
- 底部导航栏：日志本、设置、飞船信息

### 6.3 谜题场景（Puzzle）

- 顶部：关卡名称（可收起）
- 右上：暂停按钮、提示按钮（带冷却指示）
- 左下：莱米头像 + 对话气泡（引导文字）
- 中央：谜题交互区域
- 修复成功后：全屏修复动画 → 智慧结晶弹出 → 评价（1-3星）→ 返回地图

### 6.4 提示系统

- 3 级提示，逐级解锁（30秒/60秒/90秒无操作后）
- 第 1 级：轻微方向暗示（如某个区域微微发光）
- 第 2 级：文字提示 + 关键物体高亮
- 第 3 级：操作步骤提示 + 箭头引导
- 使用提示越多，获得的星评越少

### 6.5 智慧日志本（Journal）

- 翻页式 UI，每页一个已收集的智慧结晶
- 手写体风格文字
- 配有谜题缩略图
- 按阶段分章节

---

## 七、分阶段实施路线

| 阶段 | 里程碑 | 核心交付 |
|------|--------|---------|
| **P0: 引擎搭建** | 框架可运行 | 项目脚手架 + 核心框架层 + 占位场景 |
| **P1: 原型验证** | 1关可玩 | M01 完整可玩（占位美术）+ 基础交互组件 |
| **P2: MVP** | 10关可玩 | M01-M10 全部可玩 + 星图地图 + 进度存储 |
| **P3: 美术迭代** | 视觉达标 | AI生成 + 精修的正式美术资产替换占位 |
| **P4: 音频整合** | 听觉完整 | BGM + SFX + 修复动画音效 |
| **P5: 平台导出** | 多平台 | Web + 微信小游戏 + 移动端构建测试 |
| **P6: 阶段2扩展** | 20关 | M11-M20 + 新交互组件 + 新 Shader |
| **P7-P9** | 50关 | 阶段3-5 逐步扩展 |
| **P10: 个性化** | AI驱动 | 后端 + NLP + 知识图谱 + PCG |

---

## 八、AI 美术资产生成管线（规划）

MVP 阶段使用占位美术，后续按此管线替换：

```
Midjourney (概念设计)
    → Stable Diffusion + 保罗·克利风格 LoRA (批量生成一致风格素材)
    → Photoshop/Krita (精修)
    → TexturePacker (打包精灵图)
    → Cocos Creator (导入)
```

3D 模型（飞船、工具等）：
```
概念图(AI生成) → Meshy/Tripo3D (快速3D化) → Blender (精修) → glTF → Cocos Creator
```

角色动画：
```
概念图 → Spine Pro (骨骼绑定 + 动画) → Cocos Creator (原生支持)
```

---

## 九、预留接口设计

### 9.1 云同步接口

```typescript
interface ICloudSync {
  save(progress: PlayerProgress): Promise<void>;
  load(): Promise<PlayerProgress | null>;
  isAvailable(): boolean;
}
```

### 9.2 个性化系统接口

```typescript
interface IPersonalize {
  // 基于用户数据调整谜题参数
  adjustPuzzle(puzzleId: string, userData: UserProfile): PuzzleModifiers;

  // 获取个性化的智慧结晶文本
  getPersonalizedCrystal(puzzleId: string, userData: UserProfile): string;

  isAvailable(): boolean;
}

interface PuzzleModifiers {
  difficultyScale: number;     // 0.5-1.5
  themeOverrides: Record<string, string>;  // 视觉主题覆盖
  textOverrides: Record<string, string>;   // 文本内容覆盖
}
```

### 9.3 多语言接口

```typescript
interface II18n {
  t(key: string, params?: Record<string, string>): string;
  setLocale(locale: string): void;
  getLocale(): string;
}
```

---

## 十、技术风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| Shader 性能在低端设备差 | 视觉效果降级 | 实现 LOD 分级，低配设备关闭复杂效果 |
| 50关配置维护复杂 | 开发效率 | 关卡编辑器工具（后期） |
| 微信小游戏包体限制 | 无法发布 | 资源分包加载，首包 < 4MB |
| AI 生成美术风格不一致 | 视觉割裂 | 训练专用 LoRA，严格风格审核 |
| 后期关卡（M31-50）逻辑复杂 | 开发周期长 | 核心数学/物理模块与渲染层解耦 |
