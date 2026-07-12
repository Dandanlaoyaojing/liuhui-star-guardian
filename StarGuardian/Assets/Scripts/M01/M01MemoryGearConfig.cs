// M01「记忆齿轮」谜题配置的数据类型集 —— 引擎无关纯数据 DTO(fragments/evidence/flashlights/
// targets/goal/completionVideo 等), 供后续 M01 逻辑与引擎层反序列化消费。
// 从 assets/scripts/levels/stage1/M01MemoryGearController.ts 的 config 相关 interface 迁移
// (该文件的行为逻辑 —— M01MemoryGearController 状态机 —— 属有状态游戏逻辑, 留待引擎层/后续波次)。
// 对齐真实配置 assets/resources/configs/stage1/m01-memory-gear.json 的字段/形状。
//
// Newtonsoft 反序列化约定(同 Core/PuzzleConfig.cs): init 属性 + camelCase 大小写不敏感匹配
// (JSON "hiddenColor" ↔ C# HiddenColor, JSON.NET 默认对属性名先精确再不区分大小写匹配), 无需 [JsonProperty];
// 未映射的 JSON 键默认被忽略。
//
// TS→C# 语义映射:
//   - M01MemoryGearConfig extends PuzzleConfig → 继承 StarGuardian.Core.PuzzleConfig(为此已解封该基类);
//     基字段(id/name/stage/cognitiveSkill/wisdomCrystal/scene/interactions/goals/hints/repair)由基类承接。
//     注意基类的 goals(复数, GoalDef[]) 与本类 goal(单数, M01GoalDef) 两者并存(真实 JSON 两个键都在)。
//   - number → double(几何坐标/尺寸/秒数)/int(计数/层序索引); 可选 ?: → 可空(引用类型 ?, 值类型 double?/int?)。
//   - 内联 {x,y}(position/offset/pivot/outline 元素) → 复用 Core.Vec2Def(勿重定义); {width,height} → M01SizeDef。
//   - 字符串字面量联合(color/shape/targetShape/source/coordinateSpace/goal.type/M01BaseColor/M01BlendColor)
//     → string 逐字保留(M01Color / M01Shape 在 TS 本就是 string 别名)。合法取值常量见 M01MemoryGearController.cs。
//   - 元组 [string,string](solution.fragmentIds) / [number,number](goal 范围) → List<T>(元数由数据保证)。
//   - unknown / unknown[](entities / repairSequence, 真实 JSON 中缺省) → object? / List<object?>?(未定型, 保留占位)。
#nullable enable

using System.Collections.Generic;
using StarGuardian.Core;

namespace StarGuardian.M01
{
    /// <summary>轴对齐尺寸 {width,height} —— TS 的 size: { width: number; height: number }(反序列化用 sealed class + init)。</summary>
    public sealed class M01SizeDef
    {
        public double Width { get; init; }
        public double Height { get; init; }
    }

    /// <summary>手电定义 —— TS interface M01FlashlightDef。color 取 M01BaseColor 之一。</summary>
    public sealed class M01FlashlightDef
    {
        public string Id { get; init; } = "";
        public string Color { get; init; } = "";
        public string? Label { get; init; }
        public Vec2Def? Position { get; init; }
    }

    /// <summary>手持手电覆盖面(v4)配置 —— TS interface M01FlashlightCoverageDef(值来自 config 的 flashlightCoverage)。</summary>
    public sealed class M01FlashlightCoverageDef
    {
        /// <summary>px —— 覆盖半径; 圆心半径内且不在拼接盘上的候选碎片按当前灯色显色。</summary>
        public double Radius { get; init; }

        /// <summary>px —— 光池圆心相对莱米节点的水平偏置。</summary>
        public double CenterOffsetX { get; init; }

        /// <summary>px —— 光池圆心相对莱米节点的竖直偏置(下移到碎片落地高度)。</summary>
        public double CenterOffsetY { get; init; }
    }

    /// <summary>候选碎片定义(config 的 fragments 元素) —— TS interface M01CandidateFragmentDef。hiddenColor 取 M01BaseColor 之一。</summary>
    public sealed class M01CandidateFragmentDef
    {
        public string Id { get; init; } = "";
        public string HiddenColor { get; init; } = "";
        public string EdgeShape { get; init; } = "";
        public List<string>? Tags { get; init; }
        public Vec2Def? Position { get; init; }

        /// <summary>可选表层色(M01Color=string); 与 hiddenColor 区分。</summary>
        public string? Color { get; init; }

        /// <summary>可选形状(M01Shape=string)。</summary>
        public string? Shape { get; init; }

        public string? Sprite { get; init; }
    }

    /// <summary>交叠证据的生成重叠几何 —— TS M01OverlapEvidenceDef.generatedOverlap。</summary>
    public sealed class M01OverlapEvidenceGeneratedOverlapDef
    {
        public double AreaRatio { get; init; }
        public Vec2Def Offset { get; init; } = new();
        public double? Rotation { get; init; }

        /// <summary>TS M01Shape[](两源形状标识); 反序列化用 List&lt;string&gt;。</summary>
        public List<string>? SourceShapes { get; init; }

        /// <summary>重叠轮廓多边形(局部坐标)—— TS Array&lt;{x,y}&gt;。</summary>
        public List<Vec2Def>? Outline { get; init; }
    }

    /// <summary>证据解答对 —— TS solution: { fragmentIds: [string, string] }(恰好两 id, 元数由数据保证)。</summary>
    public sealed class M01OverlapEvidenceSolutionDef
    {
        public List<string> FragmentIds { get; init; } = new();
    }

    /// <summary>局部交叠证据定义(config 的 evidence 元素) —— TS interface M01OverlapEvidenceDef。
    /// targetBlendColor 取 Exclude&lt;M01BlendColor, M01BaseColor&gt;(即 orange|green|purple)之一。</summary>
    public sealed class M01OverlapEvidenceDef
    {
        public string Id { get; init; } = "";
        public string TargetShape { get; init; } = "";
        public string TargetBlendColor { get; init; } = "";
        public Vec2Def Position { get; init; } = new();
        public double Tolerance { get; init; }
        public List<string> ShapeTags { get; init; } = new();
        public M01OverlapEvidenceGeneratedOverlapDef? GeneratedOverlap { get; init; }
        public M01OverlapEvidenceSolutionDef Solution { get; init; } = new();
    }

    /// <summary>标准拼片定义(config 的 standardPieces 元素) —— TS interface M01StandardPieceDef。</summary>
    public sealed class M01StandardPieceDef
    {
        public string Id { get; init; } = "";
        public string Shape { get; init; } = "";
        public M01SizeDef Size { get; init; } = new();
        public string? Source { get; init; }
        public Vec2Def? Pivot { get; init; }
    }

    /// <summary>目标图案中的一片实例 —— TS interface M01TargetPieceInstanceDef。</summary>
    public sealed class M01TargetPieceInstanceDef
    {
        public string Id { get; init; } = "";
        public string? FragmentId { get; init; }
        public string StandardPieceId { get; init; } = "";
        public Vec2Def Position { get; init; } = new();
        public double? Rotation { get; init; }

        /// <summary>层序索引(计数, TS number → int?)。</summary>
        public int? Layer { get; init; }
    }

    /// <summary>目标图案定义(config 的 targetPattern) —— TS interface M01TargetPatternDef。
    /// source 取 "manual_standard_piece_manifest"; coordinateSpace 取 "m01_board_local"。</summary>
    public sealed class M01TargetPatternDef
    {
        public string Source { get; init; } = "";
        public string CoordinateSpace { get; init; } = "";
        public List<M01TargetPieceInstanceDef> Pieces { get; init; } = new();
        public bool? Locked { get; init; }
        public string? Note { get; init; }
    }

    /// <summary>滤色片定义(config 的 filters 元素) —— TS interface M01FilterDef。color 为 M01Color=string。</summary>
    public sealed class M01FilterDef
    {
        public string Id { get; init; } = "";
        public string Color { get; init; } = "";
        public string? Label { get; init; }
        public string? EntityId { get; init; }
    }

    /// <summary>槽位接受条件 —— TS M01SlotDef.accepts: { color; shape }。</summary>
    public sealed class M01SlotAcceptsDef
    {
        public string Color { get; init; } = "";
        public string Shape { get; init; } = "";
    }

    /// <summary>归类槽位定义(config 的 slots 元素) —— TS interface M01SlotDef。</summary>
    public sealed class M01SlotDef
    {
        public string Id { get; init; } = "";
        public M01SlotAcceptsDef Accepts { get; init; } = new();

        /// <summary>容量(计数, TS number → int?; 缺省=无上限)。</summary>
        public int? Capacity { get; init; }

        public List<string>? Tags { get; init; }
        public Vec2Def? Position { get; init; }
    }

    /// <summary>调参块 —— TS M01MemoryGearConfig.tuning。计数字段用 int。</summary>
    public sealed class M01TuningDef
    {
        public int GreyboxFragmentCount { get; init; }
        public int TargetFragmentCount { get; init; }
        public string? Note { get; init; }
    }

    /// <summary>M01 目标参数 —— TS M01MemoryGearConfig.goal.params。
    /// candidateFragments 恒 "config_defined"; requiredFragments 恒 "solution_defined"。
    /// 逻辑侧目前仅消费 validationLightSeconds(其余为设计范围数据)。</summary>
    public sealed class M01GoalParamsDef
    {
        public string CandidateFragments { get; init; } = "";

        /// <summary>推荐候选片数区间 [min,max](计数元组, TS [12,16])。</summary>
        public List<int> RecommendedCandidateRange { get; init; } = new();

        public string RequiredFragments { get; init; } = "";

        /// <summary>证据数区间 [min,max](计数元组, TS [4,6])。</summary>
        public List<int> EvidenceCount { get; init; } = new();

        /// <summary>每处证据最大层数(计数, TS 2)。</summary>
        public int MaxLayersPerEvidence { get; init; }

        /// <summary>失败验证底光闪烁秒数(逻辑侧消费, TS number → double)。</summary>
        public double ValidationLightSeconds { get; init; }

        public List<string> BaseColors { get; init; } = new();
        public List<string> BlendColors { get; init; } = new();
    }

    /// <summary>M01 目标定义(单数 goal) —— TS M01MemoryGearConfig.goal。type 恒 "overlap_evidence_reconstructed"。</summary>
    public sealed class M01GoalDef
    {
        public string Type { get; init; } = "";
        public M01GoalParamsDef Params { get; init; } = new();
    }

    /// <summary>通关成品过场动画配置 —— TS interface M01CompletionVideoDef。除 resourcesPath 外全部可选。
    /// 数值字段皆映射 TS number → double?(px 尺寸/帧率/秒数/音量; 缺省语义见各字段注释, 由消费端补默认)。</summary>
    public sealed class M01CompletionVideoDef
    {
        /// <summary>iOS/Android/Web: resources.load VideoClip 的 mp4 路径(不含扩展名, 含内嵌音轨)。省略→退回帧序列。</summary>
        public string? VideoClipPath { get; init; }

        /// <summary>Steam 桌面: resources.loadDir 逐帧 SpriteFrame 目录(必填)。</summary>
        public string ResourcesPath { get; init; } = "";

        /// <summary>帧序列路径的独立音轨 AudioClip 路径(不含扩展名); 省略=无声。</summary>
        public string? AudioPath { get; init; }

        /// <summary>音轨音量 0..1; 缺省 1。</summary>
        public double? AudioVolume { get; init; }

        /// <summary>帧序列播放帧率; 缺省 24。</summary>
        public double? Fps { get; init; }

        /// <summary>true(默认)=通关播成品动画替代 greybox 修复 tween。</summary>
        public bool? ReplacesRepairAnimation { get; init; }

        /// <summary>true(默认)=点击画面/背板跳过整段动画。</summary>
        public bool? Skippable { get; init; }

        /// <summary>叠层/黑底背板宽(px); 缺省 960。</summary>
        public double? OverlayWidth { get; init; }

        /// <summary>叠层/黑底背板高(px); 缺省 640。</summary>
        public double? OverlayHeight { get; init; }

        /// <summary>画面显示框宽(px); 缺省 640。</summary>
        public double? VideoWidth { get; init; }

        /// <summary>画面显示框高(px); 缺省 640。</summary>
        public double? VideoHeight { get; init; }

        /// <summary>加载阶段看门狗超时秒数; 缺省 20。</summary>
        public double? MaxSeconds { get; init; }

        /// <summary>VideoPlayer 路径的视频时长秒数; 缺省回退 maxSeconds。</summary>
        public double? VideoDurationSeconds { get; init; }

        /// <summary>播放开始后看门狗余量秒数; 缺省 5。</summary>
        public double? WatchdogMarginSeconds { get; init; }
    }

    /// <summary>M01「记忆齿轮」谜题配置 —— TS interface M01MemoryGearConfig extends PuzzleConfig。
    /// 继承基字段(id/name/stage/scene/goals/hints/repair 等); 下列为 M01 专属扩展字段。</summary>
    public sealed class M01MemoryGearConfig : PuzzleConfig
    {
        public string? Description { get; init; }

        /// <summary>三原色白名单 —— TS M01BaseColor[]。</summary>
        public List<string> Colors { get; init; } = new();

        /// <summary>混色白名单(orange/green/purple)—— TS Exclude&lt;M01BlendColor, M01BaseColor&gt;[]。</summary>
        public List<string> BlendColors { get; init; } = new();

        public List<M01FlashlightDef> Flashlights { get; init; } = new();

        /// <summary>可选: 缺省时运行时不绘制覆盖光池(测试夹具可省)。</summary>
        public M01FlashlightCoverageDef? FlashlightCoverage { get; init; }

        public List<M01CandidateFragmentDef> Fragments { get; init; } = new();
        public List<M01OverlapEvidenceDef> Evidence { get; init; } = new();
        public List<M01StandardPieceDef>? StandardPieces { get; init; }
        public M01TargetPatternDef? TargetPattern { get; init; }
        public List<string>? Dimensions { get; init; }

        /// <summary>形状白名单 —— TS M01Shape[]。</summary>
        public List<string>? Shapes { get; init; }

        public M01TuningDef? Tuning { get; init; }
        public List<M01FilterDef>? Filters { get; init; }
        public List<M01SlotDef>? Slots { get; init; }

        /// <summary>M01 专属单数目标(与基类 Goals 复数并存)。</summary>
        public M01GoalDef Goal { get; init; } = new();

        public ToolCardDraft ToolCard { get; init; } = new();

        /// <summary>TS unknown[](未定型, 真实 config 中缺省)。</summary>
        public List<object?>? Entities { get; init; }

        /// <summary>TS unknown(未定型, 真实 config 中缺省)。</summary>
        public object? RepairSequence { get; init; }

        /// <summary>通关成品动画; 存在则运行时以帧序列/视频叠层替代 greybox 修复 tween。</summary>
        public M01CompletionVideoDef? CompletionVideo { get; init; }
    }
}
