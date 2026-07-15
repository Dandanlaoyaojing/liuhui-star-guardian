// M02 序章「三颗余烬点棒」探针 —— 消费 M02PrologueSession(纯逻辑) + M02RenderContract,
// 渲余烬(光晕随命数收缩)/星光棒(插地斜杆↔在手竖杆/点亮), 拖余烬/点棒转给 session。
// 与 Cocos M02PrologueView.ts(标注 PV:行号)同责边界: 本文件不算任何规则。
// 拖拽状态机复用 Interaction.DragHandler(与 M01/Cocos 同一套 totalDelta + 6px 轻点判定)。
// 光效走 M2GlowProbe 管线(加法光晕 + Light2D 点光; Bloom/全局光由 M02StarWebProbe 或场景提供)。
// 用法: 由 M02StarWebProbe.Init 注入(整关流程), 或单独挂 GameObject 自载配置(编辑器目检)。
#nullable enable

using System;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using StarGuardian.Interaction;
using StarGuardian.M01.Rendering;
using StarGuardian.M02;
using StarGuardian.M02.Rendering;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering.Universal;

[ExecuteAlways]
public sealed class M02PrologueProbe : MonoBehaviour
{
    private const float Ppu = (float)M02RenderContract.PixelsPerUnit;
    private const int OrderBase = M02StarWebProbe.OrderPrologue; // 序章节点 addChild 在主视图最后(SWV:198)

    /// <summary>序章会话(纯逻辑); 渲染层只读 View、转发拖动/点击。</summary>
    public M02PrologueSession? Session { get; private set; }

    private sealed class EmberVisual
    {
        public GameObject GlowNode = null!;
        public SpriteRenderer GlowSprite = null!;
        public Light2D? Light;
        public GameObject CoreNode = null!;
        public SpriteRenderer CoreSprite = null!;
    }

    private StarWebPrologue? prologue;
    private StarNetworkRules rules;
    private Action? onDone;
    private int lifeMax = 1; // PV:49

    private GameObject? visualsRoot;
    private Material? unlitMaterial;
    private Material? additiveMaterial;
    private Sprite? radialGlowSprite;
    private Sprite? discSprite;
    private Sprite? quadSprite;
    private readonly System.Collections.Generic.List<UnityEngine.Object> ownedResources = new();
    private readonly System.Collections.Generic.Dictionary<string, EmberVisual> emberVisuals = new();
    private GameObject? wandNode;
    private Transform? wandStick;
    private SpriteRenderer? wandStickSprite;
    private SpriteRenderer? wandTipSprite;
    private SpriteRenderer? wandTipGlowSprite;
    private Light2D? wandTipLight;

    // PV:51-55 拖拽/触点/完成状态
    private DragState dragState = new();
    private bool dragActivated;   // PV:52 totalDelta 曾超阈值(锁存)
    private bool pressCaptured;   // PV:53 activeTouchId 等价(鼠标单指针)
    private double doneCountdown = -1; // PV:54
    private int renderedRevision = -1; // PV:55
    private static readonly object MousePointerId = 0; // DragHandler PointerId(单鼠标固定 0)

    /// <summary>由 M02StarWebProbe 注入配置与完成回调后启动(PV:59 init)。</summary>
    public void Init(StarWebPrologue prologueConfig, StarNetworkRules networkRules, Action? onDoneCallback)
    {
        prologue = prologueConfig;
        rules = networkRules;
        onDone = onDoneCallback;
        StartSession();
    }

    private void OnEnable()
    {
        if (Session != null) return;      // Init 已启动(注入路径)
        if (prologue != null)
        {
            StartSession();               // 重新启用: 用注入配置重开一局
            return;
        }
        TryBootstrapFromConfig();         // 独立挂场景: 自载配置(探针脚手架, 非 TS 行为)
    }

    private void OnDisable()
    {
        // M01 教训: DontSave 资源必须显式销毁; 根直接引用销毁(M2GlowProbe 模式)
        if (visualsRoot != null)
        {
            if (Application.isPlaying) Destroy(visualsRoot); else DestroyImmediate(visualsRoot);
        }
        visualsRoot = null;
        emberVisuals.Clear();
        wandNode = null;
        wandStick = null;
        wandStickSprite = null;
        wandTipSprite = null;
        wandTipGlowSprite = null;
        wandTipLight = null;
        foreach (var resource in ownedResources)
        {
            if (resource == null) continue;
            if (Application.isPlaying) Destroy(resource); else DestroyImmediate(resource);
        }
        ownedResources.Clear();
        unlitMaterial = null;
        additiveMaterial = null;
        radialGlowSprite = null;
        discSprite = null;
        quadSprite = null;
        Session = null;
        dragState = new DragState();
        dragActivated = false;
        pressCaptured = false;
        doneCountdown = -1;
        renderedRevision = -1;
    }

    private void TryBootstrapFromConfig()
    {
        var text = Resources.Load<TextAsset>("Configs/m02-starweb-warmth");
        if (text == null)
        {
            Debug.LogWarning("M02PrologueProbe: Resources/Configs/m02-starweb-warmth.json 未找到");
            return;
        }
        var result = StarWebConfigValidator.Validate(JToken.Parse(text.text));
        if (!result.Ok || result.Value == null)
        {
            Debug.LogError("M02PrologueProbe: 配置非法: " + string.Join("; ", result.Errors));
            return;
        }
        if (result.Value.Prologue == null)
        {
            Debug.LogWarning("M02PrologueProbe: 配置无 prologue 段");
            return;
        }
        prologue = result.Value.Prologue;
        rules = result.Value.Mechanic;
        onDone = null; // 独立目检: 点亮后停在完成画面
        StartSession();
    }

    private void StartSession()
    {
        if (prologue == null) return;
        Session = new M02PrologueSession(prologue, rules); // PV:60
        lifeMax = rules.LifeMax;                            // PV:62
        doneCountdown = -1;
        renderedRevision = -1;
        Build();
        Render();
    }

    // ── 搭建(镜像 PV init:64-86 的节点创建顺序: 棒先、余烬后 → 余烬盖棒) ──

    private void Build()
    {
        if (visualsRoot != null)
        {
            if (Application.isPlaying) Destroy(visualsRoot); else DestroyImmediate(visualsRoot);
        }
        emberVisuals.Clear();
        EnsureResources();

        visualsRoot = new GameObject("~M02PrologueVisuals") { hideFlags = HideFlags.DontSave };
        visualsRoot.transform.SetParent(transform, false);

        // PV:68-72 星光棒节点(位置来自配置 wand.x/y)
        wandNode = new GameObject("M02PrologueWand");
        wandNode.transform.SetParent(visualsRoot.transform, false);
        wandNode.transform.localPosition = new Vector3((float)prologue!.Wand.X / Ppu, (float)prologue.Wand.Y / Ppu, 0f);

        var stickGo = new GameObject("stick");
        stickGo.transform.SetParent(wandNode.transform, false);
        wandStick = stickGo.transform;
        wandStickSprite = stickGo.AddComponent<SpriteRenderer>();
        wandStickSprite.sprite = quadSprite;
        if (unlitMaterial != null) wandStickSprite.sharedMaterial = unlitMaterial;
        wandStickSprite.color = ToColor(M02RenderContract.WandStickColor); // PV:243
        wandStickSprite.sortingOrder = OrderBase;

        var tipGlowGo = new GameObject("tipGlow");
        tipGlowGo.transform.SetParent(wandNode.transform, false);
        wandTipGlowSprite = tipGlowGo.AddComponent<SpriteRenderer>();
        wandTipGlowSprite.sprite = radialGlowSprite;
        if (additiveMaterial != null) wandTipGlowSprite.sharedMaterial = additiveMaterial;
        wandTipGlowSprite.sortingOrder = OrderBase + 1;
        wandTipGlowSprite.enabled = false;
        var tipLightGo = new GameObject("L2D");
        tipLightGo.transform.SetParent(tipGlowGo.transform, false);
        wandTipLight = tipLightGo.AddComponent<Light2D>();
        wandTipLight.lightType = Light2D.LightType.Point;
        wandTipLight.intensity = 0f;

        var tipGo = new GameObject("tip");
        tipGo.transform.SetParent(wandNode.transform, false);
        wandTipSprite = tipGo.AddComponent<SpriteRenderer>();
        wandTipSprite.sprite = discSprite;
        if (unlitMaterial != null) wandTipSprite.sharedMaterial = unlitMaterial;
        wandTipSprite.sortingOrder = OrderBase + 2;
        var tipDiameter = (float)(M02RenderContract.WandTipRadiusPx * 2) / Ppu;
        tipGo.transform.localScale = new Vector3(tipDiameter, tipDiameter, 1f);

        // PV:74-79 每颗余烬: 光晕 + 核心
        var index = 0;
        foreach (var ember in prologue.Embers)
        {
            var glowNode = new GameObject($"M02PrologueEmberGlow_{ember.Id}");
            glowNode.transform.SetParent(visualsRoot.transform, false);
            var glowSprite = glowNode.AddComponent<SpriteRenderer>();
            glowSprite.sprite = radialGlowSprite;
            if (additiveMaterial != null) glowSprite.sharedMaterial = additiveMaterial;
            glowSprite.sortingOrder = OrderBase + 10 + index * 2;
            var lightGo = new GameObject("L2D");
            lightGo.transform.SetParent(glowNode.transform, false);
            var light = lightGo.AddComponent<Light2D>();
            light.lightType = Light2D.LightType.Point;
            light.intensity = 0f;

            var coreNode = new GameObject($"M02PrologueEmber_{ember.Id}");
            coreNode.transform.SetParent(visualsRoot.transform, false);
            var coreSprite = coreNode.AddComponent<SpriteRenderer>();
            coreSprite.sprite = discSprite;
            if (unlitMaterial != null) coreSprite.sharedMaterial = unlitMaterial;
            coreSprite.sortingOrder = OrderBase + 10 + index * 2 + 1;

            emberVisuals[ember.Id] = new EmberVisual
            {
                GlowNode = glowNode,
                GlowSprite = glowSprite,
                Light = light,
                CoreNode = coreNode,
                CoreSprite = coreSprite
            };
            index += 1;
        }
    }

    // ── 逐帧(镜像 PV update:96-114 + 触摸回调) ──

    private void Update()
    {
        if (Session == null) return;
        if (Application.isPlaying)
        {
            Session.Update(Time.deltaTime); // PV:98
            if (Session.Done)
            {
                // PV:99-110: 棒亮后停 1.1s 再交还(先置计时, 下一帧起递减)
                if (doneCountdown < 0)
                {
                    doneCountdown = M02RenderContract.DoneDelaySeconds;
                }
                else
                {
                    doneCountdown -= Time.deltaTime;
                    if (doneCountdown <= 0 && onDone != null)
                    {
                        var done = onDone;
                        onDone = null;
                        done();
                        return;
                    }
                }
            }
        }
        // PV:112-113 静止帧跳过重绘
        if (Session != null && Session.Revision != renderedRevision) Render();
        if (Application.isPlaying) HandleInput();
    }

    private void HandleInput()
    {
        var pointer = Pointer.current; // iOS 触屏无 Mouse; M01DragProbe 同款 Pointer 路径
        if (pointer == null || Session == null) return;
        var local = ScreenToCocos(pointer.position.ReadValue());

        // PV:66 触摸区矩形命中(1000×720): 框外 Cocos 不派发 → Unity 轮询显式裁剪
        var insideTouchArea = M02RenderContract.IsInsideTouchArea(local.x, local.y);
        if (pointer.press.wasPressedThisFrame)
        {
            // PV:116-127 onTouchStart
            if (!pressCaptured && insideTouchArea)
            {
                pressCaptured = true;
                dragActivated = false;
                var emberId = NearestEmberId(local.x, local.y);
                dragState = emberId != null
                    ? DragHandler.BeginDragSession(new BeginDragInput
                    {
                        PointerId = MousePointerId,
                        EntityId = emberId,
                        Position = new Point2(local.x, local.y)
                    })
                    : new DragState();
            }
        }

        if (pressCaptured && pointer.press.isPressed && dragState.Active != null)
        {
            // PV:129-146 onTouchMove(仅指针真移动时驱动, 镜像触摸事件语义)
            var current = dragState.Active.CurrentPosition;
            if (current.X != local.x || current.Y != local.y)
            {
                dragState = DragHandler.MoveDragSession(dragState, new DragPointerInput
                {
                    PointerId = MousePointerId,
                    Position = new Point2(local.x, local.y)
                });
                var active = dragState.Active;
                if (active != null)
                {
                    if (!dragActivated)
                    {
                        var movedSquared = active.TotalDelta.X * active.TotalDelta.X + active.TotalDelta.Y * active.TotalDelta.Y;
                        if (movedSquared <= DragHandler.ClickDragThreshold * DragHandler.ClickDragThreshold)
                        {
                            // 未超轻点阈值: 抬手按点击处理(PV:139-141)
                        }
                        else
                        {
                            dragActivated = true;
                        }
                    }
                    if (dragActivated)
                    {
                        Session.MoveEmber(active.EntityId, local.x, local.y); // PV:144
                        Render();
                    }
                }
            }
        }

        if (pointer.press.wasReleasedThisFrame)
        {
            // PV:148-170 onTouchEnd
            if (!pressCaptured) return;
            pressCaptured = false;
            var wasDrag = dragActivated;
            dragActivated = false;
            dragState = DragHandler.EndDragSession(dragState, new DragPointerInput
            {
                PointerId = MousePointerId,
                Position = new Point2(local.x, local.y)
            }).State;
            if (wasDrag) return; // 拖拽落下: 位置已在 move 里更新(PV:160)

            var view = Session.View;
            var wandDistance = Math.Sqrt(
                (view.Wand.X - local.x) * (view.Wand.X - local.x) +
                (view.Wand.Y - local.y) * (view.Wand.Y - local.y)); // PV:163 Math.hypot
            if (view.WandState == WandState.Planted && wandDistance <= M02RenderContract.WandTapRadiusPx)
            {
                Session.PullWand(); // PV:165
            }
            else
            {
                Session.DipWand(local.x, local.y); // PV:167 失败静默(画面教学, 不弹提示)
            }
            Render();
        }
    }

    private string? NearestEmberId(double x, double y)
    {
        // PV:189-203(<= 让后序余烬赢并列)
        if (Session == null) return null;
        string? bestId = null;
        var bestDist = M02RenderContract.EmberDragRadiusPx * M02RenderContract.EmberDragRadiusPx;
        foreach (var ember in Session.View.Embers)
        {
            var dx = ember.X - x;
            var dy = ember.Y - y;
            var dist = dx * dx + dy * dy;
            if (dist <= bestDist)
            {
                bestDist = dist;
                bestId = ember.Id;
            }
        }
        return bestId;
    }

    // ── 渲染(镜像 PV render:205-234 / renderWand:236-256) ──

    private void Render()
    {
        if (Session == null) return;
        renderedRevision = Session.Revision;
        var view = Session.View;
        foreach (var ember in view.Embers)
        {
            if (!emberVisuals.TryGetValue(ember.Id, out var visual)) continue;
            var pos = new Vector3((float)ember.X / Ppu, (float)ember.Y / Ppu, 0f);
            visual.GlowNode.transform.localPosition = pos; // PV:213
            visual.CoreNode.transform.localPosition = pos; // PV:214

            // PV:216-226 光晕: 冻结满辐 / 衰减随命数收缩 / 暗烬无(半径与 alpha 语义照契约, 技法=加法光晕+点光)
            var glowRadius = (float)M02RenderContract.EmberGlowRadiusPx(ember.Status, ember.Life, lifeMax);
            if (glowRadius > 0f)
            {
                var glowColor = M02RenderContract.EmberGlowColor(ember.Status);
                visual.GlowSprite.enabled = true;
                var scale = glowRadius * 2f / Ppu;
                visual.GlowSprite.transform.localScale = new Vector3(scale, scale, 1f);
                visual.GlowSprite.color = ToColor(glowColor);
                if (visual.Light != null)
                {
                    visual.Light.color = new Color(glowColor.R / 255f, glowColor.G / 255f, glowColor.B / 255f, 1f);
                    // M2GlowProbe:82 点光 1.3 为满档, 按 TS 光晕 alpha(95/135)折算亮度(判断值, 契约无 TS 真源)
                    visual.Light.intensity = 1.3f * (glowColor.A / 135f);
                    visual.Light.pointLightInnerRadius = (float)M02RenderContract.EmberCoreRadiusPx / Ppu;
                    visual.Light.pointLightOuterRadius = glowRadius / Ppu * 4f;
                }
            }
            else
            {
                visual.GlowSprite.enabled = false;
                if (visual.Light != null) visual.Light.intensity = 0f;
            }

            // PV:228-231 核心圆(暗烬缩到 0.7)
            visual.CoreSprite.color = ToColor(M02RenderContract.EmberColor(ember.Status));
            var coreDiameter = (float)(M02RenderContract.EmberCoreRadiusResolvedPx(ember.Status) * 2) / Ppu;
            visual.CoreNode.transform.localScale = new Vector3(coreDiameter, coreDiameter, 1f);
        }
        RenderWand(view.WandState);
    }

    private void RenderWand(string state)
    {
        if (wandStick == null || wandStickSprite == null || wandTipSprite == null || wandTipGlowSprite == null) return;
        // PV:241 插地=斜杆, 在手/点亮=竖杆; 杆基 (0,-16)(PV:244), 线宽 5(PV:242)
        var baseOffset = M02RenderContract.WandBaseOffsetPx;
        var tip = M02RenderContract.WandTipOffsetPx(state);
        var dx = tip.X - baseOffset.X;
        var dy = tip.Y - baseOffset.Y;
        var length = Math.Sqrt(dx * dx + dy * dy);
        wandStick.localPosition = new Vector3(
            (float)((baseOffset.X + tip.X) / 2) / Ppu,
            (float)((baseOffset.Y + tip.Y) / 2) / Ppu, 0f);
        wandStick.localRotation = Quaternion.Euler(0f, 0f, (float)(Math.Atan2(dy, dx) * Mathf.Rad2Deg) - 90f);
        wandStick.localScale = new Vector3(
            (float)M02RenderContract.WandLineWidthPx / Ppu,
            (float)length / Ppu, 1f);

        var tipPos = new Vector3((float)tip.X / Ppu, (float)tip.Y / Ppu, 0f);
        wandTipSprite.transform.localPosition = tipPos;
        wandTipSprite.color = ToColor(M02RenderContract.WandTipColor(state)); // PV:253

        var lit = state == WandState.Lit;
        wandTipGlowSprite.transform.localPosition = tipPos;
        wandTipGlowSprite.enabled = lit;
        if (lit)
        {
            // PV:248-251 点亮光晕: 半径 tip+12, 色(248,214,150,120)
            var glowRadius = (float)(M02RenderContract.WandTipRadiusPx + M02RenderContract.WandLitGlowExtraPx);
            var scale = glowRadius * 2f / Ppu;
            wandTipGlowSprite.transform.localScale = new Vector3(scale, scale, 1f);
            wandTipGlowSprite.color = ToColor(M02RenderContract.WandTipLitGlowColor);
        }
        if (wandTipLight != null)
        {
            var glowColor = M02RenderContract.WandTipLitGlowColor;
            wandTipLight.color = new Color(glowColor.R / 255f, glowColor.G / 255f, glowColor.B / 255f, 1f);
            wandTipLight.intensity = lit ? 1.3f : 0f;
            wandTipLight.pointLightInnerRadius = (float)M02RenderContract.WandTipRadiusPx / Ppu;
            wandTipLight.pointLightOuterRadius = (float)(M02RenderContract.WandTipRadiusPx + M02RenderContract.WandLitGlowExtraPx) / Ppu * 4f;
        }
    }

    // ── 资源 ──

    private void EnsureResources()
    {
        if (unlitMaterial == null)
        {
            var sh = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default");
            if (sh != null)
            {
                unlitMaterial = new Material(sh) { hideFlags = HideFlags.DontSave };
                ownedResources.Add(unlitMaterial);
            }
        }
        if (additiveMaterial == null)
        {
            var sh = Shader.Find("StarGuardian/GlowAdditive"); // M2GlowProbe:47 同款
            additiveMaterial = new Material(sh != null ? sh : Shader.Find("Sprites/Default")) { hideFlags = HideFlags.DontSave };
            ownedResources.Add(additiveMaterial);
        }
        radialGlowSprite ??= MakeRadialSprite(128);
        discSprite ??= MakeDiscSprite(64);
        if (quadSprite == null)
        {
            var tex = Texture2D.whiteTexture;
            quadSprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), tex.width);
            quadSprite.hideFlags = HideFlags.DontSave;
            ownedResources.Add(quadSprite);
        }
    }

    private Sprite MakeRadialSprite(int size)
    {
        // M2GlowProbe.MakeRadial:145-160 同款
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

    private static Color ToColor(M01Color32 color) => new(color.R / 255f, color.G / 255f, color.B / 255f, color.A / 255f);

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        // M01DragProbe:655 同款
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }
}
