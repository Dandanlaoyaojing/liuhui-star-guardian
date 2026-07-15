// M02 序章「三颗余烬点棒」会话层 —— 纯逻辑(无 UnityEngine), 从 assets/scripts/cocos/M02PrologueSession.ts 逐字迁移, 规则不变.
// 规则与主谜题同律(复用 StarNetworkRules 的 lifeMax/freezeThreshold, 快照结算), 差异只有两点:
//   1) 实时制: Update(dt) 累积 beatSeconds 走拍(主谜题是每点一拍的回合制);
//   2) 动邻接: 余烬可拖动, 邻居 = 圆心距 <= adjacencyRadius 的亮余烬(主谜题是固定边表)。
// 熄灭的余烬隔 rekindleBeats 拍原地复燃满命 —— 序章无死锁, 随便试。
// 引擎胶水层只读 View、转发拖动/点击, 不自己算规则。
#nullable enable

using System;
using System.Collections.Generic;
using StarGuardian.Core;

namespace StarGuardian.M02
{
    // TS 行 13: `type EmberStatus = StarNodeStatus`(联合别名, 保证两边永远同一套状态语言)
    // —— C# 直接复用 StarNodeStatus 常量类, 不另立类型。

    /// <summary>星光棒: 插在地上 / 已拔在手(未亮) / 已点燃(序章完成) —— TS `type WandState` 字符串联合</summary>
    public static class WandState
    {
        public const string Planted = "planted";
        public const string Held = "held";
        public const string Lit = "lit";
    }

    /// <summary>DipResult.Reason 的取值 —— TS reason?: "wand_not_held" | "no_frozen_ember" | "done"</summary>
    public static class DipRejectReason
    {
        public const string WandNotHeld = "wand_not_held";
        public const string NoFrozenEmber = "no_frozen_ember";
        public const string Done = "done";
    }

    public sealed class EmberView
    {
        public string Id { get; init; } = "";
        public double X { get; init; }
        public double Y { get; init; }
        /// <summary>TS number; 恒为整数拍(源自 initialLife/lifeMax, 只做 ±1) → int</summary>
        public int Life { get; init; }
        public bool Lit { get; init; }
        public string Status { get; init; } = StarNodeStatus.Dark;
    }

    public sealed class PrologueViewState
    {
        public IReadOnlyList<EmberView> Embers { get; init; } = Array.Empty<EmberView>();
        /// <summary>TS 内联 { x: number; y: number } —— 复用 Core.StarWebWand 承载(同形状), 每次构造新实例(TS 行 136 同为逐次新建)</summary>
        public StarWebWand Wand { get; init; } = new();
        /// <summary>取值见 WandState 常量类(属性与类型同名, 默认值用字面量避开名字遮蔽)</summary>
        public string WandState { get; init; } = "planted";
        public bool Done { get; init; }
    }

    public sealed class DipResult
    {
        public bool Accepted { get; init; }
        /// <summary>TS reason?: 缺省(undefined)落成 null; 取值见 DipRejectReason</summary>
        public string? Reason { get; init; }
    }

    public sealed class M02PrologueSession
    {
        /// <summary>TS 模块私有 interface EmberState(行 38-44)</summary>
        private sealed class EmberState
        {
            public string Id = "";
            public double X;
            public double Y;
            public int Life;
            /// <summary>暗烬还差几拍复燃; 亮时无意义</summary>
            public int RekindleIn;
        }

        /// <summary>结算/邻居计数共用的轻量快照行 —— TS 模块私有 interface EmberSnapshot(行 47-51)</summary>
        private readonly struct EmberSnapshot
        {
            public readonly double X;
            public readonly double Y;
            public readonly bool Lit;

            public EmberSnapshot(double x, double y, bool lit)
            {
                X = x;
                Y = y;
                Lit = lit;
            }
        }

        private readonly StarWebPrologue prologue;
        private readonly StarNetworkRules rules;
        private readonly List<EmberState> embers;
        private string wandState = WandState.Planted;
        private double beatAccumulator = 0;
        /// <summary>每次可见状态变更 +1; 视图层据此跳过静止帧的重绘。TS number → int(每拍/交互 +1, 实际量级远小于 int 上限)</summary>
        private int revisionCount = 0;

        public M02PrologueSession(StarWebPrologue prologue, StarNetworkRules rules)
        {
            this.prologue = prologue;
            this.rules = rules;
            // TS 行 64-70: prologue.embers.map(...) → 拷贝进会话自有状态
            embers = new List<EmberState>();
            foreach (var e in prologue.Embers)
            {
                embers.Add(new EmberState { Id = e.Id, X = e.X, Y = e.Y, Life = e.InitialLife, RekindleIn = 0 });
            }
        }

        /// <summary>实时推进: 累积 dt, 每满 beatSeconds 结算一拍(欠账多拍则补齐)。序章完成后场景停摆。</summary>
        public void Update(double dtSeconds)
        {
            if (wandState == WandState.Lit) return;
            // TS 行 76: if (!(dtSeconds > 0)) return; —— NaN/0/负数一律拦(NaN 与任何数比较为 false, 两语言一致)
            if (!(dtSeconds > 0)) return;
            beatAccumulator += dtSeconds;
            // epsilon 兜浮点欠账: 累积 N 拍长度的 dt 必须恰好走 N 拍 (1.4*3 = 4.1999... 的经典坑)
            while (beatAccumulator >= prologue.BeatSeconds - 1e-9)
            {
                beatAccumulator = Math.Max(0, beatAccumulator - prologue.BeatSeconds);
                TickBeat();
            }
        }

        /// <summary>玩家拖动余烬(亮暗均可拖); 未知 id 返回 false</summary>
        public bool MoveEmber(string id, double x, double y)
        {
            var ember = embers.Find(e => e.Id == id); // TS 行 87: .find
            if (ember == null) return false; // TS 行 88: if (!ember) —— 对象 falsy 仅 undefined → null 判定
            ember.X = x;
            ember.Y = y;
            revisionCount += 1;
            return true;
        }

        /// <summary>点地上的棒 = 拔起(planted→held); 其余状态拒绝</summary>
        public bool PullWand()
        {
            if (wandState != WandState.Planted) return false;
            wandState = WandState.Held;
            revisionCount += 1;
            return true;
        }

        /// <summary>手持棒点向 (x,y): 半径内存在冻结余烬 → 棒亮、序章完成</summary>
        public DipResult DipWand(double x, double y)
        {
            if (wandState == WandState.Lit)
            {
                return new DipResult { Accepted = false, Reason = DipRejectReason.Done };
            }
            if (wandState != WandState.Held)
            {
                return new DipResult { Accepted = false, Reason = DipRejectReason.WandNotHeld };
            }
            var radius = prologue.WandDipRadius;
            var snapshot = SnapshotEmbers();
            // TS 行 109-111: this.embers.some((e, index) => ...)
            var hit = false;
            for (var index = 0; index < embers.Count; index += 1)
            {
                var e = embers[index];
                if (IsFrozen(snapshot, index) && Hypot(e.X - x, e.Y - y) <= radius)
                {
                    hit = true;
                    break;
                }
            }
            if (!hit)
            {
                return new DipResult { Accepted = false, Reason = DipRejectReason.NoFrozenEmber };
            }
            wandState = WandState.Lit;
            revisionCount += 1;
            return new DipResult { Accepted = true };
        }

        /// <summary>序章是否完成(廉价读, 不构造 View)</summary>
        public bool Done => wandState == WandState.Lit;

        /// <summary>可见状态版本号: 变了才需要重绘</summary>
        public int Revision => revisionCount;

        public PrologueViewState View
        {
            get
            {
                var snapshot = SnapshotEmbers();
                // TS 行 131-135: this.embers.map((e, index) => ...)
                var emberViews = new List<EmberView>();
                for (var index = 0; index < embers.Count; index += 1)
                {
                    var e = embers[index];
                    var lit = e.Life > 0;
                    var status = !lit ? StarNodeStatus.Dark : IsFrozen(snapshot, index) ? StarNodeStatus.Frozen : StarNodeStatus.Decaying;
                    emberViews.Add(new EmberView { Id = e.Id, X = e.X, Y = e.Y, Life = e.Life, Lit = lit, Status = status });
                }
                return new PrologueViewState
                {
                    Embers = emberViews,
                    Wand = new StarWebWand { X = prologue.Wand.X, Y = prologue.Wand.Y },
                    WandState = wandState,
                    Done = Done
                };
            }
        }

        /// <summary>一拍全体同时结算: 亮烬按结算前快照判冻结/衰减(同 StarNetworkModel.Tick), 暗烬倒数复燃</summary>
        private void TickBeat()
        {
            var snapshot = SnapshotEmbers();
            // TS 行 145-155: this.embers.forEach((ember, index) => ...)
            for (var index = 0; index < embers.Count; index += 1)
            {
                var ember = embers[index];
                if (snapshot[index].Lit)
                {
                    if (CountLitNeighbors(snapshot, index) < rules.FreezeThreshold)
                    {
                        ember.Life -= 1;
                        if (ember.Life <= 0) ember.RekindleIn = prologue.RekindleBeats;
                    }
                }
                else
                {
                    ember.RekindleIn -= 1;
                    if (ember.RekindleIn <= 0) ember.Life = rules.LifeMax;
                }
            }
            revisionCount += 1;
        }

        private List<EmberSnapshot> SnapshotEmbers()
        {
            // TS 行 160: this.embers.map(...)
            var snapshot = new List<EmberSnapshot>(embers.Count);
            foreach (var e in embers)
            {
                snapshot.Add(new EmberSnapshot(e.X, e.Y, e.Life > 0));
            }
            return snapshot;
        }

        /// <summary>冻结是派生态(实时按当前位置算, 不等拍): 亮 且 亮邻居 >= freezeThreshold</summary>
        private bool IsFrozen(List<EmberSnapshot> snapshot, int index)
        {
            if (!snapshot[index].Lit) return false;
            return CountLitNeighbors(snapshot, index) >= rules.FreezeThreshold;
        }

        private int CountLitNeighbors(List<EmberSnapshot> snapshot, int index)
        {
            var self = snapshot[index];
            var count = 0;
            for (var i = 0; i < snapshot.Count; i += 1)
            {
                if (i == index || !snapshot[i].Lit) continue;
                if (Hypot(snapshot[i].X - self.X, snapshot[i].Y - self.Y) <= prologue.AdjacencyRadius)
                {
                    count += 1;
                }
            }
            return count;
        }

        // TS Math.hypot(dx, dy)(行 110/174) —— Unity 的 .NET Standard 2.1 无 Math.Hypot, 用 sqrt(dx²+dy²) 等价;
        // 差异仅在极端幅值的中间溢出与末位舍入(游戏坐标幅值下无差, 且判定不依赖恰好压线的距离)。
        private static double Hypot(double dx, double dy) => Math.Sqrt(dx * dx + dy * dy);
    }
}
