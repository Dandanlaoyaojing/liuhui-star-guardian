// M01 观察复位调度器 —— 引擎无关的纯逻辑, 由 xUnit 钉死正确性.
// 按 key 维护"防抖"计时器: 同一 key 再次 schedule 会取消上一个计时器、只保留最新的一个;
// 计时器到点时先做身份校验(仍是当前登记的计时器)再自删条目并回调 onExpire。
// cc 胶水层注入真实 setTimeout/clearTimeout(或引擎计时器); 缺省用 System.Threading.Timer。
// 从 assets/scripts/cocos/ObservedResetScheduler.ts 迁移, 规则不变。
// TS→C# 语义映射:
//   - TimeoutScheduler/TimeoutCanceller 保留为可注入委托(默认参数, 对应 TS 构造函数默认值);
//   - 计时器句柄 ReturnType<typeof setTimeout> → 不透明 object, 相等判定按引用(对应 JS 对象句柄的 !==);
//   - Map<string, handle> → Dictionary<string, object>; map.get(key) 缺省 → TryGetValue
//     (缺省即"已被取消/替换" → 不回调, 与 TS `get(key) !== timeout → return` 等价);
//   - 句柄相等 !== → !ReferenceEquals;
//   - delayMs: TS number → int(所有调用点均为整数毫秒);
//   - getPendingKeys 返回一份快照副本(TS 展开 [...keys()]); C# Dictionary 不保证键序
//     (TS Map 保插入序), 但对外语义只关心"待触发键的集合成员"。

using System;
using System.Collections.Generic;
using System.Threading;

namespace StarGuardian.M01
{
    /// <summary>登记一个到点回调, 返回不透明句柄 —— TS TimeoutScheduler(默认 setTimeout)</summary>
    public delegate object TimeoutScheduler(Action handler, int delayMs);

    /// <summary>按句柄取消一个已登记的回调 —— TS TimeoutCanceller(默认 clearTimeout)</summary>
    public delegate void TimeoutCanceller(object timeout);

    /// <summary>
    /// 按 key 防抖的一次性计时器集合: 每个 key 至多有一个在途计时器,
    /// 到点触发共享的 onExpire。重复 schedule 同一 key 会替换旧计时器。
    /// </summary>
    public sealed class ObservedResetScheduler
    {
        private readonly Dictionary<string, object> timeouts = new();
        private readonly Action onExpire;
        private readonly TimeoutScheduler scheduleTimeout;
        private readonly TimeoutCanceller cancelTimeout;

        public ObservedResetScheduler(
            Action onExpire,
            TimeoutScheduler? scheduleTimeout = null,
            TimeoutCanceller? cancelTimeout = null)
        {
            this.onExpire = onExpire;
            this.scheduleTimeout = scheduleTimeout ?? DefaultSchedule;
            this.cancelTimeout = cancelTimeout ?? DefaultCancel;
        }

        /// <summary>为 key 登记 delayMs 后的一次触发; 同 key 已有计时器则先取消(防抖)。</summary>
        public void Schedule(string key, int delayMs)
        {
            if (timeouts.TryGetValue(key, out var existing))
            {
                cancelTimeout(existing);
            }

            // 闭包捕获 timeout 变量(而非其当前值): scheduleTimeout 不会同步触发,
            // 故回调真正运行时 timeout 已被赋为本次句柄, 与 TS `const timeout = ...` 一致。
            object timeout = null!;
            timeout = scheduleTimeout(
                () =>
                {
                    if (!timeouts.TryGetValue(key, out var current) || !ReferenceEquals(current, timeout))
                    {
                        return;
                    }

                    timeouts.Remove(key);
                    onExpire();
                },
                delayMs);

            timeouts[key] = timeout;
        }

        /// <summary>取消并清空所有在途计时器。</summary>
        public void ClearAll()
        {
            foreach (var timeout in timeouts.Values)
            {
                cancelTimeout(timeout);
            }

            timeouts.Clear();
        }

        /// <summary>当前仍有在途计时器的 key 快照(副本, 改动它不影响内部状态)。</summary>
        public IReadOnlyList<string> GetPendingKeys()
        {
            return new List<string>(timeouts.Keys);
        }

        // 注意: 默认 System.Threading.Timer 在线程池线程回调; 内部 Dictionary 无锁, 假设胶水层在 Unity
        // 注入【主线程引擎计时器】(与 TS 单线程 setTimeout 一致)。游戏不走这条多线程默认路径。
        private static object DefaultSchedule(Action handler, int delayMs)
        {
            // JS setTimeout 把负延时钳为 0(立即触发); 复刻之(避免 -1 恰=Timeout.Infinite 静默永不触发、其他负值抛异常)。
            var due = Math.Max(0, delayMs);
            // 先建【不启动】的 Timer、赋值后再 Change 启动: 否则回调可能在 timer 字段赋值完成前于线程池派发 → timer.Dispose() 抛 NRE(.NET 明载竞态)。
            Timer timer = null!;
            timer = new Timer(
                _ =>
                {
                    timer.Dispose();
                    handler();
                },
                null,
                Timeout.Infinite,
                Timeout.Infinite);
            timer.Change(due, Timeout.Infinite);
            return timer;
        }

        private static void DefaultCancel(object timeout)
        {
            (timeout as Timer)?.Dispose();
        }
    }
}
