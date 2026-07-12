// 从 tests/core/StarNetworkModel.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
using System.Collections.Generic;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class StarNetworkModelTests
    {
        private static readonly StarNetworkRules Rules = new() { LifeMax = 3, FreezeThreshold = 2 };

        private static BoardGraph Triangle => new(
            new[] { "A", "B", "C" },
            new[] { ("A", "B"), ("B", "C"), ("C", "A") });

        private static BoardGraph Line => new(
            new[] { "X", "Y", "Z" },
            new[] { ("X", "Y"), ("Y", "Z") });

        // --- Tap ---

        [Fact(DisplayName = "点一颗星把它和直连邻居都置满命，其余为暗")]
        public void Tap_LightsSelfAndNeighborsToFull()
        {
            var m = new StarNetworkModel(Triangle, Rules);
            m.Tap("A");
            Assert.Equal(3, m.LifeOf("A"));
            Assert.Equal(3, m.LifeOf("B"));
            Assert.Equal(3, m.LifeOf("C"));
        }

        [Fact(DisplayName = "忽略未知星，不抛错")]
        public void Tap_UnknownStar_IsIgnored()
        {
            var m = new StarNetworkModel(Triangle, Rules);
            var ex = Record.Exception(() => m.Tap("ZZZ"));
            Assert.Null(ex);
            Assert.Equal(0, m.LifeOf("A"));
        }

        // --- Tick ---

        [Fact(DisplayName = "环上每颗都有2个亮邻居 → 全冻结不掉命")]
        public void Tick_RingWithEnoughLitNeighbors_Freezes()
        {
            var m = new StarNetworkModel(Triangle, Rules);
            m.Tap("A");
            m.Tick();
            Assert.Equal(3, m.LifeOf("A"));
            Assert.Equal(3, m.LifeOf("B"));
            Assert.Equal(3, m.LifeOf("C"));
        }

        [Fact(DisplayName = "只有1个亮邻居的星会漏光 (-1)")]
        public void Tick_InsufficientLitNeighbors_Decays()
        {
            var m = new StarNetworkModel(Line, Rules);
            m.Tap("X"); // 亮 X,Y; Z 暗
            m.Tick();
            Assert.Equal(2, m.LifeOf("X")); // 邻居仅 Y
            Assert.Equal(2, m.LifeOf("Y")); // 邻居 X 亮 / Z 暗
            Assert.Equal(0, m.LifeOf("Z"));
        }

        [Fact(DisplayName = "命归0即熄灭")]
        public void Tick_LifeReachesZero_GoesDark()
        {
            var m = new StarNetworkModel(Line, Rules);
            m.Tap("X");
            m.Tick(); m.Tick(); m.Tick(); // X: 3→2→1→0
            Assert.False(m.IsLit("X"));
        }

        // --- Step / IsWon / Reset ---

        [Fact(DisplayName = "三角环 step 一点即全锁")]
        public void Step_Triangle_WinsInOneTap()
        {
            var m = new StarNetworkModel(Triangle, Rules);
            m.Step("A");
            Assert.True(m.IsWon());
        }

        [Fact(DisplayName = "线状图无法自锁 (端点亮邻居不足)")]
        public void Step_Line_CannotSelfLock()
        {
            var m = new StarNetworkModel(Line, Rules);
            m.Step("Y"); // 亮 X,Y,Z; 但 X,Z 各只有1个亮邻居
            Assert.False(m.IsWon());
        }

        [Fact(DisplayName = "reset 清回全暗")]
        public void Reset_ClearsToAllDark()
        {
            var m = new StarNetworkModel(Triangle, Rules);
            m.Step("A");
            m.Reset();
            Assert.False(m.IsWon());
            Assert.Equal(0, m.LifeOf("A"));
        }

        // --- 图构造健壮性 ---

        [Fact(DisplayName = "镜像/重复边不把邻居算两次")]
        public void Graph_DuplicateAndMirroredEdges_CountedOnce()
        {
            var dup = new BoardGraph(new[] { "P", "Q" }, new[] { ("P", "Q"), ("Q", "P"), ("P", "Q") });
            var m = new StarNetworkModel(dup, Rules);
            m.Tap("P"); // 亮 P,Q
            Assert.Equal(1, m.LitNeighborCount("P")); // Q 只算一次
        }

        [Fact(DisplayName = "忽略自环")]
        public void Graph_SelfLoop_Ignored()
        {
            var loop = new BoardGraph(new[] { "P", "Q" }, new[] { ("P", "P"), ("P", "Q") });
            var m = new StarNetworkModel(loop, Rules);
            m.Tap("P");
            Assert.Equal(1, m.LitNeighborCount("P")); // 自己不算邻居
        }

        [Fact(DisplayName = "忽略指向未知节点的边")]
        public void Graph_EdgeToUnknownNode_Ignored()
        {
            var stray = new BoardGraph(new[] { "P", "Q" }, new[] { ("P", "Q"), ("P", "ZZZ") });
            var m = new StarNetworkModel(stray, Rules);
            m.Tap("P");
            Assert.Equal(1, m.LitNeighborCount("P"));
        }

        [Fact(DisplayName = "step 未知星: 不推进衰减, 返回 false")]
        public void Step_UnknownStar_DoesNotAdvanceDecay()
        {
            var m = new StarNetworkModel(Line, Rules);
            m.Tap("X"); // X,Y 满命
            var did = m.Step("ZZZ");
            Assert.False(did);
            Assert.Equal(3, m.LifeOf("X")); // 没白耗一拍
            Assert.Equal(3, m.LifeOf("Y"));
        }

        [Fact(DisplayName = "空图不算胜利")]
        public void IsWon_EmptyGraph_IsFalse()
        {
            var m = new StarNetworkModel(new BoardGraph(new string[0], new (string, string)[0]), Rules);
            Assert.False(m.IsWon());
        }
    }
}
