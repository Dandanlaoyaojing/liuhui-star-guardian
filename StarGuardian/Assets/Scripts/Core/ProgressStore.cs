// 进度存档模型 —— 引擎无关的纯逻辑, 从 assets/scripts/core/ProgressStore.ts 迁移, 规则不变.
// 存储后端抽象为 IKeyValueStorage(浏览器 localStorage / Unity PlayerPrefs 适配 / 内存均可),
// createMemoryStorage 保留为默认后端; JSON 读写用 Newtonsoft(JObject/JToken, 同 ToolCard.cs 样板).
// TS number(毫秒时间戳)→ C# long(与 ToolCard.UnlockedAt 一致); Record<string,T> → Dictionary.
#nullable enable

using System;
using System.Collections.Generic;
using System.Numerics;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace StarGuardian.Core
{
    /// <summary>键值存储后端 —— TS KeyValueStorage; getItem 缺省返回 null(string?)</summary>
    public interface IKeyValueStorage
    {
        string? GetItem(string key);
        void SetItem(string key, string value);
        void RemoveItem(string key);
    }

    /// <summary>TS PuzzleCompletionRecord</summary>
    public sealed class PuzzleCompletionRecord
    {
        public long CompletedAt { get; init; }
    }

    /// <summary>TS 的 { unlockedAt: number } 内联记录</summary>
    public sealed class ToolCardUnlockRecord
    {
        public long UnlockedAt { get; init; }
    }

    /// <summary>TS ProgressData —— Record&lt;string,T&gt; 落成 Dictionary</summary>
    public sealed class ProgressData
    {
        public Dictionary<string, PuzzleCompletionRecord> CompletedPuzzles { get; init; } = new();
        public Dictionary<string, ToolCardUnlockRecord> UnlockedToolCards { get; init; } = new();
    }

    /// <summary>TS ProgressStore 接口 —— 可选参数拆成重载, string|ToolCard 联合拆成两个重载</summary>
    public interface IProgressStore
    {
        ProgressData GetProgress();
        bool IsPuzzleCompleted(string puzzleId);
        void MarkPuzzleCompleted(string puzzleId);
        void MarkPuzzleCompleted(string puzzleId, long completedAt);
        bool HasToolCard(string puzzleId);
        void UnlockToolCard(string puzzleId);
        void UnlockToolCard(string puzzleId, long unlockedAt);
        void UnlockToolCard(ToolCard card);
        void Reset();
    }

    /// <summary>TS CreateProgressStoreOptions —— 全部可选; Storage 为 null 即用内存后端</summary>
    public sealed class CreateProgressStoreOptions
    {
        public IKeyValueStorage? Storage { get; init; }
        public string? StorageKey { get; init; }
        public Func<long>? Now { get; init; }
    }

    /// <summary>TS 顶层导出的工厂函数(createProgressStore / createMemoryStorage)落成 static 方法</summary>
    public static class ProgressStore
    {
        private const string DefaultStorageKey = "liuhui-star-guardian:progress:v1";

        public static IProgressStore CreateProgressStore(CreateProgressStoreOptions? options = null)
        {
            options ??= new CreateProgressStoreOptions();
            // TS: options.storage === undefined ? getDefaultStorage() : options.storage
            // C# 里 undefined 与 null 都落成 null; 非浏览器运行时 GetDefaultStorage() 恒为 null,
            // 故两种情形都回退到内存后端(与 TS 在非浏览器下的实际行为一致).
            var storage = options.Storage ?? GetDefaultStorage();
            var memoryStorage = storage ?? CreateMemoryStorage();
            var storageKey = options.StorageKey ?? DefaultStorageKey;
            var now = options.Now ?? DefaultNow;

            return new ProgressStoreImpl(memoryStorage, storageKey, now);
        }

        public static IKeyValueStorage CreateMemoryStorage(IReadOnlyDictionary<string, string>? initialValues = null)
        {
            return new MemoryStorage(initialValues);
        }

        // TS getDefaultStorage: globalThis.localStorage ?? null. C#/Unity 无环境级 localStorage → 恒 null.
        private static IKeyValueStorage? GetDefaultStorage() => null;

        // TS Date.now(): 毫秒时间戳(整数) → C# long
        private static long DefaultNow() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        private sealed class MemoryStorage : IKeyValueStorage
        {
            private readonly Dictionary<string, string> values = new();

            public MemoryStorage(IReadOnlyDictionary<string, string>? initialValues)
            {
                if (initialValues != null)
                {
                    foreach (var kv in initialValues)
                    {
                        values[kv.Key] = kv.Value;
                    }
                }
            }

            public string? GetItem(string key) => values.TryGetValue(key, out var v) ? v : null;

            public void SetItem(string key, string value) => values[key] = value;

            public void RemoveItem(string key) => values.Remove(key);
        }

        private sealed class ProgressStoreImpl : IProgressStore
        {
            private readonly IKeyValueStorage storage;
            private readonly string storageKey;
            private readonly Func<long> now;

            public ProgressStoreImpl(IKeyValueStorage storage, string storageKey, Func<long> now)
            {
                this.storage = storage;
                this.storageKey = storageKey;
                this.now = now;
            }

            public ProgressData GetProgress() => CloneProgress(ReadProgress());

            public bool IsPuzzleCompleted(string puzzleId) =>
                ReadProgress().CompletedPuzzles.ContainsKey(puzzleId);

            public void MarkPuzzleCompleted(string puzzleId) => MarkPuzzleCompleted(puzzleId, now());

            public void MarkPuzzleCompleted(string puzzleId, long completedAt)
            {
                var progress = ReadProgress();
                progress.CompletedPuzzles[puzzleId] = new PuzzleCompletionRecord { CompletedAt = completedAt };
                WriteProgress(progress);
            }

            public bool HasToolCard(string puzzleId) =>
                ReadProgress().UnlockedToolCards.ContainsKey(puzzleId);

            public void UnlockToolCard(string puzzleId) => UnlockToolCard(puzzleId, now());

            public void UnlockToolCard(string puzzleId, long unlockedAt)
            {
                var progress = ReadProgress();
                progress.UnlockedToolCards[puzzleId] = new ToolCardUnlockRecord { UnlockedAt = unlockedAt };
                WriteProgress(progress);
            }

            // TS 联合分支: 传卡时 puzzleId=card.puzzleId, 时间戳取 card.unlockedAt(忽略外部时间戳参数).
            public void UnlockToolCard(ToolCard card)
            {
                var progress = ReadProgress();
                progress.UnlockedToolCards[card.PuzzleId] = new ToolCardUnlockRecord { UnlockedAt = card.UnlockedAt };
                WriteProgress(progress);
            }

            public void Reset() => storage.RemoveItem(storageKey);

            private ProgressData ReadProgress()
            {
                var raw = storage.GetItem(storageKey);
                if (raw == null)
                {
                    return CreateEmptyProgress();
                }

                // TS: 只有 JSON.parse 会抛(非法串→空档); normalize 永不抛。故 try 只兜解析这一行,
                // 归一化移出 try —— 单条脏记录不再能借异常把整档清空(见 fable 审: bug 修复).
                JToken parsed;
                try
                {
                    parsed = JsonUtil.ParseStrict(raw); // 关 DateParseHandling: 日期样 key/值不被静默转 Date(fable 审)
                }
                catch
                {
                    return CreateEmptyProgress();
                }

                return NormalizeProgress(parsed);
            }

            private void WriteProgress(ProgressData progress)
            {
                var completed = new JObject();
                foreach (var kv in progress.CompletedPuzzles)
                {
                    completed[kv.Key] = new JObject { ["completedAt"] = kv.Value.CompletedAt };
                }

                var unlocked = new JObject();
                foreach (var kv in progress.UnlockedToolCards)
                {
                    unlocked[kv.Key] = new JObject { ["unlockedAt"] = kv.Value.UnlockedAt };
                }

                var root = new JObject
                {
                    ["completedPuzzles"] = completed,
                    ["unlockedToolCards"] = unlocked
                };

                storage.SetItem(storageKey, root.ToString(Formatting.None));
            }
        }

        private static ProgressData CreateEmptyProgress() => new();

        // TS normalizeProgress: 非对象一律回空; 逐字段做类型收敛过滤脏数据.
        private static ProgressData NormalizeProgress(JToken? value)
        {
            if (value is not JObject obj)
            {
                return CreateEmptyProgress();
            }

            return new ProgressData
            {
                CompletedPuzzles = NormalizeCompletionRecords(obj["completedPuzzles"]),
                UnlockedToolCards = NormalizeToolCardRecords(obj["unlockedToolCards"])
            };
        }

        private static Dictionary<string, PuzzleCompletionRecord> NormalizeCompletionRecords(JToken? value)
        {
            var records = new Dictionary<string, PuzzleCompletionRecord>();
            if (value is not JObject obj)
            {
                return records;
            }

            foreach (var prop in obj.Properties())
            {
                if (prop.Value is JObject record && TryGetLongMs(record["completedAt"], out var ms))
                {
                    records[prop.Name] = new PuzzleCompletionRecord { CompletedAt = ms };
                }
            }

            return records;
        }

        private static Dictionary<string, ToolCardUnlockRecord> NormalizeToolCardRecords(JToken? value)
        {
            var records = new Dictionary<string, ToolCardUnlockRecord>();
            if (value is not JObject obj)
            {
                return records;
            }

            foreach (var prop in obj.Properties())
            {
                if (prop.Value is JObject record && TryGetLongMs(record["unlockedAt"], out var ms))
                {
                    records[prop.Name] = new ToolCardUnlockRecord { UnlockedAt = ms };
                }
            }

            return records;
        }

        // TS cloneProgress: 浅拷贝两个字典(记录对象共享引用, 与 {...spread} 语义一致).
        private static ProgressData CloneProgress(ProgressData progress) => new()
        {
            CompletedPuzzles = new Dictionary<string, PuzzleCompletionRecord>(progress.CompletedPuzzles),
            UnlockedToolCards = new Dictionary<string, ToolCardUnlockRecord>(progress.UnlockedToolCards)
        };

        // TS normalizeProgress 永不抛、逐条打捞脏数据。时间戳恒为整数毫秒(Date.now), 故只接受落在 long
        // 范围内的整数 token: 浮点(避免 (long) 静默舍入固化)与超 long 范围的整数(避免 OverflowException
        // 被上层 catch-all 吞掉、把单条脏记录升级成"整档清空")一律当脏数据跳过 —— 保住其余记录,
        // 对齐 TS 的逐条打捞语义。永不抛。(fable 审: bug + float-round risk 一并修复)
        private static bool TryGetLongMs(JToken? token, out long result)
        {
            result = 0;
            if (token is not JValue { Type: JTokenType.Integer } jv)
            {
                return false;
            }

            switch (jv.Value)
            {
                case long l:
                    result = l;
                    return true;
                case int i:
                    result = i;
                    return true;
                case BigInteger big when big >= long.MinValue && big <= long.MaxValue:
                    result = (long)big;
                    return true;
                default:
                    return false;
            }
        }
    }
}
