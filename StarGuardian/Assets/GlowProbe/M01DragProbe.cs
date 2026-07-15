// M01GreyboxBootstrap.ts 拼片指针交互的 Unity 胶水层。
// 按下接管刚体; 移动超过 6px=拖放; 原地轻点=转 90°并钉住 2 秒; 自由落点恢复 Dynamic 物理。
#nullable enable

using System.Collections;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.M01;
using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(M01BoardProbe))]
public sealed class M01DragProbe : MonoBehaviour
{
    private const float Ppu = 100f;
    private const float PickupSlackPx = 8f; // 半径外余量, 手感宽一点

    /// <summary>开场期间锁输入(IntroProbe 控制); 无 IntroProbe 时保持 false 直接可玩。</summary>
    public bool InputLocked;

    private M01BoardProbe board = null!;
    private M01GreyboxTokenNode? held;
    private GameObject? heldGo;
    private double heldRotation;
    private int heldBaseOrder;
    private Vector2 heldPointerStart;
    private Vector2 heldDragOffset;
    private bool introPickupGate;
    private bool physicsSettled;
    private M01FlashlightProbe? flashlight;
    private M01IntroProbe? intro;
    private readonly HashSet<string> spilledOutFragments = new();
    private readonly Dictionary<string, double> fragmentRotations = new();
    private readonly Dictionary<string, Coroutine> rotatePinRoutines = new();

    // 玩法状态(镜像 Cocos bootstrap 的 weakSnappedFragmentsByEvidence / target-pattern 配对):
    private readonly M01PlacementLedger placementLedger = new();
    private Coroutine? validationFailureRoutine;

    private void Awake()
    {
        board = GetComponent<M01BoardProbe>();
        flashlight = GetComponent<M01FlashlightProbe>();
        intro = GetComponent<M01IntroProbe>();
    }

    public void BeginIntroPickupGate()
    {
        introPickupGate = true;
        physicsSettled = false;
        spilledOutFragments.Clear();
        InputLocked = false;
    }

    public void SetFragmentSpilledOut(string fragmentId, bool spilledOut)
    {
        if (spilledOut) spilledOutFragments.Add(fragmentId);
        else spilledOutFragments.Remove(fragmentId);
    }

    public void MarkFragmentPhysicsSettled()
    {
        physicsSettled = true;
        InputLocked = false;
    }

    public bool CanStartFragmentPointerAt(Vector2 cocosPos) => FindPickupCandidate(cocosPos) != null;

    private void Update()
    {
        if (!Application.isPlaying || board.Layout == null || InputLocked) return;
        var pointer = Pointer.current;
        if (pointer == null) return;

        var cocosPos = ScreenToCocos(pointer.position.ReadValue());

        if (pointer.press.wasPressedThisFrame && held == null)
        {
            TryPickup(cocosPos);
        }
        // release 独立于 press 检查: 同帧 press+release(快速轻点/低帧率)时立即在原地落下,
        // 不再被 else-if 跳过导致 held 永久滞留(审查 CONFIRMED 的丢 drop 坑)。
        if (held != null && pointer.press.wasReleasedThisFrame)
        {
            EndPointer(cocosPos);
        }
        else if (held != null && pointer.press.isPressed)
        {
            MoveHeld(cocosPos);
        }
    }

    /// <summary>该片是否已就位(中央槽或证据试拼)——手电 onTray 排除等消费。</summary>
    public bool IsFragmentPlaced(string fragmentId)
    {
        return placementLedger.IsPlaced(fragmentId);
    }

    /// <summary>当前拖拽中的片(无则 null)——手电拖拽中排除观察等消费。</summary>
    public string? HeldFragmentId => held?.ControllerId;

    /// <summary>清空拖拽记账(BoardProbe 重建 Session 时调, 防旧账本对新 Session 假提交)。</summary>
    public void ResetLedgers()
    {
        placementLedger.Clear();
        spilledOutFragments.Clear();
        fragmentRotations.Clear();
        CancelAllRotatePins();
        if (validationFailureRoutine != null) StopCoroutine(validationFailureRoutine);
        validationFailureRoutine = null;
        board?.RenderValidationBlendOverlays(false);
        held = null;
        heldGo = null;
    }

    /// <summary>冒烟入口: 走与鼠标完全相同的 拾起→旋转→落下 路径(供 execute_code/自动验证)。</summary>
    public void DebugDrop(string fragmentId, double x, double y, double rotation)
    {
        if (board.Layout == null) return;
        if (InputLocked || held != null)
        {
            Debug.Log($"M01DragProbe: DebugDrop({fragmentId}) 忽略 —— 输入锁定或正在拖拽(与真实输入同门禁)");
            return;
        }
        M01GreyboxTokenNode? target = null;
        foreach (var f in board.Layout.Fragments)
        {
            if (f.ControllerId == fragmentId) { target = f; break; }
        }
        if (target == null || !board.FragmentObjects.TryGetValue(fragmentId, out var go)) return;
        CancelRotatePin(fragmentId);
        var renderer = go.GetComponent<SpriteRenderer>();
        var baseOrder = renderer == null ? 0 : renderer.sortingOrder;
        var session = board.Session;
        if (session != null) session.UnstageFragment(fragmentId);
        RemoveFragmentFromPlacementLedgers(fragmentId);
        fragmentRotations[fragmentId] = rotation;
        go.transform.localRotation = Quaternion.Euler(0, 0, (float)rotation);
        SetFragmentPointerControl(go, true);
        ResolveDrop(target, go, new Vector2((float)x, (float)y), baseOrder);
    }

    private void TryPickup(Vector2 cocosPos)
    {
        var candidate = FindPickupCandidate(cocosPos);
        if (candidate == null) return;
        var best = candidate.Value.Token;
        var go = candidate.Value.Go;

        CancelRotatePin(best.ControllerId);
        held = best;
        heldGo = go;
        heldPointerStart = cocosPos;
        heldDragOffset = CurrentCocosPosition(go) - cocosPos;
        var body = go.GetComponent<Rigidbody2D>();
        if (body != null && body.bodyType == RigidbodyType2D.Dynamic)
        {
            fragmentRotations[best.ControllerId] =
                M01FragmentPointerRules.RebaselineRotation(go.transform.eulerAngles.z);
        }
        else if (!fragmentRotations.ContainsKey(best.ControllerId))
        {
            fragmentRotations[best.ControllerId] =
                M01FragmentPointerRules.RebaselineRotation(go.transform.eulerAngles.z);
        }
        heldRotation = fragmentRotations[best.ControllerId];
        var sr = go.GetComponent<SpriteRenderer>();
        heldBaseOrder = sr == null ? 0 : sr.sortingOrder;
        M01BoardProbe.SetFragmentSortingOrder(go, 60);
        SetFragmentPointerControl(go, true);
        WakeDynamicPileExcept(go);
        SyncTokenToVisual(best, go);
        flashlight?.TurnOffForFragmentPickup();

        // 拼片被拿走 → 撤它参与的暂存/配对(镜像 bootstrap: 掉片/挪走即 unstage)。
        var session = board.Session;
        if (session != null)
        {
            var cleared = session.UnstageFragment(best.ControllerId);
            if (cleared.Count > 0) Debug.Log($"M01DragProbe: unstaged {best.ControllerId} → cleared evidence [{string.Join(",", cleared)}]");
        }
        RemoveFragmentFromPlacementLedgers(best.ControllerId);
    }

    private void MoveHeld(Vector2 cocosPos)
    {
        var target = cocosPos + heldDragOffset;
        SetWorldCocosPosition(heldGo!, target);
        held!.Position = new M01GreyboxPoint(target.x, target.y);
    }

    private void EndPointer(Vector2 cocosPos)
    {
        var token = held!;
        var go = heldGo!;
        var total = cocosPos - heldPointerStart;
        if (M01FragmentPointerRules.IsRotateTap(total.x, total.y))
        {
            RotateAndPin(token, go, heldBaseOrder);
            ClearHeld();
            return;
        }

        ResolveDrop(token, go, CurrentCocosPosition(go), heldBaseOrder);
        ClearHeld();
    }

    private void ResolveDrop(M01GreyboxTokenNode token, GameObject go, Vector2 cocosPos, int baseOrder)
    {
        var layout = board.Layout!;
        var rotation = fragmentRotations.TryGetValue(token.ControllerId, out var trackedRotation)
            ? trackedRotation
            : M01FragmentPointerRules.RebaselineRotation(go.transform.eulerAngles.z);
        var action = M01GreyboxDrag.ResolveM01GreyboxDrop(
            layout, token, new M01GreyboxPoint(cocosPos.x, cocosPos.y),
            new M01GreyboxDropOptions { Rotation = rotation });

        // 有落点就同步逻辑层+渲染层; weak_snap 的 action 不带 Position → 落座证据吸附位
        // (Cocos snapNodeToEvidence 语义, 复用已迁移的 ResolveEvidenceFragmentSnapPosition, 消死代码)。
        var final = action.Position ?? new M01GreyboxPoint(cocosPos.x, cocosPos.y);
        if (action.Type == M01GreyboxDropActionType.WeakSnapFragment && action.Position == null && action.EvidenceId != null)
        {
            foreach (var ev in layout.Evidence)
            {
                if (ev.ControllerId == action.EvidenceId)
                {
                    final = M01GreyboxLayout.ResolveEvidenceFragmentSnapPosition(ev, token.ControllerId);
                    break;
                }
            }
        }
        token.Position = final;
        SetWorldCocosPosition(go, new Vector2((float)final.X, (float)final.Y));
        if (action.Type == M01GreyboxDropActionType.SnapFragmentToTargetPiece && action.Rotation != null)
        {
            rotation = action.Rotation.Value;
            fragmentRotations[token.ControllerId] = rotation;
            go.transform.rotation = Quaternion.Euler(0, 0, (float)rotation);
        }
        else if (action.Type == M01GreyboxDropActionType.StickFragmentToSlot)
        {
            go.transform.rotation = Quaternion.Euler(0, 0, (float)rotation);
        }

        // 交互只改排序、位置、Session 与刚体状态。Cocos 的水彩拼片本体在拾取/吸附/自由落点时不染色；
        // 真正的颜色变化只允许由手电观察层临时叠加，离开光束后恢复原图。
        M01BoardProbe.SetFragmentSortingOrder(go, baseOrder);

        Debug.Log($"M01DragProbe: {token.ControllerId} rot={rotation} → {action.Type}" +
                  (action.PieceSlotId != null ? $" slot={action.PieceSlotId}" : "") +
                  (action.EvidenceId != null ? $" evidence={action.EvidenceId}" : "") +
                  (action.Reason != null ? $" reason={action.Reason}" : ""));

        // ── session 玩法闭环: snap/weak_snap → 记账 → 证据两片齐即提交 → 全 staged 即验证 ──
        var session = board.Session;
        if (session != null)
        {
            if (action.Type == M01GreyboxDropActionType.SnapFragmentToTargetPiece)
            {
                PlaceIntoTargetSlot(action.PieceSlotId, token.ControllerId);
            }
            else if (action.Type == M01GreyboxDropActionType.StickFragmentToSlot)
            {
                // 角度不对也已经占住目标槽；Cocos 会在六槽全满时立刻做失败显色，
                // 不能因它尚未 staged 就永远不触发验证。
                PlaceIntoTargetSlot(action.PieceSlotId, token.ControllerId);
            }
            else if (action.Type == M01GreyboxDropActionType.WeakSnapFragment && action.EvidenceId != null)
            {
                session.WeakSnapFragmentToEvidence(token.ControllerId, action.EvidenceId);
                placementLedger.TrackWeakSnap(action.EvidenceId, token.ControllerId);
            }
            TrySubmitPairs(session);
            TryValidate(session);
        }

        if ((action.Type == M01GreyboxDropActionType.SnapFragmentToTargetPiece ||
             action.Type == M01GreyboxDropActionType.WeakSnapFragment ||
             action.Type == M01GreyboxDropActionType.StickFragmentToSlot))
        {
            ParkFragmentBody(go);
        }
        else
        {
            ReleaseFragmentBodyToPhysics(go);
        }
    }

    private (M01GreyboxTokenNode Token, GameObject Go)? FindPickupCandidate(Vector2 cocosPos)
    {
        if (InputLocked || board.Layout == null) return null;
        if (intro != null && intro.ReservesPointerForIntroAt(cocosPos)) return null;
        M01GreyboxTokenNode? best = null;
        GameObject? bestGo = null;
        var bestDistance = float.MaxValue;
        foreach (var fragment in board.Layout.Fragments)
        {
            var spilledOut = spilledOutFragments.Contains(fragment.ControllerId);
            if (introPickupGate && !M01FragmentPointerRules.CanPickFragment(physicsSettled, spilledOut))
            {
                continue;
            }
            if (!board.FragmentObjects.TryGetValue(fragment.ControllerId, out var fragmentObject)) continue;
            var live = CurrentCocosPosition(fragmentObject);
            var radius = (float)System.Math.Max(fragment.Size.Width, fragment.Size.Height) / 2f + PickupSlackPx;
            var distance = Vector2.Distance(live, cocosPos);
            if (distance <= radius && distance < bestDistance)
            {
                best = fragment;
                bestGo = fragmentObject;
                bestDistance = distance;
            }
        }
        return best == null || bestGo == null ? null : (best, bestGo);
    }

    private void RotateAndPin(M01GreyboxTokenNode token, GameObject go, int baseOrder)
    {
        var beforeLowest = LowestPolygonWorldY(go);
        var next = M01FragmentPointerRules.NextClockwiseRotation(heldRotation);
        heldRotation = next;
        fragmentRotations[token.ControllerId] = next;
        go.transform.rotation = Quaternion.Euler(0, 0, (float)next);
        Physics2D.SyncTransforms();
        var afterLowest = LowestPolygonWorldY(go);
        if (beforeLowest != null && afterLowest != null)
        {
            go.transform.position += Vector3.up * (beforeLowest.Value - afterLowest.Value);
        }
        SyncTokenToVisual(token, go);
        M01BoardProbe.SetFragmentSortingOrder(go, baseOrder);
        ParkFragmentBody(go);
        CancelRotatePin(token.ControllerId);
        rotatePinRoutines[token.ControllerId] = StartCoroutine(ReleaseRotatePinAfterDelay(token, go, baseOrder));
    }

    private IEnumerator ReleaseRotatePinAfterDelay(M01GreyboxTokenNode token, GameObject go, int baseOrder)
    {
        yield return new WaitForSeconds((float)M01FragmentPointerRules.RotatePinHoldSeconds);
        rotatePinRoutines.Remove(token.ControllerId);
        if (InputLocked || go == null || board.Layout == null) yield break;
        ResolveDrop(token, go, CurrentCocosPosition(go), baseOrder);
    }

    private void CancelRotatePin(string fragmentId)
    {
        if (!rotatePinRoutines.TryGetValue(fragmentId, out var routine)) return;
        if (routine != null) StopCoroutine(routine);
        rotatePinRoutines.Remove(fragmentId);
    }

    private void CancelAllRotatePins()
    {
        foreach (var routine in rotatePinRoutines.Values)
        {
            if (routine != null) StopCoroutine(routine);
        }
        rotatePinRoutines.Clear();
    }

    private static float? LowestPolygonWorldY(GameObject go)
    {
        var polygon = go.GetComponent<PolygonCollider2D>();
        if (polygon == null || polygon.points.Length == 0) return null;
        var minimum = float.PositiveInfinity;
        foreach (var point in polygon.points)
        {
            var local = point + polygon.offset;
            minimum = Mathf.Min(minimum, go.transform.TransformPoint(local).y);
        }
        return minimum;
    }

    private static void SetFragmentPointerControl(GameObject go, bool controlledByPointer)
    {
        var body = go.GetComponent<Rigidbody2D>();
        if (controlledByPointer)
        {
            foreach (var collider in go.GetComponents<Collider2D>()) collider.enabled = false;
            if (body == null) return;
            body.linearVelocity = Vector2.zero;
            body.angularVelocity = 0f;
            body.bodyType = RigidbodyType2D.Kinematic;
            body.simulated = false;
            return;
        }

        if (body != null)
        {
            body.simulated = true;
            body.linearVelocity = Vector2.zero;
            body.angularVelocity = 0f;
        }
        foreach (var collider in go.GetComponents<Collider2D>()) collider.enabled = true;
    }

    private static void ParkFragmentBody(GameObject go)
    {
        var body = go.GetComponent<Rigidbody2D>();
        if (body != null)
        {
            body.simulated = false;
            body.bodyType = RigidbodyType2D.Kinematic;
            body.gravityScale = 0f;
        }
        SetFragmentPointerControl(go, false);
    }

    private static void ReleaseFragmentBodyToPhysics(GameObject go)
    {
        var body = go.GetComponent<Rigidbody2D>();
        if (body == null)
        {
            foreach (var collider in go.GetComponents<Collider2D>()) collider.enabled = true;
            return;
        }
        body.simulated = false;
        body.bodyType = RigidbodyType2D.Dynamic;
        body.gravityScale = (float)M01IntroLayout.BasketPieceGravityScale;
        body.linearDamping = (float)M01IntroLayout.FragmentLinearDamping;
        body.angularDamping = (float)M01IntroLayout.FragmentAngularDamping;
        body.linearVelocity = Vector2.zero;
        body.angularVelocity = 0f;
        foreach (var collider in go.GetComponents<Collider2D>()) collider.enabled = true;
        body.simulated = true;
        body.WakeUp();
    }

    /// <summary>拿走一块支撑片后唤醒其余落地刚体，让上层拼片按 Cocos/Box2D 重新坍落垒叠。</summary>
    private void WakeDynamicPileExcept(GameObject pickedUp)
    {
        if (board.Layout == null) return;
        foreach (var token in board.Layout.Fragments)
        {
            if (!board.FragmentObjects.TryGetValue(token.ControllerId, out var fragment) || fragment == pickedUp) continue;
            var body = fragment.GetComponent<Rigidbody2D>();
            if (body == null || !body.simulated || body.bodyType != RigidbodyType2D.Dynamic) continue;
            body.WakeUp();
        }
    }

    private static Vector2 CurrentCocosPosition(GameObject go) =>
        new(go.transform.position.x * Ppu, go.transform.position.y * Ppu);

    private static void SetWorldCocosPosition(GameObject go, Vector2 cocosPosition)
    {
        var position = go.transform.position;
        go.transform.position = new Vector3(cocosPosition.x / Ppu, cocosPosition.y / Ppu, position.z);
    }

    private static void SyncTokenToVisual(M01GreyboxTokenNode token, GameObject go)
    {
        var live = CurrentCocosPosition(go);
        token.Position = new M01GreyboxPoint(live.x, live.y);
    }

    private void ClearHeld()
    {
        held = null;
        heldGo = null;
        heldDragOffset = Vector2.zero;
    }

    /// <summary>按玩家当前实际放入的拼片提交证据；错误颜色也要进入验证并显出真实结果。</summary>
    private void TrySubmitPairs(M01GreyboxSession session)
    {
        var layout = board.Layout!;
        // 自由证据区：按当前弱吸附进去的实际两片提交，不能反查真解 id。
        foreach (var ev in layout.Evidence)
        {
            if (!placementLedger.TryGetWeakPair(ev.ControllerId, out var pair)) continue;
            var result = session.SubmitEvidencePair(ev.ControllerId, pair);
            Debug.Log($"M01DragProbe: SubmitEvidencePair {ev.ControllerId} [{string.Join(",", pair)}] → accepted={result.Accepted} staged={result.CompletedEvidenceCount}" +
                      (result.Reason != null ? $" reason={result.Reason}" : ""));
        }

        TrySubmitTargetPatternEvidencePairs(session);
    }

    /// <summary>
    /// Cocos trySubmitTargetPatternEvidencePairs：证据关系由目标槽位上的实际占用片组成，而不是由
    /// 真解 fragment id 组成。这样六片位置/角度正确但颜色错误时会进入 wrong_blend_color 或
    /// wrong_fragment_set，并在失败窗口按玩家刚拼出的六片显色。
    /// </summary>
    private void TrySubmitTargetPatternEvidencePairs(M01GreyboxSession session)
    {
        var config = board.Config;
        var layout = board.Layout;
        if (config?.TargetPattern?.Locked != true || layout == null) return;

        var liveOccupantByExpectedFragment = new Dictionary<string, string>();
        foreach (var slot in layout.TargetPieceSlots)
        {
            if (slot.ExpectedFragmentId != null &&
                TryGetPoseCorrectSlotOccupant(slot, out var liveOccupant))
            {
                liveOccupantByExpectedFragment[slot.ExpectedFragmentId] = liveOccupant;
            }
        }

        foreach (var ev in config.Evidence)
        {
            var pair = M01CandidateAssembly.ResolveTargetEvidencePair(
                ev.Solution.FragmentIds,
                liveOccupantByExpectedFragment);
            if (pair != null) session.SubmitEvidencePair(ev.Id, pair);
        }
    }

    private bool TryGetPoseCorrectSlotOccupant(M01GreyboxPieceSnapZone slot, out string fragmentId)
    {
        if (!placementLedger.TryGetSlotOccupant(slot.Id, out fragmentId!)) return false;
        if (!board.FragmentObjects.TryGetValue(fragmentId, out var go)) return false;
        var body = go.GetComponent<Rigidbody2D>();
        return body != null && body.bodyType == RigidbodyType2D.Kinematic &&
               Mathf.Abs(Mathf.DeltaAngle(go.transform.eulerAngles.z, (float)slot.Rotation)) <= 1f;
    }

    /// <summary>全部证据 staged → 验证候选结构 → 底光反馈(探针: 背板染色 + 打点)。</summary>
    private void TryValidate(M01GreyboxSession session)
    {
        if (validationFailureRoutine != null) return;
        if (!M01CandidateAssembly.ShouldValidate(
                AllTargetSlotsPositionOccupied(),
                session.AreAllEvidenceStaged())) return;
        var validation = session.ValidateCandidateStructure();
        Debug.Log($"M01DragProbe: VALIDATE → accepted={validation.Accepted} completed={validation.Completed} bottomLight={validation.BottomLight}" +
                  (validation.Reason != null ? $" reason={validation.Reason}" : ""));
        ApplyValidationPresentation(session, validation);
        if (!validation.Completed && validation.ValidationLightSeconds != null)
        {
            ScheduleFailedCandidateReturn(session, (float)validation.ValidationLightSeconds.Value);
        }
        if (validation.Completed)
        {
            Debug.Log($"M01DragProbe: ✅ 通关! status=\"{validation.Status}\" → 起通关演出");
            var completion = GetComponent<M01CompletionProbe>();
            if (completion != null)
            {
                completion.PlayCompletion(session.GetLastToolCard());
            }
        }
    }

    private void ApplyValidationPresentation(M01GreyboxSession session, M01GreyboxValidateResult validation)
    {
        foreach (var fragment in board.Layout!.Fragments)
        {
            if (!board.FragmentObjects.TryGetValue(fragment.ControllerId, out var go)) continue;
            var view = session.GetFragmentView(fragment.ControllerId);
            var renderer = go.GetComponent<SpriteRenderer>();
            if (renderer == null) continue;
            renderer.color = view.ValidationColor != null
                ? M01FlashlightProbe.RevealTint(view.ValidationColor)
                : board.FragmentBaseColors[fragment.ControllerId];
        }

        // 正确与错误都按当前台面真实几何即时求交叠色；失败保持配置规定的 3 秒后再掉片。
        board.RenderValidationBlendOverlays(validation.BottomLight != M01BottomLightState.Off);
        var boardGo = GameObject.Find("~M01BoardRoot/board");
        if (boardGo != null)
        {
            boardGo.GetComponent<SpriteRenderer>().color = validation.Accepted
                ? new Color(0.62f, 0.78f, 0.60f, 0.56f)
                : new Color(0.85f, 0.58f, 0.52f, 0.56f);
        }
    }

    private void ScheduleFailedCandidateReturn(M01GreyboxSession session, float delaySeconds)
    {
        var snapshot = new HashSet<string>(placementLedger.PlacedFragments());
        validationFailureRoutine = StartCoroutine(ReturnFailedCandidateAfterDelay(session, snapshot, delaySeconds));
    }

    private IEnumerator ReturnFailedCandidateAfterDelay(
        M01GreyboxSession session,
        HashSet<string> snapshot,
        float delaySeconds)
    {
        yield return new WaitForSeconds(Mathf.Max(0f, delaySeconds));
        CancelAllRotatePins();
        snapshot.UnionWith(session.ResetCandidateStructure());
        board.RenderValidationBlendOverlays(false);
        var boardGo = GameObject.Find("~M01BoardRoot/board");
        if (boardGo != null) boardGo.GetComponent<SpriteRenderer>().color = Color.clear;

        foreach (var fragment in board.Layout!.Fragments)
        {
            if (!board.FragmentObjects.TryGetValue(fragment.ControllerId, out var go)) continue;
            var renderer = go.GetComponent<SpriteRenderer>();
            if (renderer != null && board.FragmentBaseColors.TryGetValue(fragment.ControllerId, out var baseColor))
            {
                renderer.color = baseColor;
            }
            if (!snapshot.Contains(fragment.ControllerId) || held?.ControllerId == fragment.ControllerId) continue;
            RemoveFragmentFromPlacementLedgers(fragment.ControllerId);
            ReleaseFragmentBodyToPhysics(go);
        }
        validationFailureRoutine = null;
    }

    private bool AllTargetSlotsPositionOccupied()
    {
        var slots = board.Layout?.TargetPieceSlots;
        return slots != null && slots.Count > 0 &&
               slots.All(slot => placementLedger.TryGetSlotOccupant(slot.Id, out _));
    }

    private M01TargetSlotPlacementAction PlaceIntoTargetSlot(
        string? slotId,
        string incomingFragmentId)
    {
        if (slotId == null)
        {
            return M01TargetSlotPlacementAction.ClaimIncoming;
        }
        var displacedId = incomingFragmentId;
        var hasDifferentOccupant =
            placementLedger.TryGetSlotOccupant(slotId, out displacedId) &&
            displacedId != incomingFragmentId;
        var existingOccupantPoseCorrect = false;
        if (hasDifferentOccupant)
        {
            var slot = board.Layout?.TargetPieceSlots.FirstOrDefault(candidate => candidate.Id == slotId);
            existingOccupantPoseCorrect = slot != null &&
                TryGetPoseCorrectSlotOccupant(slot, out var correctId) &&
                correctId == displacedId;
        }

        var action = placementLedger.PlaceIntoTargetSlot(
            slotId,
            incomingFragmentId,
            existingOccupantPoseCorrect,
            out var replacedId);
        if (action != M01TargetSlotPlacementAction.ReleaseExistingAndClaimIncoming)
        {
            return action;
        }

        // 此分支必有不同占用者；上面的纯决策把“保留正确占用者并停放来片”单独分流。
        if (replacedId == null) return action;
        board.Session?.UnstageFragment(replacedId);
        if (board.FragmentObjects.TryGetValue(replacedId, out var displacedGo))
        {
            ReleaseFragmentBodyToPhysics(displacedGo);
        }
        return action;
    }

    private void RemoveFragmentFromPlacementLedgers(string fragmentId)
    {
        placementLedger.Remove(fragmentId);
    }

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }
}
