using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01RenderAssetManifestTests
    {
        private static readonly IReadOnlyDictionary<string, int> LemmyFrames =
            new Dictionary<string, int>
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

        private static string ProjectRoot => Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../../"));

        private static string ArtRoot => Path.Combine(
            ProjectRoot,
            "StarGuardian/Assets/Resources/Art/M01");

        [Fact]
        public void UnityContainsEveryLemmyActionAndAllSixHundredNinetySevenFrames()
        {
            var actual = Directory.GetDirectories(Path.Combine(ArtRoot, "lemmy"))
                .ToDictionary(
                    directory => Path.GetFileName(directory)!,
                    directory => Directory.GetFiles(directory, "*.png").Length,
                    StringComparer.Ordinal);

            Assert.Equal(LemmyFrames, actual);
            Assert.Equal(697, actual.Values.Sum());
        }

        [Fact]
        public void UnityLemmyFramesAreByteIdenticalToTheFrozenCocosSnapshot()
        {
            var root = Path.Combine(ArtRoot, "lemmy");
            var lines = Directory.GetFiles(root, "*.png", SearchOption.AllDirectories)
                .Where(path => Path.GetDirectoryName(path) != root)
                .Select(path => new
                {
                    Relative = "./" + Path.GetRelativePath(root, path).Replace('\\', '/'),
                    Path = path
                })
                .OrderBy(item => item.Relative, StringComparer.Ordinal)
                .Select(item => $"{Sha256File(item.Path)}  {item.Relative}\n");
            var aggregate = Sha256Text(string.Concat(lines));

            Assert.Equal("b5e19b1ed12b25391c66d3d1bbeaf3d3ffd4ebcc722a72f04c9cd78d70a2e304", aggregate);
        }

        [Fact]
        public void EveryLemmyFrameIsImportedWithHighQualityCompression()
        {
            var metas = Directory.GetFiles(Path.Combine(ArtRoot, "lemmy"), "*.png.meta", SearchOption.AllDirectories);

            Assert.Equal(697, metas.Length);
            Assert.All(metas, path => Assert.Contains("textureCompression: 2", File.ReadAllText(path)));
            Assert.Contains(
                "textureCompression: 0",
                File.ReadAllText(Path.Combine(ArtRoot, "m01-basket-hanging-empty.png.meta")));
        }

        [Fact]
        public void UnityRuntimeResourcesExcludeLemmyPreviewGifs()
        {
            var root = Path.Combine(ArtRoot, "lemmy");

            Assert.Empty(Directory.GetFiles(root, "*.gif", SearchOption.AllDirectories));
            Assert.Empty(Directory.GetFiles(root, "*.gif.meta", SearchOption.AllDirectories));
        }

        [Fact]
        public void ReferenceOnlyAssetsStayOutsideUnityRuntimeResources()
        {
            var referenceOnlyArt = new[]
            {
                "lemmy-canonical.png",
                "m01-fragment-floor-surface.png",
                "m01-evidence-green-triangle-hexagon.png",
                "m01-evidence-orange-hexagon-hexagon.png",
                "m01-evidence-purple-circle-triangle.png",
                "m01-evidence-purple-hexagon-circle.png",
                "m01-filter-red.png",
                "m01-filter-yellow.png",
                "m01-filter-blue.png"
            };
            Assert.All(referenceOnlyArt, filename =>
                Assert.False(File.Exists(Path.Combine(ArtRoot, filename)),
                    $"Reference-only art leaked into Unity Resources: {filename}"));

            var runtimeManifest = Path.Combine(
                ProjectRoot,
                "StarGuardian/Assets/Resources/Configs/m01-render-source-manifest.json");
            Assert.False(File.Exists(runtimeManifest));

            var frozenManifest = Path.Combine(
                ProjectRoot,
                "production/manifests/m01-render-source-manifest.json");
            Assert.True(File.Exists(frozenManifest), "Frozen source manifest must remain under production/manifests");
            using var manifest = JsonDocument.Parse(File.ReadAllText(frozenManifest));
            Assert.False(manifest.RootElement.TryGetProperty("sourceRepository", out _));

            var currentLayout = Path.Combine(
                ProjectRoot,
                "assets/resources/configs/stage1/m01-memory-gear.json");
            using var layout = JsonDocument.Parse(File.ReadAllText(currentLayout));
            Assert.False(layout.RootElement.TryGetProperty("filters", out _),
                "Removing legacy filter sprites is safe only while the authoritative layout has no filters");
        }

        [Theory]
        [InlineData("m01-fragment-light-mask-circle.png")]
        [InlineData("m01-fragment-light-mask-triangle.png")]
        [InlineData("m01-fragment-light-mask-hexagon.png")]
        [InlineData("m01-basket-front-occluder.png")]
        [InlineData("m01-basket-nail.png")]
        [InlineData("m01-rope-segment.png")]
        [InlineData("m01-target-reference-card.png")]
        [InlineData("m01-single-flashlight-tool.png")]
        [InlineData("m01-toolcard-preview-frame.png")]
        public void UnityContainsEveryPreviouslyMissingRuntimeSprite(string filename)
        {
            Assert.True(File.Exists(Path.Combine(ArtRoot, filename)), $"Missing Unity runtime sprite: {filename}");
        }

        [Fact]
        public void UnityContainsTheCurrentCompletionMediaByteForByte()
        {
            Assert.Equal(
                "a3bed8eb6ef7a9769e6007f064ae12f13d806287d13ed2f6ad9900793f869a23",
                Sha256File(Path.Combine(ProjectRoot, "StarGuardian/Assets/Resources/Videos/m01-completion-cutscene.mp4")));
            Assert.Equal(
                "3f1cdd2b35b9ad1084a9bd4b3dfb8ae73314cb2c2aa2278ee51e9efbb3da2c9d",
                Sha256File(Path.Combine(ArtRoot, "completion-audio.mp3")));
        }

        private static string Sha256File(string path)
        {
            using var stream = File.OpenRead(path);
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(stream)).ToLowerInvariant();
        }

        private static string Sha256Text(string text)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();
        }
    }
}
