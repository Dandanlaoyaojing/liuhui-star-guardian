export const m01GreyboxDefaultText = {
  initialInstruction: "M01 灰盒：把颜色过滤器拖到齿轮上，再拖动同色碎片归位。",
  loadFailed: "M01 配置载入失败：{reason}",
  notInitialized: "M01 尚未初始化。",
  unknownFilter: "未知过滤器：{filterId}",
  filterActivated: "已启用 {color} 过滤器。请选择同色碎片。",
  unknownFragment: "未知碎片：{fragmentId}",
  inactiveFragment: "碎片 {fragmentId} 不属于当前过滤器。",
  fragmentSelected: "已选择 {color} {shape}。请选择匹配槽位。",
  selectFragmentFirst: "请先选择一个高亮碎片。",
  placeRejected: "无法放置 {fragmentId}：{reason}",
  sortedCount: "已归位 {sortedCount} 个碎片。",
  repairCompleted: "M01 已修复，认知工具卡已解锁。",
  toolCardUnlockedSubtitle: "认知工具卡已解锁",
  toolCardWhenToUsePrefix: "何时使用：{value}",
  hintButton: "提示",
  hintNoFilter: "先让一种颜色变得清楚。",
  hintActiveFilter: "被过滤器照亮的碎片，才是现在适合吸取的碎片。",
  hintSelectedFragment: "每个收纳槽同时看颜色和形状。",
  correctPlacementFeedback: "归位正确。",
  wrongPlacementFeedback: "这个槽位不匹配，换一个同时符合颜色和形状的位置。",
  noSelectionFeedback: "先选择被过滤器照亮的碎片。",
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
  filterLabel: "{color}过滤器",
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
