import React, { useState } from 'react';
import { type SevensClientState, canPlaceNormalCard } from '../../games/sevens';
import { SUIT_COLORS, SUIT_SYMBOLS, formatRank } from '../../types/card';
import { PlayingCard } from '../PlayingCard';

interface SevensBoardProps {
  state: SevensClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

const SUITS = ['spade', 'heart', 'diamond', 'club'] as const;

export const SevensBoard: React.FC<SevensBoardProps> = ({ state, onAction }) => {
  const [jokerSelectedId, setJokerSelectedId] = useState<string | null>(null);
  const isMyTurn = state.phase === 'playing' && state.turnPlayerId === state.myId;

  const canPlayCard = (suit: string, rank: number): boolean => {
    if (suit === 'joker') return true;
    const s = suit as (typeof SUITS)[number];
    if (state.jokerSlots[`${s}-${rank}`]) return true;
    return canPlaceNormalCard(s, rank, {
      ...state,
      players: [],
      turnIndex: 0,
      finishedOrder: [],
      eliminatedOrder: [],
    });
  };

  const handleCardClick = (cardId: string, suit: string, rank: number) => {
    if (!isMyTurn) return;
    if (suit === 'joker') {
      setJokerSelectedId((prev) => (prev === cardId ? null : cardId));
      return;
    }
    if (!canPlayCard(suit, rank)) return;
    setJokerSelectedId(null);
    onAction({ type: 'play', payload: { cardId } });
  };

  const handleBoardCellClick = (suit: (typeof SUITS)[number], rank: number) => {
    if (!isMyTurn || !jokerSelectedId) return;
    const placeable = canPlaceNormalCard(suit, rank, {
      ...state,
      players: [],
      turnIndex: 0,
      finishedOrder: [],
      eliminatedOrder: [],
    });
    if (!placeable) return;
    onAction({
      type: 'play',
      payload: { cardId: jokerSelectedId, targetSuit: suit, targetRank: rank },
    });
    setJokerSelectedId(null);
  };

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = p.id === state.turnPlayerId && state.phase === 'playing';
          const limitLabel = state.rules.passLimit === 99 ? '∞' : state.rules.passLimit;
          return (
            <div key={p.id} className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">
                {p.finishRank !== null
                  ? `🏆${p.finishRank}位`
                  : p.eliminated
                  ? '💀ドボン'
                  : `🃏${p.handCount} | パス${p.passesUsed}/${limitLabel}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="sevens-grid-wrapper">
        {SUITS.map((suit) => (
          <div key={suit} className="sevens-row">
            <span className={`sevens-suit-label ${SUIT_COLORS[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
            <div className="sevens-cells">
              {Array.from({ length: 13 }, (_, idx) => {
                const rank = idx + 1;
                const placed = state.board[suit][rank];
                const isJoker = Boolean(state.jokerSlots[`${suit}-${rank}`]);
                const canDropJoker =
                  Boolean(jokerSelectedId) &&
                  canPlaceNormalCard(suit, rank, {
                    ...state,
                    players: [],
                    turnIndex: 0,
                    finishedOrder: [],
                    eliminatedOrder: [],
                  });
                return (
                  <button
                    key={rank}
                    type="button"
                    disabled={!canDropJoker}
                    onClick={() => handleBoardCellClick(suit, rank)}
                    className={[
                      'sevens-cell',
                      placed ? 'placed' : 'empty',
                      rank === 7 ? 'seven' : '',
                      isJoker ? 'joker-slot' : '',
                      canDropJoker ? 'joker-target' : '',
                      SUIT_COLORS[suit],
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isJoker ? '🃏' : placed ? formatRank(rank as 1) : rank === 7 ? '7' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {state.phase === 'playing' ? (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {jokerSelectedId
                ? '🃏 ボードの光っている場所をタップして配置'
                : isMyTurn
                ? '🟢 出せるカードが光っています'
                : '相手のターン待機中…'}
            </span>
          </div>
          <div className="hand-scroll">
            {state.myHand.map((card) => {
              const playable = isMyTurn && canPlayCard(card.suit, card.rank);
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  highlight={playable}
                  selected={jokerSelectedId === card.id}
                  disabled={!playable}
                  onClick={() => handleCardClick(card.id, card.suit, card.rank)}
                />
              );
            })}
          </div>
          <div className="action-bar">
            <button
              type="button"
              className="secondary-btn full-width"
              disabled={!isMyTurn}
              onClick={() => {
                setJokerSelectedId(null);
                onAction({ type: 'pass' });
              }}
            >
              パスする
            </button>
          </div>
        </div>
      ) : (
        <div className="result-card">
          <h3>🏆 結果発表</h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99))
              .map((p) => (
                <li key={p.id}>
                  <span>{p.eliminated ? '💀 ドボン' : `${p.finishRank}位`}</span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
