// M01 "捡到式" diegetic intro 的纯相位机 (spec §5.2 交互流程 step 1) —— 引擎无关的纯逻辑, 由 xUnit 钉死正确性.
//
// 2026-06-08 重构: 倒篮从"够篮→轻晃→再点掀翻(脚本抛掷)"改为「莱米顶篮 headbutt」——
// 玩家自由控制莱米走位(点哪走哪、左右镜像), 走到篮子正下方点篮 → 莱米收耳(earsback)→
// 跳起用头顶篮底(headbutt)→ 顶点撞击给篮内拼片真实冲量倒出。不在正下方点篮 = 走到侧边只晃一晃
// (位置判定在 cc 胶水里, 不进纯机, 故"侧边晃"不改相位、仍是 roaming)。
//
// 仍 NOT 自动跑完: roaming 等玩家把莱米走到篮下并点篮; waitingPickup 等玩家点掉落的手电。
// 纯转移表让"不自动跳关"可在无 cc 下被测; cc 胶水(M01IntroSequence)驱动动画/物理并喂事件。
//
// 从 assets/scripts/cocos/M01IntroFlow.ts 迁移, 规则不变.

using System.Collections.Generic;

namespace StarGuardian.M01
{
    public enum M01IntroPhase
    {
        Approaching,        // Lemmy auto-walks in from offscreen and stops on stage
        Roaming,            // 玩家自由控制走位(点哪走哪); 走到篮下点篮才触发顶篮 —— WAITS for the headbutt trigger
        Folding,            // 篮下点篮: 莱米收耳(earsback 一次性)
        Headbutting,        // 收耳完: 跳起用头顶篮底(headbutt 跳跃帧)
        SpillingFragments,  // 顶到篮底: 本次撞出一批拼片(子集)获得向上冲量
        ReadyToHeadbutt,    // 还有拼片在篮里(已在篮下耳后贴待机): WAITS 玩家再点篮 → 再顶一次
        Bonking,            // 手电从篮里掉出砸到莱米(startle)
        WaitingPickup,      // 手电落地 —— WAITS for the player to tap it
        PickingUp,          // 莱米蹲下把手电捡起(crouch)
        Acquired            // 手电到手 → 谜题阶段开始
    }

    public enum M01IntroEvent
    {
        WalkArrived,        // 自动走入到位
        HeadbuttStarted,    // 篮下点篮(cc 判定莱米在篮正下方)→ 开始收耳
        FoldDone,           // earsback 播完 → 起跳
        HeadbuttContact,    // 起跳顶点撞篮底 → 撞出本批拼片
        PiecesRemain,       // 本批撞出后篮里还有片 → 回到可再顶(莱米留篮下耳后贴)
        FragmentsSettled,
        FlashlightBonked,
        FlashlightTapped,
        CrouchDone
    }

    public static class M01IntroFlow
    {
        // roaming/readyToHeadbutt/waitingPickup edges are player-driven, which enforces the mandatory
        // pauses. roaming→folding 只在 cc 判定"莱米在篮正下方点篮"时才喂 headbuttStarted。
        // 可重复顶篮(2026-06-08): 每顶一次撞出一批拼片; spillingFragments 按"是否还有片"分两路 ——
        // 还有→ piecesRemain → readyToHeadbutt(玩家可再点篮再顶, 莱米已在篮下耳后贴, 跳过收耳直接顶);
        // 全出→ fragmentsSettled → bonking(手电掉落叙事)。readyToHeadbutt→headbutting 复用 headbuttStarted。
        private static readonly IReadOnlyDictionary<M01IntroPhase, IReadOnlyDictionary<M01IntroEvent, M01IntroPhase>> Transitions =
            new Dictionary<M01IntroPhase, IReadOnlyDictionary<M01IntroEvent, M01IntroPhase>>
            {
                [M01IntroPhase.Approaching] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.WalkArrived] = M01IntroPhase.Roaming
                },
                [M01IntroPhase.Roaming] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.HeadbuttStarted] = M01IntroPhase.Folding
                },
                [M01IntroPhase.Folding] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.FoldDone] = M01IntroPhase.Headbutting
                },
                [M01IntroPhase.Headbutting] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.HeadbuttContact] = M01IntroPhase.SpillingFragments
                },
                [M01IntroPhase.SpillingFragments] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.PiecesRemain] = M01IntroPhase.ReadyToHeadbutt,
                    [M01IntroEvent.FragmentsSettled] = M01IntroPhase.Bonking
                },
                [M01IntroPhase.ReadyToHeadbutt] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.HeadbuttStarted] = M01IntroPhase.Headbutting
                },
                [M01IntroPhase.Bonking] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.FlashlightBonked] = M01IntroPhase.WaitingPickup
                },
                [M01IntroPhase.WaitingPickup] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.FlashlightTapped] = M01IntroPhase.PickingUp
                },
                [M01IntroPhase.PickingUp] = new Dictionary<M01IntroEvent, M01IntroPhase>
                {
                    [M01IntroEvent.CrouchDone] = M01IntroPhase.Acquired
                },
                [M01IntroPhase.Acquired] = new Dictionary<M01IntroEvent, M01IntroPhase>()
            };

        /// <summary>Pure reducer: returns the next phase, or the same phase if the event doesn't apply.</summary>
        public static M01IntroPhase NextIntroPhase(M01IntroPhase phase, M01IntroEvent introEvent)
        {
            if (Transitions.TryGetValue(phase, out var edges) && edges.TryGetValue(introEvent, out var next))
            {
                return next;
            }
            return phase;
        }
    }
}
