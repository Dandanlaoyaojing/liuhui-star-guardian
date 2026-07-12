// M01 手持手电的纯观察逻辑(spec §5.2)—— 引擎无关, 由 xUnit 钉死正确性。
// 手电由莱米持握: 点它循环光态; 光束有一片以莱米为中心的覆盖"面", 面内每个候选碎片在当前光下显色。
// 本模块只拥两个纯决策 —— 下一光态是什么, 光束覆盖哪些碎片 —— cc 胶水(M01GreyboxBootstrap)只当薄渲染层。
// 从 assets/scripts/cocos/M01FlashlightObservation.ts 迁移, 规则不变。
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里。
// TS→C# 语义映射:
//   LightState = "off"|"red"|"yellow"|"blue" 字符串联合 → 常量字符串(逐字保留, 测试断言依赖),
//     沿用本仓 DragHandler/SnapZone 对字符串联合的处理惯例(不建 enum);
//   NEXT_LIGHT_STATE: Record<LightState,LightState> → Dictionary<string,string>(对合法态是全函数, 直接
//     索引复刻 TS 的 bracket 访问 —— 契约保证 current 恒为四态之一);
//   center / pos: { x, y } 都是纯 2D 点 → 复用 StarGuardian.Interaction.Point2(勿重定义, double);
//   board: { x, y, width, height } 是以 (x,y) 为中心的 AABB → 复用 StarGuardian.Interaction.SnapBounds(同语义);
//   onTray?: boolean → bool?(null = TS 的 undefined; JS 真值判断 if(onTray) → == true, null/false 均不跳过);
//   CoverageFragment[] 数组返回 → List<string>(按输入顺序)。

using System;
using System.Collections.Generic;
using StarGuardian.Interaction;

namespace StarGuardian.M01
{
    /// <summary>手持手电的光态 —— TS `type LightState`(字符串联合), 逐字保留</summary>
    public static class LightState
    {
        public const string Off = "off";
        public const string Red = "red";
        public const string Yellow = "yellow";
        public const string Blue = "blue";
    }

    /// <summary>光束覆盖区内的候选碎片 —— TS interface CoverageFragment</summary>
    public sealed record CoverageFragment
    {
        public string Id { get; init; } = "";

        /// <summary>碎片位置(与光束中心同坐标系)</summary>
        public Point2 Pos { get; init; }

        /// <summary>true = 碎片已在拼接盘上(光束从不照拼接盘); null/false = 不在(对应 TS 的 undefined / false)</summary>
        public bool? OnTray { get; init; }
    }

    /// <summary>覆盖光池竖向裁剪入参 —— TS interface CoveragePoolClampOptions</summary>
    public sealed record CoveragePoolClampOptions
    {
        /// <summary>光池(画出的光斑)中心, 与 board 同坐标系</summary>
        public Point2 Center { get; init; }

        /// <summary>光池水平半宽(即覆盖半径)</summary>
        public double RadiusX { get; init; }

        /// <summary>未裁剪的光池半高("光铺地"的压扁观感)</summary>
        public double NaturalHalfHeight { get; init; }

        /// <summary>拼接盘边界(中心 + 尺寸); 这里只用底边与 x 跨度</summary>
        public SnapBounds Board { get; init; } = new();

        /// <summary>光池顶与盘底边之间保留的额外间隙</summary>
        public double Clearance { get; init; }
    }

    /// <summary>M01 手持手电的两个纯决策 —— TS 同名模块</summary>
    public static class M01FlashlightObservation
    {
        // 点手持手电走这个循环。"off" 也是循环里的一态(共 4 态), 对应 spec §5.2 "红 → 黄 → 蓝 → 灭"。
        private static readonly Dictionary<string, string> NextLightState = new()
        {
            [LightState.Off] = LightState.Red,
            [LightState.Red] = LightState.Yellow,
            [LightState.Yellow] = LightState.Blue,
            [LightState.Blue] = LightState.Off
        };

        public static string CycleLight(string current) => NextLightState[current];

        /// <summary>
        /// 被光束照亮的候选碎片: 距光束中心(莱米位置)`radius` 内 且 不在拼接盘上。按输入顺序返回 id。
        /// 因为中心是莱米实时位置, 每次调用随莱米移动会照亮不同的一组。
        /// </summary>
        public static List<string> FragmentsInCoverage(
            Point2 center,
            double radius,
            IReadOnlyList<CoverageFragment> fragments)
        {
            var radiusSquared = radius * radius;
            var lit = new List<string>();
            foreach (var fragment in fragments)
            {
                if (fragment.OnTray == true) continue;
                var dx = fragment.Pos.X - center.X;
                var dy = fragment.Pos.Y - center.Y;
                if (dx * dx + dy * dy <= radiusSquared)
                {
                    lit.Add(fragment.Id);
                }
            }
            return lit;
        }

        /// <summary>
        /// 画出的覆盖光池的竖向半高, 使光永不漫过拼接盘(spec §5.2: 光束只照候选区, 不照拼接盘)。
        /// 当光池 x 跨度与盘 x 跨度重叠时, 光池顶被裁到盘底边(减去 clearance)之下; 非正结果表示"根本不画"。
        /// 纯函数 → 规格规则可单测; cc 胶水只喂进实时几何。
        /// </summary>
        public static double CoveragePoolHalfHeight(CoveragePoolClampOptions options)
        {
            var center = options.Center;
            var radiusX = options.RadiusX;
            var naturalHalfHeight = options.NaturalHalfHeight;
            var board = options.Board;
            var clearance = options.Clearance;

            var boardLeft = board.X - board.Width / 2;
            var boardRight = board.X + board.Width / 2;
            var overlapsBoardSpan = center.X + radiusX > boardLeft && center.X - radiusX < boardRight;
            if (!overlapsBoardSpan)
            {
                return naturalHalfHeight;
            }

            var boardBottom = board.Y - board.Height / 2;
            var available = boardBottom - clearance - center.Y;
            return Math.Max(0.0, Math.Min(naturalHalfHeight, available));
        }
    }
}
