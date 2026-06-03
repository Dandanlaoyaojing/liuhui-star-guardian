import { Sprite, SpriteFrame, UITransform } from "cc";

/**
 * 防止贴图变形的统一工具。
 *
 * 问题:全项目 Sprite 都用 SizeMode.CUSTOM + 写死 setContentSize(W,H),
 * 把贴图强行拉伸到固定框,无视贴图真实宽高比 → 比例不符的图被拉扁/拉长
 * (实测绳子被拉伸 78%)。
 *
 * 方案 A(锁一边,另一边按贴图真实比例自适应):给定一个"锚定框"(原来写死的
 * W×H),保持其中较能代表意图的一边,另一边按贴图真实宽高比重算,使贴图
 * 不变形。默认锁高度(角色/道具按高度对齐场景最常见),宽度 = 高度 × 贴图宽高比。
 */

export type AspectLockAxis = "height" | "width" | "contain";

/** 从 spriteFrame 取真实宽高(优先 getOriginalSize,回退 rect)。 */
export function spriteFrameSize(frame: SpriteFrame): { width: number; height: number } {
  const anyFrame = frame as unknown as {
    getOriginalSize?: () => { width: number; height: number };
    rect?: { width: number; height: number };
  };
  if (typeof anyFrame.getOriginalSize === "function") {
    const s = anyFrame.getOriginalSize();
    if (s && s.width > 0 && s.height > 0) return { width: s.width, height: s.height };
  }
  if (anyFrame.rect && anyFrame.rect.width > 0 && anyFrame.rect.height > 0) {
    return { width: anyFrame.rect.width, height: anyFrame.rect.height };
  }
  return { width: 0, height: 0 };
}

/**
 * 按贴图真实宽高比算出不变形的 contentSize。
 * @param frameW/frameH 贴图真实宽高
 * @param boxW/boxH 原来写死的锚定框
 * @param axis 锁哪一边: height=保持框高度算宽度; width=保持框宽度算高度;
 *             contain=整体缩放使贴图完整放进框内(letterbox,不超框)
 */
export function aspectContentSize(
  frameW: number,
  frameH: number,
  boxW: number,
  boxH: number,
  axis: AspectLockAxis = "height"
): { width: number; height: number } {
  if (frameW <= 0 || frameH <= 0) return { width: boxW, height: boxH };
  const ratio = frameW / frameH; // 宽/高
  if (axis === "width") {
    return { width: boxW, height: boxW / ratio };
  }
  if (axis === "contain") {
    const scale = Math.min(boxW / frameW, boxH / frameH);
    return { width: frameW * scale, height: frameH * scale };
  }
  // 默认锁高度
  return { width: boxH * ratio, height: boxH };
}

/**
 * 在 sprite 已经 set 好 spriteFrame 后调用:按贴图真实比例重设 contentSize,防止变形。
 * 保持 CUSTOM 模式(这样 contentSize 生效),但 contentSize 现在等于贴图真实比例。
 */
export function applyAspectFit(
  transform: UITransform,
  frame: SpriteFrame,
  boxW: number,
  boxH: number,
  axis: AspectLockAxis = "height"
): { width: number; height: number } {
  const { width: fw, height: fh } = spriteFrameSize(frame);
  const size = aspectContentSize(fw, fh, boxW, boxH, axis);
  transform.setContentSize(size.width, size.height);
  return size;
}

/** 便捷:同时拿 sprite 的 UITransform 并应用。sprite 必须已 set spriteFrame。 */
export function fitSpriteToAspect(
  sprite: Sprite,
  transform: UITransform,
  boxW: number,
  boxH: number,
  axis: AspectLockAxis = "height"
): void {
  const frame = sprite.spriteFrame;
  if (!frame) return;
  applyAspectFit(transform, frame, boxW, boxH, axis);
}
