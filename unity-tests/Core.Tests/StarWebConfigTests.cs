// 从 tests/core/StarWebConfig.test.ts 逐条迁移 —— 规则不变, 断言一一对应.
// 真实配置 assets/resources/configs/stage1/m02-starweb-warmth.json 由向上查根加载(同 ToolCardTests 模式);
// mutation 用例用 JObject 深拷贝后改, 不污染共享原件.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class StarWebConfigTests
    {
        private static readonly JObject Config = LoadConfig();

        private static JObject LoadConfig()
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

        private static JObject Clone() => (JObject)Config.DeepClone();
        private static string Join(IReadOnlyList<string> errors) => string.Join("\n", errors);

        // 覆盖下界: 若 maxTaps 次连"点亮过所有节点"都做不到, 就必然不可能全锁胜利。(TS BigInt → ulong, 节点<=64)
        private static bool CanLightEveryNodeWithinTaps(BoardGraph graph, int maxTaps)
        {
            var nodes = graph.Nodes;
            if (nodes.Count > 64) throw new InvalidOperationException("ulong 掩码仅支持 <=64 节点(现三板 <=31); 超了要换 BitArray/BigInteger");
            var nodeIndex = new Dictionary<string, int>();
            for (var i = 0; i < nodes.Count; i++) nodeIndex[nodes[i]] = i;
            var coverage = new ulong[nodes.Count];
            for (var i = 0; i < nodes.Count; i++) coverage[i] = 1UL << i;
            foreach (var (a, b) in graph.Edges)
            {
                if (!nodeIndex.TryGetValue(a, out var ai) || !nodeIndex.TryGetValue(b, out var bi) || ai == bi) continue;
                coverage[ai] |= 1UL << bi;
                coverage[bi] |= 1UL << ai;
            }
            var allLit = nodes.Count >= 64 ? ulong.MaxValue : (1UL << nodes.Count) - 1;

            bool Search(int start, int remaining, ulong litMask)
            {
                if (litMask == allLit) return true;
                if (remaining == 0) return false;
                for (var i = start; i <= coverage.Length - remaining; i++)
                {
                    if (Search(i + 1, remaining - 1, litMask | coverage[i])) return true;
                }
                return false;
            }
            return Search(0, maxTaps, 0UL);
        }

        private static string EdgeKey(string a, string b)
        {
            var p = new[] { a, b };
            Array.Sort(p, StringComparer.Ordinal);
            return p[0] + "-" + p[1];
        }

        [Fact(DisplayName = "真实配置合法且只保留双环/双轨/花冠三板")]
        public void RealConfigValidWithThreeBoards()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            Assert.Equal(new[] { "twin", "orbital_gate", "corona_gate" }, result.Value!.Boards.Select(b => b.Id).ToArray());
            Assert.Equal(3, result.Value.Mechanic.LifeMax);
            Assert.Equal(2, result.Value.Mechanic.FreezeThreshold);
        }

        [Fact(DisplayName = "拒绝 edges 引用不存在的节点")]
        public void RejectsEdgeReferencingUnknownNode()
        {
            var clone = Clone();
            ((JArray)clone["boards"]![0]!["layout"]!["edges"]!).Add(new JArray("A", "ZZZ"));
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "拒绝同一板内重复 node id")]
        public void RejectsDuplicateNodeId()
        {
            var clone = Clone();
            var nodes = (JArray)clone["boards"]![0]!["layout"]!["nodes"]!;
            nodes[1]!["id"] = (string)nodes[0]!["id"]!;
            var result = StarWebConfigValidator.Validate(clone);
            Assert.False(result.Ok);
            Assert.Contains("is duplicated", Join(result.Errors));
        }

        [Fact(DisplayName = "拒绝重复 board id")]
        public void RejectsDuplicateBoardId()
        {
            var clone = Clone();
            var boards = (JArray)clone["boards"]!;
            boards[1]!["id"] = (string)boards[0]!["id"]!;
            var result = StarWebConfigValidator.Validate(clone);
            Assert.False(result.Ok);
            Assert.Contains("boards[1].id \"twin\" is duplicated", Join(result.Errors));
        }

        [Fact(DisplayName = "拒绝不受支持的 mechanic flag (tapLightsNeighbors=false)")]
        public void RejectsUnsupportedMechanicFlag()
        {
            var clone = Clone();
            clone["mechanic"]!["tapLightsNeighbors"] = false;
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "拒绝自环边")]
        public void RejectsSelfLoopEdge()
        {
            var clone = Clone();
            ((JArray)clone["boards"]![0]!["layout"]!["edges"]!).Add(new JArray("A", "A"));
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "拒绝重复/镜像边")]
        public void RejectsDuplicateMirrorEdge()
        {
            var clone = Clone();
            var edges = (JArray)clone["boards"]![0]!["layout"]!["edges"]!;
            var first = (JArray)edges[0]!;
            edges.Add(new JArray((string)first[1]!, (string)first[0]!));
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "拒绝非字符串的可选字段 (description)")]
        public void RejectsNonStringDescription()
        {
            var clone = Clone();
            clone["description"] = 123;
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "真实配置携带合法序章: 三颗余烬、命数错开")]
        public void RealConfigHasValidPrologue()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            Assert.Equal(new[] { "e1", "e2", "e3" }, result.Value!.Prologue!.Embers.Select(e => e.Id).ToArray());
            Assert.Equal(3, result.Value.Prologue.Embers.Select(e => e.InitialLife).Distinct().Count());
        }

        [Fact(DisplayName = "prologue 可选: 删掉整段仍合法(向后兼容)")]
        public void PrologueIsOptional()
        {
            var clone = Clone();
            clone.Remove("prologue");
            Assert.True(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "拒绝开局预成簇的余烬(两颗初始距离 <= adjacencyRadius)")]
        public void RejectsPreClusteredEmbers()
        {
            var clone = Clone();
            var embers = (JArray)clone["prologue"]!["embers"]!;
            embers[1]!["x"] = (double)embers[0]!["x"]! + 10;
            embers[1]!["y"] = (double)embers[0]!["y"]!;
            var result = StarWebConfigValidator.Validate(clone);
            Assert.False(result.Ok);
            Assert.Contains("预成簇", Join(result.Errors));
        }

        [Fact(DisplayName = "拒绝余烬数不足 freezeThreshold+1 (序章软锁)")]
        public void RejectsInsufficientEmbers()
        {
            var clone = Clone();
            var embers = (JArray)clone["prologue"]!["embers"]!;
            clone["prologue"]!["embers"] = new JArray(embers.Take(2).Select(e => e.DeepClone()));
            var result = StarWebConfigValidator.Validate(clone);
            Assert.False(result.Ok);
            Assert.Contains("freezeThreshold+1", Join(result.Errors));
        }

        [Fact(DisplayName = "拒绝 initialLife 超过 mechanic.lifeMax 的余烬")]
        public void RejectsInitialLifeOverLifeMax()
        {
            var clone = Clone();
            clone["prologue"]!["embers"]![0]!["initialLife"] = 99;
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "拒绝缺 wand 或非正数 beatSeconds 的序章")]
        public void RejectsMissingWandOrNonPositiveBeatSeconds()
        {
            var noWand = Clone();
            ((JObject)noWand["prologue"]!).Remove("wand");
            Assert.False(StarWebConfigValidator.Validate(noWand).Ok);

            var badBeat = Clone();
            badBeat["prologue"]!["beatSeconds"] = 0;
            Assert.False(StarWebConfigValidator.Validate(badBeat).Ok);
        }

        [Fact(DisplayName = "真实配置包含可生成合法工具卡的文案")]
        public void RealConfigProducesValidToolCard()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);

            var card = ToolCardFactory.Create(result.Value!.ToolCard, 1000);
            Assert.True(ToolCardFactory.Validate(card).Ok);
            Assert.Equal("协同与临界质量", card.Front.ToolName);
            Assert.Contains("挨在一起", card.Front.WisdomCrystal);
            Assert.True(card.Back.WhenToUse.Count > 0);
            Assert.True(card.Back.RealLifeExamples.Count > 0);
        }

        [Fact(DisplayName = "拒绝与父级配置身份不一致的工具卡")]
        public void RejectsToolCardIdentityMismatch()
        {
            var mutations = new Action<JObject>[]
            {
                c => c["toolCard"]!["puzzleId"] = "m99",
                c => c["toolCard"]!["stage"] = 2,
                c => c["toolCard"]!["front"]!["wisdomCrystal"] = "不同的智慧水晶"
            };

            foreach (var mutate in mutations)
            {
                var clone = Clone();
                mutate(clone);
                Assert.False(StarWebConfigValidator.Validate(clone).Ok);
            }
        }

        [Fact(DisplayName = "每板参考解在配额内全锁")]
        public void EachReferenceSolutionLocksWithinCharges()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);

            foreach (var board in result.Value!.Boards)
            {
                var model = new StarNetworkModel(StarWebConfigValidator.BoardGraphOf(board), result.Value.Mechanic);
                foreach (var id in board.Solution.ReferenceTaps) model.Step(id);
                Assert.True(model.IsWon(), $"{board.Id} 参考解应全锁");
                Assert.Equal(board.Charges, board.Solution.ReferenceTaps.Count);
            }
        }

        [Fact(DisplayName = "双轨星门: 24 星 6 电, 参考解保留上一版")]
        public void OrbitalGate24Stars6Charges()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            var gate = result.Value!.Boards.First(b => b.Id == "orbital_gate");
            Assert.Equal("双轨星门", gate.Name);
            Assert.Equal(24, gate.Layout.Nodes.Count);
            Assert.Equal(6, gate.Charges);
            Assert.Equal(new[] { "A", "M", "I", "U", "E", "Q" }, gate.Solution.ReferenceTaps.ToArray());
        }

        [Fact(DisplayName = "双轨星门: 直觉陷阱路线会失败")]
        public void OrbitalGateTrapSequencesFail()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            var gate = result.Value!.Boards.First(b => b.Id == "orbital_gate");
            var trapSequences = new[]
            {
                new[] { "A", "E", "I", "M", "Q", "U" },
                new[] { "A", "I", "Q", "M", "U", "E" },
                new[] { "M", "U", "E", "A", "I", "Q" },
                new[] { "A", "Q", "E", "M", "I", "U" }
            };
            foreach (var sequence in trapSequences)
            {
                var model = new StarNetworkModel(StarWebConfigValidator.BoardGraphOf(gate), result.Value.Mechanic);
                foreach (var id in sequence) model.Step(id);
                Assert.False(model.IsWon(), $"{string.Join(",", sequence)} 应失败");
            }
        }

        [Fact(DisplayName = "花冠星门: 31 星 7 电, 花冠中心必须参与")]
        public void CoronaGate31Stars7Charges()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            var gate = result.Value!.Boards.First(b => b.Id == "corona_gate");
            Assert.Equal("花冠星门", gate.Name);
            Assert.Equal(31, gate.Layout.Nodes.Count);
            Assert.Equal(7, gate.Charges);
            Assert.Equal(new[] { "A", "M", "I", "U", "E", "Q", "Y" }, gate.Solution.ReferenceTaps.ToArray());
        }

        [Fact(DisplayName = "花冠星门: 直觉陷阱路线会失败")]
        public void CoronaGateTrapSequencesFail()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            var gate = result.Value!.Boards.First(b => b.Id == "corona_gate");
            var trapSequences = new[]
            {
                new[] { "A", "E", "I", "M", "Q", "U", "Y" },
                new[] { "Y", "A", "M", "I", "U", "E", "Q" },
                new[] { "A", "I", "Q", "M", "U", "E", "Y" },
                new[] { "M", "U", "E", "A", "I", "Q", "Y" },
                new[] { "A", "Q", "E", "M", "I", "U", "Y" },
                new[] { "A", "M", "I", "U", "E", "Q" }
            };
            foreach (var sequence in trapSequences)
            {
                var model = new StarNetworkModel(StarWebConfigValidator.BoardGraphOf(gate), result.Value.Mechanic);
                foreach (var id in sequence) model.Step(id);
                Assert.False(model.IsWon(), $"{string.Join(",", sequence)} 应失败");
            }
        }

        [Fact(DisplayName = "花冠星门: 双轨外环加中心花冠连续成网")]
        public void CoronaContinuousNet()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            var gate = result.Value!.Boards.First(b => b.Id == "corona_gate");
            var edges = new HashSet<string>(gate.Layout.Edges.Select(e => EdgeKey(e[0], e[1])));

            foreach (var edge in new[] { "C-J", "K-R", "O-V", "F-W" })
            {
                Assert.Contains(edge, edges);
            }
            foreach (var (a, b) in new[] { ("Y", "Z"), ("Y", "AA"), ("Y", "AB"), ("Y", "AC"), ("Y", "AD"), ("Y", "AE") })
            {
                Assert.Contains(EdgeKey(a, b), edges);
            }
        }

        [Fact(DisplayName = "双环: 漏掉一个环的锚 (A,B,D) 无法全锁")]
        public void TwinMissingAnchorFails()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            var twin = result.Value!.Boards.First(b => b.Id == "twin");
            var model = new StarNetworkModel(StarWebConfigValidator.BoardGraphOf(twin), result.Value.Mechanic);
            foreach (var id in new[] { "A", "B", "D" }) model.Step(id);
            Assert.False(model.IsWon());
        }

        [Fact(DisplayName = "每板配额是紧的: 少一次无解")]
        public void EachBoardChargeIsTight()
        {
            var result = StarWebConfigValidator.Validate(Config);
            Assert.True(result.Ok);
            foreach (var board in result.Value!.Boards)
            {
                var canCover = CanLightEveryNodeWithinTaps(StarWebConfigValidator.BoardGraphOf(board), board.Charges - 1);
                Assert.False(canCover, $"{board.Id} 应少于 {board.Charges} 点无解");
            }
        }

        // ↓↓ C# 转写专属回归桩(TS 无对应)—— 钉住 fable 审逮到的 JToken/Newtonsoft 边界偏离(全在原无测试分支)。

        [Fact(DisplayName = "toolCard.stage 非整数被拒(不经 ToObject 强转洗成合法)")]
        public void RejectsToolCardWithNonIntegerStage()
        {
            // 旧实现先 ToObject<ToolCardDraft> 把 2.5→2 洗成合法 → 放行; 修后走类型严格 JToken 校验 → 拒。
            var clone = Clone();
            clone["toolCard"]!["stage"] = 2.5;
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "description 显式 null 被拒(已定义且非串, 同 TS)")]
        public void RejectsExplicitNullDescription()
        {
            var clone = Clone();
            clone["description"] = JValue.CreateNull();
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "prologue 显式 null 被拒(isRecord(null)=false → must be an object)")]
        public void RejectsExplicitNullPrologue()
        {
            var clone = Clone();
            clone["prologue"] = JValue.CreateNull();
            var result = StarWebConfigValidator.Validate(clone);
            Assert.False(result.Ok);
            Assert.Contains("prologue must be an object", Join(result.Errors));
        }

        [Fact(DisplayName = "整值浮点(stage=1.0)按整数接受(Number.isInteger 等价)")]
        public void AcceptsIntegerValuedFloatStage()
        {
            var clone = Clone();
            var stageVal = (int)clone["stage"]!;
            clone["stage"] = (double)stageVal; // 同值但 JSON Float 类型
            Assert.True(StarWebConfigValidator.Validate(clone).Ok);
        }

        [Fact(DisplayName = "mechanic.beatModel 为对象时被拒且不抛异常")]
        public void MechanicBeatModelObjectRejectedNotThrown()
        {
            var clone = Clone();
            clone["mechanic"]!["beatModel"] = new JObject();
            // 旧实现 (string?)obj["beatModel"] 会抛 ArgumentException; 修后先判 Type==String → 干净拒绝。
            Assert.False(StarWebConfigValidator.Validate(clone).Ok);
        }
    }
}
