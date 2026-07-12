// 拖拽会话的纯逻辑状态机 —— 引擎无关, 由 xUnit 钉死正确性.
// 从 assets/scripts/interaction/DragHandler.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里.
// TS 语义映射:
//   PointerId = string | number → object (相等用 object.Equals; !== 对应 !Equals);
//   Point2 是不可变值对象 → readonly record struct (值相等);
//   DragState.active? (可空) → DragSession? Active (null 表示 undefined);
//   free function 导出 → static 方法; TS 对象展开(...session)→ record `with` 表达式.

using System;

namespace StarGuardian.Interaction
{
    // ClickDragThreshold(定义见下方 DragHandler 类)对应 TS `export const CLICK_DRAG_THRESHOLD = 6`
    // (number → double, 值不变); 未被本文件函数使用, 但属模块公开 API, 原样保留。文档挂在常量本身上。
    // (此处用 // 而非 /// —— 游离的 XML 摘要会错挂到下面的 Point2 上, fable 审已纠。)

    // C# 9(Unity 6 编译器)不支持 record struct → 手写不可变值类型 + 值相等(语义同原 record struct)。
    public readonly struct Point2 : IEquatable<Point2>
    {
        public double X { get; }
        public double Y { get; }
        public Point2(double x, double y) { X = x; Y = y; }
        public bool Equals(Point2 other) => X == other.X && Y == other.Y;
        public override bool Equals(object obj) => obj is Point2 p && Equals(p);
        public override int GetHashCode() => HashCode.Combine(X, Y);
        public static bool operator ==(Point2 a, Point2 b) => a.Equals(b);
        public static bool operator !=(Point2 a, Point2 b) => !a.Equals(b);
        public override string ToString() => $"Point2 {{ X = {X}, Y = {Y} }}";
    }

    public sealed record DragSession
    {
        public object PointerId { get; init; } = default!;
        public string EntityId { get; init; } = "";
        public Point2 StartPosition { get; init; }
        public Point2 PreviousPosition { get; init; }
        public Point2 CurrentPosition { get; init; }
        public Point2 Delta { get; init; }
        public Point2 TotalDelta { get; init; }
    }

    public sealed record DragState
    {
        public DragSession? Active { get; init; }
    }

    public sealed record BeginDragInput
    {
        public object PointerId { get; init; } = default!;
        public string EntityId { get; init; } = "";
        public Point2 Position { get; init; }
    }

    public sealed record DragPointerInput
    {
        public object PointerId { get; init; } = default!;
        public Point2 Position { get; init; }
    }

    // IgnoredDragReason = "no_active_session" | "pointer_mismatch" —— 文案逐字保留(测试依赖)。
    // DragOutcome.type = "ended" | "canceled" | "ignored" —— 同上, 保持字符串字面量。

    public sealed record DragOutcome
    {
        public string Type { get; init; } = "";
        public string? Reason { get; init; }
        public DragSession? Session { get; init; }
    }

    public sealed record DragTransition
    {
        public DragState State { get; init; } = new();
        public DragOutcome Outcome { get; init; } = new();
    }

    public static class DragHandler
    {
        /// <summary>px; 见 CLICK_DRAG_THRESHOLD 注释</summary>
        public const double ClickDragThreshold = 6;

        private static readonly Point2 ZeroDelta = new(0, 0);

        public static DragState BeginDragSession(BeginDragInput input)
        {
            var position = CopyPoint(input.Position);

            return new DragState
            {
                Active = new DragSession
                {
                    PointerId = input.PointerId,
                    EntityId = input.EntityId,
                    StartPosition = position,
                    PreviousPosition = position,
                    CurrentPosition = position,
                    Delta = ZeroDelta,
                    TotalDelta = ZeroDelta
                }
            };
        }

        public static DragState MoveDragSession(DragState state, DragPointerInput input)
        {
            if (state.Active is null || !SamePointer(state.Active.PointerId, input.PointerId))
            {
                return state;
            }

            return new DragState
            {
                Active = MoveSessionTo(state.Active, input.Position)
            };
        }

        public static DragTransition EndDragSession(DragState state, DragPointerInput input)
        {
            if (state.Active is null)
            {
                return new DragTransition
                {
                    State = state,
                    Outcome = new DragOutcome
                    {
                        Type = "ignored",
                        Reason = "no_active_session"
                    }
                };
            }

            if (!SamePointer(state.Active.PointerId, input.PointerId))
            {
                return new DragTransition
                {
                    State = state,
                    Outcome = new DragOutcome
                    {
                        Type = "ignored",
                        Reason = "pointer_mismatch"
                    }
                };
            }

            var session = MoveSessionTo(state.Active, input.Position);

            return new DragTransition
            {
                State = new DragState(),
                Outcome = new DragOutcome
                {
                    Type = "ended",
                    Session = session
                }
            };
        }

        public static DragTransition CancelDragSession(DragState state, object pointerId)
        {
            if (state.Active is null)
            {
                return new DragTransition
                {
                    State = state,
                    Outcome = new DragOutcome
                    {
                        Type = "ignored",
                        Reason = "no_active_session"
                    }
                };
            }

            if (!SamePointer(state.Active.PointerId, pointerId))
            {
                return new DragTransition
                {
                    State = state,
                    Outcome = new DragOutcome
                    {
                        Type = "ignored",
                        Reason = "pointer_mismatch"
                    }
                };
            }

            return new DragTransition
            {
                State = new DragState(),
                Outcome = new DragOutcome
                {
                    Type = "canceled",
                    Session = state.Active
                }
            };
        }

        private static DragSession MoveSessionTo(DragSession session, Point2 position)
        {
            var currentPosition = CopyPoint(position);

            return session with
            {
                PreviousPosition = session.CurrentPosition,
                CurrentPosition = currentPosition,
                Delta = Subtract(currentPosition, session.CurrentPosition),
                TotalDelta = Subtract(currentPosition, session.StartPosition)
            };
        }

        // Point2 是值类型, 拷贝本就是隐式的; 保留此辅助以忠实映射 TS copyPoint 的意图。
        private static Point2 CopyPoint(Point2 point) => new(point.X, point.Y);

        private static Point2 Subtract(Point2 to, Point2 from) => new(to.X - from.X, to.Y - from.Y);

        // TS PointerId 是 string | number, 而 JS number 只有 double 一种 —— 所以 7 与 7(无论来自 int
        // fingerId、反序列化的 long、还是事件系统的 float)必然 ===。C# 装箱后 int 7 / long 7 / double 7.0
        // 用 object.Equals 互不相等, 会让拖拽在跨数值类型时静默卡死(move/end 永远 mismatch)。故:
        // 两侧都是数值 → 归一到 double 比较(== 对 NaN 返回 false, 恰好复刻 TS 的 NaN !== NaN 恒不匹配);
        // 否则(字符串 / 异类型)走值/类型相等。(fable 审: risk 修复)
        private static bool SamePointer(object a, object b)
        {
            if (IsNumeric(a) && IsNumeric(b))
            {
                return Convert.ToDouble(a) == Convert.ToDouble(b);
            }

            return Equals(a, b);
        }

        private static bool IsNumeric(object o) =>
            o is byte or sbyte or short or ushort or int or uint or long or ulong or float or double or decimal;
    }
}
