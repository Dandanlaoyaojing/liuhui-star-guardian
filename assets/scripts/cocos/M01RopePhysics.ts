// 割绳子式软绳物理(纯逻辑, 无 cc 依赖) —— M01 吊篮的两根吊绳共用一条物理链。
//
// 做法 = 2D 游戏绳子的业界标准(Cut the Rope 同族; Jakobsen "Advanced Character Physics", GDC 2001):
// 绳 = 一串 Verlet 粒子 + 段间距离约束(迭代松弛); 重物(篮子)不是独立系统, 而是【链的末端粒子】,
// 质量远大于绳点 → 约束修正按逆质量加权(invMass), 绳让位、篮子稳。钉子端 invMass=0(钉死)。
// 被顶起 = 给尾粒子注入速度 → 链松弛(自然下垂/甩动)→ 回落绷紧瞬间, 径向分量被位置投影吸收
// (不可拉伸、非弹簧、不回弹), 切向分量保留 → 篮子被绳拽住左右乱晃、随阻尼渐渐收住。
// 稳定性要点(文献一致): 固定子步长(不可变 dt)、迭代次数 ≈ 2×节点数、速度阻尼 <1。

export interface RopePoint {
  x: number;
  y: number;
  /** Verlet 上一位置(速度隐含在 (x,y)-(px,py) 里)。 */
  px: number;
  py: number;
  /** 逆质量: 0=钉死(钉子), 1=普通绳点, 小值=重物(篮子)。约束修正按 invMass 比例分摊。 */
  invMass: number;
}

export interface RopeState {
  /** [0]=钉子(钉死), [length-1]=尾端重物(篮子挂点)。 */
  pts: RopePoint[];
  /** 每段静止长度。 */
  segLength: number;
}

export interface RopeOptions {
  /** 重力加速度 px/s²(向下为负, 与世界 y-up 一致)。 */
  gravity: number;
  /** 每子步速度保留系数(<1; 越小越快静止)。 */
  damping: number;
  /** 每子步距离约束松弛迭代数(≈2×节点数; 越多绳越不可拉伸)。 */
  iterations: number;
  /** 固定子步长(秒)。帧时间被切成整数个子步, 文献强调不可用可变 dt。 */
  substepDt: number;
}

/** 总绳长(段长×段数)。 */
export function ropeLengthOf(state: RopeState): number {
  return state.segLength * (state.pts.length - 1);
}

/** 头端(钉子)到尾端(篮子)拉一条直链, 点均匀分布。tailInvMass 越小篮子越重。 */
export function createRope(
  nailX: number,
  nailY: number,
  tailX: number,
  tailY: number,
  pointCount: number,
  tailInvMass: number
): RopeState {
  const pts: RopePoint[] = [];
  for (let i = 0; i < pointCount; i += 1) {
    const t = i / (pointCount - 1);
    const x = nailX + (tailX - nailX) * t;
    const y = nailY + (tailY - nailY) * t;
    const invMass = i === 0 ? 0 : i === pointCount - 1 ? tailInvMass : 1;
    pts.push({ x, y, px: x, py: y, invMass });
  }
  const segLength = Math.hypot(tailX - nailX, tailY - nailY) / (pointCount - 1);
  return { pts, segLength };
}

/**
 * 给尾端(篮子)注入速度(px/s) —— 顶篮冲击。Verlet 里速度 = (当前-上一位置)/dt,
 * 故把 prev 反向偏移一个子步的位移。可叠加(连顶)。
 */
export function kickTail(state: RopeState, vx: number, vy: number, substepDt: number): void {
  const tail = state.pts[state.pts.length - 1];
  tail.px -= vx * substepDt;
  tail.py -= vy * substepDt;
}

/**
 * 推进 elapsed 秒(内部切成固定子步; 残余 < 1 子步的时间并入本次, 避免丢时间或可变步长)。
 * 每子步: Verlet 积分(重力+阻尼) → iterations 轮距离约束(质量加权双向投影) → 钉死头端。
 */
export function stepRope(state: RopeState, elapsedSeconds: number, opts: RopeOptions): void {
  const steps = Math.max(1, Math.min(16, Math.round(elapsedSeconds / opts.substepDt)));
  const dt = opts.substepDt;
  const g = opts.gravity * dt * dt;
  const pts = state.pts;
  const nailX = pts[0].x;
  const nailY = pts[0].y;

  for (let s = 0; s < steps; s += 1) {
    // Verlet 积分: 钉死点(invMass 0)不动。
    for (let i = 1; i < pts.length; i += 1) {
      const p = pts[i];
      const vx = (p.x - p.px) * opts.damping;
      const vy = (p.y - p.py) * opts.damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + g;
    }
    // 距离约束(双向: 链节既不拉长也不压缩; 折叠靠节间角度自由)。
    for (let iter = 0; iter < opts.iterations; iter += 1) {
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1e-9;
        const wSum = a.invMass + b.invMass;
        if (wSum === 0) continue;
        const diff = (dist - state.segLength) / dist / wSum;
        const ox = dx * diff;
        const oy = dy * diff;
        a.x += ox * a.invMass;
        a.y += oy * a.invMass;
        b.x -= ox * b.invMass;
        b.y -= oy * b.invMass;
      }
      pts[0].x = nailX; // invMass 0 本就不动, 双保险钉死
      pts[0].y = nailY;
    }
  }
}
