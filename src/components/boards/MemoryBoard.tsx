import React from 'react';
import type { MemoryClientState } from '../../games/memory';
import { PlayingCard } from '../PlayingCard';

interface MemoryBoardProps {
  state: MemoryClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const MemoryBoard: React.FC<MemoryBoardProps> = ({ state, onAction }) => {
  const isMyTurn =
    state.phase === 'playing' &&
    state.turnPlayerId === state.myId &&
    !state.awaitingReset;

  const cols = state.tiles.length <= 20 ? 4 : state.tiles.length <= 28 ? 5 : 6;

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = p.id === state.turnPlayerId && state.phase === 'playing';
          return (
            <div key={p.id} className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">{p.pairs}ペア</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {state.phase === 'playing' ? (
        <div
          className="memory-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {state.tiles.map((tile) => {
            const isMatched = tile.matchedBy !== null;
            const isFlipped = tile.card !== null;
            return (
              <div key={tile.index} className={`memory-cell ${isMatched ? 'matched' : ''}`}>
                <PlayingCard
                  card={tile.card ?? undefined}
                  faceDown={!isFlipped}
                  flipIn={isFlipped}
                  size="sm"
                  disabled={!isMyTurn || isFlipped || isMatched}
                  onClick={
                    isMyTurn && !isFlipped && !isMatched
                      ? () => onAction({ type: 'flip', payload: { index: tile.index } })
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="result-card">
          <h3>結果発表</h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => b.pairs - a.pairs)
              .map((p, idx) => (
                <li key={p.id}>
                  <span>{idx + 1}位 ({p.pairs}ペア)</span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
