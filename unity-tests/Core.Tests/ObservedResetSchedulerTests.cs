// 从 tests/cocos/ObservedResetScheduler.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
// vitest 的 vi.useFakeTimers()/advanceTimersByTime() 在 C# 无内建等价物:
//   - 用例 2/3 注入下面的 FakeTimers 手动计时器(播 vitest fake timers 的角色), 保持全程确定性;
//   - 用例 1 走"默认计时器包装"(System.Threading.Timer), 无法虚拟快进, 故用真实短延时 +
//     ManualResetEventSlim 等待信号(真正跑一次默认包装路径), 保留的断言 expired==1 不变。
using System;
using System.Collections.Generic;
using System.Threading;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class ObservedResetSchedulerTests
    {
        // 用例 1 的真实默认计时器延时(足够短以保持测试快, 远小于 2s 等待预算)。
        private const int DefaultTimerDelayMs = 20;

        [Fact(DisplayName = "uses safe default timer wrappers")]
        public void UsesSafeDefaultTimerWrappers()
        {
            var expired = 0;
            using var fired = new ManualResetEventSlim(false);
            var scheduler = new ObservedResetScheduler(() =>
            {
                Interlocked.Increment(ref expired); // 默认计时器在线程池线程回调
                fired.Set();
            });

            scheduler.Schedule("fragment_a", DefaultTimerDelayMs);
            Assert.True(fired.Wait(TimeSpan.FromSeconds(2)), "默认计时器未在预期时间内触发");

            Assert.Equal(1, Volatile.Read(ref expired));
        }

        [Fact(DisplayName = "expires overlapping fragment reveals independently")]
        public void ExpiresOverlappingFragmentRevealsIndependently()
        {
            var fake = new FakeTimers();
            var expired = new List<string>();
            var scheduler = new ObservedResetScheduler(
                () => expired.Add("tick"),
                fake.SetTimeout,
                fake.ClearTimeout);

            scheduler.Schedule("fragment_a", 2_000);
            fake.AdvanceTimersByTime(1_000);
            scheduler.Schedule("fragment_b", 2_000);

            fake.AdvanceTimersByTime(999);
            Assert.Equal(Array.Empty<string>(), expired);

            fake.AdvanceTimersByTime(1);
            Assert.Equal(new[] { "tick" }, expired);

            fake.AdvanceTimersByTime(999);
            Assert.Equal(new[] { "tick" }, expired);

            fake.AdvanceTimersByTime(1);
            Assert.Equal(new[] { "tick", "tick" }, expired);
        }

        [Fact(DisplayName = "replaces an existing timer only for the same fragment")]
        public void ReplacesAnExistingTimerOnlyForTheSameFragment()
        {
            var fake = new FakeTimers();
            var expired = new List<string>();
            var scheduler = new ObservedResetScheduler(
                () => expired.Add("tick"),
                fake.SetTimeout,
                fake.ClearTimeout);

            scheduler.Schedule("fragment_a", 2_000);
            scheduler.Schedule("fragment_a", 2_000);
            Assert.Equal(new[] { "fragment_a" }, scheduler.GetPendingKeys());

            fake.AdvanceTimersByTime(1_999);
            Assert.Equal(Array.Empty<string>(), expired);

            fake.AdvanceTimersByTime(1);
            Assert.Equal(new[] { "tick" }, expired);
        }

        /// <summary>
        /// 确定性手动计时器 —— 播 vitest fake timers 的角色: SetTimeout/ClearTimeout 供注入,
        /// AdvanceTimersByTime 推进虚拟时钟并按到点顺序触发。句柄为独立 object, 支持按引用比较。
        /// </summary>
        private sealed class FakeTimers
        {
            private sealed class Entry
            {
                public readonly object Handle = new();
                public Action Handler = () => { };
                public long DueTime;
                public long Order;
                public bool Cancelled;
            }

            private readonly List<Entry> entries = new();
            private long currentTime;
            private long sequence;

            public object SetTimeout(Action handler, int delayMs)
            {
                var entry = new Entry
                {
                    Handler = handler,
                    DueTime = currentTime + delayMs,
                    Order = sequence++,
                };
                entries.Add(entry);
                return entry.Handle;
            }

            public void ClearTimeout(object timeout)
            {
                foreach (var entry in entries)
                {
                    if (ReferenceEquals(entry.Handle, timeout))
                    {
                        entry.Cancelled = true;
                        return;
                    }
                }
            }

            public void AdvanceTimersByTime(int ms)
            {
                currentTime += ms;
                // 到点即触发(DueTime <= currentTime), 早到点者先触发, 同点按登记序;
                // 每次重扫以正确处理回调期间新登记的计时器。
                while (TryTakeDue(out var due))
                {
                    due.Handler();
                }
            }

            private bool TryTakeDue(out Entry due)
            {
                Entry? best = null;
                foreach (var entry in entries)
                {
                    if (entry.Cancelled || entry.DueTime > currentTime)
                    {
                        continue;
                    }

                    if (best == null ||
                        entry.DueTime < best.DueTime ||
                        (entry.DueTime == best.DueTime && entry.Order < best.Order))
                    {
                        best = entry;
                    }
                }

                if (best == null)
                {
                    due = null!;
                    return false;
                }

                entries.Remove(best);
                due = best;
                return true;
            }
        }
    }
}
