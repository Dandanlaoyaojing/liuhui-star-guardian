// M01「记忆齿轮」手动摆放草稿的本地存档读写 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性。
// 从 assets/scripts/cocos/M01ManualTargetPersistence.ts 迁移, 规则不变。
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里。
//
// 职责: 把玩家手动摆好的一批 M01ManualTargetPiecePlacement(复用 M01TargetPatternGenerator.cs 的下游 DTO)
//   序列化进 storage / 从 storage 读回并逐条校验剔除脏数据。存档后端抽象成 IM01ManualTargetStorage
//   (浏览器 localStorage / Unity PlayerPrefs 适配 / 内存均可)。
//
// TS→C# 语义映射:
//   - 导出常量 M01_MANUAL_TARGET_STORAGE_KEY → 静态类常量 StorageKey(值逐字保留)。
//   - 导出 interface M01ManualTargetStorage(getItem/setItem)→ IM01ManualTargetStorage(getItem 缺省 string?);
//     刻意保持与 TS 同形的最小两方法接口(不并入 Core.IKeyValueStorage 的三方法版, 免掉 TS 没有的 removeItem)。
//   - 导出自由函数 read.../write... → 静态类 M01ManualTargetPersistence 的 PascalCase 方法(去冗余前缀, 同
//     M01StandardPieceBlend/M01TargetPatternGenerator 先例): readM01ManualTargetPlacements → ReadPlacements,
//     writeM01ManualTargetPlacements → WritePlacements。
//   - JSON: 读用 Newtonsoft JToken(同 ProgressStore.cs 样板)手动跑 TS 的 isManualTargetPlacement/isRecord
//     类型守卫逐条打捞, 不走 DeserializeObject(否则 fragmentId=12 会被静默强转成 "12", 丢掉 TS 的剔除语义)。
//     JToken 属性索引器【大小写敏感】—— 与 TS `value.fragmentId`(JS 属性访问大小写敏感)逐字对齐, 故读取用
//     camelCase 键名; 写入亦用 CamelCasePropertyNamesContractResolver, 令存档 blob 与 TS JSON.stringify 同形,
//     读写内部一致方能 round-trip。
//   - NullValueHandling.Ignore: TS JSON.stringify 省略 undefined 的 rotation。若写成 "rotation":null, 读回时
//     rotation===null 既非 undefined 又非 number → 被守卫剔除(round-trip 丢片)—— 故序列化必须省略 null rotation。
//   - `!storage`(TS 对 null/undefined)→ C# storage == null; `!raw`(空串/null 皆 falsy)→ string.IsNullOrEmpty;
//     `JSON.parse` 抛 → 整个 try 兜底返 []; `!Array.isArray(parsed)` → parsed is not JArray。
//   - 校验守卫: typeof x === "string" → Type==String; isRecord(o) → o is JObject(数组/null/基元皆非);
//     typeof x === "number" → Type∈{Integer,Float}; rotation===undefined → 键缺省(索引器返 null / Undefined)。
#nullable enable

using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

namespace StarGuardian.M01
{
    /// <summary>草稿存档后端 —— TS interface M01ManualTargetStorage。getItem 缺省返回 null(string?)。</summary>
    public interface IM01ManualTargetStorage
    {
        string? GetItem(string key);
        void SetItem(string key, string value);
    }

    /// <summary>
    /// M01ManualTargetPersistence.ts 的导出常量 + 两个读写自由函数 + 私有校验守卫汇成静态类。语义一一对应。
    /// </summary>
    public static class M01ManualTargetPersistence
    {
        // TS: export const M01_MANUAL_TARGET_STORAGE_KEY = "liuhui-star-guardian:m01:manual-target-draft:v1"
        public const string StorageKey = "liuhui-star-guardian:m01:manual-target-draft:v1";

        // 写入设置: camelCase 键(对齐 TS JSON.stringify)+ 省略 null(= TS 省略 undefined 的 rotation)。
        private static readonly JsonSerializerSettings WriteSettings = new()
        {
            ContractResolver = new CamelCasePropertyNamesContractResolver(),
            NullValueHandling = NullValueHandling.Ignore,
            Formatting = Formatting.None
        };

        /// <summary>从 storage 读回手动摆放草稿, 逐条跑类型守卫剔除脏数据 —— TS readM01ManualTargetPlacements。</summary>
        public static IReadOnlyList<M01ManualTargetPiecePlacement> ReadPlacements(IM01ManualTargetStorage? storage)
        {
            // TS: if (!storage) return []
            if (storage == null)
            {
                return new List<M01ManualTargetPiecePlacement>();
            }

            try
            {
                var raw = storage.GetItem(StorageKey);
                // TS: if (!raw) return []（空串/null 皆 falsy）
                if (string.IsNullOrEmpty(raw))
                {
                    return new List<M01ManualTargetPiecePlacement>();
                }

                // TS: JSON.parse(raw)（非法串抛 → 落 catch 返 []）
                var parsed = StarGuardian.Core.JsonUtil.ParseStrict(raw); // 关 DateParseHandling: 日期样 fragmentId 不被静默转 Date→丢记录(fable 审实测 count=0)
                // TS: if (!Array.isArray(parsed)) return []
                if (parsed is not JArray array)
                {
                    return new List<M01ManualTargetPiecePlacement>();
                }

                // TS: parsed.filter(isManualTargetPlacement)
                var result = new List<M01ManualTargetPiecePlacement>();
                foreach (var element in array)
                {
                    if (TryReadManualTargetPlacement(element, out var placement))
                    {
                        result.Add(placement);
                    }
                }

                return result;
            }
            catch
            {
                // TS: catch → return []
                return new List<M01ManualTargetPiecePlacement>();
            }
        }

        /// <summary>把手动摆放草稿序列化进 storage —— TS writeM01ManualTargetPlacements。</summary>
        public static void WritePlacements(
            IM01ManualTargetStorage? storage,
            IReadOnlyList<M01ManualTargetPiecePlacement> placements)
        {
            // TS: if (!storage) return
            if (storage == null)
            {
                return;
            }

            // TS: storage.setItem(KEY, JSON.stringify(placements))
            storage.SetItem(StorageKey, JsonConvert.SerializeObject(placements, WriteSettings));
        }

        // TS: isManualTargetPlacement + isRecord 的合并实现。命中则同时投影出强类型 placement。
        private static bool TryReadManualTargetPlacement(JToken element, out M01ManualTargetPiecePlacement placement)
        {
            placement = null!;

            // TS: !isRecord(value) || typeof value.fragmentId !== "string"
            if (element is not JObject obj)
            {
                return false;
            }
            var fragmentIdToken = obj["fragmentId"];
            if (fragmentIdToken is not { Type: JTokenType.String })
            {
                return false;
            }

            // TS: !isRecord(value.position) || typeof value.position.x !== "number" || typeof value.position.y !== "number"
            if (obj["position"] is not JObject position)
            {
                return false;
            }
            var xToken = position["x"];
            var yToken = position["y"];
            if (!IsNumber(xToken) || !IsNumber(yToken))
            {
                return false;
            }

            // TS: value.rotation === undefined || typeof value.rotation === "number"
            //   缺省(索引器 null / Undefined)→ 可选缺省(Rotation=null); 数字 → 取值; 其余(含 JSON null)→ 剔除。
            var rotationToken = obj["rotation"];
            double? rotation;
            if (rotationToken == null || rotationToken.Type == JTokenType.Undefined)
            {
                rotation = null;
            }
            else if (IsNumber(rotationToken))
            {
                rotation = (double)rotationToken;
            }
            else
            {
                return false;
            }

            placement = new M01ManualTargetPiecePlacement
            {
                FragmentId = (string)fragmentIdToken!,
                Position = new M01StandardPieceBlendPoint((double)xToken!, (double)yToken!),
                Rotation = rotation
            };
            return true;
        }

        // TS: typeof x === "number" —— JSON 数字落 Integer/Float token。
        private static bool IsNumber(JToken? token) =>
            token is { Type: JTokenType.Integer } or { Type: JTokenType.Float };
    }
}
