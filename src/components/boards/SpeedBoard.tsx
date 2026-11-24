import React, { useState } from 'react';
import { canPlaceOnSpeedPile, type SpeedClientState } from '../../games/speed';
import type { Card } from '../../types/card';
import { PlayingCard } from '../PlayingCard';
import './SpeedLocalBoard.css';

interface SpeedBoardProps {
  state: SpeedClientState;
  onAction: (action: { type: string; payload?: unknown }, overrideActorId?: string) => void;
  isLocalPassAndPlay?: boolean;
}

export const SpeedBoard: React.FC<SpeedBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [topSelectedId, setTopSelectedId] = useState<string | null>(null);

  const activeSelectedId = state.me.fieldHand.some((c) => c.id === selectedCardId)
    ? selectedCardId
    : null;
  const activeTopSelectedId = state.opponent.fieldHand.some((c) => c.id === topSelectedId)
    ? topSelectedId
    : null;

  const handleFieldCardClick = (cardId: string) => {
    if (state.phase !== 'playing') return;
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  };

  const handlePileClick = (pileIndex: 0 | 1) => {
    if (!activeSelectedId || state.phase !== 'playing') return;
    onAction({ type: 'play', payload: { cardId: activeSelectedId, pileIndex } });
    setSelectedCardId(null);
  };

  // 向かい合わせローカル対戦用: 片方の台札にしか出せないなら1タップ即出し、両方OKなら選択して台札タップ
  const handleLocalCardClick = (side: 'bottom' | 'top', card: Card) => {
    if (state.phase !== 'playing') return;
    const actorId = side === 'bottom' ? state.me.id : state.opponent.id;
    const ok0 = canPlaceOnSpeedPile(card, state.centerPiles[0], state.rules);
    const ok1 = canPlaceOnSpeedPile(card, state.centerPiles[1], state.rules);

    if (ok0 && !ok1) {
      onAction({ type: 'play', payload: { cardId: card.id, pileIndex: 0 } }, actorId);
      if (side === 'bottom') setSelectedCardId(null);
      else setTopSelectedId(null);
      return;
    }
    if (!ok0 && ok1) {
      onAction({ type: 'play', payload: { cardId: card.id, pileIndex: 1 } }, actorId);
      if (side === 'bottom') setSelectedCardId(null);
      else setTopSelectedId(null);
      return;
    }
    if (ok0 && ok1) {
      if (side === 'bottom') {
        setSelectedCardId((prev) => (prev === card.id ? null : card.id));
      } else {
        setTopSelectedId((prev) => (prev === card.id ? null : card.id));
      }
    }
  };

  const handleLocalPileClick = (pileIndex: 0 | 1) => {
    if (state.phase !== 'playing') return;
    const bottomCard = state.me.fieldHand.find((c) => c.id === activeSelectedId);
    if (bottomCard && canPlaceOnSpeedPile(bottomCard, state.centerPiles[pileIndex], state.rules)) {
      onAction({ type: 'play', payload: { cardId: bottomCard.id, pileIndex } }, state.me.id);
      setSelectedCardId(null);
      return;
    }
    const topCard = state.opponent.fieldHand.find((c) => c.id === activeTopSelectedId);
    if (topCard && canPlaceOnSpeedPile(topCard, state.centerPiles[pileIndex], state.rules)) {
      onAction({ type: 'play', payload: { cardId: topCard.id, pileIndex } }, state.opponent.id);
      setTopSelectedId(null);
    }
  };

  if (isLocalPassAndPlay) {
    const winnerName =
      state.winnerId === state.me.id
        ? state.me.name
        : state.winnerId === state.opponent.id
        ? state.opponent.name
        : '';

    const bottomCard = state.me.fieldHand.find((c) => c.id === activeSelectedId) ?? null;
    const topCard = state.opponent.fieldHand.find((c) => c.id === activeTopSelectedId) ?? null;

    const renderPlayerZone = (side: 'top' | 'bottom') => {
      const player = side === 'bottom' ? state.me : state.opponent;
      const selId = side === 'bottom' ? activeSelectedId : activeTopSelectedId;
      return (
        <div className={`speed-local-zone ${side}`}>
          <div className="speed-local-header">
            <span className="speed-local-name">{player.name}</span>
            <span className="speed-local-deck">山札 {player.drawPileCount}枚</span>
          </div>
          <div className="speed-local-hand">
            {player.fieldHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="md"
                animateIn
                selected={selId === card.id}
                onClick={
                  state.phase === 'playing'
                    ? () => handleLocalCardClick(side, card)
                    : undefined
                }
              />
            ))}
          </div>
          {state.phase === 'playing' && (
            <div className="speed-local-controls">
              {!state.rules.autoRefill &&
                player.fieldHand.length < 4 &&
                player.drawPileCount > 0 && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => onAction({ type: 'refill' }, player.id)}
                  >
                    補充
                  </button>
                )}
              <button
                type="button"
                className={`primary-btn flex-1 ${player.readyFlip ? 'pulse' : ''}`}
                onClick={() => onAction({ type: 'readyFlip' }, player.id)}
              >
                {player.readyFlip ? '相手待ち…（取消）' : 'せーの！（めくる）'}
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="speed-local-arena">
        {renderPlayerZone('top')}

        <div className="speed-local-center">
          {state.phase === 'finished' ? (
            <div className="result-card full-width">
              <h3>{winnerName} の勝利！</h3>
            </div>
          ) : (
            <>
              <div className="speed-local-piles">
                {([0, 1] as const).map((pileIdx) => {
                  const pileCard = state.centerPiles[pileIdx];
                  const canDrop =
                    (bottomCard !== null &&
                      canPlaceOnSpeedPile(bottomCard, pileCard, state.rules)) ||
                    (topCard !== null && canPlaceOnSpeedPile(topCard, pileCard, state.rules));
                  return (
                    <div
                      key={pileIdx}
                      className={`speed-local-pile-wrap ${canDrop ? 'selectable' : ''}`}
                    >
                      <PlayingCard
                        card={pileCard}
                        size="lg"
                        animateIn
                        onClick={canDrop ? () => handleLocalPileClick(pileIdx) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="speed-local-log">
                {activeSelectedId || activeTopSelectedId
                  ? '出す台札をタップ'
                  : state.lastLog}
              </div>
            </>
          )}
        </div>

        {renderPlayerZone('bottom')}
      </div>
    );
  }

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
          return (
            <div key={pileIdx} className="speed-pile-slot">
              <div className="speed-pile-label">台札 {pileIdx + 1}</div>
              <PlayingCard
                card={state.centerPiles[pileIdx]}
                size="lg"
                animateIn
                onClick={activeSelectedId ? () => handlePileClick(pileIdx) : undefined}
              />
            </div>
          );
        })}
      </div>

      {state.phase === 'playing' ? (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {activeSelectedId
                ? '出す台札をタップしてください'
                : '手札を選択してから台札をタップ'}
            </span>
            <span>山札: {state.me.drawPileCount}枚</span>
          </div>
          <div className="speed-field-hand">
            {state.me.fieldHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="lg"
                animateIn
                selected={activeSelectedId === card.id}
                onClick={() => handleFieldCardClick(card.id)}
              />
            ))}
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
