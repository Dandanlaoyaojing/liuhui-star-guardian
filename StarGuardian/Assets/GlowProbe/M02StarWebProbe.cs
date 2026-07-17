// M02 星网盘面探针 —— 用【真实 m02-starweb-warmth.json + 已迁移的 StarWebSession/StarNetworkModel +
// M02RenderContract】在 Unity 世界空间渲出主谜题(水彩底/弧边/手绘星/电量计/竭遮罩/完成面板),
// 并把鼠标点击转给 session(渲染层不算任何规则, 与 Cocos M02StarWebView.ts 同责边界)。
// 光效走 M2GlowProbe 验证过的管线: Light2D 点光 + 全局光 + GlowAdditive 加法光晕 + Bloom Volume
// (Cocos 源里光晕是平面 Graphics 圆环, 半径/色值/命数收缩语义照契约, 呈现技法按迁移决策升级)。
// 渲染树结构/次序照 Cocos addChild 顺序(SWV:91-100), 以 sortingOrder 分带镜像。
// 坐标: Cocos 960×640 中心原点 px → Unity 世界 units, PPU=100。
#nullable enable

using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using StarGuardian.Interaction;
using StarGuardian.M01.Rendering;
using StarGuardian.M02;
using StarGuardian.M02.Rendering;
using StarGuardian.UI;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

[ExecuteAlways]
public sealed class M02StarWebProbe : MonoBehaviour
{
    private const float Ppu = (float)M02RenderContract.PixelsPerUnit;
    private const string RootName = "~M02BoardRoot";
    private const string VolumeName = "~M02GlowVolume";

    // sortingOrder 分带 = Cocos 子树顺序(SWV:91-100 背景→边→星层→电量→竭遮罩; 完成面板/序章后挂在最上)
    private const int OrderBackground = 0;
    private const int OrderEdges = 10;
    private const int OrderStarBase = 100;   // 星层内: 每颗星 glow=+2i, star=+2i+1(SWV:258-266 交替创建)
    private const int OrderCharge = 300;
    private const int OrderFailure = 400;
    private const int OrderCompletion = 500;
    public const int OrderPrologue = 600;    // 序章节点 addChild 在最后(SWV:198)

    /// <summary>谜题会话(状态机); 渲染层只读 View、转发 tap。</summary>
    public StarWebSession? Session { get; private set; }

    public StarWebConfig? Config { get; private set; }

    private sealed class StarVisual
    {
        public string Id = "";
        public GameObject GlowNode = null!;      // 修复流缩放这个(SWV:320 glow node setScale)
        public SpriteRenderer GlowSprite = null!; // 加法光晕(半径随命数)
        public Light2D? Light;
        public SpriteRenderer StarSprite = null!;
        // 星光呼吸(契约 Twinkle*): 相位/周期按 id 定值; Base* 是 RenderStarGlow 写下的基准,
        // TickTwinkle 每帧在基准上乘闪烁系数(不叠乘、不漂移)。
        public float TwinklePhase;
        public float TwinklePeriod = 1f;
        public float BaseGlowAlpha;
        public float BaseLightIntensity;
        public bool Lit;
    }

    private readonly List<StarVisual> starVisuals = new();
    private readonly Dictionary<string, Sprite> spriteCache = new(); // 星形按 id:status 缓存(几何确定性)
    private readonly List<UnityEngine.Object> ownedResources = new(); // DontSave 纹理/精灵/材质, OnDisable 显式回收

    private GameObject? runtimeRoot;
    private GameObject? starLayer;
    private GameObject? chargeLayer;
    private GameObject? failureLayer;
    private GameObject? completionRoot;
    private GameObject? prologueGo;
    private GameObject? volumeGo;
    private Material? unlitMaterial;
    private Material? litMaterial;
    private Material? additiveMaterial;
    private Sprite? radialGlowSprite;
    private Sprite? discSprite;
    private Font? cardFont;
    private bool completionTextHealed;

    private IProgressStore? progressStore; // SWV:79 组件实例级 createProgressStore()
    private int lifeMax = 1;               // SWV:80
    private bool pressCaptured;            // SWV:81 activeTouchId 单触点门(鼠标单指针等价)
    private bool repairSequencePlaying;    // SWV:82
    private bool completionShown;          // SWV:83

    // Cocos tween → Update 驱动的两条动画(SWV:306-333 修复流 / SWV:451-471 脉冲)
    private bool repairFlowRunning;
    private float repairElapsed;
    private Action? repairOnComplete;
    private bool pulseRunning;
    private float pulseElapsed;

    private void OnEnable() => Build();

    private void OnDisable()
    {
        StopAnims();
        repairSequencePlaying = false;
        pressCaptured = false;
        // 根直接引用销毁(M2GlowProbe 模式; 不 Find, teardown 期已毁则 Unity 假 null 跳过)
        if (runtimeRoot != null)
        {
            if (Application.isPlaying) Destroy(runtimeRoot); else DestroyImmediate(runtimeRoot);
        }
        runtimeRoot = null;
        starLayer = null;
        chargeLayer = null;
        failureLayer = null;
        completionRoot = null;
        prologueGo = null;
        starVisuals.Clear();
        spriteCache.Clear();
        // 全局 Bloom Volume 一并回收(M2GlowProbe 审查教训: 残留 Bloom 污染同会话其它光效对照)。
        // ⚠️ 只销毁自己持有的引用, 不 Find 兜底: Find 会在多实例场景抓走别家活体 volume 反杀
        // (审查逮到: A.OnDisable 假 null → Find 命中 B 的 volume → B 剩空后处理链洗白)。
        if (volumeGo != null)
        {
            var profile = volumeGo.GetComponent<Volume>()?.profile;
            if (Application.isPlaying) { Destroy(volumeGo); if (profile != null) Destroy(profile); }
            else { DestroyImmediate(volumeGo); if (profile != null) DestroyImmediate(profile); }
        }
        volumeGo = null;
        // M01 教训: DontSave 资源必须显式销毁, 否则跨会话泄漏
        foreach (var resource in ownedResources)
        {
            if (resource == null) continue;
            if (Application.isPlaying) Destroy(resource); else DestroyImmediate(resource);
        }
        ownedResources.Clear();
        unlitMaterial = null;
        litMaterial = null;
        additiveMaterial = null;
        radialGlowSprite = null;
        discSprite = null;
        cardFont = null;
        Session = null;
        Config = null;
        progressStore = null;
    }

    // ── 搭建(镜像 SWV onLoad:86-106 + loadConfig:158-179) ──

    private void Build()
    {
        // 只销毁自己持有的引用, 不 Find 兜底 —— 与 OnDisable 同一教训: Find 按名字会在多实例场景
        // 抓走【别家活体】盘面根(B.Build 销毁 A 的 root → A.starVisuals 全成已毁对象 → TickRepairFlow
        // 抛 MissingReference)。跨 Play 残留已由 DontSave + OnDisable 覆盖, 此处 Find 冗余(终审逮到)。
        if (runtimeRoot != null)
        {
            if (Application.isPlaying) Destroy(runtimeRoot); else DestroyImmediate(runtimeRoot);
            runtimeRoot = null;
        }

        SetupCameraAndBloom();
        EnsureMaterials();
        radialGlowSprite ??= MakeRadialSprite(128);
        discSprite ??= MakeDiscSprite(64);
        progressStore ??= ProgressStore.CreateProgressStore(); // SWV:79(内存后端, 与 TS 缺省一致)

        var root = new GameObject(RootName) { hideFlags = HideFlags.DontSave };
        root.transform.SetParent(transform, false);
        runtimeRoot = root;

        // 全局光: 让 Lit 背景正常显示, 星点 Light2D 在其上叠暖光池(M2 管线的"全局光"件)
        var globalLightGo = new GameObject("~M02GlobalLight");
        globalLightGo.transform.SetParent(root.transform, false);
        var globalLight = globalLightGo.AddComponent<Light2D>();
        globalLight.lightType = Light2D.LightType.Global;
        globalLight.color = Color.white;
        globalLight.intensity = 1f;

        CreateBackground(root);                                    // SWV:91 (siblingIndex 0 → 最底带)
        // SWV:92-100 层序: 边 → 星层 → 电量 → 竭遮罩
        starLayer = MakeLayer(root, "M02Stars");                   // SWV:94
        chargeLayer = MakeLayer(root, "M02ChargeMeter");           // SWV:96
        chargeLayer.transform.localPosition = ToWorld(M02RenderContract.ChargeMeterPositionPx); // SWV:98
        failureLayer = MakeLayer(root, "M02FailureOverlay");       // SWV:99

        LoadConfigAndStart();
    }

    private void LoadConfigAndStart()
    {
        // SWV:158-179 loadConfig(Unity Resources 同步加载, 校验语义一致)
        var text = Resources.Load<TextAsset>("Configs/m02-starweb-warmth");
        if (text == null)
        {
            Debug.LogError("[M02] 配置加载失败: Resources/Configs/m02-starweb-warmth.json 未找到");
            return;
        }
        var result = StarWebConfigValidator.Validate(JToken.Parse(text.text));
        if (!result.Ok || result.Value == null)
        {
            Debug.LogError("[M02] 配置非法: " + string.Join("; ", result.Errors));
            return;
        }
        Config = result.Value;
        lifeMax = Config.Mechanic.LifeMax; // SWV:171
        // 序章每次进关都播放, 不设已通关跳过门(SWV:172)
        if (Config.Prologue != null)
        {
            StartPrologue(Config.Prologue, Config.Mechanic);
        }
        else
        {
            StartBoards();
        }
    }

    private void StartPrologue(StarWebPrologue prologue, StarNetworkRules rules)
    {
        // SWV:196-204: 序章节点挂根下, 完成后销毁并开板
        prologueGo = new GameObject("M02Prologue");
        prologueGo.transform.SetParent(runtimeRoot!.transform, false);
        prologueGo.SetActive(false); // 先 Init 再激活, 避免 OnEnable 自举抢跑
        var view = prologueGo.AddComponent<M02PrologueProbe>();
        view.Init(prologue, rules, () =>
        {
            if (this == null || runtimeRoot == null) return; // 组件销毁后回调不碰节点(SWV:200 disposed 守卫)
            if (prologueGo != null)
            {
                if (Application.isPlaying) Destroy(prologueGo); else DestroyImmediate(prologueGo);
                prologueGo = null;
            }
            StartBoards();
        });
        prologueGo.SetActive(true);
    }

    private void StartBoards()
    {
        if (Config == null) return;
        Session = new StarWebSession(Config); // SWV:208
        BuildBoard();
    }

    private void CreateBackground(GameObject root)
    {
        // SWV:182-194: 水彩底图 1280×720, CUSTOM sizeMode 非等比拉伸; Lit 材质吃 Light2D 暖光池
        var sprite = Resources.Load<Sprite>(M02RenderContract.BackgroundUnityResourcePath);
        if (sprite == null)
        {
            Debug.LogWarning("[M02] 背景图未找到: Resources/" + M02RenderContract.BackgroundUnityResourcePath);
            return;
        }
        var go = new GameObject("M02WatercolorBackground");
        go.transform.SetParent(root.transform, false);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        if (litMaterial != null) sr.sharedMaterial = litMaterial;
        sr.sortingOrder = OrderBackground;
        go.transform.localScale = new Vector3(
            (float)M02RenderContract.BackgroundWidthPx / Ppu / sprite.bounds.size.x,
            (float)M02RenderContract.BackgroundHeightPx / Ppu / sprite.bounds.size.y, 1f);
    }

    // ── 盘面重建(SWV buildBoard:232-268) ──

    private void BuildBoard()
    {
        if (Session == null || starLayer == null || runtimeRoot == null) return;
        var view = Session.View;

        if (completionRoot != null)
        {
            if (Application.isPlaying) Destroy(completionRoot); else DestroyImmediate(completionRoot);
            completionRoot = null;
        }
        completionShown = false;
        for (var i = starLayer.transform.childCount - 1; i >= 0; i--)
        {
            var child = starLayer.transform.GetChild(i).gameObject;
            if (Application.isPlaying) Destroy(child); else DestroyImmediate(child);
        }
        starVisuals.Clear();

        RebuildEdges(view);

        // SWV:258-266 每颗星: 光晕节点 + 星形节点(交替创建 → 交替次序)
        var index = 0;
        foreach (var node in view.Nodes)
        {
            var glowNode = new GameObject($"M02StarGlow_{node.Id}");
            glowNode.transform.SetParent(starLayer.transform, false);
            glowNode.transform.localPosition = ToWorld(node.X, node.Y);
            var glowSpriteGo = new GameObject("glow");
            glowSpriteGo.transform.SetParent(glowNode.transform, false);
            var glowSprite = glowSpriteGo.AddComponent<SpriteRenderer>();
            glowSprite.sprite = radialGlowSprite;
            if (additiveMaterial != null) glowSprite.sharedMaterial = additiveMaterial;
            glowSprite.sortingOrder = OrderStarBase + index * 2;
            var lightGo = new GameObject("L2D");
            lightGo.transform.SetParent(glowNode.transform, false);
            var light = lightGo.AddComponent<Light2D>();
            light.lightType = Light2D.LightType.Point;
            light.intensity = 0f;

            var starGo = new GameObject($"M02Star_{node.Id}");
            starGo.transform.SetParent(starLayer.transform, false);
            starGo.transform.localPosition = ToWorld(node.X, node.Y);
            var starSprite = starGo.AddComponent<SpriteRenderer>();
            if (unlitMaterial != null) starSprite.sharedMaterial = unlitMaterial;
            starSprite.sortingOrder = OrderStarBase + index * 2 + 1;

            starVisuals.Add(new StarVisual
            {
                Id = node.Id,
                GlowNode = glowNode,
                GlowSprite = glowSprite,
                Light = light,
                StarSprite = starSprite,
                TwinklePhase = (float)M02RenderContract.TwinklePhase(node.Id),
                TwinklePeriod = (float)M02RenderContract.TwinklePeriodSeconds(node.Id)
            });
            index += 1;
        }
        RenderStars();
    }

    private void RebuildEdges(StarWebView view)
    {
        var oldEdges = runtimeRoot!.transform.Find("M02Edges");
        if (oldEdges != null)
        {
            if (Application.isPlaying) Destroy(oldEdges.gameObject); else DestroyImmediate(oldEdges.gameObject);
        }
        var posById = new Dictionary<string, Point2>();
        foreach (var node in view.Nodes) posById[node.Id] = new Point2(node.X, node.Y);

        // 每条边: moveTo(a) + quadraticCurveTo(control, b)(SWV:270-274), 折线化后整批烘进一张纹理
        var arcs = new List<List<Point2>>();
        foreach (var edge in view.Edges)
        {
            if (edge.Count < 2 || !posById.TryGetValue(edge[0], out var a) || !posById.TryGetValue(edge[1], out var b)) continue;
            var control = M02RenderContract.EdgeArcControlPoint(a, b);
            const int segments = 32;
            var points = new List<Point2>(segments + 1);
            for (var s = 0; s <= segments; s++)
            {
                points.Add(M02RenderContract.QuadraticBezierPoint(a, control, b, s / (double)segments));
            }
            arcs.Add(points);
        }
        if (arcs.Count == 0) return;

        var sprite = BakeStrokeUnionSprite("edges:" + view.BoardId, arcs, M02RenderContract.EdgeWidthPx / 2);
        var go = new GameObject("M02Edges"); // SWV:92
        go.transform.SetParent(runtimeRoot.transform, false);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        if (unlitMaterial != null) sr.sharedMaterial = unlitMaterial;
        sr.color = ToColor(M02RenderContract.EdgeColor);
        sr.sortingOrder = OrderEdges;
    }

    // ── 逐帧: 动画推进 + 输入(SWV onTouchStart/End:117-152) ──

    private void Update()
    {
        if (!Application.isPlaying) return;
        TickRepairFlow();
        TickPulse();
        TickTwinkle();
        HealCompletionText();

        var pointer = Pointer.current; // iOS 触屏无 Mouse; M01DragProbe 同款 Pointer 路径
        if (pointer == null) return;
        // 同帧 press+release 的处理序必须按【帧初是否已有在途按压】分流(审查逮到 + 自查纠正):
        //  · 已在途(pressCaptured): 本帧事件必以旧按压的 release 打头 → 先结算再捕获新 press,
        //    否则新 press 被 pressCaptured 吞、其 release 又被 !pressCaptured 丢 = 整次点击蒸发。
        //  · 不在途: 本帧必以新 press 打头(完整快速轻点) → 先捕获再结算, 反序会丢掉这次点击
        //    并把 pressCaptured 永久卡在 true。
        var pressed = pointer.press.wasPressedThisFrame;
        var released = pointer.press.wasReleasedThisFrame;
        var pos = ScreenToCocos(pointer.position.ReadValue());
        // SWV:90 触摸区矩形命中: 框外点击 Cocos 根本不派发 → Unity 轮询必须显式裁剪。
        // 已在途的按压其 release 仍要结算(等价 Cocos 的配对 TOUCH_END; 不裁会漏配对)。
        var inside = M02RenderContract.IsInsideTouchArea(pos.x, pos.y);
        if (pressCaptured)
        {
            if (released) OnRelease(pos);
            if (pressed && inside) OnPress();
        }
        else
        {
            if (pressed && inside) OnPress();
            if (released) OnRelease(pos);
        }
    }

    private void OnPress()
    {
        // SWV:117-122: 序章/未载入不锁触点; 修复流中不接
        if (Session == null) return;
        if (repairSequencePlaying) return;
        if (pressCaptured) return;
        pressCaptured = true;
    }

    private void OnRelease(Vector2 cocosPos)
    {
        if (!pressCaptured) return; // SWV:125 配对触点
        pressCaptured = false;
        if (Session == null) return;
        if (repairSequencePlaying) return;
        if (completionShown)
        {
            PulseCompletionPanel(); // SWV:129-132
            return;
        }
        var view = Session.View; // SWV:133 一次快照供命中与状态分流
        var status = view.Status;

        if (status == BoardStatus.Won)
        {
            BeginBoardWinFlow(); // SWV:136-139
            return;
        }
        if (status == BoardStatus.Exhausted)
        {
            Session.ResetBoard(); // SWV:140-144
            RenderStars();
            return;
        }

        var hit = NearestNodeId(cocosPos, view); // SWV:146-151
        if (hit == null) return;
        Session.TapNode(hit);
        RenderStars();
        if (Session.View.Status == BoardStatus.Won) BeginBoardWinFlow();
    }

    private static string? NearestNodeId(Vector2 localPos, StarWebView view)
    {
        // SWV:212-229 (<= 让后序节点赢并列, 语义一致)
        string? bestId = null;
        var bestDist = M02RenderContract.TapRadiusPx * M02RenderContract.TapRadiusPx;
        foreach (var node in view.Nodes)
        {
            var dx = node.X - localPos.x;
            var dy = node.Y - localPos.y;
            var dist = dx * dx + dy * dy;
            if (dist <= bestDist)
            {
                bestDist = dist;
                bestId = node.Id;
            }
        }
        return bestId;
    }

    // ── 胜利修复流(SWV:292-333) ──

    private void BeginBoardWinFlow()
    {
        if (Session == null || repairSequencePlaying || completionShown) return;
        repairSequencePlaying = true;
        PlayRepairFlow(() =>
        {
            if (Session == null) return;
            repairSequencePlaying = false;
            if (Session.IsLevelComplete())
            {
                RenderCompletionReward();
                return;
            }
            if (Session.NextBoard()) BuildBoard();
        });
    }

    private void PlayRepairFlow(Action onComplete)
    {
        StopAnims(); // SWV:307 stopRepairTweens
        repairFlowRunning = true;
        repairElapsed = 0f;
        repairOnComplete = onComplete;
    }

    private void TickRepairFlow()
    {
        if (!repairFlowRunning) return;
        repairElapsed += Time.deltaTime;
        var t = Mathf.Clamp01(repairElapsed / (float)M02RenderContract.RepairFlowSeconds);
        var progress = M02RenderContract.QuadInOut(t); // SWV:314 quadInOut
        var activeIndex = M02RenderContract.RepairFlowActiveIndex(progress, starVisuals.Count); // SWV:317
        for (var i = 0; i < starVisuals.Count; i++)
        {
            var scale = i <= activeIndex ? (float)M02RenderContract.RepairGlowScale : 1f; // SWV:319
            starVisuals[i].GlowNode.transform.localScale = new Vector3(scale, scale, 1f);
        }
        if (repairElapsed < (float)M02RenderContract.RepairFlowSeconds) return;
        foreach (var visual in starVisuals)
        {
            visual.GlowNode.transform.localScale = Vector3.one; // SWV:326-328 全体复位
        }
        repairFlowRunning = false;
        var callback = repairOnComplete;
        repairOnComplete = null;
        callback?.Invoke();
    }

    private void PulseCompletionPanel()
    {
        if (completionRoot == null) return; // SWV:452
        StopAnims();                        // SWV:453
        completionRoot.transform.localScale = Vector3.one;
        pulseRunning = true;
        pulseElapsed = 0f;
    }

    private void TickPulse()
    {
        if (!pulseRunning || completionRoot == null) return;
        pulseElapsed += Time.deltaTime;
        var up = (float)M02RenderContract.PulseUpSeconds;
        var down = (float)M02RenderContract.PulseDownSeconds;
        var peak = (float)M02RenderContract.PulseUpScale;
        float scale;
        if (pulseElapsed < up)
        {
            scale = Mathf.Lerp(1f, peak, pulseElapsed / up); // SWV:457 (tween 默认线性)
        }
        else if (pulseElapsed < up + down)
        {
            scale = Mathf.Lerp(peak, 1f, (pulseElapsed - up) / down); // SWV:463
        }
        else
        {
            scale = 1f;
            pulseRunning = false;
        }
        completionRoot.transform.localScale = new Vector3(scale, scale, 1f);
    }

    private void StopAnims()
    {
        // SWV:335-340 stopRepairTweens(修复流与脉冲同池)
        repairFlowRunning = false;
        repairOnComplete = null;
        pulseRunning = false;
    }

    private void TickTwinkle()
    {
        // 星光呼吸/闪烁(契约 Twinkle*, 2026-07-17 新增): 只动点亮星。
        // 在 RenderStarGlow 写下的 Base* 基准上乘系数 —— 不读回自身值, 无累积漂移;
        // 修复流只碰 GlowNode 缩放, 这里只碰 StarSprite 缩放/alpha 与 glow alpha/光强, 互不打架。
        var t = Time.time;
        foreach (var visual in starVisuals)
        {
            if (!visual.Lit || visual.StarSprite == null) continue;
            var level = (float)M02RenderContract.TwinkleLevel(t, visual.TwinklePhase, visual.TwinklePeriod);
            var starScale = (float)M02RenderContract.TwinkleScaleFactor(level);
            visual.StarSprite.transform.localScale = new Vector3(starScale, starScale, 1f);
            var starColor = visual.StarSprite.color;
            starColor.a = (float)M02RenderContract.TwinkleStarAlphaFactor(level);
            visual.StarSprite.color = starColor;
            var glowFactor = (float)M02RenderContract.TwinkleGlowFactor(level);
            var glowColor = visual.GlowSprite.color;
            glowColor.a = visual.BaseGlowAlpha * glowFactor;
            visual.GlowSprite.color = glowColor;
            if (visual.Light != null) visual.Light.intensity = visual.BaseLightIntensity * glowFactor;
        }
    }

    // ── 着色渲染(SWV renderStars:488-503) ──

    private void RenderStars()
    {
        if (Session == null) return;
        var view = Session.View;
        var byId = new Dictionary<string, StarNodeView>();
        foreach (var node in view.Nodes) byId[node.Id] = node;

        foreach (var visual in starVisuals)
        {
            if (!byId.TryGetValue(visual.Id, out var node)) continue;
            RenderStarGlow(visual, node);
            visual.StarSprite.sprite = GetStarSprite(node.Id, node.Status);
        }
        RenderChargeMeter(view);
        RenderFailureOverlay(view);
    }

    private void RenderStarGlow(StarVisual visual, StarNodeView node)
    {
        // SWV:571-579: 只有点亮的星有光晕; 半径随命数收缩; 冻结更亮。
        // 呈现技法 = M2 管线(加法光晕 + Light2D 点光), 半径/色/alpha 语义照契约。
        if (!node.Lit)
        {
            visual.GlowSprite.enabled = false;
            if (visual.Light != null) visual.Light.intensity = 0f;
            visual.Lit = false;
            visual.StarSprite.color = Color.white;
            visual.StarSprite.transform.localScale = Vector3.one;
            return;
        }
        var glowRadius = (float)M02RenderContract.StarGlowRadiusPx(node.Status, node.Life, lifeMax);
        var color = M02RenderContract.StarGlowColor(node.Status);
        visual.GlowSprite.enabled = true;
        // 径向精灵直径 1 unit → 缩放到 2×半径; alpha 用 Cocos 圆环 alpha(78/104, 2026-07-17 调暗)
        var scale = glowRadius * 2f / Ppu;
        visual.GlowSprite.transform.localScale = new Vector3(scale, scale, 1f);
        visual.GlowSprite.color = new Color(color.R / 255f, color.G / 255f, color.B / 255f, color.A / 255f);
        visual.Lit = true;
        visual.BaseGlowAlpha = color.A / 255f;
        if (visual.Light != null)
        {
            visual.Light.color = new Color(color.R / 255f, color.G / 255f, color.B / 255f, 1f);
            // 与序章同规则按 glow alpha 折算(终审逮到两侧不一致: 主盘常数 1.3 抹平了契约用
            // alpha 编码的"命数将尽更暗"读盘线索); 分母取契约而非硬编码。
            // 2026-07-17 用户嫌星太亮: 峰值 1.3 → 0.47, 光池 4×→2.2×(07-18 Play 模式七星点亮实测:
            // 原值下多星光池叠加把中央水彩刷成整片白; 此组合下底图纹理保持可见)。
            visual.Light.intensity = 0.47f * (color.A / (float)M02RenderContract.FrozenGlowColor.A);
            visual.Light.pointLightInnerRadius = (float)M02RenderContract.NodeRadiusPx / Ppu;
            visual.Light.pointLightOuterRadius = glowRadius / Ppu * 2.2f; // 暖光池外扩(判断值, 契约无 TS 真源)
            visual.BaseLightIntensity = visual.Light.intensity;
        }
    }

    private void RenderChargeMeter(StarWebView view)
    {
        // SWV:581-595: 每 render 重建 pip 排
        if (chargeLayer == null) return;
        for (var i = chargeLayer.transform.childCount - 1; i >= 0; i--)
        {
            var child = chargeLayer.transform.GetChild(i).gameObject;
            if (Application.isPlaying) Destroy(child); else DestroyImmediate(child);
        }
        for (var i = 0; i < view.ChargesTotal; i++)
        {
            var pip = new GameObject($"M02ChargePip_{i}");
            pip.transform.SetParent(chargeLayer.transform, false);
            pip.transform.localPosition = new Vector3((float)M02RenderContract.ChargePipOffsetXPx(i) / Ppu, 0f, 0f); // SWV:590
            var sr = pip.AddComponent<SpriteRenderer>();
            sr.sprite = discSprite;
            if (unlitMaterial != null) sr.sharedMaterial = unlitMaterial;
            sr.color = ToColor(M02RenderContract.ChargePipColor(i, view.ChargesLeft)); // SWV:591
            sr.sortingOrder = OrderCharge + i;
            var d = (float)(M02RenderContract.ChargePipRadiusPx * 2) / Ppu;
            pip.transform.localScale = new Vector3(d, d, 1f);
        }
    }

    private void RenderFailureOverlay(StarWebView view)
    {
        // SWV:597-615: 竭状态才画: 全屏暗罩 + 三个漏光点
        if (failureLayer == null) return;
        for (var i = failureLayer.transform.childCount - 1; i >= 0; i--)
        {
            var child = failureLayer.transform.GetChild(i).gameObject;
            if (Application.isPlaying) Destroy(child); else DestroyImmediate(child);
        }
        if (view.Status != BoardStatus.Exhausted) return;

        var overlay = new GameObject("M02FailureDark");
        overlay.transform.SetParent(failureLayer.transform, false);
        var overlaySr = overlay.AddComponent<SpriteRenderer>();
        overlaySr.sprite = WhiteSprite();
        if (unlitMaterial != null) overlaySr.sharedMaterial = unlitMaterial;
        overlaySr.color = ToColor(M02RenderContract.FailureOverlayColor);
        overlaySr.sortingOrder = OrderFailure;
        overlay.transform.localScale = new Vector3(
            (float)M02RenderContract.FailureOverlayWidthPx / Ppu,
            (float)M02RenderContract.FailureOverlayHeightPx / Ppu, 1f);

        var leakIndex = 0;
        foreach (var leak in M02RenderContract.FailureLeakCircles) // SWV:611
        {
            var go = new GameObject($"M02FailureLeak_{leakIndex}");
            go.transform.SetParent(failureLayer.transform, false);
            go.transform.localPosition = ToWorld(leak.X, leak.Y);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = discSprite;
            if (unlitMaterial != null) sr.sharedMaterial = unlitMaterial;
            sr.color = ToColor(M02RenderContract.FailureLeakColor);
            sr.sortingOrder = OrderFailure + 1;
            var d = (float)(leak.Radius * 2) / Ppu;
            go.transform.localScale = new Vector3(d, d, 1f);
            leakIndex += 1;
        }
    }

    // ── 完成面板(SWV renderCompletionReward:342-449) ──

    private void RenderCompletionReward()
    {
        if (Config == null || completionShown || runtimeRoot == null || progressStore == null) return;
        var card = M02CompletionController.GrantM02Completion(
            progressStore, Config.ToolCard, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()); // SWV:344 Date.now()
        var preview = ToolCardPreviewBuilder.Build(card, new ToolCardPreviewOptions
        {
            Text = new ToolCardPreviewText
            {
                UnlockedSubtitle = M02RenderContract.CompletionUnlockedSubtitle,   // SWV:347
                WhenToUsePrefix = M02RenderContract.CompletionWhenToUsePrefix      // SWV:348
            }
        });

        if (completionRoot != null)
        {
            if (Application.isPlaying) Destroy(completionRoot); else DestroyImmediate(completionRoot);
        }
        var panel = new GameObject("M02CompletionPanel");
        panel.transform.SetParent(runtimeRoot.transform, false);
        panel.transform.localPosition = ToWorld(M02RenderContract.CompletionPanelPositionPx); // SWV:355
        completionRoot = panel;

        AddFilledFrame(panel, "panelBody",
            M02RenderContract.CompletionPanelWidthPx, M02RenderContract.CompletionPanelHeightPx,
            M02RenderContract.CompletionPanelFill, M02RenderContract.CompletionPanelStroke, OrderCompletion); // SWV:359-372
        DrawCompletionCrystal(panel); // SWV:373

        cardFont ??= CreateCardFont();
        var wisdomSpec = M02RenderContract.CompletionPanelLabels[0]; // SWV:375
        AddCardLabel(panel, wisdomSpec, Config.WisdomCrystal, OrderCompletion + 4);

        var cardRoot = new GameObject("M02ToolCardPreview");
        cardRoot.transform.SetParent(panel.transform, false);
        cardRoot.transform.localPosition = ToWorld(M02RenderContract.CompletionCardPositionPx); // SWV:379
        AddFilledFrame(cardRoot, "cardBody",
            M02RenderContract.CompletionCardWidthPx, M02RenderContract.CompletionCardHeightPx,
            M02RenderContract.CompletionCardFill, M02RenderContract.CompletionCardStroke, OrderCompletion + 6); // SWV:383-394

        var order = OrderCompletion + 8;
        foreach (var spec in M02RenderContract.CompletionCardLabels) // SWV:396-400
        {
            AddCardLabel(cardRoot, spec, TextForLabel(spec, preview), order);
            order += 1;
        }
        completionTextHealed = false;
        completionShown = true;
    }

    private string TextForLabel(M02CardLabelSpec spec, ToolCardPreview preview)
    {
        var text = spec.Field switch
        {
            "wisdomCrystal" => Config?.WisdomCrystal ?? "",
            "subtitle" => preview.Subtitle,
            "title" => preview.Title,
            "crystal" => preview.Crystal,
            "coreAction" => preview.CoreAction,
            "whenToUse" => preview.WhenToUse,
            _ => ""
        };
        return spec.WrapChars > 0 ? M02RenderContract.WrapCardText(text, spec.WrapChars) : text; // SWV:399-400
    }

    private void DrawCompletionCrystal(GameObject parent)
    {
        // SWV:405-418: 菱形结晶 icon(fill=accent, stroke=卡描边, lineWidth 2)
        var sprite = GetOrBakePolygonSprite("crystalIcon",
            M02RenderContract.CompletionCrystalDiamondPx,
            M02RenderContract.CompletionAccentColor,
            M02RenderContract.CompletionCardStroke,
            M02RenderContract.CompletionPanelLineWidthPx);
        var go = new GameObject("M02WisdomCrystalIcon");
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = ToWorld(M02RenderContract.CompletionCrystalIconPositionPx); // SWV:407
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        if (unlitMaterial != null) sr.sharedMaterial = unlitMaterial;
        sr.sortingOrder = OrderCompletion + 3;
    }

    private void AddCardLabel(GameObject parent, M02CardLabelSpec spec, string text, int order)
    {
        // SWV:420-444: Label 居中对齐, 行高 fontSize+5; TextMesh + 系统中文动态字体(M01CompletionProbe 样板)
        var go = new GameObject(spec.Name);
        go.transform.SetParent(parent.transform, false);
        go.transform.localPosition = ToWorld(spec.XPx, spec.YPx);
        var tm = go.AddComponent<TextMesh>();
        tm.text = text;
        tm.fontSize = 48;
        // Cocos fontSize px → TextMesh characterSize: 48pt 字形 ≈ 4.8·characterSize 世界单位, 除 PPU 归一
        tm.characterSize = (float)(spec.FontSizePx / 480.0);
        tm.anchor = TextAnchor.MiddleCenter;
        tm.alignment = TextAlignment.Center; // SWV:442 horizontalAlign=CENTER
        tm.color = ToColor(M02RenderContract.CompletionTextColor); // SWV:441
        if (cardFont != null && cardFont.material != null)
        {
            tm.font = cardFont;
            go.GetComponent<MeshRenderer>().sharedMaterial = cardFont.material;
        }
        go.GetComponent<MeshRenderer>().sortingOrder = order;
    }

    private Font? CreateCardFont()
    {
        var font = Font.CreateDynamicFontFromOSFont("PingFang SC", 48);
        if (font == null || Config == null) return font;
        ownedResources.Add(font);
        // 预烘本面板全部字符, 催生字体图集/材质(M01CompletionProbe 教训: 首帧 material 可能未就绪)
        var preview = ToolCardPreviewBuilder.Build(ToolCardFactory.Create(Config.ToolCard, 0));
        font.RequestCharactersInTexture(
            Config.WisdomCrystal + preview.Title + preview.Subtitle + preview.Crystal + preview.CoreAction +
            M02RenderContract.CompletionUnlockedSubtitle + M02RenderContract.CompletionWhenToUsePrefix +
            string.Join("", Config.ToolCard.Back.WhenToUse) + "何时使用：", 48);
        return font;
    }

    private void HealCompletionText()
    {
        // 动态字体图集材质首帧可能未就绪 → 品红字形网格; 自愈一次即停(M01CompletionProbe 审查样板)
        // 首帧动态字体图集/材质未就绪时 AddCardLabel 会连 tm.font 一起跳过 → 自愈必须补 font, 只补材质
        // 无字形网格(TextMesh 无 font 不出字) —— 审查逮到: 原实现只补材质且一次性锁存=文字永久空白。
        if (completionRoot == null || completionTextHealed || cardFont == null || cardFont.material == null) return;
        foreach (var tm in completionRoot.GetComponentsInChildren<TextMesh>())
        {
            if (tm.font == null) tm.font = cardFont;
        }
        foreach (var mr in completionRoot.GetComponentsInChildren<MeshRenderer>())
        {
            if (mr.sharedMaterial == null) mr.sharedMaterial = cardFont.material;
        }
        completionTextHealed = true; // 补齐后才锁存
    }

    // ── 渲染原语/资源 ──

    private void EnsureMaterials()
    {
        // Cocos Sprite 不参与场景灯光 → 星/边/面板用 2D Unlit; 背景用 2D Lit 吃全局光+点光暖池
        if (unlitMaterial == null)
        {
            var sh = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default");
            if (sh != null)
            {
                unlitMaterial = new Material(sh) { hideFlags = HideFlags.DontSave };
                ownedResources.Add(unlitMaterial);
            }
            else
            {
                Debug.LogError("M02StarWebProbe: Sprite-Unlit-Default shader 未找到");
            }
        }
        if (litMaterial == null)
        {
            var sh = Shader.Find("Universal Render Pipeline/2D/Sprite-Lit-Default");
            if (sh != null)
            {
                litMaterial = new Material(sh) { hideFlags = HideFlags.DontSave };
                ownedResources.Add(litMaterial);
            }
        }
        if (additiveMaterial == null)
        {
            var sh = Shader.Find("StarGuardian/GlowAdditive"); // M2GlowProbe:47 同款
            additiveMaterial = new Material(sh != null ? sh : Shader.Find("Sprites/Default")) { hideFlags = HideFlags.DontSave };
            ownedResources.Add(additiveMaterial);
        }
    }

    private void SetupCameraAndBloom()
    {
        // M2GlowProbe:116-143 验证过的相机+Bloom 参数
        var cam = Camera.main;
        if (cam == null)
        {
            var cgo = new GameObject("Main Camera") { tag = "MainCamera", hideFlags = HideFlags.DontSave }; // ExecuteAlways: 编辑态也会建, 别序列化进场景
            cam = cgo.AddComponent<Camera>();
        }
        cam.orthographic = true;
        cam.orthographicSize = (float)(M02RenderContract.DesignHeightPx / 2 / M02RenderContract.PixelsPerUnit); // 契约派生, 非魔数(终审逮到)(M01BoardProbe 同)
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.03f, 0.05f, 0.065f);
        cam.transform.position = new Vector3(0f, 0f, -10f);
        var data = cam.GetUniversalAdditionalCameraData();
        if (data != null) data.renderPostProcessing = true;

        // 只销毁自己持有的引用(同 Build/OnDisable): Find 按名字会抓走别家活体 volume 反杀(终审逮到)。
        // 连 profile 一起销毁, 否则运行时 CreateInstance 的 VolumeProfile/Bloom 成无主 SO 滞留到域重载。
        var stale = volumeGo;
        if (stale != null)
        {
            var staleProfile = stale.GetComponent<Volume>()?.profile;
            if (Application.isPlaying)
            {
                Destroy(stale);
                if (staleProfile != null) Destroy(staleProfile);
            }
            else
            {
                DestroyImmediate(stale);
                if (staleProfile != null) DestroyImmediate(staleProfile);
            }
        }
        // ⚠️ 必须 DontSave: 本类是 [ExecuteAlways], 编辑模式下 OnEnable→Build 同样建这个 Volume;
        // 不加就会被序列化进 .unity(场景永远脏 + 空壳提交进库)。M01 的"纯 Play 对象别 DontSave"
        // 是另一情形(那些只在 isPlaying 建), 别把结论套反 —— 审查逮到我上一版正是套反了。
        volumeGo = new GameObject(VolumeName) { hideFlags = HideFlags.DontSave };
        var vol = volumeGo.AddComponent<Volume>();
        vol.isGlobal = true;
        if (vol.profile == null) vol.profile = ScriptableObject.CreateInstance<VolumeProfile>();
        if (!vol.profile.TryGet(out Bloom bloom)) bloom = vol.profile.Add<Bloom>(true);
        bloom.active = true;
        // M2GlowProbe 的 0.5/1.5 是深底(近黑)参数; M02 是浅色水彩底(亮度≈0.9), threshold 0.5 会整面
        // 超阈值→全屏泛光洗白(实测截图对照 Cocos 确认)。提到 HDR-only: 只有 additive 光晕/Light2D
        // 打亮(>1)的像素参与 bloom, 水彩底原样保留。
        bloom.intensity.Override(1.1f);
        bloom.threshold.Override(1.05f);
        bloom.scatter.Override(0.72f);
    }

    private GameObject MakeLayer(GameObject parent, string name)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent.transform, false);
        return go;
    }

    /// <summary>星形精灵: fill(非零环绕, 自交五角星实心) + 3 道漂移描边 src-over 合成, 2× 采样烘焙。
    /// 几何由星 id 确定(SWV:507 每次渲染重放同一 rng 序列), 按 id:status 缓存。</summary>
    private Sprite GetStarSprite(string id, string status)
    {
        var key = $"star:{id}:{status}";
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;

        var rng = M02RenderContract.RngFromStarId(id); // SWV:506
        var vertices = M02RenderContract.GenerateStargazeStarVertices(
            M02RenderContract.NodeRadiusPx, M02RenderContract.StargazeStarWobble, rng); // SWV:507
        var fill = M02RenderContract.StarFillColor(status);       // SWV:508
        var strokeColor = M02RenderContract.StarStrokeColor(status); // SWV:512

        var fillPath = PathFromDrawOrder(vertices);
        var strokePasses = new List<(List<Point2> Path, double HalfWidth)>();
        for (var pass = 0; pass < M02RenderContract.StarStrokePassCount; pass++) // SWV:513-523
        {
            var drifted = M02RenderContract.DriftStarVertices(vertices, M02RenderContract.StarStrokeDriftPx(pass), rng);
            strokePasses.Add((PathFromDrawOrder(drifted), M02RenderContract.StarStrokeLineWidthPx(pass) / 2));
        }

        // 边界: 所有路径点 + 最大半线宽 + 1px 羽化
        double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
        void Grow(List<Point2> path)
        {
            foreach (var p in path)
            {
                minX = Math.Min(minX, p.X); maxX = Math.Max(maxX, p.X);
                minY = Math.Min(minY, p.Y); maxY = Math.Max(maxY, p.Y);
            }
        }
        Grow(fillPath);
        foreach (var (path, _) in strokePasses) Grow(path);
        var pad = strokePasses[strokePasses.Count - 1].HalfWidth + 2;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;

        const int scale = 2; // 2× 烘焙 + 双线性 ≈ Cocos Graphics AA
        var width = Mathf.Max(1, Mathf.CeilToInt((float)(maxX - minX)) * scale);
        var height = Mathf.Max(1, Mathf.CeilToInt((float)(maxY - minY)) * scale);
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false)
        {
            hideFlags = HideFlags.DontSave,
            wrapMode = TextureWrapMode.Clamp
        };
        var pixels = new Color[width * height];
        var fillColor = ToColor(fill);
        var stroke = ToColor(strokeColor);
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var px = minX + (x + 0.5) / scale;
                var py = minY + (y + 0.5) / scale;
                var color = new Color(0, 0, 0, 0);
                if (WindingNonZero(fillPath, px, py)) color = fillColor;
                foreach (var (path, halfWidth) in strokePasses)
                {
                    // 1px 羽化的描边覆盖率(Cocos Graphics 抗锯齿近似)
                    var coverage = Mathf.Clamp01((float)(halfWidth + 0.5 - DistanceToPath(path, px, py)));
                    if (coverage <= 0f) continue;
                    var src = stroke;
                    src.a *= coverage;
                    color = SrcOver(src, color);
                }
                pixels[y * width + x] = color;
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        ownedResources.Add(tex);
        // 分母必须用纹理【实际】跨度(CeilToInt 后 width/scale), 非原始 maxX-minX —— 两者差 [0,1)px
        // 会让星形亚像素错位(终审逮到)。不再 Clamp01 静默钳: bbox 不含原点是布局错, 该显性暴露。
        var pivot = new Vector2((float)(-minX / (width / (double)scale)), (float)(-minY / (height / (double)scale)));
        var sprite = Sprite.Create(tex, new Rect(0, 0, width, height), pivot, Ppu * scale);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite);
        spriteCache[key] = sprite;
        return sprite;
    }

    private static List<Point2> PathFromDrawOrder(IReadOnlyList<Point2> vertices)
    {
        // SWV:545-554: 按 [0,2,4,1,3,0] 一笔画(首尾同点, 自交闭合路径)
        var path = new List<Point2>(M02RenderContract.StargazeStarDrawOrder.Count);
        foreach (var index in M02RenderContract.StargazeStarDrawOrder)
        {
            path.Add(vertices[index]);
        }
        return path;
    }

    private static bool WindingNonZero(List<Point2> closedPath, double x, double y)
    {
        // 非零环绕(NanoVG/Cocos Graphics 默认填充规则): 五角星中心五边形同为实心
        var winding = 0;
        for (var i = 0; i < closedPath.Count - 1; i++)
        {
            var a = closedPath[i];
            var b = closedPath[i + 1];
            if (a.Y <= y)
            {
                if (b.Y > y && IsLeft(a, b, x, y) > 0) winding += 1;
            }
            else
            {
                if (b.Y <= y && IsLeft(a, b, x, y) < 0) winding -= 1;
            }
        }
        return winding != 0;
    }

    private static double IsLeft(Point2 a, Point2 b, double x, double y) =>
        (b.X - a.X) * (y - a.Y) - (x - a.X) * (b.Y - a.Y);

    private static double DistanceToPath(List<Point2> path, double x, double y)
    {
        var best = double.MaxValue;
        for (var i = 0; i < path.Count - 1; i++)
        {
            best = Math.Min(best, DistanceToSegment(path[i], path[i + 1], x, y));
        }
        return best;
    }

    private static double DistanceToSegment(Point2 a, Point2 b, double x, double y)
    {
        var abx = b.X - a.X;
        var aby = b.Y - a.Y;
        var lenSq = abx * abx + aby * aby;
        var t = lenSq <= 1e-9 ? 0 : Math.Max(0, Math.Min(1, ((x - a.X) * abx + (y - a.Y) * aby) / lenSq));
        var dx = x - (a.X + abx * t);
        var dy = y - (a.Y + aby * t);
        return Math.Sqrt(dx * dx + dy * dy);
    }

    private static Color SrcOver(Color src, Color dst)
    {
        var outA = src.a + dst.a * (1f - src.a);
        if (outA <= 0f) return new Color(0, 0, 0, 0);
        return new Color(
            (src.r * src.a + dst.r * dst.a * (1f - src.a)) / outA,
            (src.g * src.a + dst.g * dst.a * (1f - src.a)) / outA,
            (src.b * src.a + dst.b * dst.a * (1f - src.a)) / outA,
            outA);
    }

    /// <summary>把一组折线按统一半线宽烘成一张白色 alpha 覆盖率纹理(并集; 1px 羽化), 供整批边一次着色。</summary>
    private Sprite BakeStrokeUnionSprite(string key, List<List<Point2>> polylines, double halfWidthPx)
    {
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;

        double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
        foreach (var line in polylines)
        {
            foreach (var p in line)
            {
                minX = Math.Min(minX, p.X); maxX = Math.Max(maxX, p.X);
                minY = Math.Min(minY, p.Y); maxY = Math.Max(maxY, p.Y);
            }
        }
        var pad = halfWidthPx + 2;
        minX = Math.Floor(minX - pad); minY = Math.Floor(minY - pad);
        maxX = Math.Ceiling(maxX + pad); maxY = Math.Ceiling(maxY + pad);
        var width = Mathf.Max(1, (int)(maxX - minX));
        var height = Mathf.Max(1, (int)(maxY - minY));
        var alpha = new float[width * height];

        foreach (var line in polylines)
        {
            for (var i = 0; i < line.Count - 1; i++)
            {
                var a = line[i];
                var b = line[i + 1];
                var x0 = Mathf.Max(0, (int)(Math.Min(a.X, b.X) - minX - pad));
                var x1 = Mathf.Min(width - 1, (int)(Math.Max(a.X, b.X) - minX + pad));
                var y0 = Mathf.Max(0, (int)(Math.Min(a.Y, b.Y) - minY - pad));
                var y1 = Mathf.Min(height - 1, (int)(Math.Max(a.Y, b.Y) - minY + pad));
                for (var y = y0; y <= y1; y++)
                {
                    for (var x = x0; x <= x1; x++)
                    {
                        var dist = DistanceToSegment(a, b, minX + x + 0.5, minY + y + 0.5);
                        var coverage = Mathf.Clamp01((float)(halfWidthPx + 0.5 - dist));
                        if (coverage <= 0f) continue;
                        var idx = y * width + x;
                        if (coverage > alpha[idx]) alpha[idx] = coverage; // 并集: 重叠不加深(单次 stroke 语义)
                    }
                }
            }
        }

        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false)
        {
            hideFlags = HideFlags.DontSave,
            wrapMode = TextureWrapMode.Clamp
        };
        var pixels = new Color32[width * height];
        for (var i = 0; i < pixels.Length; i++)
        {
            pixels[i] = new Color32(255, 255, 255, (byte)(alpha[i] * 255f + 0.5f));
        }
        tex.SetPixels32(pixels);
        tex.Apply();
        ownedResources.Add(tex);
        // 同上: 分母取纹理实际跨度(此处 scale=1), 不 Clamp01 静默钳错(终审逮到)。
        var pivot = new Vector2((float)(-minX / (double)width), (float)(-minY / (double)height));
        var sprite = Sprite.Create(tex, new Rect(0, 0, width, height), pivot, Ppu);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite);
        spriteCache[key] = sprite;
        return sprite;
    }

    /// <summary>矩形 fill + 居中 2px 描边(Cocos rect+fill+stroke, SWV:365-372/387-394): fill 白quad染色 + 边框纹理染色。</summary>
    private void AddFilledFrame(GameObject parent, string name, double widthPx, double heightPx, M01Color32 fill, M01Color32 strokeColor, int order)
    {
        var body = new GameObject(name);
        body.transform.SetParent(parent.transform, false);
        var bodySr = body.AddComponent<SpriteRenderer>();
        bodySr.sprite = WhiteSprite();
        if (unlitMaterial != null) bodySr.sharedMaterial = unlitMaterial;
        bodySr.color = ToColor(fill);
        bodySr.sortingOrder = order;
        body.transform.localScale = new Vector3((float)widthPx / Ppu, (float)heightPx / Ppu, 1f);

        var frameSprite = GetOrBakeFrameSprite($"frame:{widthPx}x{heightPx}:{M02RenderContract.CompletionPanelLineWidthPx}", widthPx, heightPx, M02RenderContract.CompletionPanelLineWidthPx);
        var frame = new GameObject(name + "Frame");
        frame.transform.SetParent(parent.transform, false);
        var frameSr = frame.AddComponent<SpriteRenderer>();
        frameSr.sprite = frameSprite;
        if (unlitMaterial != null) frameSr.sharedMaterial = unlitMaterial;
        frameSr.color = ToColor(strokeColor);
        frameSr.sortingOrder = order + 1;
    }

    private Sprite GetOrBakeFrameSprite(string key, double widthPx, double heightPx, double lineWidthPx)
    {
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;
        // 描边居中于矩形边界: 内外各 lineWidth/2 → 纹理比矩形大 lineWidth
        var half = lineWidthPx / 2;
        var width = (int)Math.Ceiling(widthPx + lineWidthPx);
        var height = (int)Math.Ceiling(heightPx + lineWidthPx);
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false)
        {
            hideFlags = HideFlags.DontSave,
            wrapMode = TextureWrapMode.Clamp
        };
        var pixels = new Color32[width * height];
        var centerX = width / 2.0;
        var centerY = height / 2.0;
        var halfExtentX = widthPx / 2;
        var halfExtentY = heightPx / 2;
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                // 矩形有符号距离场: |sd| <= half 即描边带(描边居中于矩形边界)
                var qx = Math.Abs(x + 0.5 - centerX) - halfExtentX;
                var qy = Math.Abs(y + 0.5 - centerY) - halfExtentY;
                var outside = Math.Sqrt(Math.Max(qx, 0) * Math.Max(qx, 0) + Math.Max(qy, 0) * Math.Max(qy, 0));
                var sd = outside + Math.Min(Math.Max(qx, qy), 0);
                pixels[y * width + x] = Math.Abs(sd) <= half
                    ? new Color32(255, 255, 255, 255)
                    : new Color32(255, 255, 255, 0);
            }
        }
        tex.SetPixels32(pixels);
        tex.Apply();
        ownedResources.Add(tex);
        var sprite = Sprite.Create(tex, new Rect(0, 0, width, height), new Vector2(0.5f, 0.5f), Ppu);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite);
        spriteCache[key] = sprite;
        return sprite;
    }

    private Sprite GetOrBakePolygonSprite(string key, IReadOnlyList<Point2> points, M01Color32 fill, M01Color32 strokeColor, double lineWidthPx)
    {
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;
        var closed = new List<Point2>(points) { points[0] };
        double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
        foreach (var p in closed)
        {
            minX = Math.Min(minX, p.X); maxX = Math.Max(maxX, p.X);
            minY = Math.Min(minY, p.Y); maxY = Math.Max(maxY, p.Y);
        }
        var pad = lineWidthPx / 2 + 2;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const int scale = 2;
        var width = Mathf.Max(1, Mathf.CeilToInt((float)(maxX - minX)) * scale);
        var height = Mathf.Max(1, Mathf.CeilToInt((float)(maxY - minY)) * scale);
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false)
        {
            hideFlags = HideFlags.DontSave,
            wrapMode = TextureWrapMode.Clamp
        };
        var pixels = new Color[width * height];
        var fillColor = ToColor(fill);
        var stroke = ToColor(strokeColor);
        var halfWidth = lineWidthPx / 2;
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var px = minX + (x + 0.5) / scale;
                var py = minY + (y + 0.5) / scale;
                var color = new Color(0, 0, 0, 0);
                if (WindingNonZero(closed, px, py)) color = fillColor;
                var coverage = Mathf.Clamp01((float)(halfWidth + 0.5 - DistanceToPath(closed, px, py)));
                if (coverage > 0f)
                {
                    var src = stroke;
                    src.a *= coverage;
                    color = SrcOver(src, color);
                }
                pixels[y * width + x] = color;
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        ownedResources.Add(tex);
        // 同 GetStarSprite: 分母取纹理实际跨度(CeilToInt 后), 不 Clamp01 静默钳错(终审逮到)。
        var pivot = new Vector2((float)(-minX / (width / (double)scale)), (float)(-minY / (height / (double)scale)));
        var sprite = Sprite.Create(tex, new Rect(0, 0, width, height), pivot, Ppu * scale);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite);
        spriteCache[key] = sprite;
        return sprite;
    }

    private Sprite MakeRadialSprite(int size)
    {
        // M2GlowProbe.MakeRadial:145-160 同款(加法光晕核)
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            wrapMode = TextureWrapMode.Clamp,
            hideFlags = HideFlags.DontSave
        };
        var r = size * 0.5f;
        var px = new Color[size * size];
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var d = Mathf.Clamp01(Vector2.Distance(new Vector2(x, y), new Vector2(r, r)) / r);
                var a = 1f - d;
                a *= a;
                px[y * size + x] = new Color(1f, 1f, 1f, a);
            }
        }
        tex.SetPixels(px);
        tex.Apply();
        ownedResources.Add(tex);
        var sprite = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite);
        return sprite;
    }

    private Sprite MakeDiscSprite(int size)
    {
        // 实心圆(1px 羽化), 直径 1 unit; 供 pip/漏光点等平面圆
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
        {
            wrapMode = TextureWrapMode.Clamp,
            hideFlags = HideFlags.DontSave
        };
        var r = size * 0.5f;
        var px = new Color32[size * size];
        for (var y = 0; y < size; y++)
        {
            for (var x = 0; x < size; x++)
            {
                var d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(r, r));
                var a = Mathf.Clamp01(r - d);
                px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255f + 0.5f));
            }
        }
        tex.SetPixels32(px);
        tex.Apply();
        ownedResources.Add(tex);
        var sprite = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite);
        return sprite;
    }

    private Sprite WhiteSprite()
    {
        const string key = "white";
        if (spriteCache.TryGetValue(key, out var cached) && cached != null) return cached;
        var tex = Texture2D.whiteTexture;
        var sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), tex.width);
        sprite.hideFlags = HideFlags.DontSave;
        ownedResources.Add(sprite); // 纹理是引擎共享白图, 只回收精灵
        spriteCache[key] = sprite;
        return sprite;
    }

    private static Vector3 ToWorld(Point2 pointPx) => new((float)pointPx.X / Ppu, (float)pointPx.Y / Ppu, 0f);

    private static Vector3 ToWorld(double xPx, double yPx) => new((float)xPx / Ppu, (float)yPx / Ppu, 0f);

    private static Color ToColor(M01Color32 color) => new(color.R / 255f, color.G / 255f, color.B / 255f, color.A / 255f);

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        // M01DragProbe:655 同款: 屏幕 → 世界 → ×PPU = Cocos px(根节点在原点)
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }
}
