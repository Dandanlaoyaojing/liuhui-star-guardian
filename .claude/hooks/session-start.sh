#!/bin/bash
# Session start: show project progress context

echo "🚀 流辉美慧号：星图守护者 — 项目状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Git context
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log -1 --format="%h %s" 2>/dev/null || echo "no commits")
echo "📌 Branch: $BRANCH"
echo "📝 Last commit: $LAST_COMMIT"

# Puzzle design docs status
echo ""
echo "📋 谜题设计文档进度 (M01-M10):"
for i in $(seq -w 1 10); do
    PUZZLE="M${i}"
    DOC=$(find docs/design -name "*${PUZZLE}*" -o -name "*m${i}*" 2>/dev/null | head -1)
    CONFIG=$(find resources/configs -name "puzzle_${PUZZLE}*.json" -o -name "puzzle_m${i}*.json" 2>/dev/null | head -1)
    SCRIPT=$(find scripts/levels -name "*${PUZZLE}*" -o -name "*m${i}*" 2>/dev/null | head -1)

    STATUS=""
    [ -n "$DOC" ] && STATUS="${STATUS}📄" || STATUS="${STATUS}  "
    [ -n "$CONFIG" ] && STATUS="${STATUS}⚙️" || STATUS="${STATUS}  "
    [ -n "$SCRIPT" ] && STATUS="${STATUS}💻" || STATUS="${STATUS}  "

    echo "  $PUZZLE: $STATUS"
done
echo "  Legend: 📄=设计文档  ⚙️=JSON配置  💻=代码"

# TODO/FIXME scan
echo ""
TODOS=$(grep -r "TODO\|FIXME\|HACK\|XXX" scripts/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODOS" != "0" ]; then
    echo "⚠️  $TODOS 个 TODO/FIXME 待处理"
fi

# Uncommitted changes
CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGES" != "0" ]; then
    echo "📂 $CHANGES 个未提交的变更"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
