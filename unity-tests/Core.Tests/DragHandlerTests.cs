// 从 tests/interaction/DragHandler.test.ts 逐条迁移 —— 规则不变, 断言一一对应。
using StarGuardian.Interaction;
using Xunit;

namespace StarGuardian.Interaction.Tests
{
    public class DragHandlerTests
    {
        [Fact(DisplayName = "tracks a drag lifecycle with stable pointer and entity ids")]
        public void TracksDragLifecycleWithStablePointerAndEntityIds()
        {
            var started = DragHandler.BeginDragSession(new BeginDragInput
            {
                PointerId = 7,
                EntityId = "fragment-red-circle-1",
                Position = new Point2(10, 20)
            });

            Assert.Equal(7, started.Active!.PointerId);
            Assert.Equal("fragment-red-circle-1", started.Active!.EntityId);
            Assert.Equal(new Point2(10, 20), started.Active!.StartPosition);
            Assert.Equal(new Point2(10, 20), started.Active!.CurrentPosition);

            var moved = DragHandler.MoveDragSession(started, new DragPointerInput
            {
                PointerId = 7,
                Position = new Point2(24, 32)
            });

            Assert.Equal(new Point2(10, 20), moved.Active!.PreviousPosition);
            Assert.Equal(new Point2(24, 32), moved.Active!.CurrentPosition);
            Assert.Equal(new Point2(14, 12), moved.Active!.Delta);
            Assert.Equal(new Point2(14, 12), moved.Active!.TotalDelta);

            var ended = DragHandler.EndDragSession(moved, new DragPointerInput
            {
                PointerId = 7,
                Position = new Point2(30, 35)
            });

            Assert.Null(ended.State.Active);
            Assert.Equal("ended", ended.Outcome.Type);
            Assert.Equal("fragment-red-circle-1", ended.Outcome.Session!.EntityId);
            Assert.Equal(new Point2(30, 35), ended.Outcome.Session!.CurrentPosition);
            Assert.Equal(new Point2(20, 15), ended.Outcome.Session!.TotalDelta);
        }

        [Fact(DisplayName = "ignores move and end requests from a different pointer")]
        public void IgnoresMoveAndEndRequestsFromADifferentPointer()
        {
            var started = DragHandler.BeginDragSession(new BeginDragInput
            {
                PointerId = "primary",
                EntityId = "filter-red",
                Position = new Point2(0, 0)
            });

            var movedByWrongPointer = DragHandler.MoveDragSession(started, new DragPointerInput
            {
                PointerId = "secondary",
                Position = new Point2(100, 100)
            });

            Assert.Equal(started, movedByWrongPointer);

            var endedByWrongPointer = DragHandler.EndDragSession(started, new DragPointerInput
            {
                PointerId = "secondary",
                Position = new Point2(100, 100)
            });

            Assert.Equal(started, endedByWrongPointer.State);
            Assert.Equal(
                new DragOutcome
                {
                    Type = "ignored",
                    Reason = "pointer_mismatch"
                },
                endedByWrongPointer.Outcome);
        }

        [Fact(DisplayName = "cancels the active session without inventing a drop position")]
        public void CancelsTheActiveSessionWithoutInventingADropPosition()
        {
            DragState state = DragHandler.BeginDragSession(new BeginDragInput
            {
                PointerId = "touch-1",
                EntityId = "fragment-yellow-hexagon-2",
                Position = new Point2(5, 8)
            });

            var canceled = DragHandler.CancelDragSession(state, "touch-1");

            Assert.Null(canceled.State.Active);
            Assert.Equal("canceled", canceled.Outcome.Type);
            Assert.Equal(new Point2(5, 8), canceled.Outcome.Session!.CurrentPosition);
        }

        // ↓↓ C# 转写专属回归桩(TS 无对应)—— 钉住 fable 审发现的 PointerId 装箱跨类型语义偏离。

        [Fact(DisplayName = "PointerId 跨数值类型视为同一指针(int 7 / long 7 / double 7.0 归一, 不静默卡死)")]
        public void CrossNumericPointerIdIsTreatedAsSame()
        {
            // TS number 只有 double 一种, 7 恒 === 7; C# 装箱后 int/long/double 若按 object.Equals 互不相等,
            // 拖拽会在跨数值类型时静默卡死。归一化后三者视为同一指针。
            var started = DragHandler.BeginDragSession(new BeginDragInput
            {
                PointerId = 7,          // int
                EntityId = "e",
                Position = new Point2(0, 0)
            });

            var moved = DragHandler.MoveDragSession(started, new DragPointerInput
            {
                PointerId = 7L,         // long —— 必须仍匹配
                Position = new Point2(3, 0)
            });
            Assert.NotNull(moved.Active);
            Assert.Equal(new Point2(3, 0), moved.Active!.CurrentPosition);   // 会话推进了(未卡死)

            var ended = DragHandler.EndDragSession(moved, new DragPointerInput
            {
                PointerId = 7.0,        // double —— 仍匹配
                Position = new Point2(5, 0)
            });
            Assert.Equal("ended", ended.Outcome.Type);
        }

        [Fact(DisplayName = "数值指针与字符串指针不匹配(number 7 ≠ string \"7\", 同 TS 跨类型 !==)")]
        public void NumericPointerDoesNotMatchStringPointer()
        {
            var started = DragHandler.BeginDragSession(new BeginDragInput
            {
                PointerId = 7,
                EntityId = "e",
                Position = new Point2(0, 0)
            });

            var ended = DragHandler.EndDragSession(started, new DragPointerInput
            {
                PointerId = "7",
                Position = new Point2(5, 0)
            });
            Assert.Equal("ignored", ended.Outcome.Type);
            Assert.Equal("pointer_mismatch", ended.Outcome.Reason);
        }

        [Fact(DisplayName = "NaN 指针永不匹配(复刻 TS NaN !== NaN)")]
        public void NaNPointerNeverMatches()
        {
            var started = DragHandler.BeginDragSession(new BeginDragInput
            {
                PointerId = double.NaN,
                EntityId = "e",
                Position = new Point2(0, 0)
            });

            var ended = DragHandler.EndDragSession(started, new DragPointerInput
            {
                PointerId = double.NaN,
                Position = new Point2(5, 0)
            });
            Assert.Equal("ignored", ended.Outcome.Type);
            Assert.Equal("pointer_mismatch", ended.Outcome.Reason);
        }
    }
}
