import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";

const colors = ["red", "blue", "yellow"] as const;
const shapes = ["circle", "triangle", "hexagon"] as const;

const fragmentPositions = [
  { x: -360, y: 210 },
  { x: -300, y: 170 },
  { x: -240, y: 210 },
  { x: -180, y: 170 },
  { x: -360, y: -150 },
  { x: -300, y: -190 },
  { x: -80, y: 210 },
  { x: -20, y: 170 },
  { x: 40, y: 210 },
  { x: 100, y: 170 },
  { x: -80, y: -150 },
  { x: -20, y: -190 },
  { x: 180, y: 210 },
  { x: 240, y: 170 },
  { x: 300, y: 210 },
  { x: 360, y: 170 },
  { x: 180, y: -150 },
  { x: 240, y: -190 }
];

export const m01LegacySortConfig = {
  id: "m01",
  name: "记忆齿轮的卡顿",
  stage: 1,
  cognitiveSkill: "分类与归纳",
  wisdomCrystal: "秩序，是为相似之物找到归处。",
  colors: [...colors],
  filters: colors.map((color) => ({
    id: `filter_${color}`,
    color
  })),
  fragments: colors.flatMap((color, colorIndex) =>
    shapes.flatMap((shape, shapeIndex) =>
      [1, 2].map((copy) => {
        const index = colorIndex * shapes.length * 2 + shapeIndex * 2 + copy - 1;
        return {
          id: `fragment_${color}_${shape}_${copy}`,
          color,
          shape,
          position: fragmentPositions[index],
          tags: ["fragment", color, shape]
        };
      })
    )
  ),
  slots: colors.flatMap((color, colorIndex) =>
    shapes.map((shape, shapeIndex) => ({
      id: `slot_${color}_${shape}`,
      accepts: { color, shape },
      capacity: 2,
      position: {
        x: (colorIndex - 1) * 120,
        y: 40 - shapeIndex * 40
      },
      tags: ["slot", color, shape]
    }))
  ),
  goal: {
    type: "all_sorted",
    params: {
      dimensions: ["color", "shape"],
      colors: [...colors],
      shapes: [...shapes]
    }
  },
  scene: {
    background: "stage1/m01/background-greybox",
    ambientAudio: "audio/ambient/stage1-memory-gear",
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    entities: [
      {
        id: "entity_memory_gear",
        type: "animated",
        sprite: "stage1/m01/gear-star-dim",
        position: { x: 0, y: 0 },
        properties: {},
        tags: ["gear", "star", "repair_target"]
      }
    ]
  },
  interactions: [],
  goals: [
    {
      type: "all_sorted",
      params: {
        dimensions: ["color", "shape"],
        colors: [...colors],
        shapes: [...shapes]
      }
    }
  ],
  hints: [],
  repair: { steps: [] },
  toolCard: {
    puzzleId: "m01",
    stage: 1,
    front: {
      toolName: "分类与归纳",
      scene: "stage1/m01/toolcards/classification-thumbnail",
      wisdomCrystal: "秩序，是为相似之物找到归处。"
    },
    back: {
      coreAction: "在杂乱事物中找到共同属性，按属性归组。",
      whenToUse: ["整理一堆笔记不知从何下手时"],
      realLifeExamples: ["整理书架：按主题、作者或使用频率归位"],
      commonTraps:
        "分类维度选错会制造假秩序；关键不是怎么分最漂亮，而是这次分类要服务什么目的。"
    }
  }
} as unknown as M01MemoryGearConfig;
