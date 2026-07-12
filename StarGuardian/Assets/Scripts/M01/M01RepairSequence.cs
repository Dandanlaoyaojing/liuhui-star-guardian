// M01 修复动画的纯时序编排(spec §5.2: 齿轮转动 → 碎片以漩涡状【喷出】→ 化为持续星光;
// 镜头拉远无相机系统, 本轮省略)。无 cc/UnityEngine 依赖(xUnit 可测); cc 胶水(M01GreyboxBootstrap)
// 按 timeline 的绝对时间窗调 tween、按 spiralOutTargets 给每片确定性的喷出终点。
// 步骤数据全部来自 config `repair.steps`(数据驱动, 不硬编码)。
// 从 assets/scripts/cocos/M01RepairSequence.ts 迁移, 规则不变.
//
// TS→C# 语义映射:
//   Record<string, unknown> params → IReadOnlyDictionary<string, object?>(异构值袋, 原样带过供胶水消费);
//   duration?/delay? 可选 number → double?(null 表示 undefined; 用 ?? 兜 0, 保留 TS 防御性 `?? 0`);
//   step.params ?? {} 的防御 → Params 可空 + BuildRepairTimeline 里 `?? EmptyParams`;
//   origin { x, y } → 复用 StarGuardian.Interaction.Point2(已转写的不可变 2D 点, 不重复定义);
//   SpiralTarget(x,y,angleDeg,spinDeg)→ record 类(值相等, 对应 TS 测试 toEqual 的深比较)。

using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Interaction;

namespace StarGuardian.M01
{
    /// <summary>config repair.steps 里的单个步骤。</summary>
    public sealed record RepairStepConfig
    {
        /// <summary>步骤类型: entity_animate(齿轮转) / fragments_spiral_out(碎片漩涡喷出) / starlight(化星光)。</summary>
        public string Type { get; init; } = "";

        /// <summary>类型相关参数, 原样带进 timeline 供 cc 胶水消费。</summary>
        public IReadOnlyDictionary<string, object?>? Params { get; init; }

        /// <summary>持续秒数(缺省 0)。</summary>
        public double? Duration { get; init; }

        /// <summary>相对整段开始的延迟秒数(缺省 0)。</summary>
        public double? Delay { get; init; }
    }

    public sealed record RepairSegment
    {
        public string Type { get; init; } = "";
        public IReadOnlyDictionary<string, object?> Params { get; init; } = new Dictionary<string, object?>();

        /// <summary>绝对开始时间(秒, 相对修复动画 t=0)。</summary>
        public double Start { get; init; }

        /// <summary>绝对结束时间(秒, 相对修复动画 t=0)。</summary>
        public double End { get; init; }
    }

    public sealed record RepairTimeline
    {
        public IReadOnlyList<RepairSegment> Segments { get; init; } = Array.Empty<RepairSegment>();

        /// <summary>总时长 = 最晚结束的段。</summary>
        public double Total { get; init; }
    }

    public sealed record SpiralTarget
    {
        /// <summary>喷出终点 X(绝对坐标; 终点都落在 origin 为圆心、radius 为半径的圆上)。</summary>
        public double X { get; init; }

        /// <summary>喷出终点 Y(绝对坐标; 终点都落在 origin 为圆心、radius 为半径的圆上)。</summary>
        public double Y { get; init; }

        /// <summary>该片的喷出方位角(deg, 仅诊断/测试用)。</summary>
        public double AngleDeg { get; init; }

        /// <summary>途中自旋角(deg, = config turnsDeg; cc 胶水转 fragment 节点)。</summary>
        public double SpinDeg { get; init; }
    }

    /// <summary>spiralOutTargets 的参数袋(对应 TS `{ radius, turnsDeg }`)。</summary>
    public readonly struct SpiralParams
    {
        /// <summary>喷出终半径。</summary>
        public double Radius { get; init; }

        /// <summary>途中自旋角(deg)。</summary>
        public double TurnsDeg { get; init; }
    }

    public static class M01RepairSequence
    {
        private static readonly IReadOnlyDictionary<string, object?> EmptyParams =
            new Dictionary<string, object?>();

        /// <summary>固定起始偏角(确定性), 避开正上/正右的机械感。</summary>
        private const double BaseOffsetDeg = 17;

        /// <summary>
        /// config repair.steps → 绝对时间窗序列。顺序保留 config 原序(并行靠 delay 错峰)。
        /// </summary>
        public static RepairTimeline BuildRepairTimeline(IReadOnlyList<RepairStepConfig> steps)
        {
            var segments = steps.Select(step =>
            {
                var start = step.Delay ?? 0.0;
                return new RepairSegment
                {
                    Type = step.Type,
                    Params = step.Params ?? EmptyParams,
                    Start = start,
                    End = start + (step.Duration ?? 0.0)
                };
            }).ToList();

            var total = segments.Aggregate(0.0, (max, seg) => Math.Max(max, seg.End));
            return new RepairTimeline { Segments = segments, Total = total };
        }

        /// <summary>
        /// 每片碎片的漩涡喷出终点: 绕盘心均匀分布整圈(9 片=每 40°), 带固定起始偏角错开 0°/90° 的呆板感。
        /// 确定性(无 RNG): 同输入同输出 → 帧率/重放无关、可测。turnsDeg 是途中自旋角(漩涡感的主要来源,
        /// 由 cc 胶水在 tween 里同时转节点), 终点本身按直线方位角放射。
        /// </summary>
        public static IReadOnlyList<SpiralTarget> SpiralOutTargets(int count, Point2 origin, SpiralParams spiralParams)
        {
            var targets = new List<SpiralTarget>();
            for (var i = 0; i < count; i += 1)
            {
                var angleDeg = BaseOffsetDeg + (360.0 / count) * i;
                var rad = (angleDeg * Math.PI) / 180.0;
                targets.Add(new SpiralTarget
                {
                    X = origin.X + Math.Cos(rad) * spiralParams.Radius,
                    Y = origin.Y + Math.Sin(rad) * spiralParams.Radius,
                    AngleDeg = angleDeg,
                    SpinDeg = spiralParams.TurnsDeg
                });
            }
            return targets;
        }
    }
}
