// 莱米帧动画播放器 —— Cocos 时代已抽好/扣好/归一化的 512² 序列帧, 这里只按动作名加载 + 按 fps 播。
// 帧命名 {action}-NN.png(idle/walk/headbutt/reach/…), Ordinal 排序即播放序。显示尺寸 180px(Cocos 同),
// 中心锚(节点中心 = LEMMY_Y), facing 用 scaleX 镜像。不重做任何美术处理。
#nullable enable

using System.Collections.Generic;
using UnityEngine;

public sealed class M01LemmyAnimator : MonoBehaviour
{
    private const float Ppu = 100f;
    private const float DisplayPx = 180f;          // Cocos LEMMY_DISPLAY
    private const float SourcePx = 512f;           // 归一化后每帧画布
    private const float BaseScale = DisplayPx / SourcePx; // 512²→180px

    private SpriteRenderer sr = null!;
    private readonly Dictionary<string, Sprite[]> clips = new();
    private Sprite[] cur = System.Array.Empty<Sprite>();
    private int frame;
    private float timer;
    private float fps = 24f;
    private bool loop = true;
    private bool facingRight = true;

    /// <summary>非循环动作是否播完(循环恒 false)。</summary>
    public bool Done { get; private set; }

    private void Awake()
    {
        sr = gameObject.AddComponent<SpriteRenderer>();
        sr.sortingOrder = 40; // 莱米在盘面(<40)之上、篮子(20)之上
        ApplyScale();
    }

    private Sprite[] Load(string action)
    {
        if (!clips.TryGetValue(action, out var arr))
        {
            arr = Resources.LoadAll<Sprite>("Art/M01/lemmy/" + action);
            System.Array.Sort(arr, (a, b) => string.CompareOrdinal(a.name, b.name));
            clips[action] = arr;
        }
        return arr;
    }

    /// <summary>播放某动作序列。loop=false 播完停在末帧并置 Done。</summary>
    public void Play(string action, bool loop, float fps)
    {
        var arr = Load(action);
        if (arr.Length == 0) return;
        cur = arr;
        this.loop = loop;
        this.fps = fps;
        frame = 0;
        timer = 0;
        Done = false;
        sr.sprite = cur[0];
    }

    public void SetFacing(bool right)
    {
        facingRight = right;
        ApplyScale();
    }

    private void ApplyScale()
    {
        transform.localScale = new Vector3(facingRight ? BaseScale : -BaseScale, BaseScale, 1f);
    }

    /// <summary>把莱米中心放到 Cocos 坐标(节点中心锚, 帧内脚位已归一化)。</summary>
    public void SetCocosPosition(float cocosX, float cocosY)
    {
        transform.localPosition = new Vector3(cocosX / Ppu, cocosY / Ppu, 0f);
    }

    private void Update()
    {
        if (cur.Length == 0 || (Done && !loop)) return;
        timer += Time.deltaTime;
        var step = 1f / fps;
        while (timer >= step)
        {
            timer -= step;
            frame++;
            if (frame >= cur.Length)
            {
                if (loop) frame = 0;
                else { frame = cur.Length - 1; Done = true; break; }
            }
        }
        sr.sprite = cur[frame];
    }
}
