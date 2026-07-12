// 从 tests/m01SnapRotation.test.ts 逐条迁移(10 it → 10 Fact) —— 规则不变, 断言一一对应。
// 这套钉的是 M01 吸附旋转的"血战语义"(fable 审指出漏迁, 本文件消费该 finding):
//   ①真理值表: 圆任意角 / 三角 120° 对称 / 六边 60° 对称, 差角不合→贴槽不掉(stick);
//   ②弱磁吸旋转门: 诱饵按【本证据生成角】判(不免检也不按身份), 真解片按自己的生成角,
//     别处真解片在本证据按诱饵规则(codex P2, 防泄露/互换朝向点亮);
//   ③重叠槽: 先取最近槽再判旋转, 不静默吸去较远的角度相容槽。
// 真实 config 部分用仓库单一真源 m01-memory-gear.json; 弱磁吸用合成布局(证据远离所有槽)。
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01SnapRotationTests
    {
        private static readonly M01MemoryGearConfig Config = LoadConfig();

        private static M01MemoryGearConfig LoadConfig()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            var rel = Path.Combine("assets", "resources", "configs", "stage1", "m01-memory-gear.json");
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, rel)))
            {
                dir = dir.Parent;
            }
            if (dir == null) throw new FileNotFoundException($"repo root with {rel} not found");
            return JsonConvert.DeserializeObject<M01MemoryGearConfig>(
                File.ReadAllText(Path.Combine(dir.FullName, rel)))!;
        }

        private static M01GreyboxLayoutData Layout() =>
            M01GreyboxLayout.Build(Config, new M01GreyboxLayoutOptions());

        private static M01GreyboxPieceSnapZone SlotFor(string id)
        {
            var slot = Layout().TargetPieceSlots.FirstOrDefault(s => s.ExpectedFragmentId == id);
            Assert.NotNull(slot);
            return slot!;
        }

        private static M01GreyboxDropAction DropOnSlot(string fragmentId, double rotation)
        {
            var l = Layout();
            var token = l.Fragments.First(f => f.ControllerId == fragmentId);
            var slot = l.TargetPieceSlots.First(s => s.ExpectedFragmentId == fragmentId);
            return M01GreyboxDrag.ResolveM01GreyboxDrop(l, token, slot.Position, new M01GreyboxDropOptions { Rotation = rotation });
        }

        // ── describe: M01 target-piece shape-fit snap: circle any-angle, others exact ──

        [Fact(DisplayName = "still snaps a rotatable piece only when rotated to its target angle")]
        public void SnapsRotatablePieceOnlyAtTargetAngle()
        {
            Assert.Equal(
                "snap_fragment_to_target_piece",
                DropOnSlot("fragment_triangle_blue_1", SlotFor("fragment_triangle_blue_1").Rotation).Type);
        }

        [Fact(DisplayName = "sticks the piece to the slot (does not free-drop/fall) when shape matches but rotation is wrong")]
        public void SticksToSlotWhenRotationWrong()
        {
            // 落点命中槽、只差旋转 → 贴在槽位不掉(stick), 而非自由落下。玩家原地转对了再落定。
            var action = DropOnSlot("fragment_triangle_blue_1", 0);
            Assert.Equal("stick_fragment_to_slot", action.Type);
            var slot = SlotFor("fragment_triangle_blue_1");
            Assert.Equal(slot.Position, action.Position);
        }

        [Fact(DisplayName = "treats a circle as orientation-free: snaps at any rotation")]
        public void CircleIsOrientationFree()
        {
            Assert.Equal("snap_fragment_to_target_piece", DropOnSlot("fragment_circle_yellow_1", 90).Type);
            Assert.Equal("snap_fragment_to_target_piece", DropOnSlot("fragment_circle_yellow_1", 270).Type);
        }

        [Fact(DisplayName = "treats a hexagon as 6-fold symmetric: coincident orientations snap, off-axis does not")]
        public void HexagonSixFoldSymmetric()
        {
            Assert.Equal(90, SlotFor("fragment_hexagon_red_2").Rotation);
            Assert.Equal("snap_fragment_to_target_piece", DropOnSlot("fragment_hexagon_red_2", 90).Type);
            // 270 = 90 + 180, and 180 is a multiple of 60 -> visually identical -> snaps
            Assert.Equal("snap_fragment_to_target_piece", DropOnSlot("fragment_hexagon_red_2", 270).Type);
            // 0 is 90deg off (not a 60-multiple) -> visibly rotated -> must NOT snap; sticks to slot instead of falling
            Assert.Equal("stick_fragment_to_slot", DropOnSlot("fragment_hexagon_red_2", 0).Type);
        }

        [Fact(DisplayName = "treats a triangle as 3-fold symmetric: 120deg-coincident snaps, 90deg off sticks (not snap)")]
        public void TriangleThreeFoldSymmetric()
        {
            var target = SlotFor("fragment_triangle_blue_1").Rotation;
            Assert.Equal("snap_fragment_to_target_piece", DropOnSlot("fragment_triangle_blue_1", target + 120).Type);
            Assert.Equal("stick_fragment_to_slot", DropOnSlot("fragment_triangle_blue_1", target + 90).Type);
        }

        // ── describe: M01 evidence weak-snap rotation gate (uniform for real pieces and decoys) ──
        // 真实 config 里证据中心都被目标槽矩形盖住(槽路径先接管), 弱磁吸路径只在边缘区决策 →
        // 用合成布局把证据放到远离所有槽的位置, 精确打到 evidence 路径本身。纯数据, 无需引擎。

        private static M01GreyboxPieceSnapZone MakeSlot(string id, double rotation) => new()
        {
            Id = $"slot_{id}",
            ExpectedFragmentId = id,
            ShapeToken = "triangle",
            Rotation = rotation,
            Position = new M01GreyboxPoint(1000, 1000), // 远离证据, 槽路径永不命中
            Size = new M01GreyboxSize(56, 56)
        };

        private static M01GreyboxTokenNode MakeToken(string id) => new()
        {
            ControllerId = id,
            Kind = "fragment",
            Tags = new List<string> { "fragment", "shape:triangle" },
            Position = new M01GreyboxPoint(200, 200),
            Size = new M01GreyboxSize(56, 56)
        };

        private static M01GreyboxLayoutData SyntheticLayout()
        {
            var evidence = new M01GreyboxTokenNode
            {
                ControllerId = "evidence_tri_tri",
                Kind = "evidence",
                Tags = new List<string> { "overlap_evidence", "shape:triangle" },
                Position = new M01GreyboxPoint(0, 0),
                Size = new M01GreyboxSize(52, 52),
                // 生成片 = 两片真解三角(目标角 90 / 180); 键即 solution.fragmentIds 的运行时形态
                FragmentSnapPositions = new Dictionary<string, M01GreyboxPoint>
                {
                    ["real_tri_a"] = new M01GreyboxPoint(-8, 0),
                    ["real_tri_b"] = new M01GreyboxPoint(8, 0)
                }
            };
            return new M01GreyboxLayoutData
            {
                EvidenceSnapEnabled = true,
                Evidence = new List<M01GreyboxTokenNode> { evidence },
                // real_tri_a / real_tri_b = 本证据生成片; other_tri_elsewhere = 属于别的证据的真解片(有自己的槽, 角0),
                // 但不在本证据 fragmentSnapPositions → 对本证据应按诱饵规则(本证据生成角)判, 不走它自己的角。
                TargetPieceSlots = new List<M01GreyboxPieceSnapZone>
                {
                    MakeSlot("real_tri_a", 90), MakeSlot("real_tri_b", 180), MakeSlot("other_tri_elsewhere", 0)
                },
                Slots = new List<M01GreyboxTokenNode>(),
                Fragments = new List<M01GreyboxTokenNode>()
            };
        }

        private static readonly M01GreyboxPoint Origin = new(0, 0);

        [Fact(DisplayName = "does NOT weak-snap a decoy triangle at an orientation no generator piece uses")]
        public void DecoyRejectedAtNonGeneratorAngle()
        {
            var l = SyntheticLayout();
            // 0° 对生成角 90(差 30, mod 120) 和 180(差 60) 都不重合 → 旧代码(诱饵免检)会吸, 新代码必须放行为自由落
            var action = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("decoy_triangle"), Origin, new M01GreyboxDropOptions { Rotation = 0 });
            Assert.Equal("place_fragment_freely", action.Type);
        }

        [Fact(DisplayName = "still lets the decoy triangle trial-fit when its orientation matches a generator piece")]
        public void DecoyTrialFitsAtGeneratorAngle()
        {
            var l = SyntheticLayout();
            // 诱饵必须能试拼(spec §633/§634: 干扰项可试、可替换), 只是不能任意角免检。
            var action = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("decoy_triangle"), Origin, new M01GreyboxDropOptions { Rotation = 90 });
            Assert.Equal("weak_snap_fragment", action.Type);
        }

        [Fact(DisplayName = "gates a real piece by its OWN generated pose, not the sibling generator's angle")]
        public void RealPieceGatedByOwnGeneratedPose()
        {
            var l = SyntheticLayout();
            // real_tri_a 自己的生成角是 90 → 90 可试拼
            var own = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("real_tri_a"), Origin, new M01GreyboxDropOptions { Rotation = 90 });
            Assert.Equal("weak_snap_fragment", own.Type);
            // 180 是另一生成片的角: 弱磁吸不矫正旋转、staging 只记 id → 若在此放行,
            // 双三角证据会以互换朝向的两片点亮底光(codex P2)。必须拒。
            var sibling = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("real_tri_a"), Origin, new M01GreyboxDropOptions { Rotation = 180 });
            Assert.Equal("place_fragment_freely", sibling.Type);
            // 0° 谁都不重合 → 不吸
            var blocked = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("real_tri_a"), Origin, new M01GreyboxDropOptions { Rotation = 0 });
            Assert.Equal("place_fragment_freely", blocked.Type);
        }

        [Fact(DisplayName = "treats a real piece from ANOTHER evidence like a decoy here, not by its own slot angle (codex P2)")]
        public void OtherEvidenceRealPieceTreatedLikeDecoy()
        {
            var l = SyntheticLayout();
            // other_tri_elsewhere 自己的槽角是 0, 但它不是本证据生成片 → 按本证据生成角(90/180)判。
            // 0° 是它自己的角但非本证据生成角 → 必须拒(旧代码只要它在某处有槽就按 0° 放行, 泄露它是别处真解)。
            var ownAngle = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("other_tri_elsewhere"), Origin, new M01GreyboxDropOptions { Rotation = 0 });
            Assert.Equal("place_fragment_freely", ownAngle.Type);
            // 90° 是本证据生成角 → 和诱饵一样可试拼。
            var genAngle = M01GreyboxDrag.ResolveM01GreyboxDrop(l, MakeToken("other_tri_elsewhere"), Origin, new M01GreyboxDropOptions { Rotation = 90 });
            Assert.Equal("weak_snap_fragment", genAngle.Type);
        }

        // ── describe: M01 overlapping target slots: nearest slot decides, mismatch hints instead of far-snap ──

        [Fact(DisplayName = "hints rotation on the aimed-at (nearest) slot rather than silently snapping to a farther one")]
        public void NearestSlotDecidesBeforeRotation()
        {
            var l = Layout();
            var triangleSlots = l.TargetPieceSlots.Where(s => s.ShapeToken == "triangle").ToList();
            Assert.Equal(2, triangleSlots.Count);
            var a = triangleSlots[0];
            var b = triangleSlots[1];
            // 只在两槽真的重叠时该场景才存在(当前 config 如此); 若未来布局改开, 此测试自动失效提醒重审。
            var dx = Math.Abs(a.Position.X - b.Position.X);
            var dy = Math.Abs(a.Position.Y - b.Position.Y);
            Assert.True(dx < (a.Size.Width + b.Size.Width) / 2);
            Assert.True(dy < (a.Size.Height + b.Size.Height) / 2);

            // 取 b 靠 a 一侧的矩形边界内缩 1px: 必在 b 内; 两槽重叠 => 该点也在 a 内, 且离 a 更近。
            double towardA = Math.Sign(a.Position.X - b.Position.X);
            if (towardA == 0) towardA = 1;
            var probe = new M01GreyboxPoint(
                b.Position.X + towardA * (b.Size.Width / 2 - 1),
                b.Position.Y + Math.Sign(a.Position.Y - b.Position.Y) * (b.Size.Height / 2 - 1));
            var distA = Math.Sqrt(Math.Pow(probe.X - a.Position.X, 2) + Math.Pow(probe.Y - a.Position.Y, 2));
            var distB = Math.Sqrt(Math.Pow(probe.X - b.Position.X, 2) + Math.Pow(probe.Y - b.Position.Y, 2));
            Assert.True(distA < distB);

            // 拼片转到"较远槽 b"的角度(与最近槽 a 不重合), 落在 probe: 旧逻辑吸去 b。
            // 新逻辑: 认最近槽 a, a 角度不合 → 贴在 a 槽位不掉(stick), 不会静默吸去较远的 b。
            var token = l.Fragments.First(f => f.ControllerId == a.ExpectedFragmentId);
            var action = M01GreyboxDrag.ResolveM01GreyboxDrop(l, token, probe, new M01GreyboxDropOptions { Rotation = b.Rotation });
            if (action.Type == "stick_fragment_to_slot")
            {
                // 贴在最近槽 a 的位置(不是较远的 b)。
                Assert.Equal(a.Position, action.Position);
            }
            else
            {
                // a/b 目标角恰好对称重合时(如未来配成 90/210), 吸附到最近槽 a 也是对的。
                Assert.Equal("snap_fragment_to_target_piece", action.Type);
                Assert.Equal(a.Id, action.PieceSlotId);
            }
        }
    }
}
