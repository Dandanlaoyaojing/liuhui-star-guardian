// M01 两段式轻点路由(spec §5.2)—— 引擎无关的纯逻辑, 由 xUnit 钉死正确性.
// cc 胶水层做命中测试, 报出这次轻点命中了哪些对象(TapHit)与当前阶段(TapContext);
// 本模块只按"阶段感知优先级"决出唯一动作. 保持纯粹以便单测. 无 cc import.
// 从 assets/scripts/cocos/M01PuzzleInputRouter.ts 迁移, 规则不变.
// TS→C# 语义映射:
//   - 字符串字面量联合 TapAction → 常量字符串(逐字保留), RouteTap 返回 string;
//   - TapHit 的可选布尔 fragment? / heldFlashlight? / fallenFlashlight? → 可空 bool?
//     (用 null 对应 TS 的 undefined); TS 真值判断 if (hit.x) → x == true(null/false 皆为假);
//   - TapContext 的 flashlightAcquired / holdingPiece 为必填 → 非空 bool.

namespace StarGuardian.M01
{
    /// <summary>
    /// 一次轻点命中了哪些候选对象 —— TS interface TapHit.
    /// 空地是"未命中任何对象"的隐式兜底(三个字段都为 null/false)。
    /// </summary>
    public sealed record TapHit
    {
        /// <summary>轻点落在候选碎片上</summary>
        public bool? Fragment { get; init; }

        /// <summary>轻点落在莱米手持的手电上</summary>
        public bool? HeldFlashlight { get; init; }

        /// <summary>轻点落在地上尚未拾起的手电上</summary>
        public bool? FallenFlashlight { get; init; }
    }

    /// <summary>当前阶段上下文 —— TS interface TapContext</summary>
    public sealed record TapContext
    {
        /// <summary>莱米已拾起手电(现为手持)。</summary>
        public bool FlashlightAcquired { get; init; }

        /// <summary>玩家正用指针拖着一块候选碎片。</summary>
        public bool HoldingPiece { get; init; }
    }

    /// <summary>轻点可解出的动作 —— TS 字符串联合 TapAction(逐字保留)</summary>
    public static class TapAction
    {
        public const string DropPiece = "dropPiece";
        public const string PickupFlashlight = "pickupFlashlight";
        public const string CycleLight = "cycleLight";
        public const string WalkLemmy = "walkLemmy";
        public const string WalkLemmyWithBeam = "walkLemmyWithBeam";
        public const string PickupPiece = "pickupPiece";
        public const string PickupPieceAndLightOff = "pickupPieceAndLightOff";
    }

    public static class M01PuzzleInputRouter
    {
        /// <summary>
        /// 把一次轻点解出唯一动作。优先级随阶段变化:
        /// - 拿着碎片: 任意轻点都放下(最高 —— 覆盖一切)。
        /// - 拾起手电前: 落地手电 &gt; 碎片 &gt; 空地。碎片一旦洒出即可拾起
        ///   (整理用; 此阶段无光束, 故 pickupPiece 不灭灯) —— 轻点落地手电仍优先, 保证
        ///   即便碎片重叠玩家也总能拿到它。
        /// - 拾起手电后: 碎片 &gt; 手持手电 &gt; 空地。轻点碎片会拾起 AND 灭灯。
        /// </summary>
        public static string RouteTap(TapHit hit, TapContext ctx)
        {
            if (ctx.HoldingPiece)
            {
                return TapAction.DropPiece;
            }

            if (!ctx.FlashlightAcquired)
            {
                if (hit.FallenFlashlight == true) return TapAction.PickupFlashlight;
                if (hit.Fragment == true) return TapAction.PickupPiece; // 落地碎片可直接整理(无光束→不灭灯)
                return TapAction.WalkLemmy; // 空地 → 仅移动莱米
            }

            if (hit.Fragment == true) return TapAction.PickupPieceAndLightOff;
            if (hit.HeldFlashlight == true) return TapAction.CycleLight;
            return TapAction.WalkLemmyWithBeam;
        }
    }
}
