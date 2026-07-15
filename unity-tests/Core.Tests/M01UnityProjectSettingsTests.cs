using System;
using System.Globalization;
using System.IO;
using System.Linq;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.Tests
{
    public sealed class M01UnityProjectSettingsTests
    {
        [Fact(DisplayName = "Unity Physics2D project setting uses the Cocos fixed step")]
        public void UsesCocosFixedPhysicsStep()
        {
            var path = Path.Combine(ProjectRoot, "StarGuardian/ProjectSettings/TimeManager.asset");
            var setting = File.ReadLines(path)
                .Select(line => line.Trim())
                .Single(line => line.StartsWith("Fixed Timestep:", StringComparison.Ordinal));
            var value = double.Parse(
                setting.Substring(setting.IndexOf(':') + 1),
                CultureInfo.InvariantCulture);

            Assert.Equal(M01IntroLayout.CocosPhysicsFixedStepSeconds, value, 8);
        }

        private static string ProjectRoot => Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../../../"));
    }
}
