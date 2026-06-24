// M01 手电光束逐像素强度(纯几何, 无 cc 依赖 → vitest 可跑)。
// ⚠️ GLSL(assets/resources/shaders/fx_color-filter.effect) 必须复刻同一公式 ——
//    改这里的强度数学要同步改 .effect(轴向投影 + 垂距 + 同比例 smoothstep)。

export interface BeamField {
  ox: number; // 光锥顶(muzzle)世界坐标
  oy: number;
  dx: number; // 光向单位向量(muzzle→落地)
  dy: number;
  length: number; // 轴向长度
  nearHalf: number; // 锥顶半宽
  farHalf: number; // 锥底半宽
  on: boolean;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ⚠️ 以下三常量 + 公式必须与 fx_color-filter.effect 的 GLSL 一致(漂移哨兵 grep 这几个数)。
const AXIAL_FEATHER = 0.25; // 轴向两端软收比例(越大越软); GLSL: smoothstep(0,0.25,u)*smoothstep(1,0.75,u)
const BEAM_SOFT = 1.8; // 横向高斯软度(越小越散越软); across = exp(-q*q*BEAM_SOFT)
const EDGE_CUTOFF = 1.4; // 垂距 > halfAt×此 → 清零(此处 across 已≈0.03, 清掉不可见, 保证"扇外=0")

export function flashlightBeamIntensity(p: { x: number; y: number }, b: BeamField): number {
  if (!b.on || b.length <= 0) return 0;
  const px = p.x - b.ox;
  const py = p.y - b.oy;
  const t = px * b.dx + py * b.dy; // 轴向投影(沿光向距离)
  if (t < 0 || t > b.length) return 0;
  const u = t / b.length; // 0..1
  const d = Math.abs(px * -b.dy + py * b.dx); // 垂距(法向 = (-dy,dx))
  const halfAt = b.nearHalf + u * (b.farHalf - b.nearHalf);
  if (halfAt <= 0) return 0;
  const q = d / halfAt;
  // 横向: 高斯软钟形(轴心最亮、向两侧自然散开、长尾) —— 比 smoothstep 软, 贴近光束散射观感。
  const across = q > EDGE_CUTOFF ? 0 : Math.exp(-q * q * BEAM_SOFT);
  const axial = smoothstep(0, AXIAL_FEATHER, u) * smoothstep(1, 1 - AXIAL_FEATHER, u);
  return Math.max(0, across * axial);
}

// drawing 空间几何(muzzle/center 世界点)→ 世界空间 BeamField。世界坐标的获取(node.worldPosition)
// 在 bootstrap 做; 这里只做无 cc 的组装, 便于单测。muzzle≈center(零长)→ on=false 不显色。
export function worldBeamFromGeometry(
  muzzle: { mx: number; my: number },
  center: { cx: number; cy: number },
  opts: { nearHalf: number; farHalf: number; on: boolean }
): BeamField {
  const vx = center.cx - muzzle.mx;
  const vy = center.cy - muzzle.my;
  const length = Math.hypot(vx, vy);
  if (length < 1e-3) {
    return {
      ox: muzzle.mx,
      oy: muzzle.my,
      dx: 1,
      dy: 0,
      length: 0,
      nearHalf: opts.nearHalf,
      farHalf: opts.farHalf,
      on: false
    };
  }
  return {
    ox: muzzle.mx,
    oy: muzzle.my,
    dx: vx / length,
    dy: vy / length,
    length,
    nearHalf: opts.nearHalf,
    farHalf: opts.farHalf,
    on: opts.on
  };
}
