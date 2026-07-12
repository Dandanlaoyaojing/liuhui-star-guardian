// 严格 JToken 解析 —— 复刻 JSON.parse 的关键点。
// 坑(fable 审在 M01ManualTargetPersistence 实测): Newtonsoft 默认 DateParseHandling.DateTime 会把 ISO-8601
// 样字符串静默转成 JTokenType.Date → 下游 "是字符串吗(Type==String)" 判定失败 → 该条记录被无声丢弃
// (TS JSON.parse 保留为字符串)。故读外部存档/JSON 字符串时统一走这里, 关掉日期识别。
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace StarGuardian.Core
{
    public static class JsonUtil
    {
        /// <summary>按 JSON.parse 语义读一个 JToken(不把日期样字符串转 Date)。非法输入抛(同 JToken.Parse, 调用方 try/catch)。</summary>
        public static JToken ParseStrict(string raw)
        {
            using var reader = new JsonTextReader(new StringReader(raw)) { DateParseHandling = DateParseHandling.None };
            return JToken.ReadFrom(reader);
        }
    }
}
