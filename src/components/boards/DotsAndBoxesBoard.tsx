import React from 'react';
import type { DotsAndBoxesClientState } from '../../games/dotsAndBoxes';

interface DotsAndBoxesBoardProps {
  state: DotsAndBoxesClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const PLAYER_COLORS = [
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.32)', text: '#6ee7b7' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.32)', text: '#fde68a' },
  { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.32)', text: '#bae6fd' },
  { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.32)', text: '#fecdd3' },
];

export const DotsAndBoxesBoard: React.FC<DotsAndBoxesBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const n = state.rules.gridSize;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const cellSize = n === 3 ? 88 : n === 4 ? 70 : 58;
  const pad = 28;
  const viewSize = pad * 2 + n * cellSize;
  const dotRadius = n === 5 ? 5.5 : 6.5;

  const isLastLine = (kind: 'h' | 'v', row: number, col: number) =>
    state.lastMove?.kind === kind &&
    state.lastMove?.row === row &&
    state.lastMove?.col === col;

  const isLastBox = (row: number, col: number) =>
    state.lastClaimedBoxes.some((b) => b.row === row && b.col === col);

  const handleDraw = (kind: 'h' | 'v', row: number, col: number) => {
    if (!isMyTurn) return;
    onAction({ type: 'drawLine', payload: { kind, row, col } });
  };

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p, idx) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
              style={active ? { borderColor: color.stroke } : undefined}
            >
              <div className="opp-name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: color.stroke,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ color: color.text, fontWeight: 800 }}>
                {p.score} 箱
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '6px 0',
        }}
      >
        <div
          style={{
            background: 'rgba(6, 24, 15, 0.72)',
            border: '1.5px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 18,
            padding: 10,
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)',
          }}
        >
          <svg
            viewBox={`0 0 ${viewSize} ${viewSize}`}
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
            role="img"
            aria-label="ドット＆ボックス盤面"
          >
            {/* 獲得済みボックスの塗りつぶし */}
            {state.boxes.map((row, r) =>
              row.map((owner, c) => {
                if (owner === null) return null;
                const color = PLAYER_COLORS[owner % PLAYER_COLORS.length];
                const x = pad + c * cellSize;
                const y = pad + r * cellSize;
                const recent = isLastBox(r, c);
                const initials = (state.players[owner]?.name ?? '').slice(0, 2);
                return (
                  <g key={`box-${r}-${c}`}>
                    <rect
                      x={x + 5}
                      y={y + 5}
                      width={cellSize - 10}
                      height={cellSize - 10}
                      rx={8}
                      fill={color.fill}
                      stroke={recent ? color.stroke : 'none'}
                      strokeWidth={recent ? 2 : 0}
                    />
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 5}
                      textAnchor="middle"
                      fill={color.text}
                      fontSize={n === 5 ? 12 : 14}
                      fontWeight={800}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {initials}
                    </text>
                  </g>
                );
              })
            )}

            {/* 水平線 */}
            {state.hLines.map((row, r) =>
              row.map((owner, c) => {
                const x1 = pad + c * cellSize;
                const x2 = x1 + cellSize;
                const y = pad + r * cellSize;
                const drawn = owner !== null;
                const color = drawn ? PLAYER_COLORS[owner % PLAYER_COLORS.length].stroke : null;
                const last = isLastLine('h', r, c);
                const clickable = isMyTurn && !drawn;

                return (
                  <g key={`h-${r}-${c}`}>
                    {last && (
                      <line
                        x1={x1 + dotRadius}
                        y1={y}
                        x2={x2 - dotRadius}
                        y2={y}
                        stroke="#ffffff"
                        strokeWidth={11}
                        strokeLinecap="round"
                        opacity={0.35}
                      />
                    )}
                    <line
                      x1={x1 + dotRadius}
                      y1={y}
                      x2={x2 - dotRadius}
                      y2={y}
                      stroke={
                        drawn
                          ? color!
                          : clickable
                          ? 'rgba(255, 255, 255, 0.22)'
                          : 'rgba(255, 255, 255, 0.1)'
                      }
                      strokeWidth={drawn ? 6 : 4}
                      strokeDasharray={drawn ? undefined : '5 5'}
                      strokeLinecap="round"
                    />
                    {clickable && (
                      <rect
                        x={x1 + dotRadius}
                        y={y - 16}
                        width={cellSize - dotRadius * 2}
                        height={32}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleDraw('h', r, c)}
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* 垂直線 */}
            {state.vLines.map((row, r) =>
              row.map((owner, c) => {
                const x = pad + c * cellSize;
                const y1 = pad + r * cellSize;
                const y2 = y1 + cellSize;
                const drawn = owner !== null;
                const color = drawn ? PLAYER_COLORS[owner % PLAYER_COLORS.length].stroke : null;
                const last = isLastLine('v', r, c);
                const clickable = isMyTurn && !drawn;

                return (
                  <g key={`v-${r}-${c}`}>
                    {last && (
                      <line
                        x1={x}
                        y1={y1 + dotRadius}
                        x2={x}
                        y2={y2 - dotRadius}
                        stroke="#ffffff"
                        strokeWidth={11}
                        strokeLinecap="round"
                        opacity={0.35}
                      />
                    )}
                    <line
                      x1={x}
                      y1={y1 + dotRadius}
                      x2={x}
                      y2={y2 - dotRadius}
                      stroke={
                        drawn
                          ? color!
                          : clickable
                          ? 'rgba(255, 255, 255, 0.22)'
                          : 'rgba(255, 255, 255, 0.1)'
                      }
                      strokeWidth={drawn ? 6 : 4}
                      strokeDasharray={drawn ? undefined : '5 5'}
                      strokeLinecap="round"
                    />
                    {clickable && (
                      <rect
                        x={x - 16}
                        y={y1 + dotRadius}
                        width={32}
                        height={cellSize - dotRadius * 2}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleDraw('v', r, c)}
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* 格子ドット */}
            {Array.from({ length: n + 1 }, (_, r) =>
              Array.from({ length: n + 1 }, (_, c) => (
                <circle
                  key={`dot-${r}-${c}`}
                  cx={pad + c * cellSize}
                  cy={pad + r * cellSize}
                  r={dotRadius}
                  fill="#f8fafc"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                />
              ))
            )}
          </svg>
        </div>
      </div>

      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            {state.winnerId === 'draw'
              ? '引き分け！'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : `${winner?.name ?? '相手'} の勝利…`}
          </h3>
          <p className="panel-desc">
            {state.players.map((p) => `${p.name}: ${p.score}箱`).join(' / ')}
          </p>
        </div>
      )}
    </div>
  );
};
