import React, { useMemo, useState } from 'react';
import { Footprints } from 'lucide-react';
import type { CorridorClientState } from '../../games/corridor';

interface CorridorBoardProps {
  state: CorridorClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

type InteractionMode = 'move' | 'h' | 'v';

export const CorridorBoard: React.FC<CorridorBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [rawMode, setRawMode] = useState<InteractionMode>('move');
  const n = state.boardSize;
  const wallN = n - 1;
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const canPlaceAnyWall = isMyTurn && current.wallsLeft > 0;
  const mode: InteractionMode =
    rawMode !== 'move' && !canPlaceAnyWall ? 'move' : rawMode;

  const validMoveSet = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const m of state.validMoves) {
      set.add(`${m.row},${m.col}`);
    }
    return set;
  }, [isMyTurn, state.validMoves]);

  const validHWallSet = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const w of state.validHWalls) {
      set.add(`${w.row},${w.col}`);
    }
    return set;
  }, [isMyTurn, state.validHWalls]);

  const validVWallSet = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const w of state.validVWalls) {
      set.add(`${w.row},${w.col}`);
    }
    return set;
  }, [isMyTurn, state.validVWalls]);

  // SVG 幾何レイアウト
  const cellSize = n === 7 ? 42 : 33;
  const gap = n === 7 ? 10 : 8;
  const step = cellSize + gap;
  const pad = 14;
  const boardSpan = n * cellSize + (n - 1) * gap;
  const svgSize = boardSpan + pad * 2;

  const cellX = (c: number) => pad + c * step;
  const cellY = (r: number) => pad + r * step;

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isP0 = p.side === 0;
          const accent = isP0 ? '#f59e0b' : '#38bdf8';
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
                    background: isP0
                      ? 'radial-gradient(circle at 35% 30%, #fde68a, #ea580c)'
                      : 'radial-gradient(circle at 35% 30%, #e0f2fe, #0284c7)',
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ color: isP0 ? '#fde68a' : '#bae6fd' }}>
                {isP0 ? '上端目標' : '下端目標'}・残壁 {p.wallsLeft}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 迷路ボード */}
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
            width: '100%',
            maxWidth: 388,
            padding: 8,
            borderRadius: 18,
            background: 'linear-gradient(155deg, #271a10 0%, #170f09 100%)',
            border: '2px solid rgba(217, 173, 124, 0.36)',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
          }}
        >
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
            role="img"
            aria-label="壁おき迷路レース盤面"
          >
            <defs>
              <radialGradient id="corridor-p0" cx="35%" cy="28%" r="70%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="48%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </radialGradient>
              <radialGradient id="corridor-p1" cx="35%" cy="28%" r="70%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="48%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </radialGradient>
              <linearGradient id="corridor-wall-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f6c177" />
                <stop offset="100%" stopColor="#c47d32" />
              </linearGradient>
            </defs>

            {/* 盤面ベース */}
            <rect
              x={pad - 6}
              y={pad - 6}
              width={boardSpan + 12}
              height={boardSpan + 12}
              rx={10}
              fill="#1e140d"
              stroke="rgba(217, 173, 124, 0.25)"
              strokeWidth={1.5}
            />

            {/* ゴールライン（上端: P0ゴール = アンバー、下端: P1ゴール = スカイブルー） */}
            <line
              x1={pad}
              y1={pad - 4}
              x2={pad + boardSpan}
              y2={pad - 4}
              stroke="#f59e0b"
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.9}
            />
            <line
              x1={pad}
              y1={pad + boardSpan + 4}
              x2={pad + boardSpan}
              y2={pad + boardSpan + 4}
              stroke="#38bdf8"
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.9}
            />

            {/* セル描画 */}
            {Array.from({ length: n }).map((_, r) =>
              Array.from({ length: n }).map((__, c) => {
                const x = cellX(c);
                const y = cellY(r);
                const isMoveTarget = mode === 'move' && validMoveSet.has(`${r},${c}`);
                const isLastMoveTo =
                  state.lastAction?.kind === 'move' &&
                  state.lastAction.to.row === r &&
                  state.lastAction.to.col === c;
                const isGoalRow0 = r === 0;
                const isGoalRow1 = r === n - 1;

                const fill = isMoveTarget
                  ? '#1f4d2e'
                  : isGoalRow0
                  ? '#3e2d1e'
                  : isGoalRow1
                  ? '#1e303e'
                  : '#34261c';

                const stroke = isMoveTarget
                  ? '#86efac'
                  : isLastMoveTo
                  ? 'rgba(254, 240, 138, 0.7)'
                  : 'rgba(255, 255, 255, 0.08)';

                return (
                  <g
                    key={`cell-${r}-${c}`}
                    style={{ cursor: isMoveTarget ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (isMoveTarget) {
                        onAction({ type: 'move', payload: { row: r, col: c } });
                      }
                    }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      rx={5}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isMoveTarget ? 2 : 1}
                    />
                    {isMoveTarget && (
                      <circle
                        cx={x + cellSize / 2}
                        cy={y + cellSize / 2}
                        r={cellSize * 0.22}
                        fill="#86efac"
                        opacity={0.92}
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* 配置済みの水平壁 */}
            {state.hWalls.map((rowArr, r) =>
              rowArr.map((placed, c) => {
                if (!placed) return null;
                const x = cellX(c) + 1;
                const y = cellY(r) + cellSize + (gap - (gap - 2)) / 2;
                const w = cellSize * 2 + gap - 2;
                const h = Math.max(5, gap - 2);
                const isLast =
                  state.lastAction?.kind === 'wall' &&
                  state.lastAction.orientation === 'h' &&
                  state.lastAction.row === r &&
                  state.lastAction.col === c;
                return (
                  <rect
                    key={`hw-${r}-${c}`}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={h / 2}
                    fill="url(#corridor-wall-grad)"
                    stroke={isLast ? '#fef08a' : '#5c340e'}
                    strokeWidth={isLast ? 1.8 : 1}
                  />
                );
              })
            )}

            {/* 配置済みの垂直壁 */}
            {state.vWalls.map((rowArr, r) =>
              rowArr.map((placed, c) => {
                if (!placed) return null;
                const x = cellX(c) + cellSize + (gap - (gap - 2)) / 2;
                const y = cellY(r) + 1;
                const w = Math.max(5, gap - 2);
                const h = cellSize * 2 + gap - 2;
                const isLast =
                  state.lastAction?.kind === 'wall' &&
                  state.lastAction.orientation === 'v' &&
                  state.lastAction.row === r &&
                  state.lastAction.col === c;
                return (
                  <rect
                    key={`vw-${r}-${c}`}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={w / 2}
                    fill="url(#corridor-wall-grad)"
                    stroke={isLast ? '#fef08a' : '#5c340e'}
                    strokeWidth={isLast ? 1.8 : 1}
                  />
                );
              })
            )}

            {/* プレイヤー駒 */}
            {state.players.map((p) => {
              const cx = cellX(p.pos.col) + cellSize / 2;
              const cy = cellY(p.pos.row) + cellSize / 2;
              const isTurn = state.phase === 'playing' && current.id === p.id;
              return (
                <g key={`pawn-${p.id}`} style={{ pointerEvents: 'none' }}>
                  {isTurn && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={cellSize * 0.42}
                      fill="none"
                      stroke={p.side === 0 ? '#fde047' : '#7dd3fc'}
                      strokeWidth={2}
                      opacity={0.9}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={cellSize * 0.34}
                    fill={p.side === 0 ? 'url(#corridor-p0)' : 'url(#corridor-p1)'}
                    stroke="#ffffff"
                    strokeWidth={1.6}
                  />
                </g>
              );
            })}

            {/* 壁配置モード時の交差点スロット（一発配置） */}
            {isMyTurn &&
              (mode === 'h' || mode === 'v') &&
              Array.from({ length: wallN }).map((_, r) =>
                Array.from({ length: wallN }).map((__, c) => {
                  const key = `${r},${c}`;
                  const allowed =
                    mode === 'h' ? validHWallSet.has(key) : validVWallSet.has(key);
                  if (!allowed) return null;

                  const cx = cellX(c) + cellSize + gap / 2;
                  const cy = cellY(r) + cellSize + gap / 2;
                  const barLen = cellSize * 0.56;
                  const barThick = Math.max(4, gap * 0.55);

                  return (
                    <g
                      key={`slot-${mode}-${r}-${c}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        onAction({
                          type: 'placeWall',
                          payload: { orientation: mode, row: r, col: c },
                        });
                        setRawMode('move');
                      }}
                    >
                      {/* タップしやすい広めのヒット領域 */}
                      <circle cx={cx} cy={cy} r={cellSize * 0.4} fill="transparent" />
                      {/* 向きが一目でわかるミニガイドバー */}
                      {mode === 'h' ? (
                        <rect
                          x={cx - barLen / 2}
                          y={cy - barThick / 2}
                          width={barLen}
                          height={barThick}
                          rx={barThick / 2}
                          fill="rgba(253, 224, 71, 0.85)"
                          stroke="#713f12"
                          strokeWidth={0.9}
                        />
                      ) : (
                        <rect
                          x={cx - barThick / 2}
                          y={cy - barLen / 2}
                          width={barThick}
                          height={barLen}
                          rx={barThick / 2}
                          fill="rgba(253, 224, 71, 0.85)"
                          stroke="#713f12"
                          strokeWidth={0.9}
                        />
                      )}
                      <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
                    </g>
                  );
                })
              )}
          </svg>
        </div>
      </div>

      {/* 勝敗カード */}
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
            {winner?.name ?? ''} が反対側のゴールへ到達しました（全{state.moveCount}手）
          </p>
        </div>
      )}

      {/* 下部 モード切替バー（駒を動かす / 横壁を置く / 縦壁を置く） */}
      {state.phase === 'playing' && (
        <div
          className="sticky-bottom-bar"
          style={{
            background: 'rgba(7, 25, 16, 0.94)',
            borderTop: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '16px 16px 0 0',
            padding: '10px 10px 8px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#cbd5e1',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {!isMyTurn
              ? `${current.name} の思考中…`
              : mode === 'move'
              ? '緑に光るマスをタップして駒を移動'
              : mode === 'h'
              ? '黄色の交差点スロットをタップして横壁を配置'
              : '黄色の交差点スロットをタップして縦壁を配置'}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <button
              type="button"
              disabled={!isMyTurn}
              onClick={() => setRawMode('move')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 6px',
                borderRadius: 12,
                border:
                  mode === 'move'
                    ? '2px solid #86efac'
                    : '1.5px solid rgba(255, 255, 255, 0.16)',
                background:
                  mode === 'move'
                    ? 'rgba(16, 185, 129, 0.24)'
                    : 'rgba(15, 23, 42, 0.65)',
                color: '#f8fafc',
                fontSize: 12,
                fontWeight: 800,
                cursor: isMyTurn ? 'pointer' : 'default',
                opacity: isMyTurn ? 1 : 0.6,
              }}
            >
              <Footprints size={15} />
              駒を動かす
            </button>

            <button
              type="button"
              disabled={!canPlaceAnyWall}
              onClick={() => setRawMode('h')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 6px',
                borderRadius: 12,
                border:
                  mode === 'h'
                    ? '2px solid #fde047'
                    : '1.5px solid rgba(255, 255, 255, 0.16)',
                background:
                  mode === 'h'
                    ? 'rgba(245, 158, 11, 0.24)'
                    : 'rgba(15, 23, 42, 0.65)',
                color: '#f8fafc',
                fontSize: 12,
                fontWeight: 800,
                cursor: canPlaceAnyWall ? 'pointer' : 'default',
                opacity: canPlaceAnyWall ? 1 : 0.4,
              }}
            >
              <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
                <rect x="1" y="3" width="14" height="4" rx="2" fill="#f6c177" />
              </svg>
              横壁 ({current.wallsLeft})
            </button>

            <button
              type="button"
              disabled={!canPlaceAnyWall}
              onClick={() => setRawMode('v')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 6px',
                borderRadius: 12,
                border:
                  mode === 'v'
                    ? '2px solid #fde047'
                    : '1.5px solid rgba(255, 255, 255, 0.16)',
                background:
                  mode === 'v'
                    ? 'rgba(245, 158, 11, 0.24)'
                    : 'rgba(15, 23, 42, 0.65)',
                color: '#f8fafc',
                fontSize: 12,
                fontWeight: 800,
                cursor: canPlaceAnyWall ? 'pointer' : 'default',
                opacity: canPlaceAnyWall ? 1 : 0.4,
              }}
            >
              <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
                <rect x="3" y="1" width="4" height="14" rx="2" fill="#f6c177" />
              </svg>
              縦壁 ({current.wallsLeft})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
