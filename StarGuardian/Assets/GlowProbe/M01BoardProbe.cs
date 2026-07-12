// M01 盘面探针 —— 用【真实 m01-memory-gear.json + 已迁移的 M01GreyboxLayout.Build】在 Unity 世界空间
// 渲出灰盒盘面(齿轮/背板/目标槽/9 拼片/证据/滤镜), 验证"纯逻辑层 → Unity 渲染"整条链路。
// 只是探针: 程序化形状贴图 + SpriteRenderer, 无交互; 正式 PuzzleBoardView 以此为骨架逐步替换。
// 坐标: Cocos 960×640 中心原点 px → Unity 世界 units, PPU=100(pos/100)。
#nullable enable

using System.Collections.Generic;
using Newtonsoft.Json;
using StarGuardian.M01;
using UnityEngine;

[ExecuteAlways]
public sealed class M01BoardProbe : MonoBehaviour
{
    private const float Ppu = 100f;
    private const string RootName = "~M01BoardRoot";

    private static readonly Color Ink = new(0.22f, 0.24f, 0.27f);          // 手绘墨线
    private static readonly Color Paper = new(0.93f, 0.91f, 0.86f);        // 米白纸底
    private static readonly Color GreyPiece = new(0.78f, 0.78f, 0.76f);    // 未显色拼片灰白
    private static readonly Color SlotGhost = new(0.55f, 0.58f, 0.62f, 0.55f); // 目标槽虚影
    private static readonly Color EvidenceTint = new(0.72f, 0.68f, 0.78f); // 证据淡紫
    private static readonly Color GearTint = new(0.82f, 0.80f, 0.74f);     // 齿轮盘

    private readonly Dictionary<string, Sprite> spriteCache = new();

    /// <summary>Build 后的布局数据(逻辑层单一真源); M01DragProbe 消费。</summary>
    public M01GreyboxLayoutData? Layout { get; private set; }

    /// <summary>谜题会话(状态机); Play 下由交互层驱动 stage/validate。</summary>
    public M01GreyboxSession? Session { get; private set; }

    /// <summary>controllerId → 拼片 GameObject(渲染层), 与 Layout.Fragments 对齐。</summary>
    public IReadOnlyDictionary<string, GameObject> FragmentObjects => fragmentObjects;

    private readonly Dictionary<string, GameObject> fragmentObjects = new();

    /// <summary>拼片"底色"账本(玩法反馈色); 手电显色离开覆盖时恢复到这里的值。DragProbe 落子时更新。</summary>
    public readonly Dictionary<string, Color> FragmentBaseColors = new();

    private Material? litMaterial; // URP 2D 受光材质(Light2D 光池要照得上)

    private void OnEnable() => Build();

    private void OnDisable()
    {
        var old = GameObject.Find(RootName);
        if (old != null) DestroyImmediate(old);
    }

    private void Build()
    {
        var old = GameObject.Find(RootName);
        if (old != null) DestroyImmediate(old);

        var text = Resources.Load<TextAsset>("Configs/m01-memory-gear");
        if (text == null)
        {
            Debug.LogError("M01BoardProbe: Resources/Configs/m01-memory-gear.json 未找到");
            return;
        }
        var config = JsonConvert.DeserializeObject<M01MemoryGearConfig>(text.text);
        if (config == null)
        {
            Debug.LogError("M01BoardProbe: config 反序列化失败");
            return;
        }
        var layout = M01GreyboxLayout.Build(config, new M01GreyboxLayoutOptions());
        Session = M01GreyboxSession.FromConfig(config);

        var root = new GameObject(RootName) { hideFlags = HideFlags.DontSave };

        SetupCamera();

        // URP 2D 受光材质 + 全局光(intensity=1 保持基础亮度不变); 手电 Light2D 光池在其上叠亮。
        var litShader = Shader.Find("Universal Render Pipeline/2D/Sprite-Lit-Default");
        litMaterial = litShader != null ? new Material(litShader) { hideFlags = HideFlags.DontSave } : null;
        var globalLightGo = new GameObject("globalLight2D");
        globalLightGo.transform.SetParent(root.transform, false);
        var globalLight = globalLightGo.AddComponent<UnityEngine.Rendering.Universal.Light2D>();
        globalLight.lightType = UnityEngine.Rendering.Universal.Light2D.LightType.Global;
        globalLight.intensity = 1f;
        globalLight.color = Color.white;

        // 纸底(整画布)
        AddQuad(root, "paper", new Vector2(0, 0), new Vector2((float)layout.Canvas.Width, (float)layout.Canvas.Height), Paper, -10);

        // 齿轮盘 + 拼接背板
        AddShape(root, "gear", "circle", layout.Gear.Position, layout.Gear.Size, GearTint, -5, 0);
        AddQuad(root, "board", ToV2(layout.Board.Position), new Vector2((float)layout.Board.Size.Width, (float)layout.Board.Size.Height), new Color(Paper.r * 0.96f, Paper.g * 0.95f, Paper.b * 0.92f), -4);

        // 目标槽(虚影轮廓, 按 rotation)
        foreach (var slot in layout.TargetPieceSlots)
        {
            AddShape(root, $"slot:{slot.Id}", slot.ShapeToken, slot.Position, slot.Size, SlotGhost, -3, (float)slot.Rotation, outlineOnly: true);
        }

        // 证据区(拼接盘上的交叠证据)
        foreach (var ev in layout.Evidence)
        {
            AddShape(root, $"evidence:{ev.ControllerId}", "circle", ev.Position, ev.Size, EvidenceTint, -2, 0, alpha: 0.5f);
        }

        // 滤镜(手电三色按钮; v4 里由手电承担, 探针仅显示位置)
        if (layout.Filters != null)
        {
            foreach (var f in layout.Filters)
            {
                AddShape(root, $"filter:{f.ControllerId}", "circle", f.Position, f.Size, ColorFor(f.ColorToken, 0.65f), -2, 0);
            }
        }

        // 9 拼片(灰白未显色; 描边示形)。渲染层节点登记进 fragmentObjects 供交互层驱动。
        fragmentObjects.Clear();
        FragmentBaseColors.Clear();
        foreach (var frag in layout.Fragments)
        {
            var go = AddShape(root, $"frag:{frag.ControllerId}", frag.ShapeToken, frag.Position, frag.Size, GreyPiece, 0, 0);
            fragmentObjects[frag.ControllerId] = go;
            FragmentBaseColors[frag.ControllerId] = GreyPiece;
        }
        Layout = layout;

        Debug.Log($"M01BoardProbe: rendered fragments={layout.Fragments.Count} slots={layout.TargetPieceSlots.Count} evidence={layout.Evidence.Count} status=\"{layout.StatusText}\"");
    }

    private void SetupCamera()
    {
        var cam = Camera.main;
        if (cam == null)
        {
            var cgo = new GameObject("Main Camera") { tag = "MainCamera" };
            cam = cgo.AddComponent<Camera>();
        }
        cam.orthographic = true;
        cam.orthographicSize = 3.2f; // 640px 竖向 / 2 / PPU
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.10f, 0.11f, 0.13f);
        cam.transform.position = new Vector3(0f, 0f, -10f);
    }

    // ── 渲染原语 ──

    private void AddQuad(GameObject parent, string name, Vector2 cocosPos, Vector2 sizePx, Color color, int order)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = new Vector3(cocosPos.x / Ppu, cocosPos.y / Ppu, 0);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = GetSprite("quad", "quad");
        if (litMaterial != null) sr.sharedMaterial = litMaterial;
        sr.color = color;
        sr.sortingOrder = order;
        go.transform.localScale = new Vector3(sizePx.x / Ppu, sizePx.y / Ppu, 1f);
    }

    private GameObject AddShape(
        GameObject parent, string name, string shapeToken, M01GreyboxPoint pos, M01GreyboxSize size,
        Color color, int order, float rotationDeg, bool outlineOnly = false, float alpha = 1f)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = new Vector3((float)pos.X / Ppu, (float)pos.Y / Ppu, 0);
        // Cocos 旋转为顺时针 → Unity Z 轴逆时针取负。
        go.transform.localRotation = Quaternion.Euler(0, 0, -rotationDeg);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = GetSprite(shapeToken, outlineOnly ? "outline" : "fill");
        if (litMaterial != null) sr.sharedMaterial = litMaterial;
        var c = color; c.a *= alpha;
        sr.color = c;
        sr.sortingOrder = order;
        var d = (float)System.Math.Max(size.Width, size.Height);
        go.transform.localScale = new Vector3(d / Ppu, d / Ppu, 1f);
        return go;
    }

    private static Vector2 ToV2(M01GreyboxPoint p) => new((float)p.X, (float)p.Y);

    private static Color ColorFor(string token, float s) => token switch
    {
        "red" => new Color(0.87f, 0.52f, 0.45f),
        "yellow" => new Color(0.89f, 0.78f, 0.46f),
        "blue" => new Color(0.48f, 0.62f, 0.80f),
        _ => new Color(s, s, s)
    };

    // ── 程序化形状贴图(128² 填充 or 轮廓): quad/circle/triangle/hexagon ──

    private Sprite GetSprite(string shapeToken, string variant)
    {
        var key = shapeToken + ":" + variant;
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;

        const int n = 128;
        var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { hideFlags = HideFlags.DontSave };
        var px = new Color32[n * n];
        var poly = PolygonFor(shapeToken, n);
        var outline = variant == "outline";

        for (var y = 0; y < n; y++)
        {
            for (var x = 0; x < n; x++)
            {
                bool inside = shapeToken == "quad" || InPolygon(poly, x + 0.5f, y + 0.5f, shapeToken, n);
                bool edge = false;
                if (inside && outline)
                {
                    // 轮廓 = 内缩 6px 后不在形内
                    edge = !InPolygon(poly, x + 0.5f, y + 0.5f, shapeToken, n, inset: 6f);
                }
                var solid = outline ? (inside && edge) : inside;
                px[y * n + x] = solid ? new Color32(255, 255, 255, 255) : new Color32(255, 255, 255, 0);
            }
        }
        tex.SetPixels32(px);
        tex.Apply();
        var sprite = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n);
        sprite.hideFlags = HideFlags.DontSave;
        spriteCache[key] = sprite;
        return sprite;
    }

    private static List<Vector2>? PolygonFor(string shapeToken, int n)
    {
        var c = n / 2f;
        var r = n / 2f - 1f;
        switch (shapeToken)
        {
            case "triangle":
            {
                var pts = new List<Vector2>();
                for (var i = 0; i < 3; i++)
                {
                    var a = Mathf.Deg2Rad * (90 + i * 120);
                    pts.Add(new Vector2(c + r * Mathf.Cos(a), c + r * Mathf.Sin(a)));
                }
                return pts;
            }
            case "hexagon":
            {
                var pts = new List<Vector2>();
                for (var i = 0; i < 6; i++)
                {
                    var a = Mathf.Deg2Rad * (30 + i * 60); // 平顶六边
                    pts.Add(new Vector2(c + r * Mathf.Cos(a), c + r * Mathf.Sin(a)));
                }
                return pts;
            }
            default:
                return null; // circle / quad 走解析式
        }
    }

    private static bool InPolygon(List<Vector2>? poly, float x, float y, string shapeToken, int n, float inset = 0f)
    {
        var c = n / 2f;
        if (poly == null)
        {
            // circle: 半径判定(quad 不进这里)
            var r = n / 2f - 1f - inset;
            var dx = x - c; var dy = y - c;
            return dx * dx + dy * dy <= r * r;
        }
        // 多边形: 先对质心做 inset 缩放, 再射线法
        var pts = poly;
        if (inset > 0f)
        {
            var shrink = 1f - inset / (n / 2f);
            pts = new List<Vector2>(poly.Count);
            foreach (var p in poly)
            {
                pts.Add(new Vector2(c + (p.x - c) * shrink, c + (p.y - c) * shrink));
            }
        }
        var insideFlag = false;
        for (int i = 0, j = pts.Count - 1; i < pts.Count; j = i++)
        {
            if (pts[i].y > y != pts[j].y > y &&
                x < (pts[j].x - pts[i].x) * (y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x)
            {
                insideFlag = !insideFlag;
            }
        }
        return insideFlag;
    }
}
