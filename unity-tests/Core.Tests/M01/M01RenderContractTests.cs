using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01RenderContractTests
    {
        [Fact]
        public void DefinesAUnityIndependentRenderContract()
        {
            var contract = ContractType();

            Assert.NotNull(contract);
        }

        [Fact]
        public void PreservesCocosDesignAndDisplaySizesExactly()
        {
            Assert.Equal(960d, Number("DesignWidthPx"));
            Assert.Equal(640d, Number("DesignHeightPx"));
            Assert.Equal(100d, Number("PixelsPerUnit"));
            Assert.Equal(56d, Number("StandardPieceDisplayPx"));
            Assert.Equal(581d, Number("GearDisplayPx"));
            Assert.Equal(1.12d, Number("BasketScale"));
            Assert.Equal(387d * 1.12d, Number("BasketDisplayWidthPx"), 10);
            Assert.Equal(242d * 1.12d, Number("BasketDisplayHeightPx"), 10);
            Assert.Equal(960d, Number("GroundDisplayWidthPx"));
            Assert.Equal(39d, Number("GroundDisplayHeightPx"));
            Assert.Equal(-270d, Number("PhysicsGroundYPx"));
            Assert.Equal(62d, Number("HintDisplayPx"));
            Assert.Equal(180d, Number("LemmyDisplayPx"));
            Assert.Equal(0.854d, Number("LemmyCanonicalFitScale"));
            Assert.Equal(490d / 512d, Number("LemmyFrameFootFraction"), 12);
            Assert.Equal(960d, Number("CompletionWidthPx"));
            Assert.Equal(640d, Number("CompletionHeightPx"));
        }

        [Fact]
        public void PreservesAllEighteenLemmyActionsAndSixHundredNinetySevenFrames()
        {
            var expected = new Dictionary<string, int>
            {
                ["celebrate"] = 93,
                ["crouch"] = 40,
                ["earsback"] = 40,
                ["earsup"] = 38,
                ["headbutt"] = 124,
                ["headshake"] = 15,
                ["idle"] = 24,
                ["idleback"] = 19,
                ["nod"] = 44,
                ["nodside"] = 27,
                ["puzzled"] = 30,
                ["reach"] = 36,
                ["reachmiss"] = 40,
                ["startle"] = 29,
                ["startleback"] = 14,
                ["turnface"] = 24,
                ["walk"] = 48,
                ["walkback"] = 12
            };

            var actions = StaticMember("LemmyActions") as IEnumerable;
            Assert.NotNull(actions);

            var actual = actions!.Cast<object>().ToDictionary(
                item => (string)Property(item, "Id")!,
                item => Convert.ToInt32(Property(item, "FrameCount")));

            Assert.Equal(expected, actual);
            Assert.Equal(18, actual.Count);
            Assert.Equal(697, actual.Values.Sum());
        }

        [Fact]
        public void UsesCocosResourcePathsAsTheCanonicalSourceIds()
        {
            Assert.Equal(
                "art/stage1-m01/runtime-sprites/surfaces/m01-ground-line/spriteFrame",
                Text("GroundCocosResourcePath"));
            Assert.Equal(
                "art/icons/icon-hint/spriteFrame",
                Text("HintCocosResourcePath"));
            Assert.Equal(
                "art/stage1-m01/m01-completion-cutscene",
                Text("CompletionCocosResourcePath"));
            Assert.Equal(
                "Art/M01/lemmy",
                Text("LemmyUnityResourceRoot"));
        }

        private static Type ContractType() =>
            Type.GetType("StarGuardian.M01.Rendering.M01RenderContract, Core.Tests")
            ?? throw new Xunit.Sdk.XunitException("M01RenderContract is missing");

        private static object? StaticMember(string name)
        {
            var type = ContractType();
            return type.GetField(name, BindingFlags.Public | BindingFlags.Static)?.GetValue(null)
                   ?? type.GetProperty(name, BindingFlags.Public | BindingFlags.Static)?.GetValue(null);
        }

        private static double Number(string name) => Convert.ToDouble(
            StaticMember(name) ?? throw new Xunit.Sdk.XunitException($"Missing numeric member {name}"));

        private static string Text(string name) =>
            (string?)StaticMember(name) ?? throw new Xunit.Sdk.XunitException($"Missing text member {name}");

        private static object? Property(object instance, string name) =>
            instance.GetType().GetProperty(name, BindingFlags.Public | BindingFlags.Instance)?.GetValue(instance);
    }
}
