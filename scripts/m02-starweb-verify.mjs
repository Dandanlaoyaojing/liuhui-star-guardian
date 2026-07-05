// M02《点亮你温暖我》星网关卡校验器 —— 机制规则的参考实现 + 配平守卫。
// 读 assets/resources/configs/stage1/m02-starweb-warmth.json, 对每一板:
//   - BFS 求"最少点亮数", 断言 == 该板 charges (配额是紧的: 少一次无解)
//   - 断言 solution.referenceTaps 确实能全锁
// 将来写 Cocos StarNetwork 组件请照此规则; 改星网/数值后跑 `node scripts/m02-starweb-verify.mjs` 复验.
//
// 规则: 点一颗星=该星+全部直连邻居满命(lifeMax); 每拍全体同时衰减:
//   亮邻居数 >= freezeThreshold 则冻结(不掉命), 否则 -1, 归0熄灭.
//   胜利 = 所有星都亮 且 每颗亮邻居 >= freezeThreshold (整网自稳锁死).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const CONFIG = join(dirname(fileURLToPath(import.meta.url)),
  '../assets/resources/configs/stage1/m02-starweb-warmth.json');

function adjacencyOf(board) {
  const adj = {};
  for (const n of board.layout.nodes) adj[n.id] = [];
  for (const [a, b] of board.layout.edges) { adj[a].push(b); adj[b].push(a); }
  return adj;
}

// BFS: 最短必胜点击序列(只考虑"点击", 跳过只会衰减不会带来新胜利)
function solve(adj, { lifeMax, freezeThreshold: F }, maxLen) {
  const N = Object.keys(adj);
  const litN = (s, n) => adj[n].filter(m => s[m] > 0).length;
  const tap = (s, n) => { const t = { ...s }; t[n] = lifeMax; for (const m of adj[n]) t[m] = lifeMax; return t; };
  const decay = (s) => { const t = { ...s }; for (const n of N) if (s[n] > 0 && litN(s, n) < F) t[n] = s[n] - 1; return t; };
  const won = (s) => N.every(n => s[n] > 0) && N.every(n => litN(s, n) >= F);
  const start = {}; for (const n of N) start[n] = 0;
  let frontier = [{ s: start, seq: [] }];
  for (let d = 1; d <= maxLen; d++) {
    const next = [];
    for (const { s, seq } of frontier) for (const n of N) {
      const s2 = decay(tap(s, n)), seq2 = [...seq, n];
      if (won(s2)) return { min: d, seq: seq2 };
      next.push({ s: s2, seq: seq2 });
    }
    frontier = next;
  }
  return { min: null, seq: null };
}

function runSeq(adj, { lifeMax, freezeThreshold: F }, seq) {
  const N = Object.keys(adj);
  const litN = (s, n) => adj[n].filter(m => s[m] > 0).length;
  const tap = (s, n) => { const t = { ...s }; t[n] = lifeMax; for (const m of adj[n]) t[m] = lifeMax; return t; };
  const decay = (s) => { const t = { ...s }; for (const n of N) if (s[n] > 0 && litN(s, n) < F) t[n] = s[n] - 1; return t; };
  const won = (s) => N.every(n => s[n] > 0) && N.every(n => litN(s, n) >= F);
  let s = {}; for (const n of N) s[n] = 0;
  for (const n of seq) s = decay(tap(s, n));
  return won(s);
}

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
let failures = 0;
console.log(`校验 ${cfg.id} 《${cfg.name}》 — ${cfg.boards.length} 板  (lifeMax=${cfg.mechanic.lifeMax}, freeze=${cfg.mechanic.freezeThreshold})`);
for (const b of cfg.boards) {
  const adj = adjacencyOf(b);
  const { min } = solve(adj, cfg.mechanic, b.charges + 1); // 搜到 charges+1 以便判"是否本可更少"
  const tight = min === b.charges;
  const refWins = runSeq(adj, cfg.mechanic, b.solution.referenceTaps);
  const ok = tight && refWins;
  if (!ok) failures++;
  console.log(
    `  ${b.id.padEnd(9)} ${String(b.layout.nodes.length).padStart(2)}星  配额${b.charges}  ` +
    `最少解=${min ?? '无'}  紧配额:${tight ? '✅' : `❌(实际${min})`}  ` +
    `参考解[${b.solution.referenceTaps.join(',')}]:${refWins ? '✅' : '❌'}`
  );
}
if (failures) { console.error(`\n${failures} 板未通过 —— 数值或星网需重调`); process.exit(1); }
console.log('\n全部通过: 每板配额均紧, 参考解均全锁 ✅');
