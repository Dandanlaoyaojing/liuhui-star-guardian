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

// ⚠️ 公式 + CONE_ALONG_POW 必须与 fx_color-filter.effect 的 GLSL 一致, 且与可见光锥纹理
//    getConeGlowSpriteFrame 同一套衰减(bAlong=pow(1-along,0.8) × bAcross=1-q²) —— 这样
//    "光打在拼片上的显色"与"手电光束本身"质感完全一致(同一衰减形状)。漂移哨兵 grep 这个数。
const CONE_ALONG_POW = 0.8; // 沿光向衰减(近出光口最亮→远端落地渐暗); = bootstrap CONE_ALONG_POW

export function flashlightBeamIntensity(p: { x: number; y: number }, b: BeamField): number {
  if (!b.on || b.length <= 0) return 0;
  const px = p.x - b.ox;
  const py = p.y - b.oy;
  const t = px * b.dx + py * b.dy; // 轴向投影(沿光向距离)
  if (t < 0 || t > b.length) return 0;
  const u = t / b.length; // 0=出光口 .. 1=落地远端
  const d = Math.abs(px * -b.dy + py * b.dx); // 垂距(法向 = (-dy,dx))
  const halfAt = b.nearHalf + u * (b.farHalf - b.nearHalf); // 锥半宽随轴向线性张开
  if (halfAt <= 0) return 0;
  const q = d / halfAt; // 0=锥轴, 1=锥侧
  const bAcross = Math.max(0, 1 - q * q); // 轴最亮→锥侧 0(柔抛物边, 同锥纹理)
  const bAlong = Math.pow(Math.max(0, 1 - u), CONE_ALONG_POW); // 近端亮→远端暗(同锥纹理)
  return Math.max(0, bAlong * bAcross);
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
