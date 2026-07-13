// M01 拖拽交互探针(桶 B: DragInputController 雏形)—— 鼠标接【已迁移的吸附判定 M01GreyboxDrag】。
// 玩法: 左键按住拼片拖动; 拖动中按 R 旋转 90°(玩家 90° 步进, 同 Cocos); 松手按
// ResolveM01GreyboxDrop 的 action 处置(snap=落槽 / stick=贴槽 / weak_snap=吸证据 / free=原地)。
// 仅 Play 模式生效。逻辑层 token.Position 与渲染层 GameObject 同步更新(单一真源=layout)。
// ponytail: 探针级输入(距离拾取, 无 Collider/EventSystem), 正式 DragInputController 再升级。
#nullable enable

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

    // 玩法状态(镜像 Cocos bootstrap 的 weakSnappedFragmentsByEvidence / target-pattern 配对):
    private readonly System.Collections.Generic.HashSet<string> snappedToTarget = new();
    private readonly System.Collections.Generic.Dictionary<string, System.Collections.Generic.HashSet<string>> weakSnapped = new();

    private void Awake() => board = GetComponent<M01BoardProbe>();

    private void Update()
    {
        if (!Application.isPlaying || board.Layout == null || InputLocked) return;
        var mouse = Mouse.current;
        if (mouse == null) return;

        var cocosPos = ScreenToCocos(mouse.position.ReadValue());

        if (mouse.leftButton.wasPressedThisFrame && held == null)
        {
            TryPickup(cocosPos);
        }
        // release 独立于 press 检查: 同帧 press+release(快速轻点/低帧率)时立即在原地落下,
        // 不再被 else-if 跳过导致 held 永久滞留(审查 CONFIRMED 的丢 drop 坑)。
        if (held != null && mouse.leftButton.wasReleasedThisFrame)
        {
            Drop(cocosPos);
        }
        else if (held != null && mouse.leftButton.isPressed)
        {
            MoveHeld(cocosPos);
            if (Keyboard.current != null && Keyboard.current.rKey.wasPressedThisFrame)
            {
                heldRotation = (heldRotation + 90) % 360;
                heldGo!.transform.localRotation = Quaternion.Euler(0, 0, (float)heldRotation);
            }
        }
    }

    /// <summary>该片是否已就位(中央槽或证据试拼)——手电 onTray 排除等消费。</summary>
    public bool IsFragmentPlaced(string fragmentId)
    {
        if (snappedToTarget.Contains(fragmentId)) return true;
        foreach (var set in weakSnapped.Values)
        {
            if (set.Contains(fragmentId)) return true;
        }
        return false;
    }

    /// <summary>当前拖拽中的片(无则 null)——手电拖拽中排除观察等消费。</summary>
    public string? HeldFragmentId => held?.ControllerId;

    /// <summary>清空拖拽记账(BoardProbe 重建 Session 时调, 防旧账本对新 Session 假提交)。</summary>
    public void ResetLedgers()
    {
        snappedToTarget.Clear();
        weakSnapped.Clear();
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
        // 复用拾起路径(unstage/记账清理), 再定向落下。
        held = target;
        heldGo = go;
        heldBaseOrder = go.GetComponent<SpriteRenderer>().sortingOrder;
        var session = board.Session;
        if (session != null) session.UnstageFragment(fragmentId);
        snappedToTarget.Remove(fragmentId);
        foreach (var set in weakSnapped.Values) set.Remove(fragmentId);
        heldRotation = rotation;
        go.transform.localRotation = Quaternion.Euler(0, 0, (float)rotation);
        Drop(new Vector2((float)x, (float)y));
    }

    private void TryPickup(Vector2 cocosPos)
    {
        var layout = board.Layout!;
        M01GreyboxTokenNode? best = null;
        var bestDist = float.MaxValue;
        foreach (var frag in layout.Fragments)
        {
            var r = (float)System.Math.Max(frag.Size.Width, frag.Size.Height) / 2f + PickupSlackPx;
            var dx = (float)frag.Position.X - cocosPos.x;
            var dy = (float)frag.Position.Y - cocosPos.y;
            var d = Mathf.Sqrt(dx * dx + dy * dy);
            if (d <= r && d < bestDist)
            {
                best = frag;
                bestDist = d;
            }
        }
        if (best == null || !board.FragmentObjects.TryGetValue(best.ControllerId, out var go)) return;

        held = best;
        heldGo = go;
        // 拾起时账本【重基线到当前视觉角就近的 90° 倍数】并把视觉贴齐(Cocos rebaselineFragmentRotationFromNode
        // 的正解; 硬归零会让账本与屏幕朝向脱节 —— 审查 CONFIRMED 的"视觉转错却判 snap"坑)。
        var visualZ = go.transform.localEulerAngles.z;
        heldRotation = ((System.Math.Round(visualZ / 90.0) * 90.0) % 360 + 360) % 360;
        go.transform.localRotation = Quaternion.Euler(0, 0, (float)heldRotation);
        var sr = go.GetComponent<SpriteRenderer>();
        heldBaseOrder = sr.sortingOrder;
        sr.sortingOrder = 50; // 拖起时压最上

        // 拼片被拿走 → 撤它参与的暂存/配对(镜像 bootstrap: 掉片/挪走即 unstage)。
        var session = board.Session;
        if (session != null)
        {
            var cleared = session.UnstageFragment(best.ControllerId);
            if (cleared.Count > 0) Debug.Log($"M01DragProbe: unstaged {best.ControllerId} → cleared evidence [{string.Join(",", cleared)}]");
        }
        snappedToTarget.Remove(best.ControllerId);
        foreach (var set in weakSnapped.Values) set.Remove(best.ControllerId);
    }

    private void MoveHeld(Vector2 cocosPos)
    {
        held!.Position = new M01GreyboxPoint(cocosPos.x, cocosPos.y);
        heldGo!.transform.localPosition = new Vector3(cocosPos.x / Ppu, cocosPos.y / Ppu, 0);
    }

    private void Drop(Vector2 cocosPos)
    {
        var layout = board.Layout!;
        var token = held!;
        var go = heldGo!;
        var action = M01GreyboxDrag.ResolveM01GreyboxDrop(
            layout, token, new M01GreyboxPoint(cocosPos.x, cocosPos.y),
            new M01GreyboxDropOptions { Rotation = heldRotation });

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
        go.transform.localPosition = new Vector3((float)final.X / Ppu, (float)final.Y / Ppu, 0);

        // 探针级视觉反馈: snap 亮绿一拍语义 → 这里直接染色区分(正式版走 session 事件)。
        var sr = go.GetComponent<SpriteRenderer>();
        sr.sortingOrder = heldBaseOrder;
        var feedback = action.Type switch
        {
            M01GreyboxDropActionType.SnapFragmentToTargetPiece => new Color(0.55f, 0.72f, 0.55f), // 吸附成功: 灰绿
            M01GreyboxDropActionType.WeakSnapFragment => new Color(0.62f, 0.60f, 0.74f),          // 证据试拼: 淡紫
            M01GreyboxDropActionType.StickFragmentToSlot => new Color(0.80f, 0.66f, 0.52f),       // 贴槽待转: 琥珀
            _ => new Color(0.78f, 0.78f, 0.76f)                                                   // 自由落: 灰白
        };
        sr.color = feedback;
        board.FragmentBaseColors[token.ControllerId] = feedback; // 手电显色离开覆盖后恢复到这个玩法色

        Debug.Log($"M01DragProbe: {token.ControllerId} rot={heldRotation} → {action.Type}" +
                  (action.PieceSlotId != null ? $" slot={action.PieceSlotId}" : "") +
                  (action.EvidenceId != null ? $" evidence={action.EvidenceId}" : "") +
                  (action.Reason != null ? $" reason={action.Reason}" : ""));

        // ── session 玩法闭环: snap/weak_snap → 记账 → 证据两片齐即提交 → 全 staged 即验证 ──
        var session = board.Session;
        if (session != null)
        {
            if (action.Type == M01GreyboxDropActionType.SnapFragmentToTargetPiece)
            {
                snappedToTarget.Add(token.ControllerId);
            }
            else if (action.Type == M01GreyboxDropActionType.WeakSnapFragment && action.EvidenceId != null)
            {
                session.WeakSnapFragmentToEvidence(token.ControllerId, action.EvidenceId);
                if (!weakSnapped.TryGetValue(action.EvidenceId, out var set))
                {
                    set = new System.Collections.Generic.HashSet<string>();
                    weakSnapped[action.EvidenceId] = set;
                }
                set.Add(token.ControllerId);
            }
            TrySubmitPairs(session);
            TryValidate(session);
        }

        held = null;
        heldGo = null;
    }

    /// <summary>每条证据的两片真解(FragmentSnapPositions 键)都已就位(中央 target 槽 pose 对 或 证据上试拼) → 提交配对。</summary>
    private void TrySubmitPairs(M01GreyboxSession session)
    {
        var layout = board.Layout!;
        foreach (var ev in layout.Evidence)
        {
            if (ev.FragmentSnapPositions == null || ev.FragmentSnapPositions.Count == 0) continue;
            if (session.IsEvidenceStaged(ev.ControllerId)) continue;
            var pair = new System.Collections.Generic.List<string>(ev.FragmentSnapPositions.Keys);
            var allPlaced = true;
            weakSnapped.TryGetValue(ev.ControllerId, out var weak);
            foreach (var fid in pair)
            {
                if (!(snappedToTarget.Contains(fid) || (weak != null && weak.Contains(fid))))
                {
                    allPlaced = false;
                    break;
                }
            }
            if (!allPlaced) continue;
            var result = session.SubmitEvidencePair(ev.ControllerId, pair);
            Debug.Log($"M01DragProbe: SubmitEvidencePair {ev.ControllerId} [{string.Join(",", pair)}] → accepted={result.Accepted} staged={result.CompletedEvidenceCount}" +
                      (result.Reason != null ? $" reason={result.Reason}" : ""));
        }
    }

    /// <summary>全部证据 staged → 验证候选结构 → 底光反馈(探针: 背板染色 + 打点)。</summary>
    private void TryValidate(M01GreyboxSession session)
    {
        if (!session.AreAllEvidenceStaged()) return;
        var validation = session.ValidateCandidateStructure();
        Debug.Log($"M01DragProbe: VALIDATE → accepted={validation.Accepted} completed={validation.Completed} bottomLight={validation.BottomLight}" +
                  (validation.Reason != null ? $" reason={validation.Reason}" : ""));
        var boardGo = GameObject.Find("~M01BoardRoot/board");
        if (boardGo != null)
        {
            boardGo.GetComponent<SpriteRenderer>().color = validation.Accepted
                ? new Color(0.62f, 0.78f, 0.60f)   // 底光亮: 灰绿
                : new Color(0.85f, 0.58f, 0.52f);  // 验证失败: 砖红闪(探针不做定时复位)
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

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }
}
