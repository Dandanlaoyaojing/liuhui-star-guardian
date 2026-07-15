// M01 通关演出探针(桶 B: CompletionDirector 雏形)—— Unity VideoPlayer 直接播 iOS 同款母版 mp4。
// 这是 Cocos 桌面"FFmpeg 原生解码器立项"整个作废的时刻: 桌面视频洞在 Unity 不存在,
// VideoPlayer 全平台原生(Win/Mac=平台解码器), 流式、内存省、1920×1280 HD。
// 流程: 通关(validate.Completed) → 全屏播过场(点击跳过) → 播完/跳过 → 打出智慧结晶卡(探针=log+染色)。
#nullable enable

using StarGuardian.Core;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Video;

public sealed class M01CompletionProbe : MonoBehaviour
{
    // Cocos 当前源真值：HIDE_SCREEN_TEXT=true，结算后不渲染文字卡面，只保留逻辑解锁数据。
    private static readonly bool HideScreenText = true;
    private VideoPlayer? player;
    private GameObject? playerGo;
    private ToolCard? pendingCard;
    private bool playing;
    private GameObject? cardGo;
    private Font? cardFont;
    private bool healed;
    private float playStartRealtime;

    private void SetGameplayInputLocked(bool locked)
    {
        var drag = GetComponent<M01DragProbe>();
        if (drag != null) drag.InputLocked = locked;
        var flashlight = GetComponent<M01FlashlightProbe>();
        if (flashlight != null) flashlight.InputLocked = locked;
    }

    /// <summary>通关入口: 全屏播母版过场, 播完/点击跳过 → 出结晶卡。幂等(重复调用忽略)。</summary>
    public void PlayCompletion(ToolCard? card)
    {
        if (playing || cardGo != null) return; // 幂等: 演出中或卡面未收都不重入(防旧卡孤儿罩屏, 审查 CONFIRMED)
        SetGameplayInputLocked(true); // 演出期间锁拖拽/手电(防跳过点击穿透拆散完成态盘面, 审查 CONFIRMED)
        pendingCard = card;
        playing = true;
        var intro = GetComponent<M01IntroProbe>();
        if (intro != null)
        {
            intro.PlayCelebrationThenIdle(StartVideo);
        }
        else
        {
            StartVideo();
        }
    }

    private void StartVideo()
    {
        if (!playing) return;
        var clip = Resources.Load<VideoClip>("Videos/m01-completion-cutscene");
        if (clip == null)
        {
            Debug.LogWarning("M01CompletionProbe: 母版 VideoClip 未找到, 直接出卡");
            playing = false;
            ShowToolCard();
            return;
        }
        playerGo = new GameObject("~M01CompletionVideo");
        player = playerGo.AddComponent<VideoPlayer>();
        player.clip = clip;
        player.renderMode = VideoRenderMode.CameraNearPlane; // 全屏叠相机近平面, 天然盖住盘面
        player.targetCamera = Camera.main;
        player.targetCameraAlpha = 1f;
        player.aspectRatio = VideoAspectRatio.FitInside;      // 1920×1280 适配窗口留黑边, 不裁切
        player.isLooping = false;
        player.loopPointReached += _ => EndCutscene();
        player.errorReceived += (_, msg) => { Debug.LogWarning($"M01CompletionProbe: video error {msg}"); EndCutscene(); };
        player.Play();
        playStartRealtime = Time.realtimeSinceStartup;
        Debug.Log($"M01CompletionProbe: ▶ 播放通关过场 {clip.width}×{clip.height} {clip.length:F1}s(点击跳过)");
    }

    private void Update()
    {
        // 卡面展示中: 文字材质自愈(动态字体图集材质首帧可能未就绪 → 品红字形网格)+ 点击收卡。
        if (cardGo != null)
        {
            if (!healed && cardFont != null && cardFont.material != null)
            {
                healed = true; // 自愈一次即停(每帧 GetComponentsInChildren 是无上界 GC 分配, 审查点名)
                foreach (var mr in cardGo.GetComponentsInChildren<MeshRenderer>())
                {
                    if (mr.sharedMaterial == null) mr.sharedMaterial = cardFont.material;
                }
            }
            var m = Pointer.current;
            if (m != null && m.press.wasPressedThisFrame)
            {
                Destroy(cardGo);
                cardGo = null;
                healed = false;
                SetGameplayInputLocked(false); // 收卡才解锁玩法输入
                Debug.Log("M01CompletionProbe: 收卡");
            }
            return;
        }
        if (!playing) return;
        if (player == null) return; // celebrate 窗口还没有视频叠层，点击不应提前跳过庆祝。
        var mouse = Pointer.current;
        if (mouse != null && mouse.press.wasPressedThisFrame)
        {
            Debug.Log("M01CompletionProbe: 点击跳过过场");
            EndCutscene();
            return;
        }
        // 看门狗(Cocos 同款教训的最小版): loopPointReached 可能不触发(实测停在 333/343 帧,
        // isPlaying=false 而回调未来)。播放已开始(time>0.5 滤掉起播缓冲)且不再播/逼近片尾 → 收尾。
        if (player != null && player.time > 0.5 &&
            (!player.isPlaying || player.time >= player.length - 0.05))
        {
            Debug.Log("M01CompletionProbe: 片尾看门狗收尾(loopPointReached 未触发)");
            EndCutscene();
            return;
        }
        // 起播超时兜底(Cocos"入口看门狗覆盖加载阶段"同款): prepare 卡死(t 恒 0, 实测偶发)时
        // 原看门狗 time>0.5 前置永不满足 → 黑屏卡死。起播 4s 仍没走时间 → 放弃视频直接出卡。
        if (player != null && player.time < 0.1 && Time.realtimeSinceStartup - playStartRealtime > 4f)
        {
            Debug.LogWarning("M01CompletionProbe: 视频起播超时(prepare 卡死), 跳过过场直接出卡");
            EndCutscene();
        }
    }

    private void EndCutscene()
    {
        if (!playing && playerGo == null) return; // 幂等(loopPointReached 与点击可能双触发)
        playing = false;
        if (player != null) player.Stop();
        if (playerGo != null) Destroy(playerGo);
        player = null;
        playerGo = null;
        ShowToolCard();
    }

    private void ShowToolCard()
    {
        var card = pendingCard;
        pendingCard = null;
        if (card == null)
        {
            Debug.Log("M01CompletionProbe: (无 ToolCard 数据)");
            SetGameplayInputLocked(false);
            return;
        }
        Debug.Log($"M01CompletionProbe: 🎴 智慧结晶卡 [{card.PuzzleId}] {card.Front.ToolName}");
        if (HideScreenText)
        {
            // 与 Cocos renderToolCardPreview 的早返回一致；解锁已由 session/controller 完成。
            SetGameplayInputLocked(false);
            return;
        }

        // 世界空间卡面(米白圆卡 + 中文动态系统字体 TextMesh, 零字体资产; 点击任意处收卡)。
        cardGo = new GameObject("~M01ToolCard");

        // 暗罩(全屏)
        var dim = MakeQuad(cardGo.transform, "dim", new Vector2(0, 0), new Vector2(9.6f, 6.4f), new Color(0.08f, 0.09f, 0.11f, 0.72f), 90);
        // 卡身(竖版)
        MakeQuad(cardGo.transform, "cardBg", new Vector2(0, 0), new Vector2(3.4f, 4.6f), new Color(0.95f, 0.93f, 0.88f), 91);
        MakeQuad(cardGo.transform, "cardEdge", new Vector2(0, 0), new Vector2(3.5f, 4.7f), new Color(0.30f, 0.32f, 0.35f), 90);

        var font = Font.CreateDynamicFontFromOSFont("PingFang SC", 48);
        cardFont = font;
        // 预请求本卡全部字符, 催生字体图集/材质(否则首帧 font.material 可能为 null)。
        font?.RequestCharactersInTexture(card.Front.ToolName + card.Front.WisdomCrystal + card.Back.CoreAction +
            string.Join("", card.Back.WhenToUse) + card.Back.CommonTraps + "「」核心动作何时使用常见误区·;", 48);
        font?.RequestCharactersInTexture(card.Front.ToolName, 48, FontStyle.Bold); // 标题 Bold 字形单独预烘(防首帧图集 rebuild)
        MakeText(cardGo.transform, "title", card.Front.ToolName, new Vector2(0, 1.8f), 0.085f, new Color(0.22f, 0.24f, 0.27f), font, 92, FontStyle.Bold);
        MakeText(cardGo.transform, "crystal", Wrap($"「{card.Front.WisdomCrystal}」", 13), new Vector2(0, 1.2f), 0.05f, new Color(0.42f, 0.36f, 0.5f), font, 92, FontStyle.Normal);
        MakeText(cardGo.transform, "core", Wrap($"核心动作 · {card.Back.CoreAction}", 16), new Vector2(0, 0.35f), 0.042f, new Color(0.28f, 0.3f, 0.33f), font, 92, FontStyle.Normal);
        MakeText(cardGo.transform, "when", Wrap($"何时使用 · {string.Join(";", card.Back.WhenToUse)}", 18), new Vector2(0, -0.65f), 0.036f, new Color(0.35f, 0.37f, 0.4f), font, 92, FontStyle.Normal);
        MakeText(cardGo.transform, "traps", Wrap($"常见误区 · {card.Back.CommonTraps}", 18), new Vector2(0, -1.65f), 0.036f, new Color(0.5f, 0.4f, 0.36f), font, 92, FontStyle.Normal);
    }

    private static Material? uiQuadMaterial;

    private static GameObject MakeQuad(Transform parent, string name, Vector2 pos, Vector2 size, Color color, int order)
    {
        // URP 2D 渲染器不认内置 Sprites-Default(品红)→ 显式 URP 2D Unlit(卡面 UI 不受光)。
        if (uiQuadMaterial == null)
        {
            var sh = Shader.Find("Universal Render Pipeline/2D/Sprite-Unlit-Default");
            uiQuadMaterial = sh != null ? new Material(sh) { hideFlags = HideFlags.DontSave } : null;
        }
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.transform.localPosition = new Vector3(pos.x, pos.y, 0);
        var sr = go.AddComponent<SpriteRenderer>();
        var tex = Texture2D.whiteTexture;
        sr.sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), tex.width);
        if (uiQuadMaterial != null) sr.sharedMaterial = uiQuadMaterial;
        sr.color = color;
        sr.sortingOrder = order;
        go.transform.localScale = new Vector3(size.x, size.y, 1f);
        return go;
    }

    private static void MakeText(Transform parent, string name, string text, Vector2 pos, float size, Color color, Font? font, int order, FontStyle style)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.transform.localPosition = new Vector3(pos.x, pos.y, 0);
        var tm = go.AddComponent<TextMesh>();
        tm.text = text;
        tm.characterSize = size;
        tm.fontSize = 48;
        tm.fontStyle = style;
        tm.anchor = TextAnchor.MiddleCenter;
        tm.alignment = TextAlignment.Center;
        tm.color = color;
        if (font != null && font.material != null)
        {
            tm.font = font;
            go.GetComponent<MeshRenderer>().sharedMaterial = font.material; // 动态字体图集材质(GUI/Text Shader), 缺它=品红字形网格
        }
        go.GetComponent<MeshRenderer>().sortingOrder = order;
    }

    // TextMesh 无自动换行 → 按字数手动断(中文场景按字符数够用)。
    private static string Wrap(string text, int perLine)
    {
        var sb = new System.Text.StringBuilder();
        var count = 0;
        foreach (var ch in text)
        {
            sb.Append(ch);
            count++;
            if (count >= perLine && ch != '\n')
            {
                sb.Append('\n');
                count = 0;
            }
        }
        return sb.ToString();
    }
}
