// M01 拼片指针交互的引擎无关契约。
// 数值与 assets/scripts/cocos/M01GreyboxBootstrap.ts 保持一致，供 Unity 胶水层与 xUnit 共用。

using System;
using StarGuardian.Interaction;

namespace StarGuardian.M01
{
    public static class M01FragmentPointerRules
    {
        public const double RotatePinHoldSeconds = 2;

        public static bool IsRotateTap(double totalDeltaX, double totalDeltaY)
        {
            var threshold = DragHandler.ClickDragThreshold;
            return totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY <= threshold * threshold;
        }

        public static double RebaselineRotation(double visualDegrees)
        {
            var quarterTurns = Math.Floor(visualDegrees / 90d + 0.5d);
            return NormalizeRotation(quarterTurns * 90d);
        }

        public static double NextClockwiseRotation(double currentDegrees) =>
            NormalizeRotation(currentDegrees + 90d);

        public static bool CanPickFragment(bool physicsSettled, bool spilledOut) =>
            physicsSettled || spilledOut;

        private static double NormalizeRotation(double degrees)
        {
            var normalized = degrees % 360d;
            return normalized < 0d ? normalized + 360d : normalized;
        }
    }
}
