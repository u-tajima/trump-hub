import React, { useState } from 'react';
import { Shuffle, Trophy } from 'lucide-react';
import type { OldMaidClientState } from '../../games/oldMaid';
import { formatCardShort } from '../../types/card';
import { PlayingCard } from '../PlayingCard';

interface OldMaidBoardProps {
  state: OldMaidClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const OldMaidBoard: React.FC<OldMaidBoardProps> = ({ state, onAction }) => {
  const [shuffling, setShuffling] = useState(false);
  const isMyTurn = state.phase === 'playing' && state.turnPlayerId === state.myId;
  const targetPlayer = state.players.find((p) => p.id === state.targetPlayerId);
  const turnPlayer = state.players.find((p) => p.id === state.turnPlayerId);

  const handleShuffle = () => {
    setShuffling(true);
    onAction({ type: 'shuffle' });
    window.setTimeout(() => setShuffling(false), 550);
  };

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = p.id === state.turnPlayerId && state.phase === 'playing';
          return (
            <div key={p.id} className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">
                {p.finishRank !== null
                  ? p.id === state.loserId
                    ? '負け'
                    : `${p.finishRank}位`
                  : `${p.handCount}枚`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="table-center oldmaid-table">
        {state.phase === 'playing' && targetPlayer ? (
          <div className="draw-target-box">
            <div className="draw-target-title">
              {isMyTurn
                ? `${targetPlayer.name} の手札から1枚引いてください`
                : `${turnPlayer?.name} が ${targetPlayer.name} から引いています…`}
            </div>
            <div className="draw-cards-row">
              {Array.from({ length: targetPlayer.handCount }, (_, idx) => (
                <PlayingCard
                  key={idx}
                  faceDown
                  size="md"
                  highlight={isMyTurn}
                  disabled={!isMyTurn}
                  onClick={isMyTurn ? () => onAction({ type: 'draw', payload: { cardIndex: idx } }) : undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="result-card">
            <h3>
              <Trophy size={18} /> 結果発表
            </h3>
            {state.removedJiji && (
              <div className="jiji-reveal">
                今回のジジ（抜かれたカード）: <strong>{formatCardShort(state.removedJiji)}</strong>
              </div>
            )}
            <ul className="result-list">
              {[...state.players]
                .sort((a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99))
                .map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.id === state.loserId
                        ? state.rules.mode === 'jiji'
                          ? 'ジジ残り（負け）'
                          : 'ババ残り（負け）'
                        : `${p.finishRank}位`}
                    </span>
                    <strong>{p.name}</strong>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {state.phase === 'playing' && (
        <div className="hand-area">
          <div className="hand-header">
            <span>あなたの手札 ({state.myHand.length}枚)</span>
            {state.rules.allowShuffle && state.myHand.length > 1 && (
              <button
                type="button"
                className="chip-btn"
                onClick={handleShuffle}
              >
                <Shuffle size={14} />
                シャッフル
              </button>
            )}
          </div>
          <div className={`hand-scroll ${shuffling ? 'hand-shuffling' : ''}`}>
            {state.myHand.map((card) => (
              <PlayingCard key={card.id} card={card} size="md" animateIn />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
