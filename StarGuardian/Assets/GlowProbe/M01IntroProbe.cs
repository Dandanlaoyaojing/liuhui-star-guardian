// M01 开场小剧场探针(最小版, 桶 B: IntroDirector 雏形)——
// 开局: 拼片藏在吊篮里(inactive), 玩家点篮 → 篮倾倒 → 拼片按抛散布逐片弧线倒出到布局位 →
// 手电从篮里掉到地上 → 点手电拾取 → 解锁手电与拖拽, 进入核心谜题。
// 莱米走位/顶篮帧动画 = 下一波(本版"点篮"代替顶篮, 时序/解锁语义与 Cocos v4 对齐)。
#nullable enable

using System.Collections;
using StarGuardian.M01;
using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(M01BoardProbe))]
public sealed class M01IntroProbe : MonoBehaviour
{
    private const float Ppu = 100f;
    // Cocos M01IntroSequence 常量: BASKET_X=300, 篮底 y=-167; 钉偏移 105×scale。
    private const float BasketX = 300f;
    private static readonly float BasketH = (float)M01IntroLayout.BasketDisplaySize.Height; // ≈271
    private static readonly float BasketY = -167f + BasketH / 2f;
    private const float FlashlightGroundY = -240f;

    public bool IntroDone { get; private set; }

    private M01BoardProbe board = null!;
    private M01DragProbe? drag;
    private M01FlashlightProbe? flashlight;
    private GameObject? basketGo;
    private SpriteRenderer? basketSr;
    private GameObject? fallenFlashlight;
    private bool spilling;

    private void Awake()
    {
        board = GetComponent<M01BoardProbe>();
        drag = GetComponent<M01DragProbe>();
        flashlight = GetComponent<M01FlashlightProbe>();
    }

    private void Start()
    {
        if (!Application.isPlaying || board.Layout == null) return;
        // 开场态: 锁拖拽/手电, 拼片入篮(隐藏)。
        if (drag != null) drag.InputLocked = true;
        if (flashlight != null) flashlight.Acquired = false;
        foreach (var go in board.FragmentObjects.Values) go.SetActive(false);

        var root = GameObject.Find("~M01BoardRoot");
        basketGo = new GameObject("~IntroBasket");
        if (root != null) basketGo.transform.SetParent(root.transform, false);
        basketGo.transform.localPosition = new Vector3(BasketX / Ppu, BasketY / Ppu, 0);
        basketSr = basketGo.AddComponent<SpriteRenderer>();
        basketSr.sortingOrder = 20;
        SetBasketSprite("m01-basket-hanging");
        // 钉子(独立贴图, 不画进篮 —— Cocos 老坑)。
        var nail = new GameObject("nail");
        nail.transform.SetParent(basketGo.transform, false);
        nail.transform.localPosition = new Vector3(0, (105f * 1.12f) / Ppu, 0);
        var nailSr = nail.AddComponent<SpriteRenderer>();
        nailSr.sprite = Resources.Load<Sprite>("Art/M01/m01-basket-nail");
        nailSr.sortingOrder = 21;
        if (nailSr.sprite != null)
        {
            var s = (24f / Ppu) / nailSr.sprite.bounds.size.y;
            nail.transform.localScale = new Vector3(s, s, 1f);
        }
        Debug.Log("M01IntroProbe: 开场 —— 点吊篮倒出拼片");
    }

    private void SetBasketSprite(string name)
    {
        if (basketSr == null) return;
        var sprite = Resources.Load<Sprite>("Art/M01/" + name);
        if (sprite == null) return;
        basketSr.sprite = sprite;
        var targetW = (float)M01IntroLayout.BasketDisplaySize.Width / Ppu;
        var s = targetW / sprite.bounds.size.x;
        basketGo!.transform.localScale = new Vector3(s, s, 1f);
    }

    private void Update()
    {
        if (!Application.isPlaying || IntroDone || board.Layout == null) return;
        var mouse = Mouse.current;
        if (mouse == null || !mouse.leftButton.wasPressedThisFrame) return;
        var cocos = ScreenToCocos(mouse.position.ReadValue());

        // 点地上的手电 → 拾取, 开场收尾。
        if (fallenFlashlight != null)
        {
            var fp = fallenFlashlight.transform.localPosition * Ppu;
            if (Vector2.Distance(new Vector2(fp.x, fp.y), cocos) < 60f)
            {
                Destroy(fallenFlashlight);
                fallenFlashlight = null;
                if (flashlight != null) flashlight.Acquired = true;
                if (drag != null) drag.InputLocked = false;
                IntroDone = true;
                Debug.Log("M01IntroProbe: 拾起手电 —— 开场完成, 谜题解锁(F 循环灯色)");
            }
            return;
        }

        // 点吊篮 → 倒片。
        if (!spilling && basketGo != null &&
            Mathf.Abs(cocos.x - BasketX) < (float)M01IntroLayout.BasketDisplaySize.Width / 2f &&
            Mathf.Abs(cocos.y - BasketY) < BasketH / 2f)
        {
            StartCoroutine(SpillRoutine());
        }
    }

    private IEnumerator SpillRoutine()
    {
        spilling = true;
        SetBasketSprite("m01-basket-tipped");
        Debug.Log("M01IntroProbe: 篮子倾倒 —— 拼片撒出");
        var mouthX = BasketX - 30f;
        var mouthY = BasketY - 30f;
        var i = 0;
        foreach (var frag in board.Layout!.Fragments)
        {
            if (!board.FragmentObjects.TryGetValue(frag.ControllerId, out var go)) continue;
            var fling = M01IntroLayout.ResolveSpillFlingVelocity(i);
            StartCoroutine(ArcMove(go, new Vector2(mouthX, mouthY),
                new Vector2((float)frag.Position.X, (float)frag.Position.Y),
                0.55f, (float)fling.Vy / 200f));
            i++;
            yield return new WaitForSeconds(0.08f);
        }
        yield return new WaitForSeconds(0.6f);
        SetBasketSprite("m01-basket-hanging-empty");
        // 手电从篮口掉到地面。
        fallenFlashlight = new GameObject("~FallenFlashlight");
        var sr = fallenFlashlight.AddComponent<SpriteRenderer>();
        sr.sprite = Resources.Load<Sprite>("Art/M01/m01-flashlight-red");
        sr.sortingOrder = 25;
        if (sr.sprite != null)
        {
            var s = (34f / Ppu) / sr.sprite.bounds.size.y;
            fallenFlashlight.transform.localScale = new Vector3(s, s, 1f);
        }
        fallenFlashlight.transform.localRotation = Quaternion.Euler(0, 0, 80f); // 躺平
        StartCoroutine(ArcMove(fallenFlashlight, new Vector2(mouthX, mouthY),
            new Vector2(BasketX - 60f, FlashlightGroundY), 0.5f, 0.4f));
        Debug.Log("M01IntroProbe: 手电掉落 —— 点它拾取");
    }

    /// <summary>简化抛物弧(视觉 tween, 非物理): from→to, 中途向上拱 arcUnits。</summary>
    private static IEnumerator ArcMove(GameObject go, Vector2 fromCocos, Vector2 toCocos, float seconds, float arcUnits)
    {
        go.SetActive(true);
        var t = 0f;
        var from = new Vector3(fromCocos.x / Ppu, fromCocos.y / Ppu, 0);
        var to = new Vector3(toCocos.x / Ppu, toCocos.y / Ppu, 0);
        while (t < seconds)
        {
            if (go == null) yield break;
            t += Time.deltaTime;
            var u = Mathf.Clamp01(t / seconds);
            var pos = Vector3.Lerp(from, to, u);
            pos.y += Mathf.Sin(u * Mathf.PI) * arcUnits;
            go.transform.localPosition = pos;
            yield return null;
        }
        if (go != null) go.transform.localPosition = to;
    }

    private static Vector2 ScreenToCocos(Vector2 screen)
    {
        var cam = Camera.main;
        if (cam == null) return Vector2.zero;
        var w = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, 0));
        return new Vector2(w.x * Ppu, w.y * Ppu);
    }
}
