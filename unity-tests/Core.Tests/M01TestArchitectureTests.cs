using System;
using System.IO;
using System.Linq;
using Xunit;

namespace StarGuardian.Tests
{
    public sealed class M01TestArchitectureTests
    {
        [Fact(DisplayName = "xUnit M01 tests do not claim Unity behavior by reading production C# source text")]
        public void DoesNotReadUnityGlueSourceAsText()
        {
            var testRoot = Path.Combine(ProjectRoot, "unity-tests/Core.Tests");
            var thisFile = nameof(M01TestArchitectureTests) + ".cs";
            var forbiddenMarkers = new[]
            {
                "ReadRepoFile(",
                "Assets/GlowProbe/",
                "Assets/Editor/"
            };
            var offenders = Directory.GetFiles(testRoot, "*.cs", SearchOption.AllDirectories)
                .Where(path => Path.GetFileName(path) != thisFile)
                .Where(path =>
                {
                    var source = File.ReadAllText(path);
                    return forbiddenMarkers.Any(marker => source.Contains(marker, StringComparison.Ordinal));
                })
                .Select(path => Path.GetRelativePath(ProjectRoot, path))
                .ToArray();

            Assert.Empty(offenders);
        }

        private static string ProjectRoot => Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../../"));
    }
}
