import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildM01GreyboxLayout } from "../assets/scripts/cocos/M01GreyboxLayout.ts";
import { resolveM01GreyboxDrop } from "../assets/scripts/cocos/M01GreyboxDrag.ts";

const config = JSON.parse(
  readFileSync(join(__dirname, "../assets/resources/configs/stage1/m01-memory-gear.json"), "utf8")
);

function layout() {
  return buildM01GreyboxLayout(config as never, {});
}

function slotFor(id: string) {
  const slot = layout().targetPieceSlots.find((s) => s.expectedFragmentId === id);
  if (!slot) throw new Error(`no slot for ${id}`);
  return slot;
}

function dropOnSlot(fragmentId: string, rotation: number) {
  const l = layout();
  const token = l.fragments.find((f) => f.controllerId === fragmentId)!;
  const slot = l.targetPieceSlots.find((s) => s.expectedFragmentId === fragmentId)!;
  return resolveM01GreyboxDrop(l, token, slot.position, { rotation });
}

describe("M01 target-piece shape-fit snap: circle any-angle, others exact", () => {
  it("still snaps a rotatable piece only when rotated to its target angle", () => {
    expect(dropOnSlot("fragment_triangle_blue_1", slotFor("fragment_triangle_blue_1").rotation).type).toBe(
      "snap_fragment_to_target_piece"
    );
  });

  it("gives a rotate hint (not silent free-drop) when shape matches but rotation is wrong", () => {
    const action = dropOnSlot("fragment_triangle_blue_1", 0);
    expect(action.type).toBe("place_fragment_freely");
    expect(action.type === "place_fragment_freely" && action.rotationHint).toBe(true);
  });

  it("treats a circle as orientation-free: snaps at any rotation", () => {
    expect(dropOnSlot("fragment_circle_yellow_1", 90).type).toBe("snap_fragment_to_target_piece");
    expect(dropOnSlot("fragment_circle_yellow_1", 270).type).toBe("snap_fragment_to_target_piece");
  });

  it("treats a hexagon as 6-fold symmetric: coincident orientations snap, off-axis does not", () => {
    expect(slotFor("fragment_hexagon_red_2").rotation).toBe(90);
    expect(dropOnSlot("fragment_hexagon_red_2", 90).type).toBe("snap_fragment_to_target_piece");
    // 270 = 90 + 180, and 180 is a multiple of 60 -> visually identical -> snaps
    expect(dropOnSlot("fragment_hexagon_red_2", 270).type).toBe("snap_fragment_to_target_piece");
    // 0 is 90deg off (not a 60-multiple) -> visibly rotated -> must NOT snap
    expect(dropOnSlot("fragment_hexagon_red_2", 0).type).toBe("place_fragment_freely");
  });

  it("treats a triangle as 3-fold symmetric: 120deg-coincident snaps, 90deg off does not", () => {
    const target = slotFor("fragment_triangle_blue_1").rotation;
    expect(dropOnSlot("fragment_triangle_blue_1", target + 120).type).toBe("snap_fragment_to_target_piece");
    expect(dropOnSlot("fragment_triangle_blue_1", target + 90).type).toBe("place_fragment_freely");
  });
});

describe("M01 evidence weak-snap rotation gate (uniform for real pieces and decoys)", () => {
  // 真实 config 里证据中心都被目标槽矩形盖住(槽路径先接管), 弱磁吸路径只在边缘区决策 →
  // 用合成布局把证据放到远离所有槽的位置, 精确打到 evidence 路径本身。纯数据, 无需引擎。
  function syntheticLayout() {
    const triangleTags = ["fragment", "shape:triangle"];
    const slot = (id: string, rotation: number) => ({
      id: `slot_${id}`,
      expectedFragmentId: id,
      shapeToken: "triangle",
      rotation,
      position: { x: 1000, y: 1000 }, // 远离证据, 槽路径永不命中
      size: { width: 56, height: 56 }
    });
    const evidence = {
      controllerId: "evidence_tri_tri",
      kind: "evidence",
      tags: ["overlap_evidence", "shape:triangle"],
      position: { x: 0, y: 0 },
      size: { width: 52, height: 52 },
      // 生成片 = 两片真解三角(目标角 90 / 180); 键即 solution.fragmentIds 的运行时形态
      fragmentSnapPositions: { real_tri_a: { x: -8, y: 0 }, real_tri_b: { x: 8, y: 0 } }
    };
    const token = (id: string) => ({
      controllerId: id,
      kind: "fragment",
      tags: triangleTags,
      position: { x: 200, y: 200 },
      size: { width: 56, height: 56 }
    });
    const l = {
      evidenceSnapEnabled: true,
      evidence: [evidence],
      // real_tri_a / real_tri_b = 本证据生成片; other_tri_elsewhere = 属于别的证据的真解片(有自己的槽, 角0),
      // 但不在本证据 fragmentSnapPositions → 对本证据应按诱饵规则(本证据生成角)判, 不走它自己的角。
      targetPieceSlots: [slot("real_tri_a", 90), slot("real_tri_b", 180), slot("other_tri_elsewhere", 0)],
      slots: [],
      fragments: []
    } as never;
    return { l, token };
  }

  it("does NOT weak-snap a decoy triangle at an orientation no generator piece uses", () => {
    const { l, token } = syntheticLayout();
    // 0° 对生成角 90(差 30, mod 120) 和 180(差 60) 都不重合 → 旧代码(诱饵免检)会吸, 新代码必须放行为自由落
    const action = resolveM01GreyboxDrop(l, token("decoy_triangle") as never, { x: 0, y: 0 }, { rotation: 0 });
    expect(action.type).toBe("place_fragment_freely");
  });

  it("still lets the decoy triangle trial-fit when its orientation matches a generator piece", () => {
    const { l, token } = syntheticLayout();
    // 诱饵必须能试拼(spec §633/§634: 干扰项可试、可替换), 只是不能任意角免检。
    const action = resolveM01GreyboxDrop(l, token("decoy_triangle") as never, { x: 0, y: 0 }, { rotation: 90 });
    expect(action.type).toBe("weak_snap_fragment");
  });

  it("gates a real piece by its OWN generated pose, not the sibling generator's angle", () => {
    const { l, token } = syntheticLayout();
    // real_tri_a 自己的生成角是 90 → 90 可试拼
    const own = resolveM01GreyboxDrop(l, token("real_tri_a") as never, { x: 0, y: 0 }, { rotation: 90 });
    expect(own.type).toBe("weak_snap_fragment");
    // 180 是另一生成片的角: 弱磁吸不矫正旋转、staging 只记 id → 若在此放行,
    // 双三角证据会以互换朝向的两片点亮底光(codex P2)。必须拒。
    const sibling = resolveM01GreyboxDrop(l, token("real_tri_a") as never, { x: 0, y: 0 }, { rotation: 180 });
    expect(sibling.type).toBe("place_fragment_freely");
    // 0° 谁都不重合 → 不吸
    const blocked = resolveM01GreyboxDrop(l, token("real_tri_a") as never, { x: 0, y: 0 }, { rotation: 0 });
    expect(blocked.type).toBe("place_fragment_freely");
  });

  it("treats a real piece from ANOTHER evidence like a decoy here, not by its own slot angle (codex P2)", () => {
    const { l, token } = syntheticLayout();
    // other_tri_elsewhere 自己的槽角是 0, 但它不是本证据生成片 → 按本证据生成角(90/180)判。
    // 0° 是它自己的角但非本证据生成角 → 必须拒(旧代码只要它在某处有槽就按 0° 放行, 泄露它是别处真解)。
    const ownAngle = resolveM01GreyboxDrop(l, token("other_tri_elsewhere") as never, { x: 0, y: 0 }, { rotation: 0 });
    expect(ownAngle.type).toBe("place_fragment_freely");
    // 90° 是本证据生成角 → 和诱饵一样可试拼。
    const genAngle = resolveM01GreyboxDrop(l, token("other_tri_elsewhere") as never, { x: 0, y: 0 }, { rotation: 90 });
    expect(genAngle.type).toBe("weak_snap_fragment");
  });
});

describe("M01 overlapping target slots: nearest slot decides, mismatch hints instead of far-snap", () => {
  it("hints rotation on the aimed-at (nearest) slot rather than silently snapping to a farther one", () => {
    const l = layout();
    const triangleSlots = l.targetPieceSlots.filter((s) => s.shapeToken === "triangle");
    expect(triangleSlots.length).toBe(2);
    const [a, b] = triangleSlots;
    // 只在两槽真的重叠时该场景才存在(当前 config 如此); 若未来布局改开, 此测试自动失效提醒重审。
    const dx = Math.abs(a.position.x - b.position.x);
    const dy = Math.abs(a.position.y - b.position.y);
    expect(dx).toBeLessThan((a.size.width + b.size.width) / 2);
    expect(dy).toBeLessThan((a.size.height + b.size.height) / 2);

    // 取 b 靠 a 一侧的矩形边界内缩 1px: 必在 b 内; 两槽重叠 => 该点也在 a 内, 且离 a 更近。
    const towardA = Math.sign(a.position.x - b.position.x) || 1;
    const probe = {
      x: b.position.x + towardA * (b.size.width / 2 - 1),
      y: b.position.y + (Math.sign(a.position.y - b.position.y) || 0) * (b.size.height / 2 - 1)
    };
    const distA = Math.hypot(probe.x - a.position.x, probe.y - a.position.y);
    const distB = Math.hypot(probe.x - b.position.x, probe.y - b.position.y);
    expect(distA).toBeLessThan(distB);

    // 拼片转到"较远槽 b"的角度(与最近槽 a 不重合), 落在 probe: 旧逻辑吸去 b, 新逻辑该提示旋转。
    const token = l.fragments.find((f) => f.controllerId === a.expectedFragmentId)!;
    const action = resolveM01GreyboxDrop(l, token, probe, { rotation: b.rotation });
    if (action.type === "place_fragment_freely") {
      expect(action.rotationHint).toBe(true);
    } else {
      // a/b 目标角恰好对称重合时(如未来配成 90/210), 吸附到最近槽 a 也是对的。
      expect(action.type).toBe("snap_fragment_to_target_piece");
      expect(action.type === "snap_fragment_to_target_piece" && action.pieceSlotId).toBe(a.id);
    }
  });
});
