import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import {
  evaluateHexPushMove,
  HEX_PUSH_CELLS,
  HEX_PUSH_DIRS,
  hexKey,
  validateLineSelection,
  type EvaluatedHexPushMove,
  type HexPushClientState,
  type HexPushCoord,
} from '../../games/hexPush';

interface HexPushBoardProps {
  state: HexPushClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const SQRT3 = Math.sqrt(3);

// 6方向ボタン表示メタデータ（通常視点: P0=白が下、P1=黒が上）
// dirIndex: 0:(1,0)右, 1:(-1,0)左, 2:(0,1)右下, 3:(0,-1)左上, 4:(1,-1)右上, 5:(-1,1)左下
const DIR_BUTTON_LAYOUT_NORMAL = [
  { dirIndex: 3, label: '左上', Icon: ArrowUpLeft },
  { dirIndex: 4, label: '右上', Icon: ArrowUpRight },
  { dirIndex: 1, label: '左', Icon: ArrowLeft },
  { dirIndex: 0, label: '右', Icon: ArrowRight },
  { dirIndex: 5, label: '左下', Icon: ArrowDownLeft },
  { dirIndex: 2, label: '右下', Icon: ArrowDownRight },
] as const;

// 180度反転視点（オンラインで自分が黒=P1のとき）
const DIR_BUTTON_LAYOUT_FLIPPED = [
  { dirIndex: 2, label: '左上', Icon: ArrowUpLeft },
  { dirIndex: 5, label: '右上', Icon: ArrowUpRight },
  { dirIndex: 0, label: '左', Icon: ArrowLeft },
  { dirIndex: 1, label: '右', Icon: ArrowRight },
  { dirIndex: 4, label: '左下', Icon: ArrowDownLeft },
  { dirIndex: 3, label: '右下', Icon: ArrowDownRight },
] as const;

function hexPolygonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function flatHexOutlinePoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export const HexPushBoard: React.FC<HexPushBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [selected, setSelected] = useState<HexPushCoord[]>([]);

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const myPlayer = state.players.find((p) => p.id === state.myId);
  const isFlipped = !isLocalPassAndPlay && myPlayer?.color === 2;
  const winner = state.players.find((p) => p.id === state.winnerId);

  // ターンや手数が進んだら選択解除
  useEffect(() => {
    setSelected([]);
  }, [state.turnIndex, state.moveCount, state.phase]);

  const selectedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of selected) set.add(hexKey(m.q, m.r));
    return set;
  }, [selected]);

  const lastMovedKeys = useMemo(() => {
    const set = new Set<string>();
    if (state.lastMove) {
      for (const c of state.lastMove.movedTo) set.add(hexKey(c.q, c.r));
    }
    return set;
  }, [state.lastMove]);

  const lastPushedKeys = useMemo(() => {
    const set = new Set<string>();
    if (state.lastMove) {
      for (const c of state.lastMove.pushedTo) set.add(hexKey(c.q, c.r));
    }
    return set;
  }, [state.lastMove]);

  // 選択中の玉群について、6方向それぞれの移動可否を評価
  const dirEvaluations = useMemo(() => {
    const map = new Map<number, EvaluatedHexPushMove>();
    if (!isMyTurn || selected.length === 0) return map;
    for (let d = 0; d < HEX_PUSH_DIRS.length; d++) {
      const ev = evaluateHexPushMove(state.board, selected, d, current.color, false);
      if (ev.valid) {
        map.set(d, ev);
      }
    }
    return map;
  }, [isMyTurn, selected, state.board, current.color]);

  // 盤面タップでそのまま移動できるターゲットセル -> dirIndex マップ
  const boardTargetMap = useMemo(() => {
    const map = new Map<string, { dirIndex: number; ev: EvaluatedHexPushMove }>();
    if (dirEvaluations.size === 0) return map;

    // まずインライン移動の先頭行き先を優先登録
    for (const [dirIndex, ev] of dirEvaluations.entries()) {
      if (!ev.isInline) continue;
      const [dq, dr] = HEX_PUSH_DIRS[dirIndex];
      // 選択玉のうち移動方向に最も先頭のもの + dir
      const line = validateLineSelection(selected);
      if (!line) continue;
      let ordered = line.ordered;
      if (
        ordered.length > 1 &&
        line.axisDir &&
        line.axisDir[0] === -dq &&
        line.axisDir[1] === -dr
      ) {
        ordered = [...ordered].reverse();
      }
      const front = ordered[ordered.length - 1];
      const targetKey = hexKey(front.q + dq, front.r + dr);
      map.set(targetKey, { dirIndex, ev });
    }

    // 次にブロードサイド移動の行き先セルを登録（未登録セルのみ）
    for (const [dirIndex, ev] of dirEvaluations.entries()) {
      if (ev.isInline) continue;
      for (const dst of ev.movedTo) {
        const k = hexKey(dst.q, dst.r);
        if (!map.has(k)) {
          map.set(k, { dirIndex, ev });
        }
      }
    }

    return map;
  }, [dirEvaluations, selected]);

  const executeMove = (dirIndex: number) => {
    if (!isMyTurn || selected.length === 0) return;
    if (!dirEvaluations.has(dirIndex)) return;
    onAction({
      type: 'move',
      payload: {
        marbles: selected,
        dirIndex,
      },
    });
    setSelected([]);
  };

  const handleCellClick = (q: number, r: number) => {
    if (!isMyTurn) return;
    const key = hexKey(q, r);
    const cell = state.board[key] ?? 0;

    // すでに移動先ターゲットとしてハイライトされているセルなら即移動
    const target = boardTargetMap.get(key);
    if (target && !selectedKeys.has(key)) {
      executeMove(target.dirIndex);
      return;
    }

    // 自玉の選択・解除
    if (cell === current.color) {
      if (selectedKeys.has(key)) {
        // 選択解除: 残りが一直線ならそれを維持、中央を外して分断されるなら全解除
        const next = selected.filter((m) => !(m.q === q && m.r === r));
        if (next.length === 0 || validateLineSelection(next)) {
          setSelected(next);
        } else {
          setSelected([]);
        }
        return;
      }

      // 追加を試みる（最大3個かつ一直線に隣接）
      if (selected.length < 3) {
        const candidate = [...selected, { q, r }];
        if (validateLineSelection(candidate)) {
          setSelected(candidate);
          return;
        }
      }

      // 直線にならない or 既に3個選択中なら、この玉単体で新規選択
      setSelected([{ q, r }]);
      return;
    }

    // それ以外をタップしたら選択解除
    setSelected([]);
  };

  // SVG レイアウト計算
  const cellR = 20.5;
  const cx = 200;
  const cy = 192;
  const viewW = 400;
  const viewH = 384;

  const getPos = (q: number, r: number) => {
    const sign = isFlipped ? -1 : 1;
    const x = cx + sign * cellR * SQRT3 * (q + r / 2);
    const y = cy + sign * cellR * 1.5 * r;
    return { x, y };
  };

  const dirButtons = isFlipped ? DIR_BUTTON_LAYOUT_FLIPPED : DIR_BUTTON_LAYOUT_NORMAL;

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isWhite = p.color === 1;
          const accent = isWhite ? '#e2e8f0' : '#f59e0b';
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
              style={active ? { borderColor: accent } : undefined}
            >
              <div
                className="opp-name"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: isWhite
                      ? 'radial-gradient(circle at 35% 30%, #ffffff, #cbd5e1)'
                      : 'radial-gradient(circle at 35% 30%, #475569, #090d16)',
                    border: isWhite ? '1px solid #94a3b8' : '1px solid #64748b',
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div
                className="opp-meta"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <span>
                  押出 {p.pushedOut}/{state.rules.pushOutTarget}
                </span>
                <span style={{ display: 'inline-flex', gap: 2 }}>
                  {Array.from({ length: state.rules.pushOutTarget }).map((_, idx) => (
                    <span
                      key={idx}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background:
                          idx < p.pushedOut
                            ? isWhite
                              ? '#334155'
                              : '#f1f5f9'
                            : 'rgba(148, 163, 184, 0.22)',
                        border:
                          idx < p.pushedOut
                            ? '1px solid #fbbf24'
                            : '1px solid rgba(148, 163, 184, 0.35)',
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 六角盤面 */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2px 0',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.92), rgba(7, 13, 24, 0.96))',
            border: '1.5px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 18,
            padding: '8px 6px',
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.48)',
          }}
        >
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
            role="img"
            aria-label="六角押し出し相撲盤面"
          >
            <defs>
              <radialGradient id="hp-board-bg" cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#263348" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
              <radialGradient id="hp-white-marble" cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="48%" stopColor="#e2e8f0" />
                <stop offset="85%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </radialGradient>
              <radialGradient id="hp-black-marble" cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="32%" stopColor="#1e293b" />
                <stop offset="78%" stopColor="#090d16" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
            </defs>

            {/* 外枠六角台座 */}
            <polygon
              points={flatHexOutlinePoints(cx, cy, cellR * 9.35)}
              fill="#0b1220"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth={3}
            />
            <polygon
              points={flatHexOutlinePoints(cx, cy, cellR * 8.92)}
              fill="url(#hp-board-bg)"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth={1.5}
            />

            {/* 61マス & 玉 */}
            {HEX_PUSH_CELLS.map(({ q, r }) => {
              const key = hexKey(q, r);
              const cell = state.board[key] ?? 0;
              const { x, y } = getPos(q, r);
              const isSelected = selectedKeys.has(key);
              const target = boardTargetMap.get(key);
              const isLastMoved = lastMovedKeys.has(key);
              const isLastPushed = lastPushedKeys.has(key);
              const isClickable =
                isMyTurn && (cell === current.color || (target !== undefined && !isSelected));

              const slotFill = target
                ? target.ev.pushesOut
                  ? 'rgba(239, 68, 68, 0.38)'
                  : target.ev.isSumito
                  ? 'rgba(245, 158, 11, 0.34)'
                  : 'rgba(16, 185, 129, 0.28)'
                : 'rgba(10, 17, 30, 0.72)';

              const slotStroke = isSelected
                ? '#fbbf24'
                : target
                ? target.ev.pushesOut
                  ? '#ef4444'
                  : target.ev.isSumito
                  ? '#f59e0b'
                  : '#34d399'
                : 'rgba(148, 163, 184, 0.24)';

              return (
                <g
                  key={key}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  onClick={() => handleCellClick(q, r)}
                >
                  {/* 六角セル背景 */}
                  <polygon
                    points={hexPolygonPoints(x, y, cellR * 0.94)}
                    fill={slotFill}
                    stroke={slotStroke}
                    strokeWidth={isSelected || target ? 2 : 1}
                  />
                  {/* くぼみ溝 */}
                  <circle
                    cx={x}
                    cy={y}
                    r={cellR * 0.56}
                    fill="rgba(2, 6, 23, 0.55)"
                    stroke="rgba(255, 255, 255, 0.06)"
                    strokeWidth={1}
                  />

                  {/* 玉の描画 */}
                  {cell !== 0 && (
                    <>
                      {/* 影 */}
                      <circle
                        cx={x + 1.5}
                        cy={y + 2.5}
                        r={cellR * 0.74}
                        fill="rgba(0, 0, 0, 0.45)"
                      />
                      {/* 本体 */}
                      <circle
                        cx={x}
                        cy={y}
                        r={cellR * 0.74}
                        fill={cell === 1 ? 'url(#hp-white-marble)' : 'url(#hp-black-marble)'}
                        stroke={
                          isSelected
                            ? '#fbbf24'
                            : target?.ev.isSumito
                            ? '#f97316'
                            : isLastMoved
                            ? '#38bdf8'
                            : isLastPushed
                            ? '#f87171'
                            : cell === 1
                            ? 'rgba(255, 255, 255, 0.75)'
                            : 'rgba(148, 163, 184, 0.45)'
                        }
                        strokeWidth={isSelected ? 3.2 : target?.ev.isSumito ? 2.8 : isLastMoved || isLastPushed ? 2.2 : 1.1}
                      />
                      {/* 光沢ハイライト */}
                      <ellipse
                        cx={x - cellR * 0.24}
                        cy={y - cellR * 0.26}
                        rx={cellR * 0.22}
                        ry={cellR * 0.13}
                        fill="#ffffff"
                        opacity={cell === 1 ? 0.85 : 0.34}
                        transform={`rotate(-30 ${(x - cellR * 0.24).toFixed(1)} ${(y - cellR * 0.26).toFixed(1)})`}
                      />
                    </>
                  )}

                  {/* 空マス移動先ドット */}
                  {cell === 0 && target && (
                    <circle
                      cx={x}
                      cy={y}
                      r={cellR * 0.28}
                      fill="#34d399"
                      opacity={0.92}
                    />
                  )}

                  {/* 押し出し対象マーク */}
                  {cell !== 0 && target && (
                    <circle
                      cx={x}
                      cy={y}
                      r={cellR * 0.28}
                      fill={target.ev.pushesOut ? '#ef4444' : '#f59e0b'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 結果カード */}
      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            {isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : `${winner?.name ?? '相手'} の勝利…`}
          </h3>
          <p className="panel-desc">
            {winner?.color === 1 ? '白' : '黒'}が相手の玉を{state.rules.pushOutTarget}個場外へ押し出しました（全{state.moveCount}手）
          </p>
        </div>
      )}

      {/* 下部6方向操作バー */}
      {state.phase === 'playing' && (
        <div className="sticky-bottom-bar">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
              padding: '0 4px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
              {!isMyTurn
                ? `${current.name} の思考中…`
                : selected.length === 0
                ? '自分の玉を1〜3個タップで選択'
                : `${selected.length}玉選択中 — 方向をタップ`}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                className="secondary-btn"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setSelected([])}
              >
                <RotateCcw size={12} />
                解除
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 6,
            }}
          >
            {dirButtons.map(({ dirIndex, label, Icon }) => {
              const ev = dirEvaluations.get(dirIndex);
              const enabled = isMyTurn && ev !== undefined;
              const isPushOut = Boolean(ev?.pushesOut);
              const isSumito = Boolean(ev?.isSumito);

              return (
                <button
                  key={dirIndex}
                  type="button"
                  disabled={!enabled}
                  onClick={() => executeMove(dirIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    height: 38,
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    border: enabled
                      ? isPushOut
                        ? '1.5px solid #ef4444'
                        : isSumito
                        ? '1.5px solid #f59e0b'
                        : '1.5px solid rgba(52, 211, 153, 0.7)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    background: enabled
                      ? isPushOut
                        ? 'rgba(239, 68, 68, 0.28)'
                        : isSumito
                        ? 'rgba(245, 158, 11, 0.24)'
                        : 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(15, 23, 42, 0.45)',
                    color: enabled
                      ? isPushOut
                        ? '#fecaca'
                        : isSumito
                        ? '#fde68a'
                        : '#d1fae5'
                      : 'rgba(148, 163, 184, 0.35)',
                    cursor: enabled ? 'pointer' : 'not-allowed',
                    touchAction: 'manipulation',
                  }}
                >
                  <Icon size={15} />
                  <span>{isPushOut ? '場外!' : isSumito ? '押出' : label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
