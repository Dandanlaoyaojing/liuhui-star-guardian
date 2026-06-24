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

const AXIAL_FEATHER = 0.12; // 轴向两端软收比例(GLSL: smoothstep(0,0.12,u)*smoothstep(1,0.88,u))

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
  const across = smoothstep(1, 0, d / halfAt); // 轴心1→边缘0
  const axial = smoothstep(0, AXIAL_FEATHER, u) * smoothstep(1, 1 - AXIAL_FEATHER, u);
  return Math.max(0, across * axial);
}
