// M01 手电探针——复刻 Cocos 的方向性渐变光锥、白热灯芯与覆盖内拼片显色。
// 玩法(v4 语义): F 键循环 红→黄→蓝→灭(session.SelectFlashlight/ClearFlashlight);
// 光池半径 = config.flashlightCoverage.radius(70px); 覆盖内候选片 session.RevealFragment →
// RevealedColor(hiddenColor×灯色混色)染色, 移出覆盖/灭灯恢复玩法底色(FragmentBaseColors)。
// 视觉光与拼片反应色都消费 M01VisualParity，避免 Unity 灯光材质改变水彩底色。仅 Play 生效。
#nullable enable

using System.Collections.Generic;
using StarGuardian.M01;
using StarGuardian.M01.Rendering;
using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(M01BoardProbe))]
public sealed class M01FlashlightProbe : MonoBehaviour
{
    private const float Ppu = 100f;

    /// <summary>手电是否已拾取(IntroProbe 拾取后置真); 无 IntroProbe 的场景在 Start 里自动置真。</summary>
    public bool Acquired = true;

    /// <summary>通关演出等期间锁输入(与 DragProbe.InputLocked 同机制, CompletionProbe 驱动)。</summary>
    public bool InputLocked;

    private readonly Dictionary<string, string> flashlightIdByColor = new();
    private M01BoardProbe board = null!;
    private M01DragProbe? drag;
    private GameObject? beamRoot;
    private SpriteRenderer? coneGlow;
    private SpriteRenderer? coreGlow;
    private SpriteRenderer? handSprite; // 手持手电本体(贴图随灯色换, 灭=显示但压暗)
    private Transform? heldAnchor;
    private GameObject? heldFlashlight;
    private SpriteRenderer? headGlow;
    private Texture2D? radialGlowTexture;
    private Sprite? radialGlowSprite;
    private Texture2D? coneGlowTexture;
    private Sprite? coneGlowSprite;
    private string activeLightState = LightState.Off;
    private double coverageRadius = 70;
    private readonly HashSet<string> litNow = new();
    private readonly HashSet<string> litPrev = new();

    /// <summary>M01IntroSequence 的 onFlashlightAcquired 等价交接：覆盖面从莱米+手持角度派生。</summary>
    public void SetHeldAnchor(Transform lemmyAnchor, GameObject flashlightObject)
    {
        heldAnchor = lemmyAnchor;
        heldFlashlight = flashlightObject;
        if (handSprite != null) handSprite.enabled = false;
        SetHeadGlow(LightState.Off);
    }

    /// <summary>Cocos suspendFlashlightObservation：真正抓到拼片时才灭灯并清掉显色。</summary>
    public void TurnOffForFragmentPickup()
    {
        if (!Acquired || board.Session == null) return;
        activeLightState = LightState.Off;
        board.Session.ClearFlashlight();
        SetBeamActive(false);
        SetHandSprite(null);
        SetHeadGlow(LightState.Off);
        RestoreAll();
    }

    /// <summary>Cocos acquired 路由：点手持手电可循环灯态；命中区至少 44px，避免小图难点。</summary>
    public bool TryCycleHeldFlashlightAt(Vector2 cocosPos)
    {
        if (!Acquired || InputLocked || heldFlashlight == null || !heldFlashlight.activeInHierarchy ||
            board.Session == null || !EnsureCycleConfig())
        {
            return false;
        }

        var center = new Vector2(heldFlashlight.transform.position.x * Ppu, heldFlashlight.transform.position.y * Ppu);
        var half = (float)M01IntroLayout.FlashlightTapMinimumPixels / 2f;
        if (Mathf.Abs(cocosPos.x - center.x) > half || Mathf.Abs(cocosPos.y - center.y) > half) return false;
        EnsureBeam();
        CycleFlashlight();
        return true;
    }

    private void Awake()
    {
        board = GetComponent<M01BoardProbe>();
        drag = GetComponent<M01DragProbe>();
    }

    private void Update()
    {
        if (!Application.isPlaying || board.Layout == null || board.Session == null || InputLocked) return;
        // 玩法数值单一真源: 半径与灯 id 从 config 读(硬编码曾被审查点名违反 puzzle-scripts 规则)。
        if (!EnsureCycleConfig()) return;
        if (!Acquired)
        {
            SetBeamActive(false);
            if (handSprite != null) handSprite.enabled = false;
            return; // 手电未拾取(开场期间)
        }
        var pointer = Pointer.current;
        if (heldAnchor == null && heldFlashlight == null && pointer == null) return;

        EnsureBeam();

        if (Keyboard.current != null && Keyboard.current.fKey.wasPressedThisFrame)
        {
            CycleFlashlight();
        }

        Vector2 muzzle;
        Vector2 cocos;
        if (heldAnchor != null && heldFlashlight != null)
        {
            ComputeHeldBeamGeometry(out muzzle, out cocos);
        }
        else
        {
            cocos = ScreenToCocos(pointer!.position.ReadValue());
            muzzle = cocos + new Vector2(-70f, 70f);
        }

        if (activeLightState == LightState.Off)
        {
            SetBeamActive(false);
            RestoreAll();
            return;
        }
        UpdateBeamVisual(muzzle, cocos);

        // 覆盖判定 + 显色(进=reveal 染混色, 出=恢复玩法底色)。
        // onTray/拖拽中排除(TS collectCoverageCandidates + suspendFlashlightObservation 语义):
        // 光束不照已上盘(中央槽/证据试拼)的片, 也不照正拖拽贴在光标上的片——否则玩家拼好后可用
        // 手电直接核对隐藏色, 绕过"靠证据混色推理"的设计(审查 CONFIRMED)。
        litNow.Clear();
        foreach (var frag in board.Layout.Fragments)
        {
            if (drag != null && (drag.IsFragmentPlaced(frag.ControllerId) || drag.HeldFragmentId == frag.ControllerId))
            {
                continue;
            }
            if (!board.FragmentObjects.TryGetValue(frag.ControllerId, out var fragmentObject)) continue;
            var live = fragmentObject.transform.position;
            var dx = live.x * Ppu - cocos.x;
            var dy = live.y * Ppu - cocos.y;
            if (dx * dx + dy * dy <= coverageRadius * coverageRadius)
            {
                litNow.Add(frag.ControllerId);
            }
        }

        foreach (var fid in litNow)
        {
            if (litPrev.Contains(fid)) continue; // 已亮, 不重复 reveal
            var result = board.Session.RevealFragment(fid);
            if (result.Accepted && result.RevealedColor != null &&
                board.FragmentObjects.TryGetValue(fid, out var go))
            {
                go.GetComponent<SpriteRenderer>().color = RevealTint(result.RevealedColor);
            }
        }
        foreach (var fid in litPrev)
        {
            if (litNow.Contains(fid)) continue;
            RestoreFragment(fid);
        }
        litPrev.Clear();
        litPrev.UnionWith(litNow);
    }

    private bool EnsureCycleConfig()
    {
        if (flashlightIdByColor.Count > 0) return true;
        if (board.Config == null) return false;
        coverageRadius = board.Config.FlashlightCoverage?.Radius ?? coverageRadius;
        var flashlights = board.Config.Flashlights;
        if (flashlights == null || flashlights.Count == 0) return false;
        foreach (var flashlight in flashlights)
        {
            flashlightIdByColor[flashlight.Color] = flashlight.Id;
        }
        return flashlightIdByColor.ContainsKey(LightState.Red) &&
               flashlightIdByColor.ContainsKey(LightState.Yellow) &&
               flashlightIdByColor.ContainsKey(LightState.Blue);
    }

    private void EnsureBeam()
    {
        if (beamRoot != null) return;
        beamRoot = new GameObject("~M01FlashlightBeam");

        var coneObject = new GameObject("M01FlashlightCone");
        coneObject.transform.SetParent(beamRoot.transform, false);
        coneGlow = coneObject.AddComponent<SpriteRenderer>();
        coneGlow.sprite = CreateConeGlowSprite();
        coneGlow.sharedMaterial = board.ArtMaterial;
        coneGlow.sortingOrder = -1; // 平台(-5)之上、拼片(0+)之下，和 Cocos sibling 顺序一致。

        var coreObject = new GameObject("M01FlashlightCore");
        coreObject.transform.SetParent(beamRoot.transform, false);
        coreGlow = coreObject.AddComponent<SpriteRenderer>();
        coreGlow.sprite = CreateRadialGlowSprite();
        coreGlow.sharedMaterial = board.ArtMaterial;
        coreGlow.sortingOrder = -1;
        coreGlow.color = new Color32(255, 255, 255, M01VisualParity.CoreAlpha);
        var coreDiameter = (float)M01VisualParity.CoreDiameterPx / Ppu;
        var coreScale = coreDiameter / coreGlow.sprite.bounds.size.x;
        coreObject.transform.localScale = new Vector3(coreScale, coreScale, 1f);
        SetBeamActive(false);

        if (heldFlashlight != null) return; // 正式开场已经交接真实手电节点，不再造鼠标跟随替身。

        // 无开场的独立探针回退: 光池节点旁造一个手电本体。
        var handGo = new GameObject("hand");
        handGo.transform.SetParent(beamRoot.transform, false);
        handGo.transform.localPosition = new Vector3(0.34f, 0.30f, 0);
        handGo.transform.localRotation = Quaternion.Euler(0, 0, 35f); // 斜向下照
        handSprite = handGo.AddComponent<SpriteRenderer>();
        handSprite.sharedMaterial = board.ArtMaterial;
        handSprite.sortingOrder = 60; // 压在拼片之上
        SetHandSprite(null);
    }

    private void SetHandSprite(string? colorWord)
    {
        if (handSprite == null) return;
        var name = colorWord == null ? "m01-flashlight-red" : $"m01-flashlight-{colorWord}";
        var sprite = Resources.Load<Sprite>("Art/M01/" + name);
        if (sprite == null) { handSprite.enabled = false; return; }
        handSprite.enabled = true;
        handSprite.sprite = sprite;
        handSprite.color = colorWord == null ? new Color(0.65f, 0.65f, 0.65f) : Color.white; // 灭态压暗
        // 手电显示高约 30px(Cocos FLASHLIGHT_VISUAL_HEIGHT≈30)。
        var targetUnits = 30f / Ppu;
        var s = targetUnits / sprite.bounds.size.y;
        handSprite.transform.localScale = new Vector3(s, s, 1f);
    }

    private void CycleFlashlight()
    {
        var session = board.Session!;
        activeLightState = M01FlashlightObservation.CycleLight(activeLightState);
        if (activeLightState == LightState.Off)
        {
            var off = session.ClearFlashlight();
            SetBeamActive(false);
            SetHandSprite(null);
            SetHeadGlow(LightState.Off);
            Debug.Log($"M01FlashlightProbe: 灭灯 status=\"{off.Status}\"");
            RestoreAll();
            return;
        }
        var flashlightId = flashlightIdByColor[activeLightState];
        var result = session.SelectFlashlight(flashlightId);
        var c = result.ActiveFlashlightColor ?? "";
        if (coneGlow != null) coneGlow.color = ToUnityColor(M01VisualParity.BeamVisualColor(c));
        SetBeamActive(true);
        SetHandSprite(c);
        SetHeadGlow(activeLightState);
        // 换灯色 → 旧显色作废, 全部恢复底色重照(session.SelectFlashlight 已清 observed)。
        RestoreAll();
        Debug.Log($"M01FlashlightProbe: {flashlightId}({c}) status=\"{result.Status}\"");
    }

    /// <summary>Cocos applyHeldFlashlightTint：灯体保持原图，仅在大头端叠当前红/黄/蓝光晕。</summary>
    private void SetHeadGlow(string lightState)
    {
        if (heldFlashlight == null) return;
        if (headGlow == null)
        {
            var glowObject = new GameObject("M01FlashlightHeadGlow");
            glowObject.transform.SetParent(heldFlashlight.transform, false);
            glowObject.transform.localPosition = new Vector3(
                0f,
                (float)M01IntroLayout.FlashlightHeadGlowOffsetY / Ppu,
                0f);
            headGlow = glowObject.AddComponent<SpriteRenderer>();
            headGlow.sharedMaterial = board.ArtMaterial;
            headGlow.sortingOrder = 61;
            headGlow.sprite = CreateRadialGlowSprite();
            var diameter = (float)M01IntroLayout.FlashlightHeadGlowDiameter / Ppu;
            var scale = diameter / headGlow.sprite.bounds.size.x;
            glowObject.transform.localScale = new Vector3(scale, scale, 1f);
        }

        if (lightState == LightState.Off)
        {
            headGlow.enabled = false;
            return;
        }

        headGlow.enabled = true;
        var visual = M01VisualParity.BeamVisualColor(lightState).WithAlpha(M01VisualParity.HeadGlowAlpha);
        headGlow.color = ToUnityColor(visual);
    }

    private Sprite CreateRadialGlowSprite()
    {
        if (radialGlowSprite != null) return radialGlowSprite;
        const int size = 128;
        radialGlowTexture = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            name = "M01FlashlightRadialGlowTexture",
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Clamp,
            hideFlags = HideFlags.DontSave
        };
        var pixels = new Color32[size * size];
        var center = (size - 1) / 2f;
        var maxRadius = size / 2f;
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var radius = Mathf.Min(1f, Vector2.Distance(new Vector2(x, y), new Vector2(center, center)) / maxRadius);
                var alpha = radius >= 1f
                    ? 0f
                    : Mathf.Exp(-(radius * radius) * 5.2f) * (1f - Mathf.Pow(radius, 4f));
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(alpha * 255f));
            }
        }
        radialGlowTexture.SetPixels32(pixels);
        radialGlowTexture.Apply(false, true);
        radialGlowSprite = Sprite.Create(
            radialGlowTexture,
            new Rect(0, 0, size, size),
            new Vector2(0.5f, 0.5f),
            Ppu);
        radialGlowSprite.name = "M01FlashlightRadialGlowSprite";
        return radialGlowSprite;
    }

    private Sprite CreateConeGlowSprite()
    {
        if (coneGlowSprite != null) return coneGlowSprite;
        const int size = 128;
        coneGlowTexture = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            name = "M01FlashlightConeGlowTexture",
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Clamp,
            hideFlags = HideFlags.DontSave
        };
        var pixels = new Color32[size * size];
        for (var y = 0; y < size; y++)
        {
            var across = y / (float)(size - 1) - 0.5f;
            for (var x = 0; x < size; x++)
            {
                var along = x / (float)(size - 1);
                var halfWidth = 0.05f + along * (0.5f - 0.05f);
                var q = Mathf.Abs(across) / halfWidth;
                var alongBrightness = Mathf.Pow(Mathf.Max(0f, 1f - along), 0.8f);
                var acrossBrightness = Mathf.Max(0f, 1f - q * q);
                var alpha = Mathf.RoundToInt(Mathf.Max(0f, alongBrightness * acrossBrightness) * 255f);
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)alpha);
            }
        }
        coneGlowTexture.SetPixels32(pixels);
        coneGlowTexture.Apply(false, true);
        coneGlowSprite = Sprite.Create(
            coneGlowTexture,
            new Rect(0, 0, size, size),
            new Vector2(0f, 0.5f),
            Ppu);
        coneGlowSprite.name = "M01FlashlightConeGlowSprite";
        return coneGlowSprite;
    }

    private void OnDestroy()
    {
        if (beamRoot != null) Destroy(beamRoot);
        if (coneGlowSprite != null) Destroy(coneGlowSprite);
        if (coneGlowTexture != null) Destroy(coneGlowTexture);
        if (radialGlowSprite != null) Destroy(radialGlowSprite);
        if (radialGlowTexture != null) Destroy(radialGlowTexture);
    }

    private void RestoreAll()
    {
        foreach (var fid in litPrev) RestoreFragment(fid);
        litPrev.Clear();
    }

    private void RestoreFragment(string fid)
    {
        if (board.FragmentObjects.TryGetValue(fid, out var go) &&
            board.FragmentBaseColors.TryGetValue(fid, out var baseColor))
        {
            go.GetComponent<SpriteRenderer>().color = baseColor;
        }
    }

    /// <summary>颜色词 → Cocos 显色字节真值。</summary>
    public static Color RevealTint(string token) => ToUnityColor(M01VisualParity.ObservedFragmentTint(token));

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }

    /// <summary>逐字复刻 Cocos computeBeamGeometry 的判定圆心（muzzle→地面交点）。</summary>
    private void ComputeHeldBeamGeometry(out Vector2 muzzle, out Vector2 center)
    {
        var anchor = heldAnchor!;
        var held = heldFlashlight!;
        var coverage = board.Config?.FlashlightCoverage;
        var thetaDeg = held.transform.eulerAngles.z;
        if (thetaDeg > 180f) thetaDeg -= 360f;
        var theta = thetaDeg * Mathf.Deg2Rad;
        var dir = new Vector2(-Mathf.Sin(theta), Mathf.Cos(theta));
        var horizontal = dir.x >= 0f ? 1f : -1f;
        var grip = new Vector2(held.transform.position.x * Ppu, held.transform.position.y * Ppu);
        muzzle = new Vector2(grip.x + horizontal * 13f, grip.y - 6f);
        var groundY = anchor.position.y * Ppu + (float)(coverage?.CenterOffsetY ?? -52d);
        var hitForward = dir.y < -0.05f
            ? dir.x * ((groundY - muzzle.y) / dir.y)
            : horizontal * 34f;
        center = new Vector2(
            muzzle.x + hitForward + (float)(coverage?.CenterOffsetX ?? 0d),
            groundY);
    }

    private void UpdateBeamVisual(Vector2 muzzle, Vector2 center)
    {
        if (beamRoot == null || coneGlow == null || coreGlow == null) return;
        SetBeamActive(true);
        var facing = Mathf.Sign(center.x - muzzle.x);
        if (Mathf.Approximately(facing, 0f)) facing = 1f;
        var baseAngle = Mathf.Atan2(center.y - muzzle.y, center.x - muzzle.x) * Mathf.Rad2Deg;
        var angle = baseAngle + facing * 3f; // Cocos: baseAngle - facing * COVERAGE_BEAM_TILT_DEG(-3)
        var sin = Mathf.Sin(angle * Mathf.Deg2Rad);
        var floorY = center.y - 18f;
        var lengthToGround = sin < -0.01f
            ? (floorY - muzzle.y) / sin
            : (float)M01VisualParity.BeamLengthPx;
        var length = Mathf.Max(1f, Mathf.Min((float)M01VisualParity.BeamLengthPx, lengthToGround));

        coneGlow.transform.position = new Vector3(muzzle.x / Ppu, muzzle.y / Ppu, 0f);
        coneGlow.transform.rotation = Quaternion.Euler(0f, 0f, angle);
        var coneBounds = coneGlow.sprite.bounds.size;
        coneGlow.transform.localScale = new Vector3(
            (length / Ppu) / coneBounds.x,
            (length * (float)M01VisualParity.ConeFan / Ppu) / coneBounds.y,
            1f);
        coreGlow.transform.position = new Vector3(muzzle.x / Ppu, muzzle.y / Ppu, 0f);
    }

    private void SetBeamActive(bool active)
    {
        if (coneGlow != null) coneGlow.enabled = active;
        if (coreGlow != null) coreGlow.enabled = active;
    }

    private static Color ToUnityColor(M01Color32 color) => new Color32(color.R, color.G, color.B, color.A);
}
