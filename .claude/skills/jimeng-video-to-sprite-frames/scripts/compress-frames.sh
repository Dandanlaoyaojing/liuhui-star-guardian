#!/usr/bin/env bash
# 按显示尺寸压缩运行时精灵帧(缩尺寸 + pngquant),降显存/包体。
# 用法: compress-frames.sh <帧目录> <动作名> [目标尺寸=384]
# 例:   compress-frames.sh assets/resources/art/characters/lemmy/walk walk 384
#
# 原则: 游戏角色显示尺寸的 1.4-2 倍即可(如显示180 → 帧256-384)。
#       512² 对 180 显示是 2.8 倍,纯浪费显存。
# 安全前提: 高清源视频已归档,压小运行时帧后要高清可从源视频重抽。
set -euo pipefail
DIR="${1:?帧目录}"; ACTION="${2:?动作名}"; SIZE="${3:-384}"
export PATH="$HOME/.local/bin:$PATH"

command -v pngquant >/dev/null || { echo "需要 pngquant: brew install pngquant"; exit 1; }

before=$(du -sk "$DIR" | cut -f1)
n=0
for f in "$DIR"/${ACTION}-*.png; do
  [ -f "$f" ] || continue
  python3 -c "from PIL import Image; im=Image.open('$f'); im.resize(($SIZE,$SIZE),Image.LANCZOS).save('$f')"
  pngquant --quality=72-94 --force --output "$f" "$f"
  n=$((n+1))
done
after=$(du -sk "$DIR" | cut -f1)
echo "压缩 $n 帧 -> ${SIZE}² + pngquant"
echo "体积: ${before}KB -> ${after}KB (降 $((100-after*100/before))%)"

# 自检: 四角透明 + 身高(循环动作应近似一致,弧线动作应有起伏)
python3 -c "
from PIL import Image; from pathlib import Path
fs=sorted(Path('$DIR').glob('$ACTION-*.png'))
im=Image.open(fs[0]).convert('RGBA');w,h=im.size;px=im.load()
print('尺寸',im.size,'四角alpha',[px[0,0][3],px[w-1,0][3],px[0,h-1][3],px[w-1,h-1][3]])
hs=[]
for p in fs:
    im=Image.open(p).convert('RGBA');w,h=im.size;px=im.load();mny=h;myy=0
    for y in range(h):
        for x in range(0,w,2):
            if px[x,y][3]>40: mny=min(mny,y);myy=max(myy,y)
    hs.append(myy-mny)
print('身高范围',min(hs),'~',max(hs),'(循环动作应≈一致;弧线动作应有起伏)')
"
