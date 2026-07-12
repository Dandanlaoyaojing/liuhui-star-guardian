// M01 物理翻滚拼片的稳定落地旋转角挑选 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性.
// 从 assets/scripts/cocos/M01PhysicsRotation.ts 迁移, 规则不变.
// TS 语义映射:
//   字符串联合 "circle" | "triangle" | "hexagon" → enum M01PhysicsShape(Circle/Triangle/Hexagon,
//     其它 M01 叶子如 M01PhysicsCollider 会复用此枚举, 勿重定义);
//   rng: () => number(返回 [0,1)) → Func<double>;
//   Math.floor(rng()*n) → (int)Math.Floor(rng()*n);
//   choices[idx] 数组取角 → int[]。返回度数为整数(所有 choices 皆整数)→ int。

using System;

namespace StarGuardian.M01
{
    /// <summary>物理翻滚拼片的形状 —— TS 的字符串联合 "circle" | "triangle" | "hexagon"</summary>
    public enum M01PhysicsShape
    {
        Circle,
        Triangle,
        Hexagon
    }

    public static class M01PhysicsRotation
    {
        /// <summary>
        /// 为给定形状挑一个物理稳定的落地旋转角(度).
        /// - Circle: 任意角(旋转对称)
        /// - Triangle: 3 个稳定底边之一(每个都让一条平边朝下)
        /// - Hexagon: 6 个稳定底边之一(每个都让一条平边朝下)
        /// rng() 提供 [0,1) 的值.
        /// </summary>
        public static int PickStableRotation(M01PhysicsShape shape, Func<double> rng)
        {
            if (shape == M01PhysicsShape.Circle)
            {
                return (int)Math.Floor(rng() * 360);
            }
            if (shape == M01PhysicsShape.Triangle)
            {
                var triangleChoices = new[] { 0, 120, 240 };
                return triangleChoices[(int)Math.Floor(rng() * triangleChoices.Length)];
            }
            var hexChoices = new[] { 0, 60, 120, 180, 240, 300 };
            return hexChoices[(int)Math.Floor(rng() * hexChoices.Length)];
        }
    }
}
