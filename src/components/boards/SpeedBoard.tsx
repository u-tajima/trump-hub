import React, { useState } from 'react';
import { type SpeedClientState, canPlaceOnSpeedPile } from '../../games/speed';
import { PlayingCard } from '../PlayingCard';

interface SpeedBoardProps {
  state: SpeedClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const SpeedBoard: React.FC<SpeedBoardProps> = ({ state, onAction }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleFieldCardClick = (cardId: string) => {
    if (state.phase !== 'playing') return;
    const card = state.me.fieldHand.find((c) => c.id === cardId);
    if (!card) return;

    const can0 = canPlaceOnSpeedPile(card, state.centerPiles[0], state.rules);
    const can1 = canPlaceOnSpeedPile(card, state.centerPiles[1], state.rules);

    if (can0 && !can1) {
      setSelectedCardId(null);
      onAction({ type: 'play', payload: { cardId, pileIndex: 0 } });
      return;
    }
    if (can1 && !can0) {
      setSelectedCardId(null);
      onAction({ type: 'play', payload: { cardId, pileIndex: 1 } });
      return;
    }
    if (can0 && can1) {
      setSelectedCardId((prev) => (prev === cardId ? null : cardId));
    }
  };

  const handlePileClick = (pileIndex: 0 | 1) => {
    if (!selectedCardId || state.phase !== 'playing') return;
    onAction({ type: 'play', payload: { cardId: selectedCardId, pileIndex } });
    setSelectedCardId(null);
  };

  return (
    <div className="board-container">
      <div className="speed-opponent-box">
        <div>
          <strong>{state.opponent.name}</strong>
          {state.opponent.readyFlip && <span className="badge host ml-8">せーの待機中</span>}
        </div>
        <div>
          場札: {state.opponent.fieldHandCount}枚 / 山札: {state.opponent.drawPileCount}枚
        </div>
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="speed-center-piles">
        {[0, 1].map((idx) => {
          const pileIdx = idx as 0 | 1;
          const selectedCard = state.me.fieldHand.find((c) => c.id === selectedCardId);
          const canDrop =
            Boolean(selectedCard) &&
            canPlaceOnSpeedPile(selectedCard!, state.centerPiles[pileIdx], state.rules);
          return (
            <div key={pileIdx} className="speed-pile-slot">
              <div className="speed-pile-label">台札 {pileIdx + 1}</div>
              <PlayingCard
                card={state.centerPiles[pileIdx]}
                size="lg"
                animateIn
                highlight={canDrop}
                onClick={canDrop ? () => handlePileClick(pileIdx) : undefined}
              />
            </div>
          );
        })}
      </div>

      {state.phase === 'playing' ? (
        <div className="hand-area">
          <div className="hand-header">
            <span>出せるカードは光ります（1タップで出せます）</span>
            <span>山札: {state.me.drawPileCount}枚</span>
          </div>
          <div className="speed-field-hand">
            {state.me.fieldHand.map((card) => {
              const playable =
                canPlaceOnSpeedPile(card, state.centerPiles[0], state.rules) ||
                canPlaceOnSpeedPile(card, state.centerPiles[1], state.rules);
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="lg"
                  animateIn
                  highlight={playable}
                  selected={selectedCardId === card.id}
                  disabled={!playable}
                  onClick={() => handleFieldCardClick(card.id)}
                />
              );
            })}
          </div>
          <div className="action-bar">
            {!state.rules.autoRefill && state.me.fieldHand.length < 4 && state.me.drawPileCount > 0 && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => onAction({ type: 'refill' })}
              >
                山札から補充
              </button>
            )}
            <button
              type="button"
              className={`primary-btn flex-1 ${state.me.readyFlip ? 'pulse' : ''}`}
              onClick={() => onAction({ type: 'readyFlip' })}
            >
              {state.me.readyFlip ? '相手を待っています…（取消）' : 'せーの！（台札をめくる）'}
            </button>
          </div>
        </div>
      ) : (
        <div className="result-card">
          <h3>{state.winnerId === state.myId ? 'あなたの勝利！' : '相手の勝利…'}</h3>
          <p className="panel-desc text-center">
            勝者: {state.winnerId === state.me.id ? state.me.name : state.opponent.name}
          </p>
        </div>
      )}
    </div>
  );
};
