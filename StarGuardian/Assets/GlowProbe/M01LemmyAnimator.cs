// LemmyActor.ts / LemmyActorContract.ts 的 Unity 等价播放器。
// 资源、fps、loop/hold、skipLeadFrames、pacing、事件帧、contain 适配和脚底锚点全部消费
// M01RenderContract；不再使用旧探针的固定 180/512 缩放。
#nullable enable

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.M01.Rendering;
using UnityEngine;

public sealed class M01LemmyAnimator : MonoBehaviour
{
    private const int MaxCachedClips = 3;
    private SpriteRenderer sr = null!;
    private readonly Dictionary<string, Sprite[]> clips = new();
    private readonly M01LemmyClipCachePolicy clipCachePolicy = new(MaxCachedClips);
    private Coroutine? unusedAssetCleanup;
    private Sprite[] cur = System.Array.Empty<Sprite>();
    private int[] sourceFrameIndices = System.Array.Empty<int>();
    private double[] frameDurationsMs = System.Array.Empty<double>();
    private M01LemmyActionContract? spec;
    private int frame;
    private double timerMs;
    private bool facingRight = true;

    /// <summary>非循环动作是否播完(循环恒 false)。</summary>
    public bool Done { get; private set; }
    public string? CurrentAction => spec?.Id;
    public bool FacingRight => facingRight;
    public event Action<string>? FrameEvent;

    private void Awake()
    {
        var visual = new GameObject("LemmySprite");
        visual.transform.SetParent(transform, false);
        sr = visual.AddComponent<SpriteRenderer>();
        sr.sortingOrder = 40; // 莱米在盘面(<40)之上、篮子(20)之上
    }

    private Sprite[] Load(string action)
    {
        if (!clips.TryGetValue(action, out var arr))
        {
            arr = Resources.LoadAll<Sprite>("Art/M01/lemmy/" + action)
                .Where(sprite => !sprite.name.EndsWith("-preview", StringComparison.OrdinalIgnoreCase))
                .ToArray();
            System.Array.Sort(arr, (a, b) => string.CompareOrdinal(a.name, b.name));
            var expected = M01LemmyPlayback.Find(action).FrameCount;
            if (arr.Length != expected)
            {
                Debug.LogError($"M01LemmyAnimator: {action} expected {expected} frames, loaded {arr.Length}");
            }
            clips[action] = arr;
            TouchClip(action);
            TrimClipCache(action);
        }
        else
        {
            TouchClip(action);
        }
        return arr;
    }

    private void TouchClip(string action)
    {
        clipCachePolicy.Touch(action);
    }

    private void TrimClipCache(string loadingAction)
    {
        foreach (var evictedAction in clipCachePolicy.RecordLoaded(loadingAction, spec?.Id))
        {
            if (!clips.Remove(evictedAction, out var evicted)) continue;
            foreach (var sprite in evicted)
            {
                if (sprite != null) Resources.UnloadAsset(sprite);
            }
            ScheduleUnusedAssetCleanup();
        }
    }

    private void ScheduleUnusedAssetCleanup()
    {
        if (unusedAssetCleanup == null)
        {
            unusedAssetCleanup = StartCoroutine(UnloadUnusedAssetsAfterFrame());
        }
    }

    private IEnumerator UnloadUnusedAssetsAfterFrame()
    {
        yield return null;
        yield return Resources.UnloadUnusedAssets();
        unusedAssetCleanup = null;
    }

    /// <summary>按 Cocos 动作契约播放；一次性动作播完是否留末帧由 holdLast 决定。</summary>
    public void Play(string action)
    {
        StartPlayback(action, reverse: false);
    }

    /// <summary>Cocos playFrameAction(action, { reverse: true })；拾起后的 crouch 倒放起身使用。</summary>
    public void PlayReverse(string action)
    {
        StartPlayback(action, reverse: true);
    }

    public void PlayRange(string action, int sourceStartFrame, int sourceFrameCount)
    {
        StartPlayback(action, reverse: false, sourceStartFrame, sourceFrameCount);
    }

    public void PlayRangeReverse(string action, int sourceStartFrame, int sourceFrameCount)
    {
        StartPlayback(action, reverse: true, sourceStartFrame, sourceFrameCount);
    }

    private void StartPlayback(
        string action,
        bool reverse,
        int? sourceStartFrame = null,
        int? sourceFrameCount = null)
    {
        var arr = Load(action);
        if (arr.Length == 0) return;
        spec = M01LemmyPlayback.Find(action);
        sourceFrameIndices = sourceStartFrame.HasValue && sourceFrameCount.HasValue
            ? M01LemmyPlayback.FrameRangeIndices(
                action,
                arr.Length,
                sourceStartFrame.Value,
                sourceFrameCount.Value,
                reverse)
            : M01LemmyPlayback.PlayableFrameIndices(action, arr.Length);
        if (reverse && !sourceStartFrame.HasValue) System.Array.Reverse(sourceFrameIndices);
        cur = sourceFrameIndices.Select(index => arr[index]).ToArray();
        frameDurationsMs = sourceStartFrame.HasValue && sourceFrameCount.HasValue
            ? M01LemmyPlayback.FrameRangeDurationsMs(
                action,
                arr.Length,
                sourceStartFrame.Value,
                sourceFrameCount.Value,
                reverse)
            : M01LemmyPlayback.FrameDurationsMs(action, arr.Length);
        if (reverse && !sourceStartFrame.HasValue) System.Array.Reverse(frameDurationsMs);
        frame = 0;
        timerMs = 0;
        Done = false;
        ApplyFrame();
    }

    /// <summary>旧探针 API 兼容入口；为保证 1:1，loop/fps 参数不再覆盖 Cocos 契约。</summary>
    public void Play(string action, bool loop, float fps) => Play(action);

    public void SetFacing(bool right)
    {
        facingRight = right;
        if (cur.Length > 0) ApplyFrame();
    }

    /// <summary>把莱米节点锚放到 Cocos 坐标；可见精灵在子节点里做脚底补偿。</summary>
    public void SetCocosPosition(float cocosX, float cocosY)
    {
        transform.localPosition = M01CocosTransform.WorldPosition(cocosX, cocosY);
    }

    private void Update()
    {
        if (cur.Length == 0 || spec == null || (Done && !spec.Loop)) return;
        timerMs += Time.deltaTime * 1000d;
        while (frameDurationsMs.Length > frame && timerMs >= frameDurationsMs[frame])
        {
            timerMs -= frameDurationsMs[frame];
            var previousSourceFrame = sourceFrameIndices[frame];
            frame++;
            if (frame >= cur.Length)
            {
                if (spec.Loop)
                {
                    frame = 0;
                }
                else
                {
                    frame = cur.Length - 1;
                    Done = true;
                    break;
                }
            }

            var eventFrame = M01LemmyPlayback.EventFrame(spec.Id, clips[spec.Id].Length);
            var currentSourceFrame = sourceFrameIndices[frame];
            if (eventFrame >= 0 && previousSourceFrame < eventFrame && currentSourceFrame >= eventFrame)
            {
                FrameEvent?.Invoke(spec.EventId!);
            }
            ApplyFrame();
            if (!spec.Loop && frame == cur.Length - 1)
            {
                Done = true;
                break;
            }
        }
    }

    private void ApplyFrame()
    {
        if (cur.Length == 0) return;
        sr.sprite = cur[frame];
        var fitted = M01RenderGeometry.AspectContentSize(
            sr.sprite.bounds.size.x * sr.sprite.pixelsPerUnit,
            sr.sprite.bounds.size.y * sr.sprite.pixelsPerUnit,
            M01RenderContract.LemmyDisplayPx,
            M01RenderContract.LemmyDisplayPx,
            "contain");
        var lift = M01RenderGeometry.LemmyFootLiftPx(fitted.Height, M01RenderContract.LemmyDisplayPx);
        M01SpriteAspect.Fit(
            sr,
            M01RenderContract.LemmyDisplayPx,
            M01RenderContract.LemmyDisplayPx,
            "contain",
            additionalLiftPx: lift,
            flipX: facingRight);
    }
}
