import React, { useEffect, useState } from 'react';
import { Coins, Minus, Plus, RefreshCw, Trophy } from 'lucide-react';
import type { PokerClientState } from '../../games/poker';
import { PlayingCard } from '../PlayingCard';
import '../BetControl.css';

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
  const maxRaise = Math.max(0, (me?.chips ?? 0) - toCall);
  const step = Math.max(5, state.rules.ante);
  const minRaise = Math.min(maxRaise, state.rules.ante * 2);

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaise);

  useEffect(() => {
    setRaiseAmount((prev) => {
      if (maxRaise <= 0) return 0;
      if (prev < minRaise || prev > maxRaise) return minRaise;
      return prev;
    });
  }, [minRaise, maxRaise, state.subPhase, state.round]);

  const clampRaise = (val: number) => Math.max(minRaise, Math.min(maxRaise, val));
  const halfPot = clampRaise(Math.max(minRaise, Math.round(state.pot / 2 / step) * step));
  const fullPot = clampRaise(Math.max(minRaise, Math.round(state.pot / step) * step));
  const isAllIn = maxRaise > 0 && raiseAmount >= maxRaise;

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
            <>
              {isMyTurn && maxRaise > 0 && (
                <div className="bet-adjuster">
                  <div className="bet-adjuster-top">
                    <span>{toCall === 0 ? 'ベット額調整' : '上乗せレイズ額'}</span>
                    <span className="bet-adjuster-amount">
                      <Coins size={13} />
                      {isAllIn
                        ? `ALL IN (${toCall + maxRaise})`
                        : toCall === 0
                        ? `${raiseAmount}`
                        : `+${raiseAmount} (計 ${toCall + raiseAmount})`}
                    </span>
                  </div>
                  <div className="bet-presets-row">
                    <button
                      type="button"
                      className={`bet-preset-btn ${raiseAmount === minRaise ? 'active' : ''}`}
                      onClick={() => setRaiseAmount(minRaise)}
                    >
                      MIN
                    </button>
                    <button
                      type="button"
                      className={`bet-preset-btn ${raiseAmount === halfPot ? 'active' : ''}`}
                      onClick={() => setRaiseAmount(halfPot)}
                    >
                      1/2 POT
                    </button>
                    <button
                      type="button"
                      className={`bet-preset-btn ${raiseAmount === fullPot ? 'active' : ''}`}
                      onClick={() => setRaiseAmount(fullPot)}
                    >
                      POT
                    </button>
                    <button
                      type="button"
                      className={`bet-preset-btn allin ${isAllIn ? 'active' : ''}`}
                      onClick={() => setRaiseAmount(maxRaise)}
                    >
                      ALL IN
                    </button>
                  </div>
                  <div className="bet-slider-row">
                    <button
                      type="button"
                      className="bet-step-btn"
                      disabled={raiseAmount <= minRaise}
                      onClick={() => setRaiseAmount((v) => clampRaise(v - step))}
                      aria-label="ベット額を減らす"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="range"
                      className="bet-range-slider"
                      min={minRaise}
                      max={maxRaise}
                      step={step}
                      value={Math.min(maxRaise, Math.max(minRaise, raiseAmount))}
                      onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="bet-step-btn"
                      disabled={raiseAmount >= maxRaise}
                      onClick={() => setRaiseAmount((v) => clampRaise(v + step))}
                      aria-label="ベット額を増やす"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}

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
                  {toCall === 0 ? 'チェック' : `コール (${Math.min(me?.chips ?? 0, toCall)})`}
                </button>
                <button
                  type="button"
                  className={isAllIn ? 'danger-btn' : 'primary-btn'}
                  disabled={!isMyTurn || maxRaise <= 0}
                  onClick={() => onAction({ type: 'raise', payload: { amount: raiseAmount } })}
                >
                  {isAllIn
                    ? 'ALL IN'
                    : toCall === 0
                    ? `ベット ${raiseAmount}`
                    : `レイズ +${raiseAmount}`}
                </button>
              </div>
            </>
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
