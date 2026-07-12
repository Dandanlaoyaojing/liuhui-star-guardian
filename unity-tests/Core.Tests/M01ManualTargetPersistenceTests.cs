// 从 tests/cocos/M01ManualTargetPersistence.test.ts 逐条迁移 —— 规则不变, 断言一一对应。
// vitest 原有 2 条 it; 本文件 2 条 [Fact] 一一对应, DisplayName 保原描述。
// 测试内的 MemoryStorage 复刻 TS 测试里的同名内存实现(只 getItem/setItem, 对齐 IM01ManualTargetStorage)。
using System.Collections.Generic;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01ManualTargetPersistenceTests
    {
        [Fact(DisplayName = "round-trips manual target placements through storage")]
        public void RoundTripsManualTargetPlacementsThroughStorage()
        {
            var storage = new MemoryStorage();

            M01ManualTargetPersistence.WritePlacements(storage, new[]
            {
                new M01ManualTargetPiecePlacement
                {
                    FragmentId = "fragment_circle_red_1",
                    Position = new(-12.5, 34),
                    Rotation = 90
                }
            });

            // expect(storage.getItem(KEY)).toContain("fragment_circle_red_1")
            Assert.Contains("fragment_circle_red_1", storage.GetItem(M01ManualTargetPersistence.StorageKey)!);

            // expect(read(storage)).toEqual([{ fragmentId, position: { x, y }, rotation }])
            var placements = M01ManualTargetPersistence.ReadPlacements(storage);
            Assert.Single(placements);
            var placement = placements[0];
            Assert.Equal("fragment_circle_red_1", placement.FragmentId);
            Assert.Equal(-12.5, placement.Position.X);
            Assert.Equal(34.0, placement.Position.Y);
            Assert.Equal(90.0, placement.Rotation);
        }

        [Fact(DisplayName = "ignores missing or malformed saved placements")]
        public void IgnoresMissingOrMalformedSavedPlacements()
        {
            var storage = new MemoryStorage();

            // expect(read(storage)).toEqual([])  —— 空存档
            Assert.Empty(M01ManualTargetPersistence.ReadPlacements(storage));

            // storage.setItem(KEY, JSON.stringify([{ fragmentId: 12 }])) —— fragmentId 非字符串 → 剔除
            storage.SetItem(M01ManualTargetPersistence.StorageKey, "[{\"fragmentId\":12}]");
            Assert.Empty(M01ManualTargetPersistence.ReadPlacements(storage));

            // storage.setItem(KEY, "not json") —— 解析抛 → 返 []
            storage.SetItem(M01ManualTargetPersistence.StorageKey, "not json");
            Assert.Empty(M01ManualTargetPersistence.ReadPlacements(storage));
        }

        // TS 测试里的 MemoryStorage: 私有 Map<string,string>, getItem 缺省返回 null。
        private sealed class MemoryStorage : IM01ManualTargetStorage
        {
            private readonly Dictionary<string, string> values = new();

            public string? GetItem(string key) => values.TryGetValue(key, out var v) ? v : null;

            public void SetItem(string key, string value) => values[key] = value;
        }
    }
}
