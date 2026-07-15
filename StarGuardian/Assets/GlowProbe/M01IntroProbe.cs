// M01IntroSequence.ts 的 Unity 编排层。
// 相位、坐标、displaySize、三次顶篮、Lemmy 动作、软绳、手电砸头/拾取均复用 Cocos 真值。
#nullable enable

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.M01;
using StarGuardian.M01.Rendering;
using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(M01BoardProbe))]
public sealed class M01IntroProbe : MonoBehaviour
{
    private const float Ppu = (float)M01RenderContract.PixelsPerUnit;
    private const float GroundY = -270f;
    private const float LemmyOffscreenX = -460f;
    private const float LemmyPlatformFrontX = -320f;
    private const float LemmyUnderBasketX = 265f;
    private const float LemmyY = -190f;
    private const float LemmyRoamMinX = -440f;
    private const float LemmyRoamMaxX = 430f;
    private const float BasketX = 300f;
    private const float BasketBottomY = -167f;
    private const float BasketNailOffsetY = 117.6f; // 105 × 1.12
    private const float BasketAttachOffsetY = -13.278f;
    private const float BasketKnotLeftX = -111f;
    private const float BasketKnotLeftY = -27f;
    private const float BasketKnotRightX = 109f;
    private const float BasketKnotRightY = -28f;
    private const float RopeRawWidth = 204f;
    private const float RopeRawHeight = 550f;
    private const float RopeTrimmedWidth = 29f;
    private const float RopeTrimmedHeight = 550f;
    private const float RopeDisplayWidth = 12f;
    private const float HeadbuttX = BasketX - 40f;
    private const float HeadbuttTolerance = 80f;
    private const float EarFoldCenterX = BasketX;
    private const float EarFoldHalfWidth = 140f;
    private const float BasketReachX = HeadbuttX - 90f;
    private const float WalkSpeed = (LemmyUnderBasketX - LemmyOffscreenX) / 7.2f;
    private const float WalkBoostWindow = 0.65f;
    private const float WalkBoostStep = 0.7f;
    private const float WalkBoostMax = 3f;
    private const float FlashlightHeadDy = 56f;
    private const float FlashlightLyingAngle = -82f;
    private const float HeldFlashlightX = 6f;
    private const float HeldFlashlightY = -34f;
    private const float HeldFlashlightAngle = -113f;
    private const float PickupStandOff = 30f;
    private const float PickupHandDrop = 30f;
    private const float PickupRiseSeconds = 0.7f;
    private const float FragmentSettleSeconds = 3.6f;

    private static readonly RopeOptions RopeOptions = new()
    {
        Gravity = -1100,
        Damping = 0.995,
        Iterations = 24,
        SubstepDt = 1d / 120d
    };

    public bool IntroDone => phase == M01IntroPhase.Acquired;
    public M01IntroPhase Phase => phase;

    /// <summary>Cocos playCelebrationThenIdle：隐藏手电，celebrate 完成后回调并接 idle。</summary>
    public void PlayCelebrationThenIdle(Action onCelebrated)
    {
        StartCoroutine(Celebrate(onCelebrated));
    }

    private M01BoardProbe board = null!;
    private M01DragProbe? drag;
    private M01FlashlightProbe? flashlight;
    private M01LemmyAnimator? lemmy;
    private GameObject? sceneRoot;
    private GameObject? basket;
    private Rigidbody2D? basketBody;
    private SpriteRenderer? basketSprite;
    private GameObject? frontOccluder;
    private GameObject? flashlightObject;
    private SpriteRenderer? flashlightSprite;
    private readonly List<SpriteRenderer> ropeStraps = new();
    private readonly List<GameObject> basketCavityWalls = new();
    private readonly Dictionary<M01PhysicsShape, PhysicsMaterial2D> fragmentMaterials = new();
    private readonly Dictionary<GameObject, Vector3> frozenBasketLocalPositions = new();
    private readonly Dictionary<GameObject, Quaternion> frozenBasketLocalRotations = new();
    private readonly List<PhysicsMaterial2D> runtimePhysicsMaterials = new();
    private readonly HashSet<int> releasedFragmentIndices = new();
    private RopeState? rope;
    private Coroutine? basketPileFreezeRoutine;
    private M01IntroPhase phase = M01IntroPhase.Approaching;
    private Coroutine? walkRoutine;
    private bool actionInProgress;
    private bool earsFolded;
    private int releasedCount;
    private float walkBoost = 1f;
    private float lastRoamTap = float.NegativeInfinity;
    private int pointerReservedFrame = -1;
    private bool groundSettled;

    private float BasketDisplayWidth => (float)M01IntroLayout.BasketDisplaySize.Width;
    private float BasketDisplayHeight => (float)M01IntroLayout.BasketDisplaySize.Height;
    private float BasketY => BasketBottomY + BasketDisplayHeight / 2f;
    private float NailY => BasketY + BasketNailOffsetY;

    private void Awake()
    {
        board = GetComponent<M01BoardProbe>();
        drag = GetComponent<M01DragProbe>();
        flashlight = GetComponent<M01FlashlightProbe>();
    }

    private void Start()
    {
        if (!Application.isPlaying || board.Layout == null) return;
        Time.fixedDeltaTime = (float)M01IntroLayout.CocosPhysicsFixedStepSeconds;
        if (drag != null) drag.BeginIntroPickupGate();
        if (flashlight != null) flashlight.Acquired = false;
        BuildIntroScene();
        StartCoroutine(BeginWalk());
    }

    private void BuildIntroScene()
    {
        var boardRoot = GameObject.Find("~M01BoardRoot");
        sceneRoot = new GameObject("~M01IntroRuntime");
        if (boardRoot != null) sceneRoot.transform.SetParent(boardRoot.transform, false);

        // Cocos 顺序: Lemmy 先挂，篮子后挂，顶篮时兔头自然被篮体遮挡。
        var lemmyObject = new GameObject("M01Lemmy");
        lemmyObject.transform.SetParent(sceneRoot.transform, false);
        lemmy = lemmyObject.AddComponent<M01LemmyAnimator>();
        lemmy.SetCocosPosition(LemmyOffscreenX, LemmyY);

        basket = new GameObject("M01IntroBasket");
        basket.transform.SetParent(sceneRoot.transform, false);
        SetCocosPosition(basket.transform, BasketX, BasketY);
        basketSprite = AddVisual(basket.transform, "basketVisual", "m01-basket-hanging-empty",
            BasketDisplayWidth, BasketDisplayHeight, 50);
        if (basketSprite != null)
            basketSprite.color = ToUnityColor(M01VisualParity.UnityLinearBasketSpriteTint);

        SpawnRopeAndNail();
        SpawnBasketInnerCavity();
        StageFragmentsInBasket();

        frontOccluder = new GameObject("M01IntroBasketFrontOccluder");
        frontOccluder.transform.SetParent(basket.transform, false);
        var frontRenderer = AddVisual(frontOccluder.transform, "visual", "m01-basket-front-occluder",
            BasketDisplayWidth, BasketDisplayHeight, 55);
        if (frontRenderer != null)
            frontRenderer.color = ToUnityColor(M01VisualParity.UnityLinearBasketSpriteTint);

        flashlightObject = new GameObject("M01IntroFlashlight");
        flashlightObject.transform.SetParent(sceneRoot.transform, false);
        SetCocosPosition(flashlightObject.transform, BasketX, BasketY);
        flashlightSprite = AddVisual(
            flashlightObject.transform,
            "visual",
            "m01-single-flashlight-tool",
            M01IntroLayout.FlashlightCanvasDisplaySize.Width,
            M01IntroLayout.FlashlightCanvasDisplaySize.Height,
            60);
        flashlightObject.SetActive(false);

        SpawnBoundary("ground", 0, GroundY - 12f, 960, 24, 0.82f);
        SpawnBoundary("left", -492, 0, 24, 640, 0.25f);
        SpawnBoundary("right", 492, 0, 24, 640, 0.25f);
    }

    private void SpawnBoundary(string id, float x, float y, float width, float height, float friction)
    {
        if (sceneRoot == null) return;
        var boundary = new GameObject($"M01IntroBoundary:{id}");
        boundary.transform.SetParent(sceneRoot.transform, false);
        SetCocosPosition(boundary.transform, x, y);
        var collider = boundary.AddComponent<BoxCollider2D>();
        collider.size = new Vector2(width / Ppu, height / Ppu);
        collider.sharedMaterial = CreatePhysicsMaterial($"M01IntroBoundary:{id}", friction, 0f);
    }

    private void SpawnRopeAndNail()
    {
        if (sceneRoot == null) return;
        rope = M01RopePhysics.CreateRope(BasketX, NailY, BasketX, BasketY + BasketAttachOffsetY, 12, 0.05);
        for (var i = 0; i < 2; i++)
        {
            var strap = new GameObject("M01IntroRopeStrap");
            strap.transform.SetParent(sceneRoot.transform, false);
            var renderer = AddVisual(strap.transform, "visual", "m01-rope-segment", 12, 100, 48);
            if (renderer != null) renderer.color = new Color32(220, 220, 220, 255);
            if (renderer != null) ropeStraps.Add(renderer);
        }

        var nail = new GameObject("M01IntroBasketNail");
        nail.transform.SetParent(sceneRoot.transform, false);
        SetCocosPosition(nail.transform, BasketX, NailY);
        var nailW = 93f * (BasketDisplayWidth / 1586f);
        var nailH = 115f * (BasketDisplayWidth / 1586f);
        AddVisual(nail.transform, "visual", "m01-basket-nail", nailW, nailH, 56, 0.5, 0.33);
        DrawRope();
    }

    private void SpawnBasketInnerCavity()
    {
        if (basket == null) return;
        basketBody = basket.AddComponent<Rigidbody2D>();
        basketBody.bodyType = RigidbodyType2D.Kinematic;
        basketBody.gravityScale = 0f;
        basketBody.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        basketBody.interpolation = RigidbodyInterpolation2D.Interpolate;

        var material = CreatePhysicsMaterial(
            "M01BasketInnerCavity",
            (float)M01IntroLayout.InnerCavity.WallFriction,
            (float)M01IntroLayout.InnerCavity.WallRestitution);
        foreach (var wall in M01IntroLayout.InnerCavityWalls)
        {
            var wallObject = new GameObject($"M01IntroBasketInnerCavity:{wall.Id}");
            wallObject.transform.SetParent(basket.transform, false);
            SetCocosPosition(wallObject.transform, (float)wall.Center.X, (float)wall.Center.Y);
            wallObject.transform.localRotation = Quaternion.Euler(0f, 0f, (float)wall.AngleDeg);
            var collider = wallObject.AddComponent<BoxCollider2D>();
            collider.size = new Vector2((float)wall.Size.Width / Ppu, (float)wall.Size.Height / Ppu);
            collider.sharedMaterial = material;
            basketCavityWalls.Add(wallObject);
        }
    }

    private void StageFragmentsInBasket()
    {
        if (basket == null || sceneRoot == null || board.Layout == null) return;
        for (var i = 0; i < board.Layout.Fragments.Count; i++)
        {
            var token = board.Layout.Fragments[i];
            if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment)) continue;
            var offset = M01IntroLayout.PileOffsets[i % M01IntroLayout.PileOffsets.Count];
            fragment.transform.SetParent(basket.transform, false);
            SetCocosPosition(fragment.transform, (float)offset.X, (float)offset.Y);
            fragment.transform.localRotation = Quaternion.identity;

            var renderers = fragment.GetComponentsInChildren<SpriteRenderer>();
            for (var r = 0; r < renderers.Length; r++) renderers[r].sortingOrder = 52 + r;
            ApplyFragmentPhysics(fragment, token, M01IntroBasketPiecePhase.Settling);
        }
        ScheduleBasketPileFreeze();
    }

    private void ApplyFragmentPhysics(
        GameObject fragment,
        M01GreyboxTokenNode token,
        M01IntroBasketPiecePhase phase)
    {
        var shape = ResolvePhysicsShape(token.ShapeToken);
        var body = fragment.GetComponent<Rigidbody2D>();
        if (body == null) body = fragment.AddComponent<Rigidbody2D>();
        body.simulated = false;
        var contract = M01IntroLayout.ResolveBasketPiecePhysics(phase);
        // Unity 只允许给“正在模拟的 Dynamic + AutoMass”刚体上的 Collider2D 写 density。
        // 同一调用栈内先临时满足该前置条件，写完几何/密度再切到目标 phase；FixedUpdate 不会插进来。
        body.bodyType = RigidbodyType2D.Dynamic;
        body.useAutoMass = true;
        body.simulated = true;
        var collider = EnsureFragmentCollider(fragment, token, shape);
        body.simulated = false;
        if (!contract.Simulated)
        {
            body.linearVelocity = Vector2.zero;
            body.angularVelocity = 0f;
            body.gravityScale = 0f;
            body.bodyType = RigidbodyType2D.Kinematic;
            if (basket != null) fragment.transform.SetParent(basket.transform, true);
            frozenBasketLocalPositions[fragment] = fragment.transform.localPosition;
            frozenBasketLocalRotations[fragment] = fragment.transform.localRotation;
            return;
        }

        frozenBasketLocalPositions.Remove(fragment);
        frozenBasketLocalRotations.Remove(fragment);
        // Cocos 在 Settling/Headbutting 阶段始终把刚体留在 basketNode 下；只有真正释放时才改挂根节点。
        // 篮子和内胆由绳子一起移动，保留同一局部参考系才能得到相同的物理堆叠输入。
        if (basket != null) fragment.transform.SetParent(basket.transform, true);
        body.gravityScale = (float)contract.GravityScale;
        body.linearDamping = (float)M01IntroLayout.FragmentLinearDamping;
        body.angularDamping = (float)M01IntroLayout.FragmentAngularDamping;
        body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        body.interpolation = RigidbodyInterpolation2D.Interpolate;
        body.sleepMode = RigidbodySleepMode2D.NeverSleep;
        body.position = fragment.transform.position;
        body.rotation = fragment.transform.eulerAngles.z;
        body.linearVelocity = Vector2.zero;
        body.angularVelocity = 0f;
        collider.enabled = true;
        body.simulated = true;
    }

    private Collider2D EnsureFragmentCollider(
        GameObject fragment,
        M01GreyboxTokenNode token,
        M01PhysicsShape shape)
    {
        var scaleX = Mathf.Max(Mathf.Abs(fragment.transform.lossyScale.x), 0.0001f);
        var scaleY = Mathf.Max(Mathf.Abs(fragment.transform.lossyScale.y), 0.0001f);
        var visualSize = Math.Max(token.Size.Width, token.Size.Height);
        var geometry = M01PhysicsCollider.Build(
            shape,
            visualSize + M01PhysicsCollider.ResolveVisualPadding(shape));
        Collider2D collider;
        if (geometry is M01PhysicsCircleCollider circleGeometry)
        {
            var circle = fragment.GetComponent<CircleCollider2D>();
            if (circle == null) circle = fragment.AddComponent<CircleCollider2D>();
            circle.radius = (float)circleGeometry.Radius / (Ppu * Mathf.Min(scaleX, scaleY));
            collider = circle;
        }
        else
        {
            var polygonGeometry = (M01PhysicsPolygonCollider)geometry;
            var polygon = fragment.GetComponent<PolygonCollider2D>();
            if (polygon == null) polygon = fragment.AddComponent<PolygonCollider2D>();
            polygon.points = polygonGeometry.Points
                .Select(point => new Vector2(
                    (float)point.X / (Ppu * scaleX),
                    (float)point.Y / (Ppu * scaleY)))
                .ToArray();
            collider = polygon;
        }

        var material = ResolveFragmentPhysicsMaterial(shape);
        collider.sharedMaterial = material;
        collider.density = (float)M01IntroLayout.CocosColliderDensityToUnity(
            M01IntroLayout.FragmentDensity,
            Ppu);
        collider.isTrigger = false;
        return collider;
    }

    private PhysicsMaterial2D ResolveFragmentPhysicsMaterial(M01PhysicsShape shape)
    {
        if (fragmentMaterials.TryGetValue(shape, out var material)) return material;
        var spec = M01IntroLayout.ResolveFragmentMaterial(shape);
        material = CreatePhysicsMaterial(
            $"M01Fragment:{shape}",
            (float)spec.Friction,
            (float)spec.Restitution);
        fragmentMaterials.Add(shape, material);
        return material;
    }

    private PhysicsMaterial2D CreatePhysicsMaterial(string name, float friction, float bounciness)
    {
        var material = new PhysicsMaterial2D(name)
        {
            friction = friction,
            bounciness = bounciness,
            hideFlags = HideFlags.DontSave
        };
        runtimePhysicsMaterials.Add(material);
        return material;
    }

    private static M01PhysicsShape ResolvePhysicsShape(string shapeToken) => shapeToken switch
    {
        "circle" => M01PhysicsShape.Circle,
        "triangle" => M01PhysicsShape.Triangle,
        _ => M01PhysicsShape.Hexagon
    };

    private void SetUnreleasedBasketPiecePhase(M01IntroBasketPiecePhase phase)
    {
        if (board.Layout == null) return;
        for (var i = 0; i < board.Layout.Fragments.Count; i++)
        {
            if (releasedFragmentIndices.Contains(i)) continue;
            var token = board.Layout.Fragments[i];
            if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment)) continue;
            ApplyFragmentPhysics(fragment, token, phase);
        }
        Physics2D.SyncTransforms();
    }

    private void ScheduleBasketPileFreeze()
    {
        if (basketPileFreezeRoutine != null) StopCoroutine(basketPileFreezeRoutine);
        basketPileFreezeRoutine = StartCoroutine(FreezeBasketPileAfterDelay());
    }

    private IEnumerator FreezeBasketPileAfterDelay()
    {
        yield return new WaitForSeconds((float)M01IntroLayout.BasketPileSettleSeconds);
        ApplyCocosSettledBasketPose();
        SetUnreleasedBasketPiecePhase(M01IntroBasketPiecePhase.Frozen);
        basketPileFreezeRoutine = null;
    }

    private void ApplyCocosSettledBasketPose()
    {
        if (basket == null || board.Layout == null) return;
        for (var index = 0; index < board.Layout.Fragments.Count; index += 1)
        {
            if (releasedFragmentIndices.Contains(index)) continue;
            var token = board.Layout.Fragments[index];
            if (!M01IntroLayout.TryResolveCocosSettledPilePose(token.ControllerId, out var pose)) continue;
            if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment)) continue;

            fragment.transform.SetParent(basket.transform, false);
            SetCocosPosition(fragment.transform, (float)pose.X, (float)pose.Y);
            fragment.transform.localRotation = Quaternion.Euler(0f, 0f, (float)pose.RotationDeg);
        }
        Physics2D.SyncTransforms();
    }

    private void SetBasketCavityActive(bool active)
    {
        foreach (var wall in basketCavityWalls) wall.SetActive(active);
    }

    private void SyncFrozenBasketPieces()
    {
        if (basket == null) return;
        foreach (var entry in frozenBasketLocalPositions)
        {
            var fragment = entry.Key;
            if (fragment == null) continue;
            if (fragment.transform.parent != basket.transform)
            {
                fragment.transform.SetParent(basket.transform, false);
            }
            fragment.transform.localPosition = entry.Value;
            if (frozenBasketLocalRotations.TryGetValue(fragment, out var rotation))
            {
                fragment.transform.localRotation = rotation;
            }
        }
    }

    private void Update()
    {
        if (!Application.isPlaying) return;
        UpdateRope();
        SyncFrozenBasketPieces();
        SyncFragmentPickupEligibility();
        SyncHeldFlashlight();

        var pointer = Pointer.current;
        if (pointer == null || !pointer.press.wasPressedThisFrame) return;
        var point = ScreenToCocos(pointer.position.ReadValue());
        if (actionInProgress) return;

        if (phase == M01IntroPhase.WaitingPickup && flashlightObject != null)
        {
            var fp = ToCocos(flashlightObject.transform.position);
            if (IsFlashlightTapHit(point, fp))
            {
                pointerReservedFrame = Time.frameCount;
                StartCoroutine(BeginPickup());
                return;
            }
        }

        if ((phase == M01IntroPhase.Roaming || phase == M01IntroPhase.ReadyToHeadbutt) && IsBasketHit(point))
        {
            pointerReservedFrame = Time.frameCount;
            StartCoroutine(HandleBasketTap());
            return;
        }

        if (phase == M01IntroPhase.Roaming || phase == M01IntroPhase.ReadyToHeadbutt ||
            phase == M01IntroPhase.WaitingPickup || phase == M01IntroPhase.Acquired)
        {
            // Cocos 路由：点到可拾拼片时由 per-node 拖拽消费，不把同一次点击再解释成莱米走路。
            if (drag != null && drag.CanStartFragmentPointerAt(point)) return;
            // acquired 路由优先级：fragment > held flashlight > ground。
            if (phase == M01IntroPhase.Acquired && flashlight != null &&
                flashlight.TryCycleHeldFlashlightAt(point))
            {
                pointerReservedFrame = Time.frameCount;
                return;
            }
            var now = Time.unscaledTime;
            walkBoost = now - lastRoamTap < WalkBoostWindow ? Mathf.Min(walkBoost + WalkBoostStep, WalkBoostMax) : 1f;
            lastRoamTap = now;
            StartRoam(Mathf.Clamp(point.x, LemmyRoamMinX, LemmyRoamMaxX));
        }
    }

    /// <summary>落地手电和吊篮点击优先于拼片，复刻 M01PuzzleInputRouter 的阶段路由。</summary>
    public bool ReservesPointerForIntroAt(Vector2 point)
    {
        // StartCoroutine 会在同一帧内先推进 phase；保留显式消费帧，避免 DragProbe 后执行时把
        // “点落地手电”又识别成一次重叠拼片拾取。
        if (pointerReservedFrame == Time.frameCount) return true;
        if (phase == M01IntroPhase.WaitingPickup && flashlightObject != null)
        {
            var flashlightPosition = ToCocos(flashlightObject.transform.position);
            if (IsFlashlightTapHit(point, flashlightPosition)) return true;
        }
        return (phase == M01IntroPhase.Roaming || phase == M01IntroPhase.ReadyToHeadbutt) && IsBasketHit(point);
    }

    private void SyncFragmentPickupEligibility()
    {
        if (drag == null || board.Layout == null || basket == null || sceneRoot == null) return;
        var basketCenter = ToCocos(basket.transform.position);
        for (var i = 0; i < board.Layout.Fragments.Count; i++)
        {
            var token = board.Layout.Fragments[i];
            if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment)) continue;
            var point = ToCocos(fragment.transform.position);
            var insideBasket =
                Mathf.Abs(point.x - basketCenter.x) < BasketDisplayWidth / 2f &&
                Mathf.Abs(point.y - basketCenter.y) < BasketDisplayHeight / 2f;
            var releasedToStage = releasedFragmentIndices.Contains(i) && fragment.transform.parent == sceneRoot.transform;
            drag.SetFragmentSpilledOut(token.ControllerId, releasedToStage && !insideBasket);
        }
    }

    private void UpdateRope()
    {
        if (rope == null || basket == null) return;
        M01RopePhysics.StepRope(rope, Math.Min(Time.deltaTime, 1f / 30f), RopeOptions);
        var tail = rope.Pts[rope.Pts.Count - 1];
        var localTarget = M01CocosTransform.WorldPosition((float)tail.X, (float)(tail.Y - BasketAttachOffsetY));
        var worldTarget = basket.transform.parent == null
            ? localTarget
            : basket.transform.parent.TransformPoint(localTarget);
        if (basketBody != null)
        {
            basketBody.MovePosition(worldTarget);
        }
        else
        {
            basket.transform.position = worldTarget;
        }
        DrawRope();
    }

    private void DrawRope()
    {
        if (rope == null || basket == null || ropeStraps.Count < 2) return;
        var nail = rope.Pts[0];
        var center = ToCocos(basket.transform.position);
        var knots = new[]
        {
            new Vector2(center.x + BasketKnotLeftX, center.y + BasketKnotLeftY),
            new Vector2(center.x + BasketKnotRightX, center.y + BasketKnotRightY)
        };
        for (var i = 0; i < 2; i++)
        {
            var end = knots[i];
            var dx = end.x - (float)nail.X;
            var dy = end.y - (float)nail.Y;
            var length = Mathf.Max(0.001f, Mathf.Sqrt(dx * dx + dy * dy));
            var renderer = ropeStraps[i];
            SetCocosPosition(renderer.transform.parent!, ((float)nail.X + end.x) / 2f, ((float)nail.Y + end.y) / 2f);
            renderer.transform.parent!.localRotation = Quaternion.Euler(0, 0, Mathf.Atan2(dx, -dy) * Mathf.Rad2Deg);
            // Cocos 的 SpriteFrame 把 204px 透明画布裁成 29px 绳芯后再显示为 12px。
            // Unity 保留整张画布, 因此先反算画布显示宽, 保证真正绳芯仍是 12px 而不是 1.7px。
            var canvasSize = M01RenderGeometry.UntrimmedCanvasDisplaySize(
                RopeRawWidth,
                RopeRawHeight,
                RopeTrimmedWidth,
                RopeTrimmedHeight,
                RopeDisplayWidth,
                length);
            ApplyCustomSprite(renderer, canvasSize.Width, canvasSize.Height, 0.5, 0.5);
        }
    }

    private IEnumerator BeginWalk()
    {
        if (lemmy == null) yield break;
        yield return MoveLemmy(LemmyPlatformFrontX, 1f);
        Advance(M01IntroEvent.WalkArrived);
        lemmy.Play("idle");
    }

    private void StartRoam(float targetX)
    {
        if (walkRoutine != null) StopCoroutine(walkRoutine);
        walkRoutine = StartCoroutine(RoamTo(targetX));
    }

    private IEnumerator RoamTo(float targetX)
    {
        if (lemmy == null) yield break;
        var under = IsEarFoldZone(CurrentLemmyX());
        var initialEarTransition = M01IntroFlow.CommitEarState(ref earsFolded, under);
        if (initialEarTransition != M01IntroEarTransition.None)
        {
            yield return PlayAction(initialEarTransition == M01IntroEarTransition.Fold ? "earsback" : "earsup");
        }

        var from = CurrentLemmyX();
        var direction = Mathf.Sign(targetX - from);
        var edges = new[] { EarFoldCenterX - EarFoldHalfWidth, EarFoldCenterX + EarFoldHalfWidth }
            .Where(edge => (from < edge) != (targetX < edge))
            .OrderBy(edge => direction * edge)
            .ToArray();
        var current = from;
        foreach (var edge in edges)
        {
            yield return MoveLemmy(edge, walkBoost);
            var nowUnder = IsEarFoldZone(edge + direction);
            var edgeEarTransition = M01IntroFlow.CommitEarState(ref earsFolded, nowUnder);
            if (edgeEarTransition != M01IntroEarTransition.None)
            {
                yield return PlayAction(edgeEarTransition == M01IntroEarTransition.Fold ? "earsback" : "earsup");
            }
            current = edge;
        }
        if (Mathf.Abs(targetX - current) > 1f) yield return MoveLemmy(targetX, walkBoost);
        lemmy.Play(earsFolded ? "idleback" : "idle");
        walkRoutine = null;
    }

    private IEnumerator MoveLemmy(float targetX, float speedMultiplier)
    {
        if (lemmy == null) yield break;
        var from = CurrentLemmyX();
        lemmy.SetFacing(targetX >= from);
        lemmy.Play(earsFolded ? "walkback" : "walk");
        var duration = Mathf.Abs(targetX - from) / WalkSpeed / Mathf.Max(0.01f, speedMultiplier);
        var elapsed = 0f;
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            lemmy.SetCocosPosition(Mathf.Lerp(from, targetX, Mathf.Clamp01(elapsed / duration)), LemmyY);
            yield return null;
        }
        lemmy.SetCocosPosition(targetX, LemmyY);
    }

    private IEnumerator HandleBasketTap()
    {
        if (lemmy == null) yield break;
        if (M01IntroFlow.ShouldInterruptRoamForBasketTap(phase) && walkRoutine != null)
        {
            StopCoroutine(walkRoutine);
            walkRoutine = null;
        }
        actionInProgress = true;
        var action = M01IntroFlow.ResolveBasketTapAction(phase, IsUnderBasket(CurrentLemmyX()));
        if (action == M01IntroBasketTapAction.ApproachReachAndShake)
        {
            yield return RoamTo(BasketReachX);
            lemmy.SetFacing(true);
            yield return PlayAction("reach");
            yield return PlayAction("turnface");
            yield return PlayAction("headshake");
            M01IntroFlow.CommitEarState(ref earsFolded, IsEarFoldZone(CurrentLemmyX()));
            lemmy.Play(earsFolded ? "idleback" : "idle");
        }
        else if (action == M01IntroBasketTapAction.Headbutt)
        {
            var repeat = phase == M01IntroPhase.ReadyToHeadbutt;
            yield return Headbutt(repeat);
        }
        actionInProgress = false;
    }

    private IEnumerator Headbutt(bool repeat)
    {
        if (lemmy == null) yield break;
        if (!Advance(M01IntroEvent.HeadbuttStarted)) yield break;
        if (!repeat)
        {
            if (!earsFolded)
            {
                yield return PlayAction("earsback");
                earsFolded = true;
            }
            Advance(M01IntroEvent.FoldDone);
        }

        var released = false;
        void OnFrameEvent(string eventId)
        {
            if (eventId != "headbutt_contact" || released) return;
            released = true;
            ReleaseHeadbuttBatch();
        }
        lemmy.FrameEvent += OnFrameEvent;
        yield return PlayAction("headbutt");
        lemmy.FrameEvent -= OnFrameEvent;
        if (!released) ReleaseHeadbuttBatch();
        lemmy.Play("idleback");

        if (releasedCount >= board.Layout!.Fragments.Count)
        {
            StartCoroutine(BeginFlashlightDrop());
        }
    }

    private void ReleaseHeadbuttBatch()
    {
        if (board.Layout == null || basket == null || sceneRoot == null) return;
        Advance(M01IntroEvent.HeadbuttContact);
        if (basketPileFreezeRoutine != null)
        {
            StopCoroutine(basketPileFreezeRoutine);
            basketPileFreezeRoutine = null;
        }
        var order = Enumerable.Range(0, board.Layout.Fragments.Count)
            .OrderByDescending(i => M01IntroLayout.PileOffsets[i % M01IntroLayout.PileOffsets.Count].Y)
            .ThenBy(i => i)
            .ToArray();
        var subset = order
            .Where(index => !releasedFragmentIndices.Contains(index))
            .Take(M01IntroLayout.HeadbuttPiecesPerBatch)
            .ToArray();
        // Cocos destroyBasketInnerCavity 在第一次 commitHeadbuttSpill 就执行，且发生在冲量之前。
        var releasedAfterThisBatch = releasedFragmentIndices.Count + subset.Length;
        SetBasketCavityActive(M01IntroLayout.ShouldKeepBasketCavityActive(releasedAfterThisBatch));
        foreach (var index in subset)
        {
            var token = board.Layout.Fragments[index];
            if (board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment))
            {
                ApplyFragmentPhysics(fragment, token, M01IntroBasketPiecePhase.Headbutting);
            }
        }
        Physics2D.SyncTransforms();
        var lateral = Mathf.Clamp((BasketX - CurrentLemmyX()) * 3f, -220f, 220f);
        if (rope != null) M01RopePhysics.KickTail(rope, lateral, 520, RopeOptions.SubstepDt);

        for (var batchIndex = 0; batchIndex < subset.Length; batchIndex++)
        {
            var index = subset[batchIndex];
            releasedFragmentIndices.Add(index);
            var token = board.Layout.Fragments[index];
            if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment)) continue;
            var worldStart = fragment.transform.position;
            fragment.transform.SetParent(sceneRoot.transform, true);
            fragment.transform.position = worldStart;
            var renderers = fragment.GetComponentsInChildren<SpriteRenderer>();
            for (var r = 0; r < renderers.Length; r++) renderers[r].sortingOrder = r;
            ReleaseWithPhysics(fragment, token, batchIndex);
        }
        releasedCount = releasedFragmentIndices.Count;
        if (releasedCount < board.Layout.Fragments.Count)
        {
            Advance(M01IntroEvent.PiecesRemain);
        }
        else
        {
            StartCoroutine(FreezeGroundPile());
        }
    }

    private void ReleaseWithPhysics(GameObject fragment, M01GreyboxTokenNode token, int batchIndex)
    {
        ApplyFragmentPhysics(fragment, token, M01IntroBasketPiecePhase.Released);
        var body = fragment.GetComponent<Rigidbody2D>()!;
        var lane = (batchIndex % 3) - 1;
        body.linearVelocity = new Vector2(
            (float)M01IntroLayout.CocosBodyLinearVelocityToUnity(lane * 10, Ppu),
            (float)M01IntroLayout.CocosBodyLinearVelocityToUnity(20, Ppu));
        body.angularVelocity = (float)M01IntroLayout.CocosBodyAngularVelocityToUnity(
            (lane == 0 ? 1 : -lane) * 22);
    }

    private IEnumerator FreezeGroundPile()
    {
        yield return new WaitForSeconds(FragmentSettleSeconds);
        var settledPhysics = M01IntroLayout.ResolveGroundPileSettledPhysics();
        if (board.Layout != null)
        {
            foreach (var token in board.Layout.Fragments)
            {
                if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment)) continue;
                var body = fragment.GetComponent<Rigidbody2D>();
                if (body == null) continue;
                // 玩家可能已经拿起、吸附或处于 2 秒旋转钉住期；只休眠仍在地面物理堆里的 Dynamic 片。
                if (body.bodyType == RigidbodyType2D.Dynamic && body.simulated)
                {
                    body.gravityScale = (float)settledPhysics.GravityScale;
                    body.linearVelocity = Vector2.zero;
                    body.angularVelocity = 0f;
                    body.Sleep();
                }
                var live = ToCocos(fragment.transform.position);
                token.Position = new M01GreyboxPoint(live.x, live.y);
            }
        }
        groundSettled = true;
        TryUnlockPuzzleInput();
    }

    private IEnumerator BeginFlashlightDrop()
    {
        if (flashlightObject == null || lemmy == null || sceneRoot == null) yield break;
        Advance(M01IntroEvent.FragmentsSettled);
        flashlightObject.transform.SetParent(sceneRoot.transform, false);
        flashlightObject.SetActive(true);
        var start = new Vector2(BasketX - 30f, BasketY - 30f);
        SetCocosPosition(flashlightObject.transform, start.x, start.y);
        flashlightObject.transform.localRotation = Quaternion.identity;
        var elapsed = 0f;
        while (elapsed < (float)M01IntroLayout.FlashlightBonkSeconds)
        {
            elapsed += Time.deltaTime;
            var t = Mathf.Clamp01(elapsed / (float)M01IntroLayout.FlashlightBonkSeconds);
            var q = t * t;
            var liveHead = new Vector2(CurrentLemmyX(), LemmyY + FlashlightHeadDy);
            var p = Vector2.Lerp(start, liveHead, q);
            SetCocosPosition(flashlightObject.transform, p.x, p.y);
            yield return null;
        }

        lemmy.Play(earsFolded ? "startleback" : "startle");
        ReleaseFlashlightToPhysics();
        yield return new WaitForSeconds((float)M01IntroLayout.FlashlightSettleSeconds);
        // 这里只解锁下一剧情阶段，不再接管刚体。手电继续自然碰撞、滚动并由 Physics2D 自行停下；
        // 即使落在拼片上，也保留那个真实结果，不强制传送到兔子脚边。
        Advance(M01IntroEvent.FlashlightBonked);
    }

    private void ReleaseFlashlightToPhysics()
    {
        if (flashlightObject == null) return;
        flashlightObject.transform.localRotation = Quaternion.Euler(0f, 0f, FlashlightLyingAngle);

        // Unity 只允许在“正在模拟的 Dynamic + AutoMass”刚体上设置 Collider2D.density。
        var body = flashlightObject.GetComponent<Rigidbody2D>();
        if (body == null) body = flashlightObject.AddComponent<Rigidbody2D>();
        body.simulated = false;
        body.bodyType = RigidbodyType2D.Dynamic;
        body.useAutoMass = true;
        body.simulated = true;

        var collider = flashlightObject.GetComponent<BoxCollider2D>();
        if (collider == null) collider = flashlightObject.AddComponent<BoxCollider2D>();
        collider.size = new Vector2(
            (float)M01IntroLayout.FlashlightColliderSize.Width / Ppu,
            (float)M01IntroLayout.FlashlightColliderSize.Height / Ppu);
        collider.sharedMaterial = CreatePhysicsMaterial("M01IntroFlashlight", 0.6f, 0.04f);
        collider.density = (float)M01IntroLayout.CocosColliderDensityToUnity(1, Ppu);
        collider.enabled = true;

        body.simulated = false;
        body.gravityScale = (float)M01IntroLayout.BasketPieceGravityScale;
        body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        body.interpolation = RigidbodyInterpolation2D.Interpolate;
        body.position = flashlightObject.transform.position;
        body.rotation = FlashlightLyingAngle;
        body.linearVelocity = new Vector2(
            (float)M01IntroLayout.CocosBodyLinearVelocityToUnity(20, Ppu),
            0f);
        body.angularVelocity = 0f;
        body.simulated = true;
    }

    private IEnumerator BeginPickup()
    {
        if (lemmy == null || flashlightObject == null) yield break;
        if (M01IntroFlow.ShouldInterruptRoamForPickup(phase) && walkRoutine != null)
        {
            StopCoroutine(walkRoutine);
            walkRoutine = null;
        }
        if (!Advance(M01IntroEvent.FlashlightTapped)) yield break;
        actionInProgress = true;
        var flashX = ToCocos(flashlightObject.transform.position).x;
        var approachX = (float)M01IntroFlow.ResolvePickupApproachX(
            CurrentLemmyX(),
            flashX,
            PickupStandOff);
        if (Mathf.Abs(CurrentLemmyX() - flashX) > PickupStandOff)
        {
            yield return RoamTo(Mathf.Clamp(approachX, LemmyRoamMinX, LemmyRoamMaxX));
        }
        lemmy.SetFacing(M01IntroFlow.ResolvePickupFacingRight(CurrentLemmyX(), flashX));
        var pickupMotion = M01IntroFlow.ResolvePickupMotion(IsFlashlightSupportedByFragment());
        var pickupAnimation = M01IntroFlow.ResolvePickupAnimation(pickupMotion, earsFolded);
        if (pickupAnimation == M01IntroPickupAnimation.FoldedCrouch)
        {
            yield return PlayActionRange("headbutt", 0, 40);
        }
        else if (pickupAnimation == M01IntroPickupAnimation.Crouch)
        {
            yield return PlayAction("crouch");
        }

        var heldBody = flashlightObject.GetComponent<Rigidbody2D>();
        if (heldBody != null) heldBody.simulated = false;
        var heldCollider = flashlightObject.GetComponent<Collider2D>();
        if (heldCollider != null) heldCollider.enabled = false;
        flashlightObject.transform.SetParent(lemmy.transform, false);
        var right = lemmy.FacingRight;
        var heldX = right ? HeldFlashlightX : -HeldFlashlightX;
        flashlightObject.transform.localRotation = Quaternion.Euler(0, 0, right ? HeldFlashlightAngle : -HeldFlashlightAngle);
        if (pickupMotion == M01IntroPickupMotion.Crouch)
        {
            SetCocosPosition(flashlightObject.transform, heldX, HeldFlashlightY - PickupHandDrop);
            if (pickupAnimation == M01IntroPickupAnimation.FoldedCrouch)
            {
                lemmy.PlayRangeReverse("headbutt", 0, 40);
            }
            else
            {
                lemmy.PlayReverse("crouch");
            }
            var elapsed = 0f;
            while (elapsed < PickupRiseSeconds)
            {
                elapsed += Time.deltaTime;
                var t = Mathf.Sin(Mathf.Clamp01(elapsed / PickupRiseSeconds) * Mathf.PI * 0.5f);
                SetCocosPosition(flashlightObject.transform, heldX, Mathf.Lerp(HeldFlashlightY - PickupHandDrop, HeldFlashlightY, t));
                yield return null;
            }
            while (!lemmy.Done) yield return null;
        }
        else
        {
            SetCocosPosition(flashlightObject.transform, heldX, HeldFlashlightY);
        }
        M01IntroFlow.CommitEarState(ref earsFolded, IsEarFoldZone(CurrentLemmyX()));
        lemmy.Play(earsFolded ? "idleback" : "idle");
        Advance(M01IntroEvent.CrouchDone);
        if (flashlight != null)
        {
            flashlight.Acquired = true;
            flashlight.SetHeldAnchor(lemmy.transform, flashlightObject);
        }
        TryUnlockPuzzleInput();
        actionInProgress = false;
    }

    private bool IsFlashlightSupportedByFragment()
    {
        if (flashlightObject == null) return false;
        var flashlightCollider = flashlightObject.GetComponent<Collider2D>();
        if (flashlightCollider == null || !flashlightCollider.enabled) return false;

        foreach (var fragment in board.FragmentObjects.Values)
        {
            if (fragment == null) continue;
            foreach (var fragmentCollider in fragment.GetComponentsInChildren<Collider2D>())
            {
                if (!fragmentCollider.enabled || fragmentCollider.isTrigger) continue;
                if (fragmentCollider.bounds.center.y >= flashlightCollider.bounds.center.y) continue;
                if (flashlightCollider.IsTouching(fragmentCollider)) return true;
            }
        }
        return false;
    }

    private void TryUnlockPuzzleInput()
    {
        if (drag != null && groundSettled) drag.MarkFragmentPhysicsSettled();
    }

    private IEnumerator PlayAction(string id)
    {
        if (lemmy == null) yield break;
        lemmy.Play(id);
        while (!lemmy.Done) yield return null;
    }

    private IEnumerator PlayActionRange(string id, int sourceStartFrame, int sourceFrameCount)
    {
        if (lemmy == null) yield break;
        lemmy.PlayRange(id, sourceStartFrame, sourceFrameCount);
        while (!lemmy.Done) yield return null;
    }

    private IEnumerator Celebrate(Action onCelebrated)
    {
        if (flashlightObject != null) flashlightObject.SetActive(false);
        if (lemmy == null)
        {
            onCelebrated();
            yield break;
        }
        yield return PlayAction("celebrate");
        onCelebrated();
        lemmy.Play("idle");
    }

    private void SyncHeldFlashlight()
    {
        if (phase != M01IntroPhase.Acquired || flashlightObject == null || lemmy == null) return;
        var right = lemmy.FacingRight;
        SetCocosPosition(flashlightObject.transform, right ? HeldFlashlightX : -HeldFlashlightX, HeldFlashlightY);
        flashlightObject.transform.localRotation = Quaternion.Euler(0, 0, right ? HeldFlashlightAngle : -HeldFlashlightAngle);
    }

    private void OnDestroy()
    {
        if (basketPileFreezeRoutine != null) StopCoroutine(basketPileFreezeRoutine);
        foreach (var material in runtimePhysicsMaterials)
        {
            if (material != null) Destroy(material);
        }
        runtimePhysicsMaterials.Clear();
        fragmentMaterials.Clear();
    }

    private bool Advance(M01IntroEvent introEvent)
    {
        var next = M01IntroFlow.NextIntroPhase(phase, introEvent);
        if (next == phase) return false;
        phase = next;
        return true;
    }

    private bool IsBasketHit(Vector2 p)
    {
        if (basket == null) return false;
        var center = ToCocos(basket.transform.position);
        return Mathf.Abs(p.x - center.x) <= BasketDisplayWidth / 2f && Mathf.Abs(p.y - center.y) <= BasketDisplayHeight / 2f;
    }

    private static bool IsFlashlightTapHit(Vector2 point, Vector2 center)
    {
        var half = (float)M01IntroLayout.FlashlightTapMinimumPixels / 2f;
        return Mathf.Abs(point.x - center.x) <= half && Mathf.Abs(point.y - center.y) <= half;
    }

    private static bool IsUnderBasket(float x) => Mathf.Abs(x - HeadbuttX) < HeadbuttTolerance;
    private static bool IsEarFoldZone(float x) => Mathf.Abs(x - EarFoldCenterX) < EarFoldHalfWidth;
    private float CurrentLemmyX() => lemmy == null ? 0f : ToCocos(lemmy.transform.position).x;

    private SpriteRenderer? AddVisual(Transform parent, string name, string resource, double width, double height,
        int order, double anchorX = 0.5, double anchorY = 0.5)
    {
        var sprite = Resources.Load<Sprite>("Art/M01/" + resource);
        if (sprite == null) return null;
        var visual = new GameObject(name);
        visual.transform.SetParent(parent, false);
        var renderer = visual.AddComponent<SpriteRenderer>();
        renderer.sprite = sprite;
        renderer.sharedMaterial = board.ArtMaterial;
        renderer.sortingOrder = order;
        ApplyCustomSprite(renderer, width, height, anchorX, anchorY);
        return renderer;
    }

    private static void ApplyCustomSprite(SpriteRenderer renderer, double widthPx, double heightPx, double anchorX, double anchorY)
    {
        var bounds = renderer.sprite.bounds;
        renderer.transform.localScale = new Vector3(
            ((float)widthPx / Ppu) / bounds.size.x,
            ((float)heightPx / Ppu) / bounds.size.y,
            1f);
        var anchorOffset = M01RenderGeometry.AnchorCenterOffsetPx(widthPx, heightPx, anchorX, anchorY);
        var center = M01CocosTransform.WorldPosition(anchorOffset.X, anchorOffset.Y);
        renderer.transform.localPosition = center - Vector3.Scale(bounds.center, renderer.transform.localScale);
    }

    private static void SetCocosPosition(Transform transform, float x, float y) =>
        transform.localPosition = M01CocosTransform.WorldPosition(x, y);

    private static Color32 ToUnityColor(M01Color32 color) =>
        new(color.R, color.G, color.B, color.A);

    private static Vector2 ToCocos(Vector3 world) => new(world.x * Ppu, world.y * Ppu);

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        var camera = Camera.main;
        if (camera == null) return Vector2.zero;
        return ToCocos(camera.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0)));
    }
}
