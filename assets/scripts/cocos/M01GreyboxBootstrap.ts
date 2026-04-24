import { _decorator, Component, JsonAsset, Label, resources } from "cc";
import {
  M01MemoryGearController,
  type M01MemoryGearConfig
} from "../levels/stage1/M01MemoryGearController.ts";

const { ccclass, property } = _decorator;

@ccclass("M01GreyboxBootstrap")
export class M01GreyboxBootstrap extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  private controller: M01MemoryGearController | null = null;

  start(): void {
    resources.load("configs/stage1/m01-memory-gear", JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.setStatus(`Failed to load M01 config: ${error?.message ?? "unknown error"}`);
        return;
      }

      const m01Config = asset.json as unknown as M01MemoryGearConfig;
      this.controller = M01MemoryGearController.fromConfig(m01Config);
      this.setStatus("M01 greybox loaded: insert a color filter to begin.");
    });
  }

  selectFilter(filterIdOrColor: string): void {
    if (!this.controller) {
      this.setStatus("M01 is not initialized.");
      return;
    }

    const result = this.controller.insertFilter(filterIdOrColor);
    this.setStatus(
      result.accepted
        ? `Active filter: ${result.color}`
        : `Unknown filter: ${result.filterId}`
    );
  }

  placeFragment(fragmentId: string, slotId: string): void {
    if (!this.controller) {
      this.setStatus("M01 is not initialized.");
      return;
    }

    const result = this.controller.placeFragmentInSlot(fragmentId, slotId);
    if (!result.accepted) {
      this.setStatus(`Rejected ${fragmentId}: ${result.reason}`);
      return;
    }

    this.setStatus(
      result.completed
        ? "M01 repaired. ToolCard unlocked."
        : `Sorted ${result.sortedCount} fragments.`
    );
  }

  private setStatus(message: string): void {
    if (this.statusLabel) {
      this.statusLabel.string = message;
    }
  }
}
