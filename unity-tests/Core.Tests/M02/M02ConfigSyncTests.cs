using System.IO;
using Xunit;

namespace StarGuardian.M02.Tests
{
    /// <summary>
    /// 双源一致性: Cocos 树(assets/resources/configs)与 Unity 运行时(StarGuardian/Assets/Resources/Configs)
    /// 各持一份 config, CLAUDE.md 要求"改配置两处同步直至 Cocos 树退役"。测试逐字节钉住,
    /// 防止一侧改动后静默漂移(codex 审查 P1: 测试读 Cocos 份而运行时读 Unity 份, 漂移无人发现)。
    /// </summary>
    public sealed class M02ConfigSyncTests
    {
        [Theory(DisplayName = "Cocos and Unity runtime configs stay byte-identical until the Cocos tree retires")]
        [InlineData("assets/resources/configs/stage1/m02-starweb-warmth.json",
            "StarGuardian/Assets/Resources/Configs/m02-starweb-warmth.json")]
        [InlineData("assets/resources/configs/stage1/m01-memory-gear.json",
            "StarGuardian/Assets/Resources/Configs/m01-memory-gear.json")]
        public void RuntimeConfigMatchesCocosSource(string cocosRelative, string unityRelative)
        {
            var root = FindRepoRoot();
            var cocos = File.ReadAllBytes(Path.Combine(root, cocosRelative));
            var unity = File.ReadAllBytes(Path.Combine(root, unityRelative));
            Assert.Equal(cocos, unity);
        }

        private static string FindRepoRoot()
        {
            var dir = new DirectoryInfo(System.AppContext.BaseDirectory);
            while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "StarGuardian")))
            {
                dir = dir.Parent;
            }
            Assert.NotNull(dir);
            return dir!.FullName;
        }
    }
}
