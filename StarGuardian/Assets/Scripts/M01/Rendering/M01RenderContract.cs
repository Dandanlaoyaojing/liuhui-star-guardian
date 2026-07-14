// M01 Cocos → Unity 渲染等价契约。
// 纯 C#，不得引用 UnityEngine；由 xUnit 与 Unity 共同编译。
#nullable enable

using System;
using System.Collections.Generic;

namespace StarGuardian.M01.Rendering
{
    public sealed class M01LemmyActionContract
    {
        public string Id { get; }
        public int FrameCount { get; }
        public double Fps { get; }
        public bool Loop { get; }
        public bool HoldLast { get; }
        public int SkipLeadFrames { get; }
        public int? EventFrame { get; }
        public string? EventId { get; }
        public int? PeakFrame { get; }
        public double PeakHoldMs { get; }
        public double? TailFps { get; }

        public string CocosResourcePath => M01RenderContract.LemmyCocosResourceRoot + "/" + Id;
        public string UnityResourcePath => M01RenderContract.LemmyUnityResourceRoot + "/" + Id;

        public M01LemmyActionContract(
            string id,
            int frameCount,
            double fps,
            bool loop,
            bool holdLast,
            int skipLeadFrames = 0,
            int? eventFrame = null,
            string? eventId = null,
            int? peakFrame = null,
            double peakHoldMs = 0,
            double? tailFps = null)
        {
            Id = id;
            FrameCount = frameCount;
            Fps = fps;
            Loop = loop;
            HoldLast = holdLast;
            SkipLeadFrames = skipLeadFrames;
            EventFrame = eventFrame;
            EventId = eventId;
            PeakFrame = peakFrame;
            PeakHoldMs = peakHoldMs;
            TailFps = tailFps;
        }
    }

    public static class M01RenderContract
    {
        // assets/scripts/cocos/M01GreyboxLayout.ts
        public const double DesignWidthPx = 960;
        public const double DesignHeightPx = 640;
        public const double PixelsPerUnit = 100;
        public const double StandardPieceDisplayPx = 56;

        // assets/scripts/cocos/M01GreyboxArt.ts + M01IntroLayout.ts
        public const double GearDisplayPx = 581;
        public const double BasketScale = 1.12;
        public const double BasketDisplayWidthPx = 387 * BasketScale;
        public const double BasketDisplayHeightPx = 242 * BasketScale;

        // assets/scripts/cocos/M01PhysicsBoundary.ts
        public const double GroundDisplayWidthPx = 960;
        public const double GroundDisplayHeightPx = 39;
        public const double PhysicsGroundYPx = -270;

        // assets/scripts/cocos/M01GreyboxBootstrap.ts
        public const double HintDisplayPx = 62;

        // assets/scripts/cocos/LemmyActor.ts
        public const double LemmyDisplayPx = 180;
        public const double LemmyCanonicalFitScale = 0.854;
        public const double LemmyFrameFootFraction = 490d / 512d;

        // assets/resources/configs/stage1/m01-memory-gear.json
        public const double CompletionWidthPx = 960;
        public const double CompletionHeightPx = 640;

        public const string GroundCocosResourcePath =
            "art/stage1-m01/runtime-sprites/surfaces/m01-ground-line/spriteFrame";
        public const string HintCocosResourcePath = "art/icons/icon-hint/spriteFrame";
        public const string CompletionCocosResourcePath = "art/stage1-m01/m01-completion-cutscene";
        public const string LemmyCocosResourceRoot = "art/characters/lemmy";
        public const string LemmyUnityResourceRoot = "Art/M01/lemmy";

        // assets/scripts/cocos/LemmyActorContract.ts + current source asset counts.
        // FrameCount intentionally records the files actually present in the frozen source snapshot;
        // comments in the TS file are not used as a substitute for the filesystem truth.
        public static readonly IReadOnlyList<M01LemmyActionContract> LemmyActions =
            Array.AsReadOnly(new[]
            {
                new M01LemmyActionContract("idle", 24, 12, true, false),
                new M01LemmyActionContract("walk", 48, 16, true, false),
                new M01LemmyActionContract("reach", 36, 12, false, true, eventFrame: 23, eventId: "reach_contact"),
                new M01LemmyActionContract("reachmiss", 40, 18, false, true),
                new M01LemmyActionContract("headshake", 15, 8, false, true),
                new M01LemmyActionContract("turnface", 24, 30, false, false),
                new M01LemmyActionContract("puzzled", 30, 14, false, true),
                new M01LemmyActionContract("nod", 44, 16, false, true),
                new M01LemmyActionContract("nodside", 27, 14, false, true),
                new M01LemmyActionContract("startle", 29, 60, false, true, 4, peakFrame: 6, peakHoldMs: 420, tailFps: 13),
                new M01LemmyActionContract("startleback", 14, 100, false, true, peakFrame: 2, peakHoldMs: 420, tailFps: 16),
                new M01LemmyActionContract("crouch", 40, 50, false, true),
                new M01LemmyActionContract("earsback", 40, 48, false, true),
                new M01LemmyActionContract("idleback", 19, 10, true, false),
                new M01LemmyActionContract("walkback", 12, 15, true, false),
                new M01LemmyActionContract("headbutt", 124, 48, false, true, eventFrame: 66, eventId: "headbutt_contact"),
                new M01LemmyActionContract("earsup", 38, 24, false, true),
                new M01LemmyActionContract("celebrate", 93, 28, false, true)
            });
    }
}
