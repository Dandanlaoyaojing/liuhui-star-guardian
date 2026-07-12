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
    private VideoPlayer? player;
    private GameObject? playerGo;
    private ToolCard? pendingCard;
    private bool playing;

    /// <summary>通关入口: 全屏播母版过场, 播完/点击跳过 → 出结晶卡。幂等(重复调用忽略)。</summary>
    public void PlayCompletion(ToolCard? card)
    {
        if (playing) return;
        var clip = Resources.Load<VideoClip>("Videos/m01-completion-cutscene");
        pendingCard = card;
        if (clip == null)
        {
            Debug.LogWarning("M01CompletionProbe: 母版 VideoClip 未找到, 直接出卡");
            ShowToolCard();
            return;
        }
        playing = true;
        playerGo = new GameObject("~M01CompletionVideo") { hideFlags = HideFlags.DontSave };
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
        Debug.Log($"M01CompletionProbe: ▶ 播放通关过场 {clip.width}×{clip.height} {clip.length:F1}s(点击跳过)");
    }

    private void Update()
    {
        if (!playing) return;
        var mouse = Mouse.current;
        if (mouse != null && mouse.leftButton.wasPressedThisFrame)
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
            return;
        }
        // 探针级出卡: log 完整卡面(正式 ToolCardView 是 UI Canvas 活, 下一波)。
        Debug.Log(
            $"M01CompletionProbe: 🎴 智慧结晶卡 [{card.PuzzleId}] {card.Front.ToolName}\n" +
            $"  场景: {card.Front.Scene}\n" +
            $"  智慧结晶: {card.Front.WisdomCrystal}\n" +
            $"  核心动作: {card.Back.CoreAction}\n" +
            $"  何时使用: {string.Join(" / ", card.Back.WhenToUse)}\n" +
            $"  现实例子: {string.Join(" / ", card.Back.RealLifeExamples)}\n" +
            $"  常见误区: {card.Back.CommonTraps}");
    }
}
