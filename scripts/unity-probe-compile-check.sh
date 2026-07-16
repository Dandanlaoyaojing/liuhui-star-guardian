#!/usr/bin/env bash
# Unity 运行时代码(GlowProbe/Editor + Scripts)的编译门禁。
#
# 为什么需要它: unity-tests/Core.Tests 只编译 Scripts/(引擎无关纯逻辑), GlowProbe/ 下约 1900 行
# UnityEngine/URP/InputSystem 代码【完全不进 dotnet test】。CI 也只跑 Node 检查。于是探针的编译错
# 只能靠人肉开 Unity 才发现 —— 这正是 CLAUDE.md 警告的 "dotnet 绿≠Unity 编得过" 的缺口来源。
# (2026-07-16 零框架 codex 审查独立发现; 同期真实案例: M02StarWebProbe 的 glowColor 变量名错
#  在 dotnet 440/440 全绿下漏过, 靠打开 Unity console 才逮到。)
#
# 做法: 直接编译 Unity 自己生成的 Assembly-CSharp.csproj —— 它天然含全部源文件与正确的
# UnityEngine/URP/InputSystem 引用, 比手拼 DLL 引用更忠实, 且随 Unity 侧改动自动同步。
#
# 前提: 本机装有 Unity 且该工程至少被 Unity 打开过一次(csproj 由编辑器生成)。
#       CI 无 Unity → 本脚本按"跳过"退出 0, 不阻塞(Unity 编译验证仍需本地/自托管 runner)。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CSPROJ="$ROOT/StarGuardian/Assembly-CSharp.csproj"

if [[ ! -f "$CSPROJ" ]]; then
  echo "skip: $CSPROJ 不存在(Unity 未生成 → 本机无 Unity 或工程未打开过)。"
  echo "      Unity 侧编译验证本轮跳过; 合并前请在有 Unity 的机器上跑本脚本。"
  exit 0
fi

command -v dotnet >/dev/null 2>&1 || { echo "skip: 未找到 dotnet"; exit 0; }

echo "编译 Unity 运行时程序集(含 GlowProbe 探针)..."
# 只看 error: Unity 工程有既有 nullable/重复 using 警告, 不作为门禁信号。
if out=$(dotnet build "$CSPROJ" -v q --nologo 2>&1); then
  echo "$out" | grep -E '个错误|error' || true
  echo "✅ Unity 运行时代码编译通过(0 error)"
else
  echo "$out" | grep -E 'error CS' | head -20
  echo "❌ Unity 运行时代码编译失败 —— dotnet test 覆盖不到这批代码, 必须修好再提交"
  exit 1
fi
