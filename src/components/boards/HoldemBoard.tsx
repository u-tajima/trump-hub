import React from 'react';
import { Coins, Trophy } from 'lucide-react';
import type { HoldemClientState } from '../../games/holdem';
import { PlayingCard } from '../PlayingCard';

interface HoldemBoardProps {
  state: HoldemClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

const PHASE_LABEL: Record<HoldemClientState['subPhase'], string> = {
  preflop: 'プリフロップ',
  flop: 'フロップ',
  turn: 'ターン',
  river: 'リバー',
  showdown: 'ショーダウン',
};

export const HoldemBoard: React.FC<HoldemBoardProps> = ({ state, onAction }) => {
  const isMyTurn =
    state.phase === 'playing' &&
    state.subPhase !== 'showdown' &&
    state.turnPlayerId === state.myId;

  const me = state.players.find((p) => p.id === state.myId);
  const toCall = me ? Math.max(0, state.highestBet - me.currentBet) : 0;

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          {PHASE_LABEL[state.subPhase]} ({state.round}/{state.rules.rounds})
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

      <div className="table-center holdem-table">
        <div className="holdem-community-label">コミュニティカード</div>
        <div className="table-cards-row">
          {Array.from({ length: 5 }, (_, idx) => {
            const card = state.communityCards[idx];
            return card ? (
              <PlayingCard key={card.id} card={card} size="sm" flipIn />
            ) : (
              <div key={idx} className="empty-community-slot" />
            );
          })}
        </div>
      </div>

      {state.subPhase === 'showdown' && (
        <div className="poker-showdown-list">
          {state.players
            .filter((p) => !p.folded && p.revealedHole)
            .map((p) => (
              <div
                key={p.id}
                className={`poker-showdown-row ${
                  state.handWinners.includes(p.id) ? 'winner' : ''
                }`}
              >
                <div className="poker-showdown-header">
                  <strong>{p.name}</strong>
                  {p.evaluated && <span className="hand-rank-badge">{p.evaluated.name}</span>}
                </div>
                <div className="table-cards-row">
                  {p.revealedHole!.map((c) => (
                    <PlayingCard key={c.id} card={c} size="xs" flipIn />
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
              {me?.evaluated ? `現在のベスト役: ${me.evaluated.name}` : 'あなたのホールカード'}
            </span>
            <span>{isMyTurn ? 'あなたのターン' : '相手を待機中'}</span>
          </div>
          <div className="speed-field-hand">
            {state.myHoleCards.map((card) => (
              <PlayingCard key={card.id} card={card} size="lg" flipIn />
            ))}
          </div>
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
              onClick={() => onAction({ type: 'raise', payload: { amount: state.rules.bigBlind } })}
            >
              レイズ +{state.rules.bigBlind}
            </button>
          </div>
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
