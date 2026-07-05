// M02《点亮你温暖我》会话层 —— 纯逻辑(无 cc import), 由 Vitest 钉死。
// 管三件 domain 之上的东西: 电量(charges)、三板推进、每颗星的呈现态 + 胜负。
// cc 胶水层(M02StarWebView)只读 view()、把 tap 转给 tapNode(), 不自己算规则。

import { StarNetworkModel, type StarNetworkRules } from "../core/StarNetworkModel.ts";
import { boardGraph, type StarBoard, type StarWebConfig } from "../core/StarWebConfig.ts";

/** 单颗星的呈现态: 暗 / 衰减中(亮但支撑不足) / 冻结(亮且亮邻居达标) */
export type StarNodeStatus = "dark" | "decaying" | "frozen";
/** 一板的状态: 进行中 / 已全锁胜利 / 电量耗尽未胜 */
export type BoardStatus = "playing" | "won" | "exhausted";

export interface StarNodeView {
  id: string;
  x: number;
  y: number;
  life: number;
  lit: boolean;
  status: StarNodeStatus;
}

export interface StarWebView {
  boardId: string;
  boardIndex: number;
  boardCount: number;
  nodes: StarNodeView[];
  edges: [string, string][];
  chargesTotal: number;
  chargesLeft: number;
  status: BoardStatus;
}

export interface TapResult {
  accepted: boolean;
  reason?: "not_playing" | "unknown_node";
}

export class StarWebSession {
  private readonly boards: StarBoard[];
  private readonly rules: StarNetworkRules;
  private boardIndex = 0;
  private model: StarNetworkModel;
  private chargesUsed = 0;
  private status: BoardStatus = "playing";
  private readonly wonBoardIds = new Set<string>();

  constructor(config: StarWebConfig) {
    if (config.boards.length === 0) {
      throw new Error("StarWebSession requires at least one board");
    }
    this.boards = config.boards;
    this.rules = config.mechanic;
    this.model = this.buildModel(0);
  }

  /** 点一颗星 = 花一点电量走一拍。未知星不消耗电量、不推进；非进行中拒绝。 */
  tapNode(id: string): TapResult {
    if (this.status !== "playing") return { accepted: false, reason: "not_playing" };
    if (!this.model.step(id)) return { accepted: false, reason: "unknown_node" };
    this.chargesUsed += 1;
    if (this.model.isWon()) {
      this.status = "won";
      this.wonBoardIds.add(this.board.id);
    } else if (this.chargesUsed >= this.board.charges) {
      this.status = "exhausted";
    }
    return { accepted: true };
  }

  /** 三板都曾被打通才算整关完成；不信任 nextBoard() 调用顺序。 */
  isLevelComplete(): boolean {
    return this.boards.every((board) => this.wonBoardIds.has(board.id));
  }

  /** 重来本板(电量、状态、星网清零) */
  resetBoard(): void {
    this.model.reset();
    this.chargesUsed = 0;
    this.status = "playing";
    this.wonBoardIds.delete(this.board.id);
  }

  /** 进入下一板; 已是最后一板返回 false */
  nextBoard(): boolean {
    if (this.boardIndex >= this.boards.length - 1) return false;
    this.boardIndex += 1;
    this.model = this.buildModel(this.boardIndex);
    this.chargesUsed = 0;
    this.status = "playing";
    return true;
  }

  get view(): StarWebView {
    const board = this.board;
    const nodes: StarNodeView[] = board.layout.nodes.map((node) => {
      const life = this.model.lifeOf(node.id);
      const lit = life > 0;
      const frozen = lit && this.model.litNeighborCount(node.id) >= this.rules.freezeThreshold;
      const status: StarNodeStatus = !lit ? "dark" : frozen ? "frozen" : "decaying";
      return { id: node.id, x: node.x, y: node.y, life, lit, status };
    });
    return {
      boardId: board.id,
      boardIndex: this.boardIndex,
      boardCount: this.boards.length,
      nodes,
      edges: board.layout.edges,
      chargesTotal: board.charges,
      chargesLeft: Math.max(0, board.charges - this.chargesUsed),
      status: this.status
    };
  }

  private get board(): StarBoard {
    return this.boards[this.boardIndex];
  }

  private buildModel(index: number): StarNetworkModel {
    return new StarNetworkModel(boardGraph(this.boards[index]), this.rules);
  }
}
