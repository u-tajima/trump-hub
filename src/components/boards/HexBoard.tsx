import React, { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { HexClientState } from '../../games/hex';

interface HexBoardProps {
  state: HexClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const SQRT3 = Math.sqrt(3);

function hexPolygonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top hexagon
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export const HexBoard: React.FC<HexBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const n = state.board.length;
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const winningSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of state.winningPath) {
      set.add(`${c.row},${c.col}`);
    }
    return set;
  }, [state.winningPath]);

  const counts = useMemo(() => {
    let red = 0;
    let blue = 0;
    for (const row of state.board) {
      for (const cell of row) {
        if (cell === 1) red++;
        else if (cell === 2) blue++;
      }
    }
    return { red, blue };
  }, [state.board]);

  // SVG レイアウト計算（pointy-top hex, 菱形配置）
  const hexR = n === 7 ? 24 : n === 9 ? 19.5 : 16.5;
  const hexW = SQRT3 * hexR;
  const rowStep = 1.5 * hexR;
  const padX = hexR * 1.65;
  const padY = hexR * 1.7;

  const getCenter = (r: number, c: number) => ({
    x: padX + c * hexW + r * (hexW / 2),
    y: padY + r * rowStep,
  });

  const topLeft = getCenter(0, 0);
  const topRight = getCenter(0, n - 1);
  const bottomLeft = getCenter(n - 1, 0);
  const bottomRight = getCenter(n - 1, n - 1);

  const viewWidth = bottomRight.x + padX;
  const viewHeight = bottomRight.y + padY;

  // 外枠の4辺（赤：上下、青：左右）
  const borderOffset = hexR * 1.05;
  const topEdge = [
    `${(topLeft.x - hexW * 0.55).toFixed(1)},${(topLeft.y - borderOffset).toFixed(1)}`,
    `${(topRight.x + hexW * 0.45).toFixed(1)},${(topRight.y - borderOffset).toFixed(1)}`,
  ].join(' ');
  const bottomEdge = [
    `${(bottomLeft.x - hexW * 0.45).toFixed(1)},${(bottomLeft.y + borderOffset).toFixed(1)}`,
    `${(bottomRight.x + hexW * 0.55).toFixed(1)},${(bottomRight.y + borderOffset).toFixed(1)}`,
  ].join(' ');
  const leftEdge = [
    `${(topLeft.x - hexW * 0.72).toFixed(1)},${(topLeft.y - hexR * 0.65).toFixed(1)}`,
    `${(bottomLeft.x - hexW * 0.72).toFixed(1)},${(bottomLeft.y + hexR * 0.65).toFixed(1)}`,
  ].join(' ');
  const rightEdge = [
    `${(topRight.x + hexW * 0.72).toFixed(1)},${(topRight.y - hexR * 0.65).toFixed(1)}`,
    `${(bottomRight.x + hexW * 0.72).toFixed(1)},${(bottomRight.y + hexR * 0.65).toFixed(1)}`,
  ].join(' ');

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isRed = p.color === 1;
          const accent = isRed ? '#ef4444' : '#38bdf8';
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
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ color: isRed ? '#fca5a5' : '#bae6fd' }}>
                {isRed ? `上下連結・${counts.red}石` : `左右連結・${counts.blue}石`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* パイルール（2手目交換）ボタン */}
      {state.canSwap && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 4px' }}>
          <button
            type="button"
            className="secondary-btn"
            style={{
              borderColor: '#38bdf8',
              color: '#bae6fd',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => onAction({ type: 'swap' })}
          >
            <ArrowLeftRight size={15} />
            パイルールで初手の石を交換
          </button>
        </div>
      )}

      {/* 六角盤面 */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '4px 0',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.92), rgba(7, 13, 24, 0.96))',
            border: '1.5px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 18,
            padding: '10px 6px',
            width: '100%',
            maxWidth: 420,
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
          }}
        >
          <svg
            viewBox={`0 0 ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`}
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
            role="img"
            aria-label="ヘックス盤面"
          >
            <defs>
              <radialGradient id="hex-red-stone" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="45%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </radialGradient>
              <radialGradient id="hex-blue-stone" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#bae6fd" />
                <stop offset="45%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#075985" />
              </radialGradient>
            </defs>

            {/* 対辺カラーライン（上下=赤、左右=青） */}
            <polyline
              points={topEdge}
              fill="none"
              stroke="#ef4444"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.9}
            />
            <polyline
              points={bottomEdge}
              fill="none"
              stroke="#ef4444"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.9}
            />
            <polyline
              points={leftEdge}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.9}
            />
            <polyline
              points={rightEdge}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.9}
            />

            {/* 六角セル */}
            {state.board.map((row, r) =>
              row.map((cell, c) => {
                const { x, y } = getCenter(r, c);
                const clickable = isMyTurn && cell === 0;
                const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
                const isWin = winningSet.has(`${r},${c}`);

                const fill =
                  cell === 1
                    ? 'url(#hex-red-stone)'
                    : cell === 2
                    ? 'url(#hex-blue-stone)'
                    : clickable
                    ? 'rgba(30, 41, 59, 0.92)'
                    : 'rgba(15, 23, 42, 0.85)';

                const stroke = isWin
                  ? '#fde047'
                  : isLast
                  ? '#ffffff'
                  : cell === 1
                  ? '#fca5a5'
                  : cell === 2
                  ? '#7dd3fc'
                  : 'rgba(148, 163, 184, 0.38)';

                return (
                  <g
                    key={`${r}-${c}`}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                    onClick={() => clickable && onAction({ type: 'place', payload: { row: r, col: c } })}
                  >
                    <polygon
                      points={hexPolygonPoints(x, y, hexR * 0.95)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isWin ? 3 : isLast ? 2.4 : 1.3}
                    />
                    {isWin && (
                      <circle
                        cx={x}
                        cy={y}
                        r={hexR * 0.3}
                        fill="#fef08a"
                        opacity={0.95}
                      />
                    )}
                    {!isWin && isLast && cell !== 0 && (
                      <circle
                        cx={x}
                        cy={y}
                        r={hexR * 0.22}
                        fill="#ffffff"
                        opacity={0.88}
                      />
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>

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
            {winner?.color === 1 ? '赤（上下）' : '青（左右）'}のラインが繋がりました（全{state.moveCount}手）
          </p>
        </div>
      )}
    </div>
  );
};
