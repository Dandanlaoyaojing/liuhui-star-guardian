// M01 修复动画的纯时序编排(spec §5.2: 齿轮转动 → 碎片以漩涡状【喷出】→ 化为持续星光;
// 镜头拉远无相机系统, 本轮省略)。无 cc 依赖(vitest 可测); cc 胶水(M01GreyboxBootstrap)
// 按 timeline 的绝对时间窗调 tween、按 spiralOutTargets 给每片确定性的喷出终点。
// 步骤数据全部来自 config `repair.steps`(数据驱动, 不硬编码)。

export interface RepairStepConfig {
  /** 步骤类型: entity_animate(齿轮转) / fragments_spiral_out(碎片漩涡喷出) / starlight(化星光)。 */
  type: string;
  /** 类型相关参数, 原样带进 timeline 供 cc 胶水消费。 */
  params: Record<string, unknown>;
  /** 持续秒数(缺省 0)。 */
  duration?: number;
  /** 相对整段开始的延迟秒数(缺省 0)。 */
  delay?: number;
}

export interface RepairSegment {
  type: string;
  params: Record<string, unknown>;
  /** 绝对开始/结束时间(秒, 相对修复动画 t=0)。 */
  start: number;
  end: number;
}

export interface RepairTimeline {
  segments: RepairSegment[];
  /** 总时长 = 最晚结束的段。 */
  total: number;
}

/** config repair.steps → 绝对时间窗序列。顺序保留 config 原序(并行靠 delay 错峰)。 */
export function buildRepairTimeline(steps: RepairStepConfig[]): RepairTimeline {
  const segments: RepairSegment[] = steps.map((step) => {
    const start = step.delay ?? 0;
    return {
      type: step.type,
      params: step.params ?? {},
      start,
      end: start + (step.duration ?? 0)
    };
  });
  const total = segments.reduce((max, seg) => Math.max(max, seg.end), 0);
  return { segments, total };
}

export interface SpiralTarget {
  /** 喷出终点(绝对坐标; 终点都落在 origin 为圆心、radius 为半径的圆上)。 */
  x: number;
  y: number;
  /** 该片的喷出方位角(deg, 仅诊断/测试用)。 */
  angleDeg: number;
  /** 途中自旋角(deg, = config turnsDeg; cc 胶水转 fragment 节点)。 */
  spinDeg: number;
}

/**
 * 每片碎片的漩涡喷出终点: 绕盘心均匀分布整圈(9 片=每 40°), 带固定起始偏角错开 0°/90° 的呆板感。
 * 确定性(无 RNG): 同输入同输出 → 帧率/重放无关、可测。turnsDeg 是途中自旋角(漩涡感的主要来源,
 * 由 cc 胶水在 tween 里同时转节点), 终点本身按直线方位角放射。
 */
export function spiralOutTargets(
  count: number,
  origin: { x: number; y: number },
  params: { radius: number; turnsDeg: number }
): SpiralTarget[] {
  const targets: SpiralTarget[] = [];
  const baseOffsetDeg = 17; // 固定起始偏角(确定性), 避开正上/正右的机械感
  for (let i = 0; i < count; i += 1) {
    const angleDeg = baseOffsetDeg + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    targets.push({
      x: origin.x + Math.cos(rad) * params.radius,
      y: origin.y + Math.sin(rad) * params.radius,
      angleDeg,
      spinDeg: params.turnsDeg
    });
  }
  return targets;
}
