// 从 tests/cocos/M01FlashlightObservation.test.ts 逐条迁移 —— 规格不变, 断言一一对应(不增不减)。
using System.Collections.Generic;
using StarGuardian.Interaction;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01FlashlightObservationTests
    {
        // --- M01 held-flashlight light-state cycle ---

        [Fact(DisplayName = "cycles off → red → yellow → blue → off on each tap of the held flashlight")]
        public void CycleLight_WalksTheFourStateCycle()
        {
            var sequence = new List<string> { "off" };
            var state = "off";
            for (var i = 0; i < 4; i += 1)
            {
                state = M01FlashlightObservation.CycleLight(state);
                sequence.Add(state);
            }
            Assert.Equal(new[] { "off", "red", "yellow", "blue", "off" }, sequence);
        }

        // --- M01 flashlight coverage hit-test ---

        private static IReadOnlyList<CoverageFragment> Fragments => new List<CoverageFragment>
        {
            new() { Id = "a", Pos = new Point2(30, 0) },   // 距原点 30 → r=100 内
            new() { Id = "b", Pos = new Point2(60, 60) },  // 距原点 ~84.9 → r=100 内
            new() { Id = "c", Pos = new Point2(200, 0) },  // 距原点 200 → r=100 外
            new() { Id = "d", Pos = new Point2(10, 10), OnTray = true } // 半径内但已在拼接盘上
        };

        [Fact(DisplayName = "lights every candidate within the beam radius (a coverage area, not just one)")]
        public void FragmentsInCoverage_LightsEveryCandidateWithinRadius()
        {
            var lit = M01FlashlightObservation.FragmentsInCoverage(new Point2(0, 0), 100, Fragments);
            Assert.Equal(new[] { "a", "b" }, lit);
            Assert.True(lit.Count > 1);
        }

        [Fact(DisplayName = "excludes candidates outside the radius")]
        public void FragmentsInCoverage_ExcludesCandidatesOutsideRadius()
        {
            Assert.DoesNotContain(
                "c",
                M01FlashlightObservation.FragmentsInCoverage(new Point2(0, 0), 100, Fragments));
        }

        [Fact(DisplayName = "never lights candidates already on the assembly tray (beam does not hit the tray)")]
        public void FragmentsInCoverage_NeverLightsCandidatesOnTray()
        {
            Assert.DoesNotContain(
                "d",
                M01FlashlightObservation.FragmentsInCoverage(new Point2(0, 0), 100, Fragments));
        }

        [Fact(DisplayName = "recomputes from the beam center, so moving Lemmy changes which candidates light up")]
        public void FragmentsInCoverage_RecomputesFromBeamCenter()
        {
            Assert.Equal(
                new[] { "c" },
                M01FlashlightObservation.FragmentsInCoverage(new Point2(200, 0), 50, Fragments));
        }

        // --- M01 coverage-pool board exclusion (spec §5.2: 光束只照候选区, 不照拼接盘) ---
        // M01 关卡事实: 拼接盘圆在 (-60, 0), 430px 包围盒 → 底边 -215; 光池中心贴碎片地面线(~y -242)。
        private static SnapBounds Board => new() { X = -60, Y = 0, Width = 430, Height = 430 };

        [Fact(DisplayName = "keeps the natural pool height when the pool is horizontally clear of the board")]
        public void CoveragePoolHalfHeight_KeepsNaturalWhenHorizontallyClear()
        {
            var half = M01FlashlightObservation.CoveragePoolHalfHeight(new CoveragePoolClampOptions
            {
                Center = new Point2(400, -242),
                RadiusX = 140,
                NaturalHalfHeight = 48,
                Board = Board,
                Clearance = 6
            });
            Assert.Equal(48d, half);
        }

        [Fact(DisplayName = "clamps the pool top below the board bottom edge when their x-spans overlap")]
        public void CoveragePoolHalfHeight_ClampsBelowBoardBottomOnOverlap()
        {
            var half = M01FlashlightObservation.CoveragePoolHalfHeight(new CoveragePoolClampOptions
            {
                Center = new Point2(-60, -242),
                RadiusX = 140,
                NaturalHalfHeight = 48,
                Board = Board,
                Clearance = 6
            });
            // board bottom (-215) - clearance (6) - center (-242) = 21 → 光池永不触盘。
            Assert.Equal(21d, half);
            Assert.True(-242 + half <= -215 - 6);
        }

        [Fact(DisplayName = "does not grow the pool when the natural height already clears the board")]
        public void CoveragePoolHalfHeight_DoesNotGrowBeyondNatural()
        {
            var half = M01FlashlightObservation.CoveragePoolHalfHeight(new CoveragePoolClampOptions
            {
                Center = new Point2(-60, -242),
                RadiusX = 140,
                NaturalHalfHeight = 10,
                Board = Board,
                Clearance = 6
            });
            Assert.Equal(10d, half);
        }

        [Fact(DisplayName = "suppresses the pool entirely when the center would sit at or above the board bottom")]
        public void CoveragePoolHalfHeight_SuppressesWhenCenterAtOrAboveBottom()
        {
            var half = M01FlashlightObservation.CoveragePoolHalfHeight(new CoveragePoolClampOptions
            {
                Center = new Point2(-60, -210),
                RadiusX = 140,
                NaturalHalfHeight = 48,
                Board = Board,
                Clearance = 6
            });
            Assert.Equal(0d, half);
        }
    }
}
