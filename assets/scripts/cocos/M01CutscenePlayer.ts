import { _decorator, Component, Sprite, SpriteFrame } from "cc";
import { cutsceneFrameIndex } from "./M01CutsceneTiming.ts";

const { ccclass } = _decorator;

/**
 * 匀速逐帧过场播放器: 按 dt 累计时间, 换 sprite.spriteFrame, 播完回调。帧率无关(用 dt 不用帧计数)。
 * 用于 M01 通关成品动画(帧序列 + 独立音轨), 替代 Cocos VideoPlayer(桌面 Steam 不编译, 见
 * beginRepairSequenceThenToolCard 注释)。全平台通吃(Sprite 恒可用)。音频由调用方另起 AudioSource。
 * 计时纯逻辑在 M01CutsceneTiming(可单测)。
 */
@ccclass("M01CutscenePlayer")
export class M01CutscenePlayer extends Component {
  private frames: SpriteFrame[] = [];
  private sprite: Sprite | null = null;
  private fps = 24;
  private elapsedMs = 0;
  private lastIndex = -1;
  private finished = false;
  private onComplete: (() => void) | null = null;

  /** 配置并从第 0 帧起播。onComplete 在整段时长走完时触发一次(末帧显示满一帧后)。 */
  configure(frames: SpriteFrame[], sprite: Sprite, fps: number, onComplete: () => void): void {
    this.frames = frames;
    this.sprite = sprite;
    this.fps = fps > 0 ? fps : 24;
    this.onComplete = onComplete;
    this.elapsedMs = 0;
    this.lastIndex = -1;
    this.finished = false;
    this.renderFrame(0);
  }

  update(deltaSeconds: number): void {
    if (this.finished || this.frames.length === 0) return;
    this.elapsedMs += deltaSeconds * 1000;
    this.renderFrame(cutsceneFrameIndex(this.elapsedMs, this.fps, this.frames.length));
    // 整段时长走完(末帧也显示满一帧)→ 收尾一次。
    if (this.elapsedMs >= (this.frames.length / this.fps) * 1000) {
      this.finished = true;
      const cb = this.onComplete;
      this.onComplete = null;
      cb?.();
    }
  }

  private renderFrame(index: number): void {
    if (index === this.lastIndex) return;
    this.lastIndex = index;
    const frame = this.frames[index];
    if (this.sprite && frame) {
      this.sprite.spriteFrame = frame;
    }
  }
}
