# M01 Cocos → Unity 渲染 1:1 等价设计

## 目标

以当前 Cocos M01 工作区为视觉与行为真源，在 Unity 6.3 LTS 2D URP 中重建完整 M01 渲染层。相同配置、布局状态、动画动作和交互状态必须产生相同的基础几何输出：相同设计分辨率、显示尺寸、token 位置、旋转、锚点、裁边补偿、层级与动画帧序列。

URP 的 Light2D、Bloom 和 Unity 材质只允许叠加表现，不得改变上述基础几何契约。

## 真源边界

- 盘面与交互渲染：`assets/scripts/cocos/M01GreyboxBootstrap.ts`
- 美术资源清单和 displaySize：`assets/scripts/cocos/M01GreyboxArt.ts`
- Sprite 裁边与比例：`assets/scripts/cocos/M01SpriteAspect.ts`
- 开场剧场：`assets/scripts/cocos/M01IntroSequence.ts`
- 莱米逐帧播放与脚底锚点：`assets/scripts/cocos/LemmyActor.ts`、`LemmyActorContract.ts`
- 逻辑坐标：`assets/scripts/levels/stage1/M01GreyboxLayout.ts` 及 `m01-memory-gear.json`
- 当前未提交但已进入 Cocos 工作区的 M01 资源和配置也属于本次快照；迁移记录必须保存源文件哈希，避免以后误把旧快照当最新版。

## 架构

### 1. M01RenderContract

新增纯 C# 渲染契约，不引用 `UnityEngine`。它保存资源 ID、Cocos 资源路径、Unity 资源路径、displaySize、pivot、sorting order、设计分辨率、PPU、莱米动作帧数及脚底锚点规则。xUnit 直接验证契约值和资源清单。

### 2. Cocos 坐标兼容层

新增小型 Unity 适配层，集中完成：

- Cocos px → Unity world units（PPU=100）
- Cocos 顺时针角 → Unity Z 轴角
- UITransform anchor/pivot → SpriteRenderer transform offset
- trimmed SpriteFrame 的原始尺寸、裁边矩形和 pivot 补偿
- displaySize 的 contain/cover/width/height 适配

所有渲染器禁止自行重复写换算公式。

### 3. 方法级渲染器

把单体探针拆成正式组件，但保持 Cocos 方法的责任边界：

- `M01BoardRenderer`：盘面、槽、证据、拼片、地面线、底灯
- `M01FragmentRenderer`：隐藏态、显色态、描边和层级
- `M01FlashlightRenderer`：手电、光束、逐像素显色参数
- `M01IntroDirector`：篮子、前遮挡、绳、钉子、碎片释放、莱米走位
- `M01LemmyRenderer`：18 动作、697 帧、脚底锚点、朝向和动作缩放
- `M01CompletionDirector`：庆祝、全屏 960×640 视频、跳过、ToolCard

现有 `*Probe` 先作为场景接线入口，逐步变成薄适配器；验证完成前不删除，避免破坏当前可玩闭环。

## 数据流

`m01-memory-gear.json` → 已迁移的 `M01GreyboxLayout/Session` → 渲染状态 DTO → 正式渲染器 → Unity Transform/SpriteRenderer/Light2D。

渲染器不重新推导谜题逻辑；Cocos 中属于状态机的决定继续由已迁移纯逻辑提供。Cocos 渲染函数中的视觉副作用按原顺序映射为 Unity 协程或显式时间线步骤。

## 验收

- 契约测试：关键常量、18 动作和 697 帧、资源路径、displaySize、anchor/pivot 全部有断言。
- 资源测试：Unity 资源数量、文件哈希和尺寸与冻结的 Cocos 快照一致。
- 几何测试：给定相同 token，断言 Unity 输出位置、尺寸、旋转、pivot offset、sorting order。
- Unity 编译：BatchMode 无 C# 编译错误。
- 场景验证：固定状态截图与 Cocos 基准图逐像素/感知差异比较；允许的差异仅为已声明的 URP 光效叠加。

## 非目标

- 不重写已经 231/231 通过的 M01 纯逻辑。
- 不迁移 M02-M33。
- 不借机调整 M01 美术、坐标或节奏；发现 Cocos 本身的问题先记录，不在 parity 阶段修正。
