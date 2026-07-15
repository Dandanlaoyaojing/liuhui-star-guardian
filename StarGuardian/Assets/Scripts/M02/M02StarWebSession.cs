// M02《点亮你温暖我》会话层 —— 纯逻辑(无 UnityEngine), 从 assets/scripts/cocos/M02StarWebSession.ts 逐字迁移, 规则不变.
// 管三件 domain 之上的东西: 电量(charges)、三板推进、每颗星的呈现态 + 胜负。
// 引擎胶水层(视图组件)只读 View、把 tap 转给 TapNode(), 不自己算规则。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Core;

namespace StarGuardian.M02
{
    /// <summary>单颗星的呈现态: 暗 / 衰减中(亮但支撑不足) / 冻结(亮且亮邻居达标)
    /// —— TS `type StarNodeStatus` 字符串联合(沿用 M01 惯例落成 const string, 不建 enum, 测试断言依赖字面值)</summary>
    public static class StarNodeStatus
    {
        public const string Dark = "dark";
        public const string Decaying = "decaying";
        public const string Frozen = "frozen";
    }

    /// <summary>一板的状态: 进行中 / 已全锁胜利 / 电量耗尽未胜 —— TS `type BoardStatus` 字符串联合</summary>
    public static class BoardStatus
    {
        public const string Playing = "playing";
        public const string Won = "won";
        public const string Exhausted = "exhausted";
    }

    /// <summary>TapResult.Reason 的取值 —— TS reason?: "not_playing" | "unknown_node"</summary>
    public static class TapRejectReason
    {
        public const string NotPlaying = "not_playing";
        public const string UnknownNode = "unknown_node";
    }

    public sealed class StarNodeView
    {
        public string Id { get; init; } = "";
        public double X { get; init; }
        public double Y { get; init; }
        /// <summary>TS number; 恒为整数拍(来源 StarNetworkModel.LifeOf, int) → int</summary>
        public int Life { get; init; }
        public bool Lit { get; init; }
        public string Status { get; init; } = StarNodeStatus.Dark;
    }

    public sealed class StarWebView
    {
        public string BoardId { get; init; } = "";
        public int BoardIndex { get; init; }
        public int BoardCount { get; init; }
        public IReadOnlyList<StarNodeView> Nodes { get; init; } = Array.Empty<StarNodeView>();
        /// <summary>TS ReadonlyArray&lt;readonly [string, string]&gt; —— 与 TS 同为透传 board.Layout.Edges 的共享引用(协变只读视图)</summary>
        public IReadOnlyList<IReadOnlyList<string>> Edges { get; init; } = Array.Empty<IReadOnlyList<string>>();
        public int ChargesTotal { get; init; }
        public int ChargesLeft { get; init; }
        public string Status { get; init; } = BoardStatus.Playing;
    }

    public sealed class TapResult
    {
        public bool Accepted { get; init; }
        /// <summary>TS reason?: 缺省(undefined)落成 null; 取值见 TapRejectReason</summary>
        public string? Reason { get; init; }
    }

    public sealed class StarWebSession
    {
        private readonly List<StarBoard> boards;
        private readonly StarNetworkRules rules;
        private int boardIndex = 0;
        private StarNetworkModel model;
        private int chargesUsed = 0;
        private string status = BoardStatus.Playing;
        private readonly HashSet<string> wonBoardIds = new();

        public StarWebSession(StarWebConfig config)
        {
            if (config.Boards.Count == 0)
            {
                // TS 行 49: throw new Error(...) —— 本仓惯例落成 InvalidOperationException, 文案逐字
                throw new InvalidOperationException("StarWebSession requires at least one board");
            }
            boards = config.Boards; // TS 行 51: 共享引用, 不拷贝
            rules = config.Mechanic; // TS 行 52: mechanic 结构化直传 → C# 隐式转换 StarWebMechanic→StarNetworkRules
            model = BuildModel(0);
        }

        /// <summary>点一颗星 = 花一点电量走一拍。未知星不消耗电量、不推进；非进行中拒绝。</summary>
        public TapResult TapNode(string id)
        {
            if (status != BoardStatus.Playing)
            {
                return new TapResult { Accepted = false, Reason = TapRejectReason.NotPlaying };
            }
            if (!model.Step(id))
            {
                return new TapResult { Accepted = false, Reason = TapRejectReason.UnknownNode };
            }
            chargesUsed += 1;
            if (model.IsWon())
            {
                status = BoardStatus.Won;
                wonBoardIds.Add(Board.Id);
            }
            else if (chargesUsed >= Board.Charges)
            {
                status = BoardStatus.Exhausted;
            }
            return new TapResult { Accepted = true };
        }

        /// <summary>三板都曾被打通才算整关完成；不信任 NextBoard() 调用顺序。</summary>
        public bool IsLevelComplete()
        {
            return boards.All(board => wonBoardIds.Contains(board.Id)); // TS 行 72: .every
        }

        /// <summary>重来本板(电量、状态、星网清零)</summary>
        public void ResetBoard()
        {
            model.Reset();
            chargesUsed = 0;
            status = BoardStatus.Playing;
            wonBoardIds.Remove(Board.Id); // TS 行 80: Set.delete
        }

        /// <summary>进入下一板; 已是最后一板返回 false</summary>
        public bool NextBoard()
        {
            if (boardIndex >= boards.Count - 1) return false;
            boardIndex += 1;
            model = BuildModel(boardIndex);
            chargesUsed = 0;
            status = BoardStatus.Playing;
            return true;
        }

        public StarWebView View
        {
            get
            {
                var board = Board;
                // TS 行 95-101: board.layout.nodes.map(...)
                var nodes = board.Layout.Nodes.Select(node =>
                {
                    var life = model.LifeOf(node.Id);
                    var lit = life > 0;
                    var frozen = lit && model.LitNeighborCount(node.Id) >= rules.FreezeThreshold;
                    var nodeStatus = !lit ? StarNodeStatus.Dark : frozen ? StarNodeStatus.Frozen : StarNodeStatus.Decaying;
                    return new StarNodeView { Id = node.Id, X = node.X, Y = node.Y, Life = life, Lit = lit, Status = nodeStatus };
                }).ToList();
                return new StarWebView
                {
                    BoardId = board.Id,
                    BoardIndex = boardIndex,
                    BoardCount = boards.Count,
                    Nodes = nodes,
                    Edges = board.Layout.Edges,
                    ChargesTotal = board.Charges,
                    ChargesLeft = Math.Max(0, board.Charges - chargesUsed), // TS 行 109: Math.max(0, ...)
                    Status = status
                };
            }
        }

        private StarBoard Board => boards[boardIndex];

        private StarNetworkModel BuildModel(int index)
        {
            // TS 行 119: boardGraph(this.boards[index]) → C# StarWebConfigValidator.BoardGraphOf
            return new StarNetworkModel(StarWebConfigValidator.BoardGraphOf(boards[index]), rules);
        }
    }
}
