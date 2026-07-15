// 从 tests/cocos/M02StarWebSession.test.ts 逐条迁移 —— 断言一一对应, 字面值(状态串/棋盘 id)逐字保留.
// 真实配置 assets/resources/configs/stage1/m02-starweb-warmth.json 由向上查根加载(同 StarWebConfigTests 模式).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.M02.Tests
{
    public class M02StarWebSessionTests
    {
        private static readonly JObject ConfigJson = LoadConfigJson();

        private static JObject LoadConfigJson()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            var rel = Path.Combine("assets", "resources", "configs", "stage1", "m02-starweb-warmth.json");
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, rel)))
            {
                dir = dir.Parent;
            }
            if (dir == null) throw new FileNotFoundException($"repo root with {rel} not found");
            return (JObject)JToken.Parse(File.ReadAllText(Path.Combine(dir.FullName, rel)));
        }

        // TS loadConfig(): validateStarWebConfig(starWeb) → 不合法即抛
        private static StarWebConfig LoadConfig()
        {
            var result = StarWebConfigValidator.Validate(ConfigJson);
            if (!result.Ok) throw new InvalidOperationException("config invalid: " + string.Join(", ", result.Errors));
            return result.Value!;
        }

        [Fact(DisplayName = "首板=双环共枢纽: 9 星全暗, 电量 3, 进行中")]
        public void InitialViewFirstBoard()
        {
            var s = new StarWebSession(LoadConfig());
            var v = s.View;
            Assert.Equal("twin", v.BoardId);
            Assert.Equal(0, v.BoardIndex);
            Assert.Equal(3, v.BoardCount);
            Assert.Equal(9, v.Nodes.Count);
            Assert.True(v.Nodes.All(n => n.Status == "dark"));
            Assert.Equal(3, v.ChargesTotal);
            Assert.Equal(3, v.ChargesLeft);
            Assert.Equal("playing", v.Status);
        }

        [Fact(DisplayName = "参考解 [A,C,G] 恰用满电量并胜利, 所有星冻结")]
        public void ReferenceSolutionWinsWithExactCharges()
        {
            var s = new StarWebSession(LoadConfig());
            Assert.True(s.TapNode("A").Accepted);
            Assert.Equal(2, s.View.ChargesLeft);
            Assert.True(s.TapNode("C").Accepted);
            Assert.True(s.TapNode("G").Accepted);
            var v = s.View;
            Assert.Equal("won", v.Status);
            Assert.Equal(0, v.ChargesLeft);
            Assert.True(v.Nodes.All(n => n.Status == "frozen"));
        }

        [Fact(DisplayName = "未知星: 拒绝, 不耗电量")]
        public void UnknownNodeRejectedWithoutChargeCost()
        {
            var s = new StarWebSession(LoadConfig());
            var r = s.TapNode("ZZZ");
            Assert.False(r.Accepted);
            Assert.Equal("unknown_node", r.Reason);
            Assert.Equal(3, s.View.ChargesLeft);
        }

        [Fact(DisplayName = "电量耗尽未胜 → exhausted, 之后 tap 被拒")]
        public void ExhaustedAfterChargesSpentThenTapsRejected()
        {
            var s = new StarWebSession(LoadConfig());
            s.TapNode("A"); // 亮一段弧, 未合环
            s.TapNode("A");
            s.TapNode("A"); // 白耗完三点, 仍未全锁
            var v = s.View;
            Assert.Equal("exhausted", v.Status);
            Assert.Equal(0, v.ChargesLeft);
            Assert.False(s.TapNode("D").Accepted); // not_playing
            Assert.Equal("not_playing", s.TapNode("D").Reason);
        }

        [Fact(DisplayName = "resetBoard 回到进行中、电量满")]
        public void ResetBoardRestoresPlayingAndCharges()
        {
            var s = new StarWebSession(LoadConfig());
            s.TapNode("A");
            s.TapNode("A");
            s.ResetBoard();
            var v = s.View;
            Assert.Equal("playing", v.Status);
            Assert.Equal(3, v.ChargesLeft);
            Assert.True(v.Nodes.All(n => n.Status == "dark"));
        }

        [Fact(DisplayName = "nextBoard 依次到 orbital_gate/corona_gate, 末板返回 false")]
        public void NextBoardAdvancesThroughAllBoards()
        {
            var s = new StarWebSession(LoadConfig());
            Assert.Equal("twin", s.View.BoardId);
            Assert.Equal(3, s.View.ChargesTotal);
            Assert.True(s.NextBoard());
            Assert.Equal("orbital_gate", s.View.BoardId);
            Assert.Equal(6, s.View.ChargesTotal);
            Assert.True(s.NextBoard());
            Assert.Equal("corona_gate", s.View.BoardId);
            Assert.Equal(7, s.View.ChargesTotal);
            Assert.False(s.NextBoard()); // 已是最后一板
            Assert.Equal("corona_gate", s.View.BoardId);
        }

        [Fact(DisplayName = "每一板参考解都能在本会话内打通")]
        public void EveryBoardReferenceSolutionWinsInOneSession()
        {
            var s = new StarWebSession(LoadConfig());
            var cfg = LoadConfig();
            foreach (var board in cfg.Boards)
            {
                foreach (var id in board.Solution.ReferenceTaps) s.TapNode(id);
                Assert.True("won" == s.View.Status, board.Id); // TS: expect(..., board.id).toBe("won")
                s.NextBoard();
            }
        }

        [Fact(DisplayName = "三板全 won 后关卡完成")]
        public void LevelCompleteAfterAllBoardsWon()
        {
            var s = new StarWebSession(LoadConfig());
            var cfg = LoadConfig();
            foreach (var board in cfg.Boards)
            {
                foreach (var id in board.Solution.ReferenceTaps) s.TapNode(id);
                Assert.True("won" == s.View.Status, board.Id);
                if (s.View.BoardIndex < s.View.BoardCount - 1) s.NextBoard();
            }
            Assert.True(s.IsLevelComplete());
        }

        [Fact(DisplayName = "中途未通关不算关卡完成")]
        public void LevelNotCompleteInitially()
        {
            var s = new StarWebSession(LoadConfig());
            Assert.False(s.IsLevelComplete());
        }

        [Fact(DisplayName = "点一颗后: 该星冻结/衰减态出现, 其余仍暗")]
        public void StatusesAfterSingleTap()
        {
            var s = new StarWebSession(LoadConfig());
            s.TapNode("A"); // 双环: A 有 4 个亮邻居 → frozen; 环端点各 1 个亮邻居 → decaying
            var byId = s.View.Nodes.ToDictionary(n => n.Id); // TS: new Map(...)
            Assert.Equal("frozen", byId["A"].Status);
            Assert.Equal("decaying", byId["B"].Status);
            Assert.Equal("dark", byId["C"].Status);
        }
    }
}
