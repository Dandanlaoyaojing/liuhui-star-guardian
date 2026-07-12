// 从 tests/cocos/m01LegacySortConfig.ts 迁移 —— 旧「按色形归类」谜题夹具(无手电/无交叠证据),
// 供 M01GreyboxSessionTests 的 legacy 分支用例复用。数据逐字对齐 TS 生成逻辑(颜色/形状/坐标/容量)。
//
// TS→C# 说明:
//   - colors=["red","blue","yellow"](注: 非 red/yellow/blue)/ shapes=["circle","triangle","hexagon"]。
//   - fragments: colors.flatMap(shapes.flatMap([1,2].map(...))); index = ci*6 + si*2 + copy-1 索引进 fragmentPositions。
//     legacy 碎片只有 color/shape(可见), 无 hiddenColor/edgeShape(C# 默认空串, legacy 分支不消费)。
//   - slots: 每 (color,shape) 一槽, capacity 2, position {x:(ci-1)*120, y:40-si*40}。
//   - goal 在 TS 是 { type:"all_sorted", params:{dimensions,colors,shapes} }; C# 侧只留 Type(Session/Controller 的
//     legacy 路径不读 goal.params.validationLightSeconds —— 无 evidence 不会走验证)。
#nullable enable

using System.Collections.Generic;
using StarGuardian.Core;

namespace StarGuardian.M01.Tests
{
    internal static class M01LegacySortConfig
    {
        private static readonly string[] Colors = { "red", "blue", "yellow" };
        private static readonly string[] Shapes = { "circle", "triangle", "hexagon" };

        private static readonly (double X, double Y)[] FragmentPositions =
        {
            (-360, 210), (-300, 170), (-240, 210), (-180, 170), (-360, -150), (-300, -190),
            (-80, 210), (-20, 170), (40, 210), (100, 170), (-80, -150), (-20, -190),
            (180, 210), (240, 170), (300, 210), (360, 170), (180, -150), (240, -190)
        };

        public static M01MemoryGearConfig Build()
        {
            var filters = new List<M01FilterDef>();
            foreach (var color in Colors)
            {
                filters.Add(new M01FilterDef { Id = $"filter_{color}", Color = color });
            }

            var fragments = new List<M01CandidateFragmentDef>();
            for (var colorIndex = 0; colorIndex < Colors.Length; colorIndex += 1)
            {
                var color = Colors[colorIndex];
                for (var shapeIndex = 0; shapeIndex < Shapes.Length; shapeIndex += 1)
                {
                    var shape = Shapes[shapeIndex];
                    foreach (var copy in new[] { 1, 2 })
                    {
                        var index = colorIndex * Shapes.Length * 2 + shapeIndex * 2 + copy - 1;
                        var position = FragmentPositions[index];
                        fragments.Add(new M01CandidateFragmentDef
                        {
                            Id = $"fragment_{color}_{shape}_{copy}",
                            Color = color,
                            Shape = shape,
                            Position = new Vec2Def { X = position.X, Y = position.Y },
                            Tags = new List<string> { "fragment", color, shape }
                        });
                    }
                }
            }

            var slots = new List<M01SlotDef>();
            for (var colorIndex = 0; colorIndex < Colors.Length; colorIndex += 1)
            {
                var color = Colors[colorIndex];
                for (var shapeIndex = 0; shapeIndex < Shapes.Length; shapeIndex += 1)
                {
                    var shape = Shapes[shapeIndex];
                    slots.Add(new M01SlotDef
                    {
                        Id = $"slot_{color}_{shape}",
                        Accepts = new M01SlotAcceptsDef { Color = color, Shape = shape },
                        Capacity = 2,
                        Position = new Vec2Def { X = (colorIndex - 1) * 120, Y = 40 - shapeIndex * 40 },
                        Tags = new List<string> { "slot", color, shape }
                    });
                }
            }

            return new M01MemoryGearConfig
            {
                Id = "m01",
                Name = "记忆齿轮的卡顿",
                Stage = 1,
                CognitiveSkill = "分类与归纳",
                WisdomCrystal = "秩序，是为相似之物找到归处。",
                Colors = new List<string>(Colors),
                Filters = filters,
                Fragments = fragments,
                Slots = slots,
                Goal = new M01GoalDef { Type = "all_sorted" },
                ToolCard = new ToolCardDraft
                {
                    PuzzleId = "m01",
                    Stage = 1,
                    Front = new ToolCardFront
                    {
                        ToolName = "分类与归纳",
                        Scene = "stage1/m01/toolcards/classification-thumbnail",
                        WisdomCrystal = "秩序，是为相似之物找到归处。"
                    },
                    Back = new ToolCardBack
                    {
                        CoreAction = "在杂乱事物中找到共同属性，按属性归组。",
                        WhenToUse = new List<string> { "整理一堆笔记不知从何下手时" },
                        RealLifeExamples = new List<string> { "整理书架：按主题、作者或使用频率归位" },
                        CommonTraps = "分类维度选错会制造假秩序；关键不是怎么分最漂亮，而是这次分类要服务什么目的。"
                    }
                }
            };
        }
    }
}
