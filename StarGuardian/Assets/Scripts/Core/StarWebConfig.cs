// M02《点亮你温暖我》配置类型与校验 —— 从 assets/scripts/core/StarWebConfig.ts 迁移, 规则不变.
// 校验风格仿 PuzzleConfig.cs(走 JToken, 成功后 ToObject 建强类型); 忽略 *_comment 说明字段.
// BoardGraphOf() 把一板拍平成 StarNetworkModel 可吃的图. 校验失败文案逐字保留 TS 原文.
// 边界处理已按 fable 对抗审修: Number.isInteger 等价(整值浮点算整)、可选串/prologue 的显式 null 判定、
// toolCard 走类型严格 JToken 校验(不经 ToObject 强转洗类型)、所有数值裸转换成安全取值(校验器永不抛)。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace StarGuardian.Core
{
    /// <summary>TS StarWebMechanic extends StarNetworkRules —— C# 无法继承 struct, 用隐式转换补上"是一个 rules"。</summary>
    public sealed class StarWebMechanic
    {
        public int LifeMax { get; init; }
        public int FreezeThreshold { get; init; }
        public string BeatModel { get; init; } = "";
        public bool TapLightsNeighbors { get; init; }
        public bool WinRequiresAllFrozen { get; init; }

        // TS 里 mechanic 因结构化类型可直接当 StarNetworkRules 传给模型; C# 用隐式转换忠实还原这一用法。
        public static implicit operator StarNetworkRules(StarWebMechanic m) =>
            new() { LifeMax = m.LifeMax, FreezeThreshold = m.FreezeThreshold };
    }

    public sealed class StarNodeLayout
    {
        public string Id { get; init; } = "";
        public double X { get; init; }
        public double Y { get; init; }
    }

    public sealed class StarBoardLayout
    {
        public List<StarNodeLayout> Nodes { get; init; } = new();
        // TS edges: [string,string][] → JSON 里是 [["a","b"],...], 落成 List<List<string>>(每条两元素)。
        public List<List<string>> Edges { get; init; } = new();
    }

    public sealed class StarBoardSolution
    {
        public List<string> ReferenceTaps { get; init; } = new();
        public string? Teaches { get; init; }
    }

    public sealed class StarBoard
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public int Charges { get; init; }
        public StarBoardLayout Layout { get; init; } = new();
        public StarBoardSolution Solution { get; init; } = new();
    }

    public sealed class PrologueEmber
    {
        public string Id { get; init; } = "";
        public double X { get; init; }
        public double Y { get; init; }
        public int InitialLife { get; init; }
    }

    public sealed class StarWebWand
    {
        public double X { get; init; }
        public double Y { get; init; }
    }

    /// <summary>开场序章「三颗余烬点棒」配置(spec §5.3)。规则复用 mechanic 的 lifeMax/freezeThreshold。</summary>
    public sealed class StarWebPrologue
    {
        public double BeatSeconds { get; init; }
        public double AdjacencyRadius { get; init; }
        public int RekindleBeats { get; init; }
        public StarWebWand Wand { get; init; } = new();
        public double WandDipRadius { get; init; }
        public List<PrologueEmber> Embers { get; init; } = new();
    }

    public sealed class StarWebConfig
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public int Stage { get; init; }
        public string CognitiveSkill { get; init; } = "";
        public string WisdomCrystal { get; init; } = "";
        public string? Description { get; init; }
        public ToolCardDraft ToolCard { get; init; } = new();
        public StarWebMechanic Mechanic { get; init; } = new();
        public StarWebPrologue? Prologue { get; init; }
        public List<StarBoard> Boards { get; init; } = new();
    }

    /// <summary>TS 顶层导出的 boardGraph / validateStarWebConfig 落成静态类方法(同 PuzzleConfigValidator 样板)。</summary>
    public static class StarWebConfigValidator
    {
        /// <summary>从一板取出 StarNetworkModel 需要的邻接图(TS boardGraph)。命名带 Of 避免与 BoardGraph 类型撞名。</summary>
        public static BoardGraph BoardGraphOf(StarBoard board) =>
            new(board.Layout.Nodes.Select(n => n.Id),
                board.Layout.Edges.Select(e => (e[0], e[1])));

        public static ValidationResult<StarWebConfig> Validate(JToken? value)
        {
            if (value is not JObject obj)
            {
                return ValidationResult<StarWebConfig>.Failure(new[] { "config must be an object" });
            }

            var errors = new List<string>();

            RequireNonEmptyString(obj, "id", errors);
            RequireNonEmptyString(obj, "name", errors);
            RequirePositiveInteger(obj, "stage", errors);
            RequireNonEmptyString(obj, "cognitiveSkill", errors);
            RequireNonEmptyString(obj, "wisdomCrystal", errors);
            RequireOptionalString(obj, "description", errors);

            ValidateToolCardDraft(obj["toolCard"], errors);
            ValidateToolCardMatchesConfig(obj, errors);
            ValidateMechanic(obj["mechanic"], errors);
            ValidatePrologue(obj["prologue"], obj["mechanic"], errors);
            ValidateBoards(obj["boards"], errors);

            if (errors.Count > 0)
            {
                return ValidationResult<StarWebConfig>.Failure(errors);
            }

            // TS: `return { ok: true, value: value as unknown as StarWebConfig }`(零成本断言)。C# 校验已保证形状,
            // 反序列化成强类型; 但极端数值(如 lifeMax=2^32+1)落不进 int 字段会抛 → 折成 Failure, 保"校验器永不抛"。
            try
            {
                var config = obj.ToObject<StarWebConfig>() ?? new StarWebConfig();
                return ValidationResult<StarWebConfig>.Success(config);
            }
            catch
            {
                return ValidationResult<StarWebConfig>.Failure(new[] { "config could not be materialized" });
            }
        }

        private static void ValidateToolCardDraft(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("toolCard must be an object");
                return;
            }

            // TS: validateToolCard(createToolCard(draft, 0)) —— 对原始 JObject(补 unlockedAt=0)跑类型严格的 JToken
            // 校验器。别先 ToObject<ToolCardDraft>: Newtonsoft 宽松强转会把 stage=2.5→2、"1"→1、123→"123" 洗成
            // 合法, 提前放行烂数据(fable 审 bug)。
            try
            {
                var draft = (JObject)obj.DeepClone();
                draft["unlockedAt"] = 0;
                var result = ToolCardFactory.Validate(draft);
                if (!result.Ok)
                {
                    foreach (var error in result.Errors)
                    {
                        errors.Add($"toolCard.{error}");
                    }
                }
            }
            catch
            {
                errors.Add("toolCard must be a valid tool card draft");
            }
        }

        private static void ValidateToolCardMatchesConfig(JObject config, List<string> errors)
        {
            if (config["toolCard"] is not JObject toolCard)
            {
                return;
            }

            if (IsNonEmptyString(config["id"]) && IsNonEmptyString(toolCard["puzzleId"]) &&
                (string?)toolCard["puzzleId"] != (string?)config["id"])
            {
                errors.Add("toolCard.puzzleId must match id");
            }
            if (IsPositiveInteger(config["stage"]) && IsPositiveInteger(toolCard["stage"]))
            {
                TryGetFiniteNumber(config["stage"], out var configStage);
                TryGetFiniteNumber(toolCard["stage"], out var cardStage);
                if (cardStage != configStage)
                {
                    errors.Add("toolCard.stage must match stage");
                }
            }
            if (toolCard["front"] is not JObject front || !IsNonEmptyString(config["wisdomCrystal"]))
            {
                return;
            }
            if (IsNonEmptyString(front["wisdomCrystal"]) &&
                (string?)front["wisdomCrystal"] != (string?)config["wisdomCrystal"])
            {
                errors.Add("toolCard.front.wisdomCrystal must match wisdomCrystal");
            }
        }

        private static void ValidateMechanic(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("mechanic must be an object");
                return;
            }
            RequirePositiveInteger(obj, "lifeMax", errors, "mechanic.lifeMax");
            RequirePositiveInteger(obj, "freezeThreshold", errors, "mechanic.freezeThreshold");
            // 这三个 flag 描述 StarNetworkModel 当前唯一实现的语义, 强制等于受支持值, 避免声明与实现静默分歧。
            // beatModel 先判 String 再取值: 若为对象/数组, TS `!== "turn"` 为真→报错; C# 裸 (string?) 会抛(fable 审)。
            var beatModel = obj["beatModel"];
            if (beatModel?.Type != JTokenType.String || (string?)beatModel != "turn")
            {
                errors.Add("mechanic.beatModel must be \"turn\" (仅支持回合制)");
            }
            if (obj["tapLightsNeighbors"]?.Type != JTokenType.Boolean || (bool)obj["tapLightsNeighbors"]! != true)
            {
                errors.Add("mechanic.tapLightsNeighbors must be true (model 恒点亮邻居)");
            }
            if (obj["winRequiresAllFrozen"]?.Type != JTokenType.Boolean || (bool)obj["winRequiresAllFrozen"]! != true)
            {
                errors.Add("mechanic.winRequiresAllFrozen must be true (model 胜利判定=整网自锁)");
            }
        }

        // 序章可选; 存在则整段校验。数值边界外还锁两条设计不变量: 开局不得预成簇、余烬数必须够冻结。
        private static void ValidatePrologue(JToken? value, JToken? mechanic, List<string> errors)
        {
            if (value is null)
            {
                return; // TS: value === undefined(键缺失)→ 跳过
            }
            if (value is not JObject obj)
            {
                // 显式 null 也落到这: TS isRecord(null)=false → "prologue must be an object"(fable 审 bug)。
                errors.Add("prologue must be an object");
                return;
            }
            RequirePositiveNumber(obj, "beatSeconds", errors, "prologue.beatSeconds");
            RequirePositiveNumber(obj, "adjacencyRadius", errors, "prologue.adjacencyRadius");
            RequirePositiveNumber(obj, "wandDipRadius", errors, "prologue.wandDipRadius");
            RequirePositiveInteger(obj, "rekindleBeats", errors, "prologue.rekindleBeats");

            if (obj["wand"] is not JObject wand || !IsFiniteNumber(wand["x"]) || !IsFiniteNumber(wand["y"]))
            {
                errors.Add("prologue.wand must be an object with finite x/y");
            }

            var mechanicObj = mechanic as JObject;
            double? lifeMax = null;
            if (mechanicObj != null && IsPositiveInteger(mechanicObj["lifeMax"]))
            {
                TryGetFiniteNumber(mechanicObj["lifeMax"], out var lm);
                lifeMax = lm;
            }
            double? freezeThreshold = null;
            if (mechanicObj != null && IsPositiveInteger(mechanicObj["freezeThreshold"]))
            {
                TryGetFiniteNumber(mechanicObj["freezeThreshold"], out var ft);
                freezeThreshold = ft;
            }

            if (obj["embers"] is not JArray embers || embers.Count == 0)
            {
                errors.Add("prologue.embers must be a non-empty array");
                return;
            }
            var ids = new HashSet<string>();
            var positions = new List<(double X, double Y)>();
            for (var i = 0; i < embers.Count; i++)
            {
                var ember = embers[i];
                var path = $"prologue.embers[{i}]";
                if (ember is not JObject emberObj)
                {
                    errors.Add($"{path} must be an object");
                    continue;
                }
                if (!IsNonEmptyString(emberObj["id"]))
                {
                    errors.Add($"{path}.id must be a non-empty string");
                }
                else if (ids.Contains((string)emberObj["id"]!))
                {
                    errors.Add($"{path}.id \"{(string)emberObj["id"]!}\" is duplicated");
                }
                else
                {
                    ids.Add((string)emberObj["id"]!);
                }
                if (!IsFiniteNumber(emberObj["x"])) errors.Add($"{path}.x must be a finite number");
                if (!IsFiniteNumber(emberObj["y"])) errors.Add($"{path}.y must be a finite number");
                RequirePositiveInteger(emberObj, "initialLife", errors, $"{path}.initialLife");
                if (lifeMax != null && IsPositiveInteger(emberObj["initialLife"]))
                {
                    TryGetFiniteNumber(emberObj["initialLife"], out var il);
                    if (il > lifeMax)
                    {
                        errors.Add($"{path}.initialLife must be <= mechanic.lifeMax ({lifeMax})");
                    }
                }
                if (IsFiniteNumber(emberObj["x"]) && IsFiniteNumber(emberObj["y"]))
                {
                    TryGetFiniteNumber(emberObj["x"], out var ex);
                    TryGetFiniteNumber(emberObj["y"], out var ey);
                    positions.Add((ex, ey));
                }
            }

            // 余烬数不够 freezeThreshold+1 → 序章永远冻结不了 = 软锁; 开局预成簇则"三颗成簇长明"的顿悟被白送。
            if (freezeThreshold != null && embers.Count < freezeThreshold.Value + 1)
            {
                errors.Add($"prologue.embers must have at least freezeThreshold+1 ({freezeThreshold.Value + 1}) embers");
            }
            if (IsFiniteNumber(obj["adjacencyRadius"]) && positions.Count == embers.Count)
            {
                TryGetFiniteNumber(obj["adjacencyRadius"], out var adjacencyRadius);
                for (var i = 0; i < positions.Count; i++)
                {
                    for (var j = i + 1; j < positions.Count; j++)
                    {
                        var distance = Math.Sqrt(
                            Math.Pow(positions[i].X - positions[j].X, 2) + Math.Pow(positions[i].Y - positions[j].Y, 2));
                        if (distance <= adjacencyRadius)
                        {
                            errors.Add($"prologue.embers[{i}] and prologue.embers[{j}] start within adjacencyRadius (开局不得预成簇)");
                        }
                    }
                }
            }
        }

        private static void ValidateBoards(JToken? value, List<string> errors)
        {
            if (value is not JArray boards || boards.Count == 0)
            {
                errors.Add("boards must be a non-empty array");
                return;
            }
            var ids = new HashSet<string>();
            for (var index = 0; index < boards.Count; index++)
            {
                var board = boards[index];
                ValidateBoard(board, index, errors);
                if (board is not JObject boardObj || !IsNonEmptyString(boardObj["id"])) continue;
                var id = (string)boardObj["id"]!;
                if (ids.Contains(id))
                {
                    errors.Add($"boards[{index}].id \"{id}\" is duplicated");
                }
                else
                {
                    ids.Add(id);
                }
            }
        }

        private static void ValidateBoard(JToken? value, int index, List<string> errors)
        {
            var path = $"boards[{index}]";
            if (value is not JObject obj)
            {
                errors.Add($"{path} must be an object");
                return;
            }
            RequireNonEmptyString(obj, "id", errors, $"{path}.id");
            RequireNonEmptyString(obj, "name", errors, $"{path}.name");
            RequirePositiveInteger(obj, "charges", errors, $"{path}.charges");

            var nodeIds = ValidateLayout(obj["layout"], $"{path}.layout", errors);
            ValidateSolution(obj["solution"], $"{path}.solution", nodeIds, errors);
        }

        // 校验 layout 并返回节点 id 集合(供 edges / solution 交叉校验)
        private static HashSet<string> ValidateLayout(JToken? value, string path, List<string> errors)
        {
            var ids = new HashSet<string>();
            if (value is not JObject obj)
            {
                errors.Add($"{path} must be an object");
                return ids;
            }

            if (obj["nodes"] is not JArray nodes || nodes.Count == 0)
            {
                errors.Add($"{path}.nodes must be a non-empty array");
            }
            else
            {
                for (var i = 0; i < nodes.Count; i++)
                {
                    var nodePath = $"{path}.nodes[{i}]";
                    if (nodes[i] is not JObject node)
                    {
                        errors.Add($"{nodePath} must be an object");
                        continue;
                    }
                    if (!IsNonEmptyString(node["id"]))
                    {
                        errors.Add($"{nodePath}.id must be a non-empty string");
                    }
                    else if (ids.Contains((string)node["id"]!))
                    {
                        errors.Add($"{nodePath}.id \"{(string)node["id"]!}\" is duplicated");
                    }
                    else
                    {
                        ids.Add((string)node["id"]!);
                    }
                    if (!IsFiniteNumber(node["x"])) errors.Add($"{nodePath}.x must be a finite number");
                    if (!IsFiniteNumber(node["y"])) errors.Add($"{nodePath}.y must be a finite number");
                }
            }

            if (obj["edges"] is not JArray edges)
            {
                errors.Add($"{path}.edges must be an array");
            }
            else
            {
                // 拒绝自环与重复/镜像边: 让"一条无向边=一次邻接"成为配置层硬保证, 消费方不会因重复计数误判冻结。
                var seenEdges = new HashSet<string>();
                for (var i = 0; i < edges.Count; i++)
                {
                    var edgePath = $"{path}.edges[{i}]";
                    if (edges[i] is not JArray edge || edge.Count != 2 ||
                        !IsNonEmptyString(edge[0]) || !IsNonEmptyString(edge[1]))
                    {
                        errors.Add($"{edgePath} must be a [nodeId, nodeId] pair");
                        continue;
                    }
                    var a = (string)edge[0]!;
                    var b = (string)edge[1]!;
                    foreach (var endpoint in new[] { a, b })
                    {
                        if (ids.Count > 0 && !ids.Contains(endpoint))
                        {
                            errors.Add($"{edgePath} references unknown node \"{endpoint}\"");
                        }
                    }
                    if (a == b)
                    {
                        errors.Add($"{edgePath} must not be a self-loop");
                        continue;
                    }
                    var sorted = new[] { a, b };
                    Array.Sort(sorted, StringComparer.Ordinal);
                    // 键 = JSON.stringify(sort()) 的等价物, 忠实对齐 TS 且可读(旧写法用不可见分隔符, 后人易误改)。
                    var key = new JArray(sorted[0], sorted[1]).ToString(Newtonsoft.Json.Formatting.None);
                    if (seenEdges.Contains(key))
                    {
                        errors.Add($"{edgePath} duplicates edge {a}-{b}");
                    }
                    else
                    {
                        seenEdges.Add(key);
                    }
                }
            }
            return ids;
        }

        private static void ValidateSolution(JToken? value, string path, HashSet<string> nodeIds, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add($"{path} must be an object");
                return;
            }
            RequireOptionalString(obj, "teaches", errors, $"{path}.teaches");
            if (obj["referenceTaps"] is not JArray taps || taps.Count == 0 || !taps.All(t => IsNonEmptyString(t)))
            {
                errors.Add($"{path}.referenceTaps must be a non-empty string array");
                return;
            }
            for (var i = 0; i < taps.Count; i++)
            {
                var tap = (string)taps[i]!;
                if (nodeIds.Count > 0 && !nodeIds.Contains(tap))
                {
                    errors.Add($"{path}.referenceTaps[{i}] references unknown node \"{tap}\"");
                }
            }
        }

        private static void RequireNonEmptyString(JObject obj, string key, List<string> errors, string? path = null)
        {
            if (!IsNonEmptyString(obj[key])) errors.Add($"{path ?? key} must be a non-empty string");
        }

        // TS: `record[key] !== undefined && typeof !== "string"` —— 显式 null 是"已定义且非串"→ 报错(别多排 Null)。
        private static void RequireOptionalString(JObject obj, string key, List<string> errors, string? path = null)
        {
            var token = obj[key];
            if (token != null && token.Type != JTokenType.String)
            {
                errors.Add($"{path ?? key} must be a string");
            }
        }

        private static void RequirePositiveInteger(JObject obj, string key, List<string> errors, string? path = null)
        {
            if (!IsPositiveInteger(obj[key])) errors.Add($"{path ?? key} must be a positive integer");
        }

        private static void RequirePositiveNumber(JObject obj, string key, List<string> errors, string? path = null)
        {
            if (!TryGetFiniteNumber(obj[key], out var v) || v <= 0) errors.Add($"{path ?? key} must be a positive number");
        }

        private static bool IsFiniteNumber(JToken? token) => TryGetFiniteNumber(token, out _);

        // Number.isInteger 等价: 值为整的浮点(JSON 里的 1.0)也算整数(修 fable 审: 原只认 JTokenType.Integer 会拒 1.0)。
        private static bool IsPositiveInteger(JToken? token) =>
            TryGetFiniteNumber(token, out var v) && Math.Floor(v) == v && v >= 1;

        // 安全取有限数(Integer/Float 均可); 用 Value<double> 承接, 避免超 long 的 BigInteger 裸 (long) 转抛 OverflowException。
        private static bool TryGetFiniteNumber(JToken? token, out double value)
        {
            value = 0;
            if (token is null) return false;
            if (token.Type != JTokenType.Integer && token.Type != JTokenType.Float) return false;
            value = token.Value<double>();
            return double.IsFinite(value);
        }

        private static bool IsNonEmptyString(JToken? token) =>
            token is { Type: JTokenType.String } && !string.IsNullOrWhiteSpace((string?)token);
    }
}
