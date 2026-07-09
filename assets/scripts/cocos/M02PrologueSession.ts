// M02 序章「三颗余烬点棒」会话层 —— 纯逻辑(无 cc import), 由 Vitest 钉死。
// 规则与主谜题同律(复用 StarNetworkRules 的 lifeMax/freezeThreshold, 快照结算), 差异只有两点:
//   1) 实时制: update(dt) 累积 beatSeconds 走拍(主谜题是每点一拍的回合制);
//   2) 动邻接: 余烬可拖动, 邻居 = 圆心距 <= adjacencyRadius 的亮余烬(主谜题是固定边表)。
// 熄灭的余烬隔 rekindleBeats 拍原地复燃满命 —— 序章无死锁, 随便试。
// cc 胶水层(M02PrologueView)只读 view()、转发拖动/点击, 不自己算规则。

import type { StarNetworkRules } from "../core/StarNetworkModel.ts";
import type { StarWebPrologue } from "../core/StarWebConfig.ts";
import type { StarNodeStatus } from "./M02StarWebSession.ts";

/** 复用主谜题的呈现态词汇(暗/衰减中/冻结), 保证两边永远同一套状态语言 */
export type EmberStatus = StarNodeStatus;
/** 星光棒: 插在地上 / 已拔在手(未亮) / 已点燃(序章完成) */
export type WandState = "planted" | "held" | "lit";

export interface EmberView {
  id: string;
  x: number;
  y: number;
  life: number;
  lit: boolean;
  status: EmberStatus;
}

export interface PrologueViewState {
  embers: EmberView[];
  wand: { x: number; y: number };
  wandState: WandState;
  done: boolean;
}

export interface DipResult {
  accepted: boolean;
  reason?: "wand_not_held" | "no_frozen_ember" | "done";
}

interface EmberState {
  id: string;
  x: number;
  y: number;
  life: number;
  rekindleIn: number; // 暗烬还差几拍复燃; 亮时无意义
}

/** 结算/邻居计数共用的轻量快照行 */
interface EmberSnapshot {
  x: number;
  y: number;
  lit: boolean;
}

export class M02PrologueSession {
  private readonly embers: EmberState[];
  private wandState: WandState = "planted";
  private beatAccumulator = 0;
  /** 每次可见状态变更 +1; 视图层据此跳过静止帧的重绘 */
  private revisionCount = 0;

  constructor(
    private readonly prologue: StarWebPrologue,
    private readonly rules: StarNetworkRules
  ) {
    this.embers = prologue.embers.map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      life: e.initialLife,
      rekindleIn: 0
    }));
  }

  /** 实时推进: 累积 dt, 每满 beatSeconds 结算一拍(欠账多拍则补齐)。序章完成后场景停摆。 */
  update(dtSeconds: number): void {
    if (this.wandState === "lit") return;
    if (!(dtSeconds > 0)) return;
    this.beatAccumulator += dtSeconds;
    // epsilon 兜浮点欠账: 累积 N 拍长度的 dt 必须恰好走 N 拍 (1.4*3 = 4.1999... 的经典坑)
    while (this.beatAccumulator >= this.prologue.beatSeconds - 1e-9) {
      this.beatAccumulator = Math.max(0, this.beatAccumulator - this.prologue.beatSeconds);
      this.tickBeat();
    }
  }

  /** 玩家拖动余烬(亮暗均可拖); 未知 id 返回 false */
  moveEmber(id: string, x: number, y: number): boolean {
    const ember = this.embers.find((e) => e.id === id);
    if (!ember) return false;
    ember.x = x;
    ember.y = y;
    this.revisionCount += 1;
    return true;
  }

  /** 点地上的棒 = 拔起(planted→held); 其余状态拒绝 */
  pullWand(): boolean {
    if (this.wandState !== "planted") return false;
    this.wandState = "held";
    this.revisionCount += 1;
    return true;
  }

  /** 手持棒点向 (x,y): 半径内存在冻结余烬 → 棒亮、序章完成 */
  dipWand(x: number, y: number): DipResult {
    if (this.wandState === "lit") return { accepted: false, reason: "done" };
    if (this.wandState !== "held") return { accepted: false, reason: "wand_not_held" };
    const radius = this.prologue.wandDipRadius;
    const snapshot = this.snapshotEmbers();
    const hit = this.embers.some(
      (e, index) => this.isFrozen(snapshot, index) && Math.hypot(e.x - x, e.y - y) <= radius
    );
    if (!hit) return { accepted: false, reason: "no_frozen_ember" };
    this.wandState = "lit";
    this.revisionCount += 1;
    return { accepted: true };
  }

  /** 序章是否完成(廉价读, 不构造 view) */
  get done(): boolean {
    return this.wandState === "lit";
  }

  /** 可见状态版本号: 变了才需要重绘 */
  get revision(): number {
    return this.revisionCount;
  }

  get view(): PrologueViewState {
    const snapshot = this.snapshotEmbers();
    return {
      embers: this.embers.map((e, index) => {
        const lit = e.life > 0;
        const status: EmberStatus = !lit ? "dark" : this.isFrozen(snapshot, index) ? "frozen" : "decaying";
        return { id: e.id, x: e.x, y: e.y, life: e.life, lit, status };
      }),
      wand: { x: this.prologue.wand.x, y: this.prologue.wand.y },
      wandState: this.wandState,
      done: this.done
    };
  }

  /** 一拍全体同时结算: 亮烬按结算前快照判冻结/衰减(同 StarNetworkModel.tick), 暗烬倒数复燃 */
  private tickBeat(): void {
    const snapshot = this.snapshotEmbers();
    this.embers.forEach((ember, index) => {
      if (snapshot[index].lit) {
        if (this.countLitNeighbors(snapshot, index) < this.rules.freezeThreshold) {
          ember.life -= 1;
          if (ember.life <= 0) ember.rekindleIn = this.prologue.rekindleBeats;
        }
      } else {
        ember.rekindleIn -= 1;
        if (ember.rekindleIn <= 0) ember.life = this.rules.lifeMax;
      }
    });
    this.revisionCount += 1;
  }

  private snapshotEmbers(): EmberSnapshot[] {
    return this.embers.map((e) => ({ x: e.x, y: e.y, lit: e.life > 0 }));
  }

  /** 冻结是派生态(实时按当前位置算, 不等拍): 亮 且 亮邻居 >= freezeThreshold */
  private isFrozen(snapshot: EmberSnapshot[], index: number): boolean {
    if (!snapshot[index].lit) return false;
    return this.countLitNeighbors(snapshot, index) >= this.rules.freezeThreshold;
  }

  private countLitNeighbors(snapshot: EmberSnapshot[], index: number): number {
    const self = snapshot[index];
    let count = 0;
    for (let i = 0; i < snapshot.length; i += 1) {
      if (i === index || !snapshot[i].lit) continue;
      if (Math.hypot(snapshot[i].x - self.x, snapshot[i].y - self.y) <= this.prologue.adjacencyRadius) {
        count += 1;
      }
    }
    return count;
  }
}
