import React from 'react';
import { ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import type { MancalaClientState } from '../../games/mancala';

interface MancalaBoardProps {
  state: MancalaClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const GEM_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb7185',
  '#facc15',
  '#2dd4bf',
];

function renderGems(count: number, seed: number, maxVisible = 14) {
  const visible = Math.min(count, maxVisible);
  const items = [];
  for (let i = 0; i < visible; i++) {
    const color = GEM_COLORS[(seed * 5 + i * 3) % GEM_COLORS.length];
    items.push(
      <span
        key={i}
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, #ffffff 0%, ${color} 45%, rgba(0,0,0,0.45) 100%)`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.55)',
          flexShrink: 0,
        }}
      />
    );
  }
  return items;
}

export const MancalaBoard: React.FC<MancalaBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  // オンライン時は自分を常に「下ストア・左列」に表示。ローカル対戦時は P0 を固定表示して視認性を保つ。
  const mySeat: 0 | 1 = isLocalPassAndPlay
    ? 0
    : state.players[1].id === state.myId
    ? 1
    : 0;
  const oppSeat: 0 | 1 = mySeat === 0 ? 1 : 0;

  const myPlayer = state.players[mySeat];
  const oppPlayer = state.players[oppSeat];
  const myStoreIdx = mySeat === 0 ? 6 : 13;
  const oppStoreIdx = oppSeat === 0 ? 6 : 13;

  // 反時計回り（左列: 上→下 で自分ストアへ、右列: 下→上 で相手ストアへ）
  // かつ左右の行が向かい合わせ (12 - idx) になるよう配置
  const rows = Array.from({ length: 6 }, (_, rowIdx) => {
    const leftPit = mySeat === 0 ? rowIdx : 7 + rowIdx;
    const rightPit = 12 - leftPit;
    return { leftPit, rightPit };
  });

  const canClickPit = (pitIdx: number) => {
    if (state.phase !== 'playing') return false;
    if (!isMyTurn) return false;
    return state.validPits.includes(pitIdx);
  };

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const storeCount = state.pits[p.seat === 0 ? 6 : 13];
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
            >
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">ストア {storeCount}個</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {state.extraTurn && (
          <span className="flag-badge warn" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Sparkles size={11} /> 連続ターン
          </span>
        )}
        <span>{state.lastLog}</span>
      </div>

      {/* 木目調カラハ盤（縦長2列レイアウト） */}
      <div
        style={{
          background:
            'linear-gradient(160deg, #5c3a21 0%, #3e2514 55%, #2b180c 100%)',
          border: '2px solid #8b5a2b',
          borderRadius: 22,
          padding: 12,
          boxShadow: 'inset 0 2px 10px rgba(255,215,160,0.16), 0 10px 24px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 400,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {/* 上: 相手のストア */}
        <div
          style={{
            background: 'radial-gradient(ellipse at center, #241309 0%, #1a0d06 100%)',
            borderRadius: 16,
            border:
              state.lastLandingPit === oppStoreIdx
                ? '2px solid #f59e0b'
                : state.turnIndex === oppSeat && state.phase === 'playing'
                ? '1.5px solid rgba(251, 191, 36, 0.55)'
                : '1.5px solid rgba(255, 255, 255, 0.1)',
            padding: '8px 12px',
            boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            minHeight: 54,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#d6b48e', letterSpacing: '0.04em' }}>
              {oppPlayer.name} のストア
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 210 }}>
              {renderGems(state.pits[oppStoreIdx], oppStoreIdx, 18)}
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: '#fde68a',
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {state.pits[oppStoreIdx]}
          </div>
        </div>

        {/* 方向インジケーター */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            padding: '0 6px',
            fontSize: 10,
            fontWeight: 800,
            color: '#d6b48e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <ArrowDown size={12} /> {myPlayer.name} の陣地
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {oppPlayer.name} の陣地 <ArrowUp size={12} />
          </div>
        </div>

        {/* 中央: 6行 × 2列のピット */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map(({ leftPit, rightPit }) => {
            const renderPit = (pitIdx: number, ownerSeat: 0 | 1) => {
              const count = state.pits[pitIdx];
              const playable = canClickPit(pitIdx);
              const isLastOrigin = state.lastPit === pitIdx;
              const isLastLand = state.lastLandingPit === pitIdx;
              const isOwnerTurn = state.phase === 'playing' && state.turnIndex === ownerSeat;

              return (
                <button
                  key={pitIdx}
                  type="button"
                  disabled={!playable}
                  onClick={() => playable && onAction({ type: 'sow', payload: { pitIndex: pitIdx } })}
                  aria-label={`穴 ${pitIdx + 1}（石 ${count}個）`}
                  style={{
                    position: 'relative',
                    background: playable
                      ? 'radial-gradient(circle at 50% 35%, #3d2412 0%, #241308 100%)'
                      : 'radial-gradient(circle at 50% 35%, #2b180c 0%, #190c05 100%)',
                    borderRadius: 14,
                    border: isLastLand
                      ? '2px solid #f59e0b'
                      : playable
                      ? '2px solid rgba(52, 211, 153, 0.7)'
                      : isLastOrigin
                      ? '1.5px dashed rgba(245, 158, 11, 0.55)'
                      : isOwnerTurn
                      ? '1.5px solid rgba(255, 255, 255, 0.16)'
                      : '1.5px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: playable
                      ? 'inset 0 3px 8px rgba(0,0,0,0.6), 0 0 10px rgba(16,185,129,0.22)'
                      : 'inset 0 3px 8px rgba(0,0,0,0.68)',
                    padding: '6px 10px',
                    minHeight: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    cursor: playable ? 'pointer' : 'default',
                    opacity: count === 0 && !isLastOrigin && !isLastLand ? 0.6 : 1,
                    transition: 'transform 0.12s ease, border-color 0.15s ease',
                    color: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 3,
                      alignItems: 'center',
                      maxWidth: 96,
                    }}
                  >
                    {renderGems(count, pitIdx, 12)}
                  </div>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: playable ? '#6ee7b7' : count > 0 ? '#fef3c7' : '#78716c',
                      minWidth: 24,
                      textAlign: 'right',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            };

            return (
              <div
                key={leftPit}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {renderPit(leftPit, mySeat)}
                {renderPit(rightPit, oppSeat)}
              </div>
            );
          })}
        </div>

        {/* 下: 自分のストア */}
        <div
          style={{
            background: 'radial-gradient(ellipse at center, #241309 0%, #1a0d06 100%)',
            borderRadius: 16,
            border:
              state.lastLandingPit === myStoreIdx
                ? '2px solid #f59e0b'
                : state.turnIndex === mySeat && state.phase === 'playing'
                ? '1.5px solid rgba(52, 211, 153, 0.65)'
                : '1.5px solid rgba(255, 255, 255, 0.1)',
            padding: '8px 12px',
            boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            minHeight: 54,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.04em' }}>
              {myPlayer.name} のストア
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 210 }}>
              {renderGems(state.pits[myStoreIdx], myStoreIdx, 18)}
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: '#6ee7b7',
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {state.pits[myStoreIdx]}
          </div>
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
              : '相手の勝利…'}
          </h3>
          <p className="panel-desc">
            {state.players[0].name}: {state.pits[6]}個 / {state.players[1].name}: {state.pits[13]}個
          </p>
        </div>
      )}
    </div>
  );
};
