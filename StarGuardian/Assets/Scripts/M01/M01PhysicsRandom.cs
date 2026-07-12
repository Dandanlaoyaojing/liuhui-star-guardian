// M01 物理翻滚拼片用的确定性伪随机数发生器 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性.
// 从 assets/scripts/cocos/M01PhysicsRandom.ts 迁移, 规则不变.
// TS 语义映射(mulberry32, 全程 32 位环绕算术, 逐比特复现):
//   函数返回闭包 () => number(值域 [0,1)) → 工厂返回 Func<double>;
//     捕获的 state 由 lambda 独占持有 → 每次 CreateRng 得到独立序列, 与 TS 闭包同构。
//   seed: number + `seed >>> 0`(ToUint32) → 参数用 long 承接任意整数种子(含 Date.now() 时间戳 > 2^32),
//     unchecked((uint)seed) 复现低 32 位截断语义。
//   `>>> 0` / `| 0` 的 32 位无符号语义 → 全程 uint 运算; JS `>>>`(无符号右移) → uint `>>`(逻辑右移)。
//   Math.imul(a, b)(32 位整乘取低 32 位) → uint 乘法(unchecked 下取低 32 位, 比特一致)。
//   `t + Math.imul(...)`: JS 中该加法在双精度内精确、随后 `^` 走 ToInt32 环绕 → 等价于 uint 加法(mod 2^32)。
//   `unchecked` 块: 防止工程若以 /checked 编译时 uint 加/乘溢出抛异常, 强制环绕语义。
//   `/ 4294967296`(= 2^32)得 [0,1) → (double)value / 4294967296.0(强制浮点除法, 避免整除陷阱)。

using System;

namespace StarGuardian.M01
{
    public static class M01PhysicsRandom
    {
        /// <summary>
        /// Mulberry32 PRNG. 确定性且快速.
        /// 生产用时间戳(Date.now 等)作种子获得每次会话的随机性, 测试用固定整数.
        /// 返回的委托每次调用推进内部状态并返回 [0,1) 的浮点数.
        /// </summary>
        public static Func<double> CreateRng(long seed)
        {
            uint state = unchecked((uint)seed);
            return () =>
            {
                unchecked
                {
                    state = state + 0x6d2b79f5u;
                    uint t = state;
                    t = (t ^ (t >> 15)) * (t | 1u);
                    t ^= t + (t ^ (t >> 7)) * (t | 61u);
                    return (double)(t ^ (t >> 14)) / 4294967296.0;
                }
            };
        }
    }
}
