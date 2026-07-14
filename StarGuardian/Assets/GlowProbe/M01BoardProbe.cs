// M01 盘面探针 —— 用【真实 m01-memory-gear.json + 已迁移的 M01GreyboxLayout.Build】在 Unity 世界空间
// 渲出灰盒盘面(齿轮/背板/目标槽/9 拼片/证据/滤镜), 验证"纯逻辑层 → Unity 渲染"整条链路。
// 只是探针: 程序化形状贴图 + SpriteRenderer, 无交互; 正式 PuzzleBoardView 以此为骨架逐步替换。
// 坐标: Cocos 960×640 中心原点 px → Unity 世界 units, PPU=100(pos/100)。
#nullable enable

using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using StarGuardian.M01;
using StarGuardian.M01.Rendering;
using UnityEngine;

public sealed class M01BoardProbe : MonoBehaviour
{
    private const float Ppu = (float)M01RenderContract.PixelsPerUnit;
    private const string RootName = "~M01BoardRoot";

    private static readonly Color Ink = new(0.22f, 0.24f, 0.27f);          // 手绘墨线
    private static Color Paper => ToUnityColor(M01VisualParity.Paper);
    private static readonly Color GreyPiece = new(0.78f, 0.78f, 0.76f);    // 未显色拼片灰白
    private static readonly Color SlotGhost = new(0.55f, 0.58f, 0.62f, 0.55f); // 目标槽虚影
    private static readonly Color EvidenceTint = new(0.72f, 0.68f, 0.78f); // 证据淡紫
    private static readonly Color GearTint = new(0.82f, 0.80f, 0.74f);     // 齿轮盘

    private readonly Dictionary<string, Sprite> spriteCache = new();

    /// <summary>Build 后的布局数据(逻辑层单一真源); M01DragProbe 消费。</summary>
    public M01GreyboxLayoutData? Layout { get; private set; }

    /// <summary>谜题会话(状态机); Play 下由交互层驱动 stage/validate。</summary>
    public M01GreyboxSession? Session { get; private set; }

    /// <summary>已加载的 M01 配置(玩法数值单一真源, 手电半径/灯 id 等从这读)。</summary>
    public M01MemoryGearConfig? Config { get; private set; }

    /// <summary>controllerId → 拼片 GameObject(渲染层), 与 Layout.Fragments 对齐。</summary>
    public IReadOnlyDictionary<string, GameObject> FragmentObjects => fragmentObjects;

    private readonly Dictionary<string, GameObject> fragmentObjects = new();

    /// <summary>拼片原始水彩底色账本；交互不修改，手电显色离开覆盖时永远恢复原图。</summary>
    public readonly Dictionary<string, Color> FragmentBaseColors = new();

    private Material? unlitMaterial;
    public Material? ArtMaterial => unlitMaterial;
    private GameObject? runtimeRoot;
    private GameObject? validationOverlayRoot;
    private readonly List<string> validationOverlaySpriteKeys = new();
    private int validationOverlayGeneration;

    private void OnEnable() => Build();

    private void OnDisable()
    {
        // 动态验证覆盖层的 Sprite/Texture 不是磁盘资源，必须在 key 仍可达时主动释放。
        // 根节点本身仍交给场景 teardown/下次 Build 处理，避免 OnDisable 销毁层级触发 Unity 断言。
        ReleaseValidationOverlaySprites();
        // 根节点是本组件对象的子节点，会随场景对象一起销毁。Play/脚本重载的 teardown 阶段
        // 主动查找/销毁它会触发 Unity 的 go.IsActive 断言，因此这里只断开托管引用。
        runtimeRoot = null;
        validationOverlayRoot = null;
        // 清引用: 消费方只判 Layout==null, 不清会对已销毁 GameObject 抛 MissingReference,
        // 且 DragProbe 旧账本会对下次重建的新 Session 假提交(审查 CONFIRMED)。
        Layout = null;
        Session = null;
        Config = null;
        fragmentObjects.Clear();
        FragmentBaseColors.Clear();
        GetComponent<M01DragProbe>()?.ResetLedgers();
        // spriteCache 继续由同一个组件实例复用；场景对象销毁时 Unity 回收 DontSave 资源。
    }

    private void Build()
    {
        var old = GameObject.Find(RootName);
        if (old != null)
        {
            if (Application.isPlaying) Destroy(old);
            else DestroyImmediate(old);
        }

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
        Config = config;
        var layout = M01GreyboxLayout.Build(config, new M01GreyboxLayoutOptions());
        Session = M01GreyboxSession.FromConfig(config);

        var root = new GameObject(RootName) { hideFlags = HideFlags.DontSave };
        root.transform.SetParent(transform, false);
        runtimeRoot = root;

        SetupCamera();

        // Cocos Sprite 不参与场景灯光。URP 2D 的 SpriteRenderer 默认材质可能是 Lit，必须显式覆盖。
        var unlitShader = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default");
        if (unlitMaterial == null && unlitShader != null)
            unlitMaterial = new Material(unlitShader) { hideFlags = HideFlags.DontSave };
        if (unlitMaterial == null)
            Debug.LogError("M01BoardProbe: Sprite-Unlit-Default shader 未找到，M01 色彩无法与 Cocos 对齐");

        // 纸底(整画布)
        AddQuad(root, "paper", new Vector2(0, 0), new Vector2((float)layout.Canvas.Width, (float)layout.Canvas.Height), Paper, -10);

        // 手绘地面线(M01PhysicsBoundary.renderGroundLine): 960×39 横跨, 中心 Y=-286 让墨色行落在地面 -270
        // (=-270-(39/2-6×39/66))。极宽比 → 非等比拉伸(Cocos CUSTOM sizeMode)。莱米/掉落物踩这条线。
        AddStretchedArt(root, "groundLine", "m01-ground-line", new Vector2(0, -285.95f),
            new Vector2((float)M01RenderContract.GroundDisplayWidthPx, (float)M01RenderContract.GroundDisplayHeightPx), -6);

        // 齿轮盘 + 拼接背板(齿轮用真水彩贴图, 缺失时回退程序化圆)。
        // 美术 displaySize=581(art.ts:472, 553×1.05 贴地补偿), 比引擎 size(430)大 35% —— 用美术尺寸渲染,
        // 引擎槽/证据仍按 430 逻辑坐标落在其内(美术盘面天然比逻辑盘大, Cocos 同)。
        // 齿轮: Cocos trimType "auto" → displaySize 581 套在【裁剪内容 620×587】上(非整张 750² 画布)。
        // 整张 sprite 按 localScale=display/content 缩放, 使可见内容=581², 居中于 (-120,0) → 底边贴地(和 Cocos 同)。
        if (!AddTrimmedArt(root, "gear", "m01-overlap-memory-gear",
                content: new Vector2(620, 587), display: new Vector2(581, 581), layout.Gear.Position,
                ToUnityColor(M01VisualParity.UnityLinearGearSpriteTint), -5))
        {
            AddShape(root, "gear", "circle", layout.Gear.Position, layout.Gear.Size, GearTint, -5, 0);
        }
        // 提示灯泡(持久盘面 UI, 篮/钉正上方 (300,180), 62×62; Cocos addHintButton)。
        TryAddArtSprite(root, "hintBulb", "icon-hint", new M01GreyboxPoint(300, 180), new M01GreyboxSize(62, 62), Color.white, 30, 0);
        // 拼接背板 = 底光反馈逻辑节点(tag bottom_light): 静息透明, 只在验证时由 DragProbe 闪色。不是可见灰板。
        AddQuad(root, "board", ToV2(layout.Board.Position), new Vector2((float)layout.Board.Size.Width, (float)layout.Board.Size.Height), new Color(1f, 1f, 1f, 0f), -4);

        // Cocos renderGreybox 的正式顺序不是把 TargetPieceSlots 画成 6 个槽。艺术预览开启时，
        // 先按 sourcePosition + magnetPolygon 画盘内交叠证据。当前 Cocos live 中参考图根节点存在，
        // 但 Graphics fill/stroke 均为 alpha 0 且没有可见子节点，因此开场不额外手绘参考图。
        RenderTargetOverlapEvidence(root, layout, -3);

        // 滤镜(手电三色按钮; v4 里由手电承担, 探针仅显示位置)
        if (layout.Filters != null)
        {
            foreach (var f in layout.Filters)
            {
                if (!TryAddArtSprite(root, $"filter:{f.ControllerId}", "m01-filter-" + f.ColorToken,
                        f.Position, f.Size, Color.white, -1, 0))
                {
                    AddShape(root, $"filter:{f.ControllerId}", "quad", f.Position, f.Size,
                        ColorFor(f.ColorToken, 0.65f), -1, 0);
                }
            }
        }

        // 9 拼片: 真水彩灰白片(hidden)+ 描边(light-edge)两层; tint=白 显贴图本色,
        // 只有手电观察显色走 SpriteRenderer.color 临时乘法；拾取/吸附不改色。缺贴图回退程序化形状。
        fragmentObjects.Clear();
        FragmentBaseColors.Clear();
        foreach (var frag in layout.Fragments)
        {
            var go = AddFragmentNode(root, frag);
            fragmentObjects[frag.ControllerId] = go;
            FragmentBaseColors[frag.ControllerId] = Color.white;
        }
        Layout = layout;

        Debug.Log($"M01BoardProbe: rendered fragments={layout.Fragments.Count} slots={layout.TargetPieceSlots.Count} evidence={layout.Evidence.Count} status=\"{layout.StatusText}\"");
    }

    /// <summary>
    /// Cocos drawManualTargetBlendOverlays：只在结构验证亮起时，把当前位于中央平台内的
    /// 原色拼片两两求真实几何交叠，并把橙/绿/紫反应色盖在拼片上方。
    /// </summary>
    public void RenderValidationBlendOverlays(bool revealActive)
    {
        ClearValidationBlendOverlays();
        if (!revealActive || runtimeRoot == null || Layout == null) return;

        var boardCenter = Layout.Board.Position;
        var boardRadius = Layout.Board.Size.Width / 2d - M01GreyboxLayout.StandardPieceDisplaySize.Width / 2d;
        var pieces = new List<M01StandardPieceBlendPlacement>();
        foreach (var fragment in Layout.Fragments)
        {
            if (!fragmentObjects.TryGetValue(fragment.ControllerId, out var go)) continue;
            var position = new M01StandardPieceBlendPoint(go.transform.position.x * Ppu, go.transform.position.y * Ppu);
            var dx = position.X - boardCenter.X;
            var dy = position.Y - boardCenter.Y;
            if (dx * dx + dy * dy > boardRadius * boardRadius) continue;

            pieces.Add(new M01StandardPieceBlendPlacement
            {
                Id = fragment.ControllerId,
                ShapeToken = fragment.ShapeToken,
                ColorToken = fragment.ColorToken,
                Position = position,
                Size = new M01StandardPieceBlendSize(fragment.Size.Width, fragment.Size.Height),
                Rotation = go.transform.eulerAngles.z
            });
        }

        var overlays = M01StandardPieceBlend.ResolveOverlays(pieces);
        if (overlays.Count == 0) return;
        validationOverlayRoot = new GameObject("M01ValidationBlendOverlays");
        validationOverlayRoot.transform.SetParent(runtimeRoot.transform, false);
        var generation = ++validationOverlayGeneration;
        foreach (var overlay in overlays)
        {
            var name = $"validation:{generation}:{overlay.Id}";
            var points = overlay.Points.Select(point => new Vector2((float)point.X, (float)point.Y)).ToList();
            validationOverlaySpriteKeys.Add(name + ":fill");
            validationOverlaySpriteKeys.Add(name + ":stroke");
            AddPolygon(
                validationOverlayRoot,
                name,
                new M01GreyboxPoint(0, 0),
                points,
                TargetOverlapColor(overlay.ColorToken),
                Color.clear,
                20,
                0f);
        }
    }

    private void ClearValidationBlendOverlays()
    {
        if (validationOverlayRoot != null)
        {
            if (Application.isPlaying) Destroy(validationOverlayRoot);
            else DestroyImmediate(validationOverlayRoot);
            validationOverlayRoot = null;
        }
        ReleaseValidationOverlaySprites();
    }

    private void ReleaseValidationOverlaySprites()
    {
        foreach (var key in validationOverlaySpriteKeys)
        {
            if (!spriteCache.Remove(key, out var sprite) || sprite == null) continue;
            var texture = sprite.texture;
            if (Application.isPlaying)
            {
                Destroy(sprite);
                if (texture != null) Destroy(texture);
            }
            else
            {
                DestroyImmediate(sprite);
                if (texture != null) DestroyImmediate(texture);
            }
        }
        validationOverlaySpriteKeys.Clear();
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

    /// <summary>拼片节点: 水彩底片(可染色)+ 描边层(恒白, 不吃 tint)。返回底片 GameObject(交互层驱动它)。</summary>
    private GameObject AddFragmentNode(GameObject parent, M01GreyboxTokenNode frag)
    {
        var artDisplaySize = M01GreyboxLayout.ResolveFragmentArtDisplaySize(frag.ShapeToken);
        var body = TryLoadArt($"m01-fragment-hidden-{frag.ShapeToken}");
        if (body == null)
        {
            return AddShape(parent, $"frag:{frag.ControllerId}", frag.ShapeToken, frag.Position, artDisplaySize, GreyPiece, 0, 0);
        }
        var go = MakeArtSprite(parent, $"frag:{frag.ControllerId}", body, frag.Position, artDisplaySize, Color.white, 0);
        var edge = TryLoadArt($"m01-fragment-light-edge-{frag.ShapeToken}");
        if (edge != null)
        {
            // 描边挂子节点: 随父移动/旋转, 但不吃父 SpriteRenderer 的染色(保手绘墨线恒色)。
            var edgeGo = new GameObject("edge");
            edgeGo.transform.SetParent(go.transform, false);
            var esr = edgeGo.AddComponent<SpriteRenderer>();
            esr.sprite = edge;
            esr.sharedMaterial = unlitMaterial;
            esr.sortingOrder = 1;
            var body0 = go.GetComponent<SpriteRenderer>();
            // 与父同世界尺寸: 父已按 Size 缩放, edge 贴图若同分辨率则 localScale=贴图尺寸比。
            var scale = body0.sprite.bounds.size.x / esr.sprite.bounds.size.x;
            edgeGo.transform.localScale = new Vector3(scale, scale, 1f);
        }
        return go;
    }

    private bool TryAddArtSprite(GameObject parent, string name, string resource, M01GreyboxPoint pos, M01GreyboxSize size, Color tint, int order, float rotationDeg)
    {
        var sprite = TryLoadArt(resource);
        if (sprite == null) return false;
        MakeArtSprite(parent, name, sprite, pos, size, tint, order, rotationDeg);
        return true;
    }

    /// <summary>按 Cocos 齿轮渲染复刻(commit 334deff "齿轮变圆"): 裁剪内容(content px)以 CONTAIN 装进
    /// displaySize 框 —— 等比缩放(min 比例)保持真实宽高比, 不拉成方形(方形会把略宽的齿轮压成细长)。
    /// content=Cocos .meta 裁剪 rect(gear 620×587, 非整画布 750²); 居中于 pos, 底边贴地。</summary>
    private bool AddTrimmedArt(GameObject parent, string name, string resource, Vector2 content, Vector2 display, M01GreyboxPoint pos, Color tint, int order)
    {
        var sprite = TryLoadArt(resource);
        if (sprite == null) return false;
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = new Vector3((float)pos.X / Ppu, (float)pos.Y / Ppu, 0);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        sr.sharedMaterial = unlitMaterial;
        sr.color = tint;
        sr.sortingOrder = order;
        // CONTAIN: 等比装框(aspectContentSize 同款), 保持圆; 裁剪内容 620×587 → 581×550(×0.937)。
        var scale = Mathf.Min(display.x / content.x, display.y / content.y);
        go.transform.localScale = new Vector3(scale, scale, 1f);
        return true;
    }

    private GameObject MakeArtSprite(GameObject parent, string name, Sprite sprite, M01GreyboxPoint pos, M01GreyboxSize size, Color tint, int order, float rotationDeg = 0)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = new Vector3((float)pos.X / Ppu, (float)pos.Y / Ppu, 0);
        go.transform.localRotation = Quaternion.Euler(0, 0, rotationDeg);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        sr.sharedMaterial = unlitMaterial;
        sr.color = tint;
        sr.sortingOrder = order;
        // Cocos Sprite.SizeMode.CUSTOM: displaySize 的宽高逐轴生效，不擅自按最大边等比缩放。
        go.transform.localScale = new Vector3(
            ((float)size.Width / Ppu) / sprite.bounds.size.x,
            ((float)size.Height / Ppu) / sprite.bounds.size.y,
            1f);
        return go;
    }

    private static Sprite? TryLoadArt(string name) => Resources.Load<Sprite>("Art/M01/" + name);

    /// <summary>非等比拉伸精灵到精确 W×H(Cocos Sprite.SizeMode.CUSTOM); 用于极端宽高比的地面线等。</summary>
    private void AddStretchedArt(GameObject parent, string name, string resource, Vector2 cocosPos, Vector2 sizePx, int order)
    {
        var sprite = TryLoadArt(resource);
        if (sprite == null) return;
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = new Vector3(cocosPos.x / Ppu, cocosPos.y / Ppu, 0);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        sr.sharedMaterial = unlitMaterial;
        sr.sortingOrder = order;
        go.transform.localScale = new Vector3(
            (sizePx.x / Ppu) / sprite.bounds.size.x,
            (sizePx.y / Ppu) / sprite.bounds.size.y, 1f); // 非等比
    }

    private void AddQuad(GameObject parent, string name, Vector2 cocosPos, Vector2 sizePx, Color color, int order)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = new Vector3(cocosPos.x / Ppu, cocosPos.y / Ppu, 0);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = GetSprite("quad", "quad");
        sr.sharedMaterial = unlitMaterial;
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
        // Cocos 3.x euler Z 与 Unity 同为逆时针 → 直接用正值(原先取负把绝对朝向镜像了, 审查 CONFIRMED)。
        go.transform.localRotation = Quaternion.Euler(0, 0, rotationDeg);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = GetSprite(shapeToken, outlineOnly ? "outline" : "fill");
        sr.sharedMaterial = unlitMaterial;
        var c = color; c.a *= alpha;
        sr.color = c;
        sr.sortingOrder = order;
        go.transform.localScale = new Vector3((float)size.Width / Ppu, (float)size.Height / Ppu, 1f);
        return go;
    }

    private void RenderTargetOverlapEvidence(GameObject parent, M01GreyboxLayoutData layout, int order)
    {
        foreach (var evidence in layout.Evidence)
        {
            if (evidence.MagnetPolygon == null || evidence.MagnetPolygon.Count < 3) continue;
            var position = evidence.SourcePosition ?? evidence.Position;
            var points = evidence.MagnetPolygon.Select(p => new Vector2((float)p.X, (float)p.Y)).ToList();
            AddPolygon(parent, $"M01TargetOverlapEvidence_{evidence.ControllerId}", position, points,
                TargetOverlapColor(evidence.ColorToken), new Color32(44, 43, 38, 205), order, 1.6f);
        }
    }

    private void AddPolygon(GameObject parent, string name, M01GreyboxPoint position, IReadOnlyList<Vector2> points,
        Color fill, Color stroke, int order, float lineWidthPx)
    {
        var fillSprite = GetPolygonSprite(name + ":fill", points, 0f);
        var fillGo = new GameObject(name);
        fillGo.transform.SetParent(parent.transform, false);
        fillGo.transform.localPosition = new Vector3((float)position.X / Ppu, (float)position.Y / Ppu, 0);
        var fillRenderer = fillGo.AddComponent<SpriteRenderer>();
        fillRenderer.sprite = fillSprite;
        fillRenderer.sharedMaterial = unlitMaterial;
        fillRenderer.color = fill;
        fillRenderer.sortingOrder = order;

        var strokeGo = new GameObject("stroke");
        strokeGo.transform.SetParent(fillGo.transform, false);
        var strokeRenderer = strokeGo.AddComponent<SpriteRenderer>();
        strokeRenderer.sprite = GetPolygonSprite(name + ":stroke", points, lineWidthPx);
        strokeRenderer.sharedMaterial = unlitMaterial;
        strokeRenderer.color = stroke;
        strokeRenderer.sortingOrder = order + 1;
    }

    private Sprite GetPolygonSprite(string key, IReadOnlyList<Vector2> points, float outlineWidth)
    {
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;
        var minX = Mathf.Floor(points.Min(p => p.x) - 3f);
        var maxX = Mathf.Ceil(points.Max(p => p.x) + 3f);
        var minY = Mathf.Floor(points.Min(p => p.y) - 3f);
        var maxY = Mathf.Ceil(points.Max(p => p.y) + 3f);
        var width = Mathf.Max(1, Mathf.CeilToInt(maxX - minX));
        var height = Mathf.Max(1, Mathf.CeilToInt(maxY - minY));
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false) { hideFlags = HideFlags.DontSave };
        var pixels = new Color32[width * height];
        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
        {
            var p = new Vector2(minX + x + 0.5f, minY + y + 0.5f);
            var inside = InPolygon(points, p.x, p.y);
            var solid = outlineWidth <= 0 ? inside : inside && DistanceToEdges(points, p) <= outlineWidth;
            pixels[y * width + x] = solid ? new Color32(255, 255, 255, 255) : new Color32(255, 255, 255, 0);
        }
        tex.SetPixels32(pixels);
        tex.Apply();
        var pivot = new Vector2(Mathf.Clamp01(-minX / width), Mathf.Clamp01(-minY / height));
        var sprite = Sprite.Create(tex, new Rect(0, 0, width, height), pivot, Ppu);
        sprite.hideFlags = HideFlags.DontSave;
        spriteCache[key] = sprite;
        return sprite;
    }

    private static float DistanceToEdges(IReadOnlyList<Vector2> points, Vector2 p)
    {
        var best = float.PositiveInfinity;
        for (var i = 0; i < points.Count; i++)
        {
            var a = points[i];
            var b = points[(i + 1) % points.Count];
            var ab = b - a;
            var t = ab.sqrMagnitude <= 0.00001f ? 0f : Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude);
            best = Mathf.Min(best, Vector2.Distance(p, a + ab * t));
        }
        return best;
    }

    private static Color TargetOverlapColor(string token)
    {
        var raw = token switch
        {
            "orange" => new Vector3(206, 154, 114),
            "green" => new Vector3(136, 166, 138),
            "purple" => new Vector3(167, 140, 166),
            _ => new Vector3(150, 132, 118)
        };
        var lum = 0.299f * raw.x + 0.587f * raw.y + 0.114f * raw.z;
        raw = new Vector3(
            Mathf.Clamp(Mathf.Round(lum + (raw.x - lum) * 1.4f), 0, 255),
            Mathf.Clamp(Mathf.Round(lum + (raw.y - lum) * 1.4f), 0, 255),
            Mathf.Clamp(Mathf.Round(lum + (raw.z - lum) * 1.4f), 0, 255));
        return new Color(raw.x / 255f, raw.y / 255f, raw.z / 255f, 232f / 255f);
    }

    private static Vector2 ToV2(M01GreyboxPoint p) => new((float)p.X, (float)p.Y);

    private static Color ToUnityColor(M01Color32 color) => new Color32(color.R, color.G, color.B, color.A);

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
                    edge = shapeToken == "quad"
                        ? x < 6 || y < 6 || x >= n - 6 || y >= n - 6
                        : !InPolygon(poly, x + 0.5f, y + 0.5f, shapeToken, n, inset: 6f);
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
                var triangleHeight = r * Mathf.Sqrt(3f);
                return new List<Vector2>
                {
                    new(c, c + triangleHeight / 2f),
                    new(c - r, c - triangleHeight / 2f),
                    new(c + r, c - triangleHeight / 2f)
                };
            }
            case "hexagon":
            {
                var hh = Mathf.Sqrt(3f) * r / 2f;
                return new List<Vector2>
                {
                    new(c - r, c), new(c - r / 2f, c + hh), new(c + r / 2f, c + hh),
                    new(c + r, c), new(c + r / 2f, c - hh), new(c - r / 2f, c - hh)
                };
            }
            default:
                return null; // circle / quad 走解析式
        }
    }

    private static bool InPolygon(IReadOnlyList<Vector2>? poly, float x, float y, string shapeToken = "polygon", int n = 128, float inset = 0f)
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
        IReadOnlyList<Vector2> pts = poly;
        if (inset > 0f)
        {
            var shrink = 1f - inset / (n / 2f);
            var insetPoints = new List<Vector2>(poly.Count);
            foreach (var p in poly)
            {
                insetPoints.Add(new Vector2(c + (p.x - c) * shrink, c + (p.y - c) * shrink));
            }
            pts = insetPoints;
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
