import React, { useState } from 'react';
import { Coins, RefreshCw, Trophy } from 'lucide-react';
import type { PokerClientState } from '../../games/poker';
import { PlayingCard } from '../PlayingCard';

interface PokerBoardProps {
  state: PokerClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const PokerBoard: React.FC<PokerBoardProps> = ({ state, onAction }) => {
  const [discardIds, setDiscardIds] = useState<string[]>([]);
  const isMyTurn =
    state.phase === 'playing' &&
    state.subPhase !== 'showdown' &&
    state.turnPlayerId === state.myId;

  const me = state.players.find((p) => p.id === state.myId);
  const toCall = me ? Math.max(0, state.highestBet - me.currentBet) : 0;

  const toggleDiscard = (id: string) => {
    if (!isMyTurn || state.subPhase !== 'draw') return;
    setDiscardIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDraw = () => {
    onAction({ type: 'draw', payload: { discardIds } });
    setDiscardIds([]);
  };

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          ハンド {state.round} / {state.rules.rounds}
        </span>
        <span className="flag-badge warn">
          <Coins size={12} /> ポット: {state.pot}
        </span>
      </div>

      <div className="opponents-bar">
        {state.players.map((p, idx) => {
          const active =
            state.phase === 'playing' &&
            state.subPhase !== 'showdown' &&
            p.id === state.turnPlayerId;
          const isWinner = state.handWinners.includes(p.id);
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}
            >
              <div className="opp-name">
                {idx === state.dealerIndex ? '[D] ' : ''}
                {p.name}
              </div>
              <div className="opp-meta">
                {p.folded
                  ? 'FOLD'
                  : isWinner && state.subPhase === 'showdown'
                  ? `WIN (${p.chips})`
                  : `${p.chips} (BET ${p.currentBet})`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {state.subPhase === 'showdown' && (
        <div className="poker-showdown-list">
          {state.players
            .filter((p) => !p.folded && p.revealedHand)
            .map((p) => (
              <div
                key={p.id}
                className={`poker-showdown-row ${
                  state.handWinners.includes(p.id) ? 'winner' : ''
                }`}
              >
                <div className="poker-showdown-header">
                  <strong>{p.name}</strong>
                  <span className="hand-rank-badge">{p.evaluated?.name}</span>
                </div>
                <div className="table-cards-row">
                  {p.revealedHand!.map((c) => (
                    <PlayingCard key={c.id} card={c} size="xs" animateIn />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {state.phase === 'playing' && state.subPhase === 'showdown' && (
        <div className="sticky-bottom-bar">
          <button
            type="button"
            className="primary-btn full-width"
            onClick={() => onAction({ type: 'nextHand' })}
          >
            次のハンドへ進む
          </button>
        </div>
      )}

      {state.phase === 'playing' && state.subPhase !== 'showdown' && (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {me?.evaluated ? `現在の役: ${me.evaluated.name}` : 'あなたの手札'}
            </span>
            <span>
              {state.subPhase === 'draw' && isMyTurn
                ? `交換カード選択 (${discardIds.length}枚)`
                : isMyTurn
                ? 'あなたのターン'
                : '相手を待機中'}
            </span>
          </div>
          <div className="hand-scroll">
            {state.myHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="md"
                animateIn
                selected={discardIds.includes(card.id)}
                onClick={
                  state.subPhase === 'draw' && isMyTurn
                    ? () => toggleDiscard(card.id)
                    : undefined
                }
              />
            ))}
          </div>

          {state.subPhase === 'draw' ? (
            <div className="action-bar">
              <button
                type="button"
                className="primary-btn full-width"
                disabled={!isMyTurn}
                onClick={handleDraw}
              >
                <RefreshCw size={16} />
                {discardIds.length === 0
                  ? '交換せずにステイ'
                  : `${discardIds.length}枚を交換する`}
              </button>
            </div>
          ) : (
            <div className="action-bar">
              <button
                type="button"
                className="secondary-btn"
                disabled={!isMyTurn}
                onClick={() => onAction({ type: 'fold' })}
              >
                フォールド
              </button>
              <button
                type="button"
                className="secondary-btn flex-1"
                disabled={!isMyTurn}
                onClick={() => onAction({ type: 'call' })}
              >
                {toCall === 0 ? 'チェック' : `コール (${toCall})`}
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!isMyTurn || (me?.chips ?? 0) <= toCall}
                onClick={() => onAction({ type: 'raise', payload: { amount: 20 } })}
              >
                レイズ +20
              </button>
            </div>
          )}
        </div>
      )}

      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            <Trophy size={18} /> 最終チップランキング
          </h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => b.chips - a.chips)
              .map((p, idx) => (
                <li key={p.id}>
                  <span>
                    {idx + 1}位 ({p.chips} チップ)
                  </span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
