export const m01GreyboxDefaultText = {
  initialInstruction: "M01 灰盒：用三色手电观察灰白碎片，再按局部交叠证据拼出成立的关系。",
  loadFailed: "M01 配置载入失败：{reason}",
  notInitialized: "M01 尚未初始化。",
  unknownFilter: "未知光源：{filterId}",
  filterActivated: "已启用 {color} 光源。请观察候选碎片。",
  unknownFragment: "未知碎片：{fragmentId}",
  inactiveFragment: "碎片 {fragmentId} 暂时不适合当前线索。",
  fragmentSelected: "已选择 {color} {shape}。寻找能与它形成证据关系的位置。",
  selectFragmentFirst: "请先选择或拾起一个碎片。",
  placeRejected: "无法放置 {fragmentId}：{reason}",
  sortedCount: "已暂存 {sortedCount} 个碎片关系。",
  repairCompleted: "M01 已修复，认知工具卡已解锁。",
  toolCardUnlockedSubtitle: "认知工具卡已解锁",
  toolCardWhenToUsePrefix: "何时使用：{value}",
  hintButton: "提示",
  hintNoFilter: "先选择一种手电光，观察灰白碎片在光下的反应。",
  hintActiveFilter: "现在从候选碎片里找形状线索，别只看单个特征。",
  hintSelectedFragment: "找能和这片碎片形成局部交叠证据的关系位置。",
  correctPlacementFeedback: "这组关系成立。",
  wrongPlacementFeedback: "这里的关系不成立，换一个能同时对上局部形状和颜色推理的位置。",
  noSelectionFeedback: "先拾起一个候选碎片。",
  flashlightSelected: "已选择 {color} 光手电。",
  fragmentRevealed: "碎片 {fragmentId} 在当前光下显现为 {color}。",
  fragmentPickedUp: "已拾起碎片 {fragmentId}。",
  fragmentPlacedFreely: "已把碎片 {fragmentId} 放在工作区。",
  weakSnapHint: "碎片 {fragmentId} 已贴近证据 {evidenceId}。",
  candidateStructureReady: "候选结构已摆好，等待底光验证。",
  validationLightFlash: "底光闪烁后熄灭，结构还不对。",
  validationLightSteady: "底光保持亮起，结构成立。",
  evidenceCompleted: "证据 {evidenceId} 已暂存。",
  evidenceRejected: "证据 {evidenceId} 不匹配。",
  colorRed: "红",
  colorBlue: "蓝",
  colorYellow: "黄",
  shapeCircle: "圆",
  shapeTriangle: "三角",
  shapeHexagon: "六边",
  filterLabel: "{color}光源",
  tokenLabel: "{color} {shape}"
} as const;

export type M01GreyboxTextKey = keyof typeof m01GreyboxDefaultText;
export type M01GreyboxTextOverrides = Partial<Record<M01GreyboxTextKey, string>>;

export function formatM01GreyboxText(
  key: M01GreyboxTextKey,
  params: Record<string, string | number> = {},
  overrides: M01GreyboxTextOverrides = {}
): string {
  const template = overrides[key] ?? m01GreyboxDefaultText[key];

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey];
    return value === undefined ? match : String(value);
  });
}

export function formatM01ColorLabel(
  color: string,
  overrides: M01GreyboxTextOverrides = {}
): string {
  const keyByColor: Record<string, M01GreyboxTextKey> = {
    red: "colorRed",
    blue: "colorBlue",
    yellow: "colorYellow"
  };
  const key = keyByColor[color];

  return key ? formatM01GreyboxText(key, {}, overrides) : color;
}

export function formatM01ShapeLabel(
  shape: string,
  overrides: M01GreyboxTextOverrides = {}
): string {
  const keyByShape: Record<string, M01GreyboxTextKey> = {
    circle: "shapeCircle",
    triangle: "shapeTriangle",
    hexagon: "shapeHexagon"
  };
  const key = keyByShape[shape];

  return key ? formatM01GreyboxText(key, {}, overrides) : shape;
}
