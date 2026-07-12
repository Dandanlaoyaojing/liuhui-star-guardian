// M01 手电探针(桶 B: FlashlightRig 雏形)—— Light2D 光池跟随鼠标 + 覆盖内拼片按灯色显真彩。
// 玩法(v4 语义): F 键循环 红→黄→蓝→灭(session.SelectFlashlight/ClearFlashlight);
// 光池半径 = config.flashlightCoverage.radius(70px); 覆盖内候选片 session.RevealFragment →
// RevealedColor(hiddenColor×灯色混色)染色, 移出覆盖/灭灯恢复玩法底色(FragmentBaseColors)。
// Light2D = URP 2D 点光(这就是换引擎要的那套光), 光池颜色随灯色。仅 Play 生效。
#nullable enable

using System.Collections.Generic;
using StarGuardian.M01;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering.Universal;

[RequireComponent(typeof(M01BoardProbe))]
public sealed class M01FlashlightProbe : MonoBehaviour
{
    private const float Ppu = 100f;

    private static readonly string[] CycleIds = { "flashlight_red", "flashlight_yellow", "flashlight_blue" };

    private M01BoardProbe board = null!;
    private Light2D? pool;
    private SpriteRenderer? handSprite; // 手持手电本体(贴图随灯色换, 灭=显示但压暗)
    private int cycleIndex = -1; // -1 = 灭
    private double coverageRadius = 70;
    private readonly HashSet<string> litNow = new();
    private readonly HashSet<string> litPrev = new();

    private void Awake() => board = GetComponent<M01BoardProbe>();

    private void Update()
    {
        if (!Application.isPlaying || board.Layout == null || board.Session == null) return;
        var mouse = Mouse.current;
        if (mouse == null) return;

        EnsurePool();

        if (Keyboard.current != null && Keyboard.current.fKey.wasPressedThisFrame)
        {
            CycleFlashlight();
        }

        var cocos = ScreenToCocos(mouse.position.ReadValue());
        pool!.transform.position = new Vector3(cocos.x / Ppu, cocos.y / Ppu, 0);

        if (cycleIndex < 0)
        {
            RestoreAll();
            return;
        }

        // 覆盖判定 + 显色(进=reveal 染混色, 出=恢复玩法底色)。
        litNow.Clear();
        foreach (var frag in board.Layout.Fragments)
        {
            var dx = (float)frag.Position.X - cocos.x;
            var dy = (float)frag.Position.Y - cocos.y;
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

    private void EnsurePool()
    {
        if (pool != null) return;
        var go = new GameObject("~FlashlightPool");
        pool = go.AddComponent<Light2D>();
        pool.lightType = Light2D.LightType.Point;
        pool.pointLightInnerRadius = 0.1f;
        pool.pointLightOuterRadius = (float)coverageRadius * 1.6f / Ppu; // 视觉光斑比逻辑覆盖略大, 柔和
        pool.intensity = 0f; // 灭态
        pool.color = Color.white;

        // 手电本体贴图: 挂光池节点右上(像被手持着), 灯色换贴图, 灭态压暗。
        var handGo = new GameObject("hand");
        handGo.transform.SetParent(go.transform, false);
        handGo.transform.localPosition = new Vector3(0.34f, 0.30f, 0);
        handGo.transform.localRotation = Quaternion.Euler(0, 0, 35f); // 斜向下照
        handSprite = handGo.AddComponent<SpriteRenderer>();
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
        cycleIndex = cycleIndex >= CycleIds.Length - 1 ? -1 : cycleIndex + 1;
        if (cycleIndex < 0)
        {
            var off = session.ClearFlashlight();
            pool!.intensity = 0f;
            SetHandSprite(null);
            Debug.Log($"M01FlashlightProbe: 灭灯 status=\"{off.Status}\"");
            RestoreAll();
            return;
        }
        var result = session.SelectFlashlight(CycleIds[cycleIndex]);
        var c = result.ActiveFlashlightColor ?? "";
        pool!.color = RevealTint(c);
        pool.intensity = 1.1f;
        SetHandSprite(c);
        // 换灯色 → 旧显色作废, 全部恢复底色重照(session.SelectFlashlight 已清 observed)。
        RestoreAll();
        Debug.Log($"M01FlashlightProbe: {CycleIds[cycleIndex]}({c}) status=\"{result.Status}\"");
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

    /// <summary>颜色词 → 展示色(低饱和手绘风, 但显色态要明显比灰白鲜亮)。</summary>
    private static Color RevealTint(string token) => token switch
    {
        "red" => new Color(0.87f, 0.45f, 0.38f),
        "yellow" => new Color(0.91f, 0.78f, 0.38f),
        "blue" => new Color(0.42f, 0.60f, 0.84f),
        "orange" => new Color(0.89f, 0.60f, 0.36f),
        "green" => new Color(0.50f, 0.72f, 0.50f),
        "purple" => new Color(0.68f, 0.53f, 0.72f),
        _ => new Color(0.8f, 0.8f, 0.78f)
    };

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }
}
