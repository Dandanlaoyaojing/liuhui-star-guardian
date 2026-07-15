// 从 tests/cocos/M02PrologueSession.test.ts 逐条迁移 —— 断言一一对应, 字面值逐字保留.
// 钉死: 与主谜题同律的衰减/冻结(快照结算) + 序章特有的 实时拍推进/距离邻接/复燃无死锁/拔棒点棒.
// 夹具与 TS 相同为内联 PROLOGUE/RULES 字面量(TS 测试不读真实 config, 忠实保持).
using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.M02.Tests
{
    public class M02PrologueSessionTests
    {
        private static readonly StarNetworkRules Rules = new() { LifeMax = 3, FreezeThreshold = 2 };

        private static readonly StarWebPrologue Prologue = new()
        {
            BeatSeconds = 1.4,
            AdjacencyRadius = 90,
            RekindleBeats = 2,
            Wand = new StarWebWand { X = 320, Y = -180 },
            WandDipRadius = 120,
            Embers = new List<PrologueEmber>
            {
                new() { Id = "e1", X = -300, Y = -80, InitialLife = 3 },
                new() { Id = "e2", X = -60, Y = -170, InitialLife = 2 },
                new() { Id = "e3", X = 150, Y = -60, InitialLife = 1 }
            }
        };

        private static M02PrologueSession MakeSession() => new(Prologue, Rules);

        private static void Beat(M02PrologueSession session, int count = 1)
        {
            for (var i = 0; i < count; i += 1) session.Update(Prologue.BeatSeconds);
        }

        private static EmberView Ember(M02PrologueSession session, string id)
        {
            var found = session.View.Embers.FirstOrDefault(e => e.Id == id);
            if (found == null) throw new InvalidOperationException($"ember {id} missing from view");
            return found;
        }

        /// <summary>把三颗余烬摆成两两都在 adjacencyRadius 内的紧簇</summary>
        private static void Cluster(M02PrologueSession session)
        {
            session.MoveEmber("e1", 0, 0);
            session.MoveEmber("e2", 50, 0);
            session.MoveEmber("e3", 25, 40);
        }

        // ---- 开局与衰减 ----

        [Fact(DisplayName = "开局: 按 initialLife 亮着、各自孤立(decaying)、棒 planted、未完成")]
        public void InitialStateLitIsolatedPlanted()
        {
            var view = MakeSession().View;
            Assert.Equal(
                new[] { ("e1", 3, "decaying"), ("e2", 2, "decaying"), ("e3", 1, "decaying") },
                view.Embers.Select(e => (e.Id, e.Life, e.Status)).ToArray());
            Assert.Equal("planted", view.WandState);
            Assert.Equal(320.0, view.Wand.X);
            Assert.Equal(-180.0, view.Wand.Y);
            Assert.False(view.Done);
        }

        [Fact(DisplayName = "孤烬逐拍衰减, 命数错开先后熄灭")]
        public void IsolatedEmbersDecayPerBeat()
        {
            var session = MakeSession();
            Beat(session);
            Assert.Equal(2, Ember(session, "e1").Life);
            Assert.Equal(1, Ember(session, "e2").Life);
            Assert.Equal("dark", Ember(session, "e3").Status);
        }

        [Fact(DisplayName = "熄灭后隔 rekindleBeats 拍原地复燃至满命")]
        public void RekindlesAfterConfiguredBeats()
        {
            var session = MakeSession();
            Beat(session); // e3 熄灭
            Beat(session); // 暗第 1 拍
            Assert.Equal("dark", Ember(session, "e3").Status);
            Beat(session); // 暗第 2 拍 → 复燃
            Assert.Equal(Rules.LifeMax, Ember(session, "e3").Life);
            Assert.Equal("decaying", Ember(session, "e3").Status);
        }

        [Fact(DisplayName = "无死锁: 无任何交互跑 20 拍, 每颗余烬都反复复燃过")]
        public void NoDeadlockAcrossTwentyBeats()
        {
            var session = MakeSession();
            var seenLit = new HashSet<string>();
            for (var i = 0; i < 20; i += 1)
            {
                Beat(session);
                foreach (var e in session.View.Embers)
                {
                    if (e.Lit) seenLit.Add(e.Id);
                }
            }
            // TS: [...seenLit].sort() —— JS 默认字典序, 用 Ordinal 对齐
            Assert.Equal(new[] { "e1", "e2", "e3" }, seenLit.OrderBy(x => x, StringComparer.Ordinal).ToArray());
        }

        // ---- 邻接与冻结(与主谜题同律) ----

        [Fact(DisplayName = "两颗互在半径内仍衰减(1 个亮邻居 < freezeThreshold)")]
        public void PairWithinRadiusStillDecays()
        {
            var session = MakeSession();
            session.MoveEmber("e1", 0, 0);
            session.MoveEmber("e2", 60, 0);
            Beat(session);
            Assert.Equal(2, Ember(session, "e1").Life);
            Assert.Equal(1, Ember(session, "e2").Life);
        }

        [Fact(DisplayName = "三颗成簇: 冻结状态即时可见(不等拍), 多拍不掉命")]
        public void ClusterFreezesImmediatelyAndHoldsLife()
        {
            var session = MakeSession();
            Cluster(session);
            // 冻结是派生态: 摆成簇的那一刻 view 立即显示 frozen
            Assert.True(session.View.Embers.All(e => e.Status == "frozen"));
            Beat(session, 5);
            Assert.Equal(3, Ember(session, "e1").Life);
            Assert.Equal(2, Ember(session, "e2").Life);
            Assert.Equal(1, Ember(session, "e3").Life);
        }

        [Fact(DisplayName = "拖走一颗, 剩下两颗恢复衰减")]
        public void DraggingOneAwayResumesDecay()
        {
            var session = MakeSession();
            Cluster(session);
            session.MoveEmber("e1", -300, -80);
            Beat(session);
            Assert.Equal(1, Ember(session, "e2").Life);
            Assert.Equal("dark", Ember(session, "e3").Status);
        }

        [Fact(DisplayName = "暗烬不算邻居: 两亮一暗的簇不冻结")]
        public void DarkEmberDoesNotCountAsNeighbor()
        {
            var session = MakeSession();
            Beat(session); // e3 熄灭
            Cluster(session);
            Assert.Equal("decaying", Ember(session, "e1").Status);
            Assert.Equal("decaying", Ember(session, "e2").Status);
            Beat(session);
            Assert.Equal(1, Ember(session, "e1").Life);
        }

        [Fact(DisplayName = "自愈: 三颗保持成簇, 熄的复燃后终态全冻结")]
        public void ClusterSelfHealsToAllFrozen()
        {
            var session = MakeSession();
            Cluster(session);
            session.MoveEmber("e1", -300, -80); // 先破坏一次让它们乱掉
            Beat(session, 3);
            Cluster(session);
            Beat(session, 10);
            Assert.True(session.View.Embers.All(e => e.Status == "frozen"));
        }

        [Fact(DisplayName = "moveEmber: 未知 id 返回 false, 合法移动更新坐标")]
        public void MoveEmberUnknownIdRejectedValidMoveApplies()
        {
            var session = MakeSession();
            Assert.False(session.MoveEmber("nope", 0, 0));
            Assert.True(session.MoveEmber("e1", 12, 34));
            Assert.Equal(12.0, Ember(session, "e1").X);
            Assert.Equal(34.0, Ember(session, "e1").Y);
        }

        // ---- 实时拍推进 ----

        [Fact(DisplayName = "dt 累积不足一拍不结算, 累积过拍一次性补齐多拍")]
        public void DtAccumulatesAndCatchesUp()
        {
            var session = MakeSession();
            session.Update(0.7);
            Assert.True(Ember(session, "e3").Lit);
            session.Update(0.7); // 满 1.4 → 走 1 拍
            Assert.Equal("dark", Ember(session, "e3").Status);

            var fresh = MakeSession();
            fresh.Update(Prologue.BeatSeconds * 3); // 一次性 3 拍
            Assert.Equal("dark", Ember(fresh, "e1").Status); // 3 命耗尽
        }

        // ---- 拔棒与点棒 ----

        [Fact(DisplayName = "pullWand: planted→held 一次成功, 重复拔失败")]
        public void PullWandOnceThenRejected()
        {
            var session = MakeSession();
            Assert.True(session.PullWand());
            Assert.Equal("held", session.View.WandState);
            Assert.False(session.PullWand());
        }

        [Fact(DisplayName = "未拔棒不能点火: dipWand → wand_not_held")]
        public void DipWithoutHoldingRejected()
        {
            var session = MakeSession();
            Cluster(session);
            var result = session.DipWand(25, 15);
            Assert.False(result.Accepted);
            Assert.Equal("wand_not_held", result.Reason);
        }

        [Fact(DisplayName = "手持但点击处半径内没有冻结余烬 → no_frozen_ember (含'簇在别处'的情况)")]
        public void DipWithoutFrozenEmberNearbyRejected()
        {
            var session = MakeSession();
            session.PullWand();
            // 尚无簇
            var noCluster = session.DipWand(0, 0);
            Assert.False(noCluster.Accepted);
            Assert.Equal("no_frozen_ember", noCluster.Reason);
            // 有簇但点得太远 (簇在原点附近, 点在 400px 外)
            Cluster(session);
            var farAway = session.DipWand(400, 400);
            Assert.False(farAway.Accepted);
            Assert.Equal("no_frozen_ember", farAway.Reason);
            Assert.Equal("held", session.View.WandState);
        }

        [Fact(DisplayName = "revision: 静止 update 不变, 走拍/拖动/拔棒/点棒各 +1(重绘门控依据)")]
        public void RevisionTracksVisibleChangesOnly()
        {
            var session = MakeSession();
            var baseRevision = session.Revision;
            session.Update(0.5); // 不足一拍
            Assert.Equal(baseRevision, session.Revision);
            Beat(session);
            Assert.Equal(baseRevision + 1, session.Revision);
            session.MoveEmber("e1", 5, 5);
            Assert.Equal(baseRevision + 2, session.Revision);
            session.MoveEmber("nope", 0, 0); // 未知 id 无变更
            Assert.Equal(baseRevision + 2, session.Revision);
            session.PullWand();
            Assert.Equal(baseRevision + 3, session.Revision);
        }

        [Fact(DisplayName = "点中冻结火簇 → 棒亮、序章完成、场景冻结")]
        public void DipOnFrozenClusterCompletesPrologue()
        {
            var session = MakeSession();
            session.PullWand();
            Cluster(session);
            var result = session.DipWand(25, 15);
            Assert.True(result.Accepted);
            Assert.Equal("lit", session.View.WandState);
            Assert.True(session.View.Done);
            // 完成后模拟停摆: 再走拍不掉命
            var livesBefore = session.View.Embers.Select(e => e.Life).ToArray();
            Beat(session, 5);
            Assert.Equal(livesBefore, session.View.Embers.Select(e => e.Life).ToArray());
            // 完成后再点/再拔均拒绝
            var afterDone = session.DipWand(25, 15);
            Assert.False(afterDone.Accepted);
            Assert.Equal("done", afterDone.Reason);
            Assert.False(session.PullWand());
        }

        // ---- 序章与主谜题同律(跨模型契约) ----
        // 序章(距离邻接/实时拍)与主谜题 StarNetworkModel(固定边表/回合拍)必须执行同一条衰减律。
        // 若任何一边的规则内核被单独改动, 这组镜像对比会当场变红 —— 序章的教学价值全押在"同律"上。

        private static M02PrologueSession MakeCustomSession(List<PrologueEmber> embers)
        {
            // TS: new M02PrologueSession({ ...PROLOGUE, embers }, RULES) —— 浅拷贝换 embers
            return new M02PrologueSession(new StarWebPrologue
            {
                BeatSeconds = Prologue.BeatSeconds,
                AdjacencyRadius = Prologue.AdjacencyRadius,
                RekindleBeats = Prologue.RekindleBeats,
                Wand = Prologue.Wand,
                WandDipRadius = Prologue.WandDipRadius,
                Embers = embers
            }, Rules);
        }

        [Fact(DisplayName = "三角簇 vs 三角图: 逐拍命数完全一致(双方都冻结)")]
        public void TriangleClusterMatchesTriangleGraphPerBeat()
        {
            var session = MakeCustomSession(new List<PrologueEmber>
            {
                new() { Id = "a", X = 0, Y = 0, InitialLife = 3 },
                new() { Id = "b", X = 50, Y = 0, InitialLife = 3 },
                new() { Id = "c", X = 25, Y = 40, InitialLife = 3 }
            });
            var model = new StarNetworkModel(
                new BoardGraph(new[] { "a", "b", "c" }, new[] { ("a", "b"), ("b", "c"), ("c", "a") }),
                Rules);
            model.Tap("a"); // a + 邻居 b,c 全满命, 与序章初始等价

            for (var k = 0; k < 6; k += 1)
            {
                Assert.Equal(
                    new[] { "a", "b", "c" }.Select(id => model.LifeOf(id)).ToArray(),
                    session.View.Embers.Select(e => e.Life).ToArray());
                Beat(session);
                model.Tick();
            }
        }

        [Fact(DisplayName = "双星线 vs 一条边: 两端各 1 亮邻居, 同步漏光到全灭(只比到复燃前)")]
        public void PairLineMatchesSingleEdgeUntilAllDark()
        {
            var session = MakeCustomSession(new List<PrologueEmber>
            {
                new() { Id = "a", X = 0, Y = 0, InitialLife = 3 },
                new() { Id = "b", X = 60, Y = 0, InitialLife = 3 }
            });
            var model = new StarNetworkModel(new BoardGraph(new[] { "a", "b" }, new[] { ("a", "b") }), Rules);
            model.Tap("a");

            // lifeMax=3 → 第 3 拍双方归零; 序章的复燃是刻意的额外机制, 不在同律范围, 故只比衰减段
            for (var k = 0; k < 3; k += 1)
            {
                Assert.Equal(
                    new[] { "a", "b" }.Select(id => model.LifeOf(id)).ToArray(),
                    session.View.Embers.Select(e => e.Life).ToArray());
                Beat(session);
                model.Tick();
            }
            Assert.True(session.View.Embers.All(e => e.Status == "dark"));
            Assert.True(new[] { "a", "b" }.All(id => !model.IsLit(id)));
        }
    }
}
