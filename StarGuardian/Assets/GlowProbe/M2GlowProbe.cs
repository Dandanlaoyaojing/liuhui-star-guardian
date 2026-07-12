using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Phase 1 光效切片: M2 星网呼吸辉光(URP 2D Light + Bloom + 分层加辉)。
// 挂到空 GameObject 上即在编辑器/Play 里程序化搭建, 验证 Unity 光效能否达到迁移期望(go/no-go 闸门)。
[ExecuteAlways]
public class M2GlowProbe : MonoBehaviour
{
    static readonly Color Teal = new Color(0.36f, 0.60f, 0.57f);
    static readonly Color Amber = new Color(0.95f, 0.82f, 0.58f);
    static readonly Color Hot = new Color(1.0f, 0.98f, 0.94f);
    static readonly Vector2[] Nodes = { new Vector2(-3.4f, 1.3f), new Vector2(3.0f, 2.1f), new Vector2(0.3f, -2.3f) };
    static readonly int[][] Bands = { new[] { 0, 1 }, new[] { 1, 2 } };

    Transform root;
    Sprite glow;
    Material mat;

    struct Br { public Transform t; public SpriteRenderer sr; public float baseScale, baseAlpha, phase; }
    readonly List<Br> breathers = new List<Br>();

    void OnEnable() { Build(); }
    void OnDisable() { Clear(); }

    void Clear()
    {
        breathers.Clear();
        if (root != null)
        {
            if (Application.isPlaying) Destroy(root.gameObject); else DestroyImmediate(root.gameObject);
            root = null;
        }
    }

    void Build()
    {
        Clear();
        glow = MakeRadial(128);
        var addSh = Shader.Find("StarGuardian/GlowAdditive");
        mat = new Material(addSh != null ? addSh : Shader.Find("Sprites/Default"));
        SetupCameraAndBloom();

        root = new GameObject("~GlowRoot").transform;
        root.gameObject.hideFlags = HideFlags.DontSave;
        root.SetParent(transform, false);

        foreach (var band in Bands)
        {
            Vector2 a = Nodes[band[0]], c = Nodes[band[1]];
            const int steps = 46;
            for (int i = 0; i <= steps; i++)
            {
                float u = (float)i / steps;
                float taper = Mathf.Sin(u * Mathf.PI);
                var sr = AddGlow(Vector2.Lerp(a, c, u), 0.34f + taper * 0.34f, Teal, 0.018f + 0.02f * taper, 0);
                breathers.Add(new Br { t = sr.transform, sr = sr, baseScale = sr.transform.localScale.x, baseAlpha = sr.color.a, phase = (a + c).sqrMagnitude });
            }
        }

        foreach (var n in Nodes)
        {
            AddGlow(n, 2.6f, Teal, 0.18f, 1);
            var mid = AddGlow(n, 1.35f, Teal, 0.28f, 2);
            AddGlow(n, 0.6f, Amber, 0.55f, 3);
            AddGlow(n, 0.2f, Hot, 0.95f, 4);
            breathers.Add(new Br { t = mid.transform, sr = mid, baseScale = 1.35f, baseAlpha = 0.28f, phase = n.x + n.y });

            var lgo = new GameObject("L2D");
            lgo.transform.SetParent(root, false);
            lgo.transform.localPosition = n;
            var l = lgo.AddComponent<Light2D>();
            l.lightType = Light2D.LightType.Point;
            l.color = Amber;
            l.intensity = 1.3f;
            l.pointLightInnerRadius = 0.25f;
            l.pointLightOuterRadius = 2.8f;
        }
    }

    SpriteRenderer AddGlow(Vector2 pos, float scale, Color col, float alpha, int order)
    {
        var go = new GameObject("g");
        go.transform.SetParent(root, false);
        go.transform.localPosition = pos;
        go.transform.localScale = Vector3.one * scale;
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = glow;
        sr.sharedMaterial = mat;
        sr.color = new Color(col.r, col.g, col.b, alpha);
        sr.sortingOrder = order;
        return sr;
    }

    void Update()
    {
        float t = Time.realtimeSinceStartup;
        for (int i = 0; i < breathers.Count; i++)
        {
            var b = breathers[i];
            if (b.sr == null) continue;
            float bp = 0.5f + 0.5f * Mathf.Sin(t * 1.15f + b.phase);
            float s = b.baseScale * (0.82f + 0.32f * bp);
            b.t.localScale = new Vector3(s, s, 1f);
            var c = b.sr.color; c.a = b.baseAlpha * (0.5f + 0.5f * bp); b.sr.color = c;
        }
    }

    void SetupCameraAndBloom()
    {
        var cam = Camera.main;
        if (cam == null)
        {
            var cgo = new GameObject("Main Camera") { tag = "MainCamera" };
            cam = cgo.AddComponent<Camera>();
        }
        cam.orthographic = true;
        cam.orthographicSize = 5.5f;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.03f, 0.05f, 0.065f);
        cam.transform.position = new Vector3(0f, 0f, -10f);
        var data = cam.GetUniversalAdditionalCameraData();
        if (data != null) data.renderPostProcessing = true;

        var vgo = GameObject.Find("~GlowVolume");
        if (vgo == null) { vgo = new GameObject("~GlowVolume"); vgo.hideFlags = HideFlags.DontSave; }
        var vol = vgo.GetComponent<Volume>();
        if (vol == null) vol = vgo.AddComponent<Volume>();
        vol.isGlobal = true;
        if (vol.profile == null) vol.profile = ScriptableObject.CreateInstance<VolumeProfile>();
        if (!vol.profile.TryGet(out Bloom bloom)) bloom = vol.profile.Add<Bloom>(true);
        bloom.active = true;
        bloom.intensity.Override(1.5f);
        bloom.threshold.Override(0.5f);
        bloom.scatter.Override(0.72f);
    }

    Sprite MakeRadial(int size)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
        float r = size * 0.5f;
        var px = new Color[size * size];
        for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Mathf.Clamp01(Vector2.Distance(new Vector2(x, y), new Vector2(r, r)) / r);
                float a = 1f - d; a *= a;
                px[y * size + x] = new Color(1f, 1f, 1f, a);
            }
        tex.SetPixels(px);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
    }
}
