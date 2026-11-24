import React, { useState } from 'react';
import {
  AlertTriangle,
  Layers,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  type Crazy8ClientState,
  type Crazy8Suit,
  canPlayCrazy8Card,
} from '../../games/crazy8';
import { SUIT_COLORS, SUIT_SYMBOLS, formatCardShort } from '../../types/card';
import { PlayingCard } from '../PlayingCard';

interface Crazy8BoardProps {
  state: Crazy8ClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

const SUIT_OPTIONS: { suit: Crazy8Suit; label: string }[] = [
  { suit: 'spade', label: 'スペード' },
  { suit: 'heart', label: 'ハート' },
  { suit: 'diamond', label: 'ダイヤ' },
  { suit: 'club', label: 'クラブ' },
];

export const Crazy8Board: React.FC<Crazy8BoardProps> = ({ state, onAction }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingEightId, setPendingEightId] = useState<string | null>(null);

  const isMyTurn = state.phase === 'playing' && state.turnPlayerId === state.myId;
  const activeSelectedCard = state.myHand.find((c) => c.id === selectedCardId) ?? null;
  const activePendingEight = state.myHand.find((c) => c.id === pendingEightId) ?? null;

  const playableIds = new Set(
    state.myHand
      .filter((c) =>
        canPlayCrazy8Card(c, state.topCard, state.currentSuit, state.pendingDraw, state.rules)
      )
      .map((c) => c.id)
  );

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn) return;
    if (!playableIds.has(cardId)) return;

    const card = state.myHand.find((c) => c.id === cardId);
    if (!card) return;

    if (card.rank === 8) {
      setSelectedCardId(cardId);
      setPendingEightId(cardId);
      return;
    }

    setPendingEightId(null);
    if (selectedCardId === cardId) {
      onAction({ type: 'play', payload: { cardId } });
      setSelectedCardId(null);
    } else {
      setSelectedCardId(cardId);
    }
  };

  const handlePlaySelected = () => {
    if (!isMyTurn || !activeSelectedCard) return;
    if (activeSelectedCard.rank === 8) {
      setPendingEightId(activeSelectedCard.id);
      return;
    }
    onAction({ type: 'play', payload: { cardId: activeSelectedCard.id } });
    setSelectedCardId(null);
  };

  const handleChooseSuit = (suit: Crazy8Suit) => {
    if (!isMyTurn || !activePendingEight) return;
    onAction({
      type: 'play',
      payload: { cardId: activePendingEight.id, chosenSuit: suit },
    });
    setPendingEightId(null);
    setSelectedCardId(null);
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    setPendingEightId(null);
    setSelectedCardId(null);
    onAction({ type: 'draw' });
  };

  const suitIsRed = SUIT_COLORS[state.currentSuit] === 'red';

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && p.id === state.turnPlayerId;
          const isWinner = state.winnerId === p.id;
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}
            >
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">
                {isWinner ? '上がり' : `手札 ${p.handCount}枚`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="status-flags">
        <span
          className="flag-badge info"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: suitIsRed ? 'rgba(239, 68, 68, 0.22)' : 'rgba(148, 163, 184, 0.22)',
            color: suitIsRed ? '#fca5a5' : '#f8fafc',
          }}
        >
          指定スート: {SUIT_SYMBOLS[state.currentSuit]}
        </span>
        <span
          className="flag-badge info"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {state.direction === 1 ? <RotateCw size={12} /> : <RotateCcw size={12} />}
          {state.direction === 1 ? '時計回り' : '反時計回り'}
        </span>
        <span
          className="flag-badge warn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Layers size={12} /> 山札 {state.deckCount}枚
        </span>
        {state.pendingDraw > 0 && (
          <span
            className="flag-badge danger"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <AlertTriangle size={12} /> ドロー累積 +{state.pendingDraw}
          </span>
        )}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="table-center">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <PlayingCard
              faceDown
              size="lg"
              disabled={!isMyTurn}
              onClick={isMyTurn ? handleDraw : undefined}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
              山札 ({state.deckCount})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <PlayingCard
              card={state.topCard}
              size="lg"
              animateIn
              highlight={state.topCard.rank === 8}
              badge={
                state.topCard.rank === 8
                  ? SUIT_SYMBOLS[state.currentSuit]
                  : state.pendingDraw > 0
                  ? `+${state.pendingDraw}`
                  : undefined
              }
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fde68a' }}>
              場札（{SUIT_SYMBOLS[state.currentSuit]}）
            </span>
          </div>
        </div>
      </div>

      {isMyTurn && activePendingEight && (
        <div
          className="card-panel"
          style={{
            borderColor: 'rgba(245, 158, 11, 0.55)',
            background: 'rgba(15, 23, 42, 0.92)',
          }}
        >
          <div
            className="field-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#fde68a',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={13} /> 8ワイルド：次のスートを選択
            </span>
            <button
              type="button"
              className="text-link-btn"
              onClick={() => {
                setPendingEightId(null);
                setSelectedCardId(null);
              }}
            >
              キャンセル
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}
          >
            {SUIT_OPTIONS.map(({ suit, label }) => {
              const isRed = SUIT_COLORS[suit] === 'red';
              return (
                <button
                  key={suit}
                  type="button"
                  className="secondary-btn"
                  style={{
                    flexDirection: 'column',
                    padding: '10px 6px',
                    gap: 2,
                    color: isRed ? '#f87171' : '#f8fafc',
                    borderColor: isRed ? 'rgba(248, 113, 113, 0.45)' : 'rgba(255, 255, 255, 0.25)',
                  }}
                  onClick={() => handleChooseSuit(suit)}
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{SUIT_SYMBOLS[suit]}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.phase === 'playing' ? (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {isMyTurn
                ? state.pendingDraw > 0
                  ? `あなたのターン（2を重ねるか +${state.pendingDraw}枚引く）`
                  : 'あなたのターン'
                : '相手のターン待機中'}
            </span>
            <span>手札 {state.myHand.length}枚</span>
          </div>

          <div className="hand-scroll">
            {state.myHand.map((card) => {
              const canPlay = isMyTurn && playableIds.has(card.id);
              const isSelected = activeSelectedCard?.id === card.id;
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={isSelected}
                  highlight={canPlay && !isSelected}
                  disabled={!canPlay}
                  onClick={canPlay ? () => handleCardClick(card.id) : undefined}
                />
              );
            })}
          </div>

          <div className="action-bar">
            <button
              type="button"
              className={state.pendingDraw > 0 ? 'danger-btn' : 'secondary-btn'}
              disabled={!isMyTurn}
              onClick={handleDraw}
            >
              {state.pendingDraw > 0 ? `+${state.pendingDraw}枚引く` : '1枚引く'}
            </button>
            <button
              type="button"
              className="primary-btn flex-1"
              disabled={!isMyTurn || !activeSelectedCard || !playableIds.has(activeSelectedCard.id)}
              onClick={handlePlaySelected}
            >
              {activeSelectedCard
                ? activeSelectedCard.rank === 8
                  ? `${formatCardShort(activeSelectedCard)} でスート選択`
                  : `${formatCardShort(activeSelectedCard)} を出す`
                : playableIds.size > 0
                ? '出せるカードを選択'
                : '出せるカードがありません'}
            </button>
          </div>
        </div>
      ) : (
        <div className="result-card">
          <h3>
            <Trophy size={18} /> 対局結果
          </h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => a.handCount - b.handCount)
              .map((p, idx) => (
                <li key={p.id}>
                  <span>{p.id === state.winnerId ? '優勝（上がり）' : `${idx + 1}位（残り ${p.handCount}枚）`}</span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
