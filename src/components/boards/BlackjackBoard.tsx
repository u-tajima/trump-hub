import React, { useEffect, useState } from 'react';
import { Coins, Minus, Plus, Shield, Trophy } from 'lucide-react';
import type { BlackjackClientState, BlackjackResult } from '../../games/blackjack';
import { PlayingCard } from '../PlayingCard';
import '../BetControl.css';

interface BlackjackBoardProps {
  state: BlackjackClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

function resultBadgeStyle(result: BlackjackResult): {
  label: string;
  bg: string;
  color: string;
} | null {
  switch (result) {
    case 'bj':
      return { label: 'BJ +1.5x', bg: 'rgba(245, 158, 11, 0.28)', color: '#fde68a' };
    case 'win':
      return { label: 'WIN', bg: 'rgba(16, 185, 129, 0.28)', color: '#6ee7b7' };
    case 'push':
      return { label: 'PUSH', bg: 'rgba(148, 163, 184, 0.28)', color: '#e2e8f0' };
    case 'bust':
      return { label: 'BUST', bg: 'rgba(239, 68, 68, 0.28)', color: '#fca5a5' };
    case 'lose':
      return { label: 'LOSE', bg: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' };
    default:
      return null;
  }
}

export const BlackjackBoard: React.FC<BlackjackBoardProps> = ({ state, onAction }) => {
  const me = state.players.find((p) => p.id === state.myId);
  const myChips = me?.chips ?? 0;
  const minBet = Math.min(myChips, Math.max(1, state.rules.minBet));
  const step = Math.max(1, state.rules.minBet);

  const [betAmount, setBetAmount] = useState<number>(minBet);

  useEffect(() => {
    setBetAmount((prev) => {
      if (myChips <= 0) return 0;
      if (prev < minBet || prev > myChips) return minBet;
      return prev;
    });
  }, [minBet, myChips, state.round, state.subPhase]);

  const clampBet = (v: number) => Math.max(minBet, Math.min(myChips, v));
  const doubleBet = clampBet(minBet * 2);
  const fiveBet = clampBet(minBet * 5);

  const isMyBetTurn =
    state.phase === 'playing' &&
    state.subPhase === 'betting' &&
    !!me &&
    !me.betConfirmed &&
    me.chips > 0;

  const isMyPlayTurn =
    state.phase === 'playing' &&
    state.subPhase === 'playing' &&
    state.turnPlayerId === state.myId;

  const canDouble =
    isMyPlayTurn &&
    !!me &&
    me.hand.length === 2 &&
    me.chips >= me.bet;

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          ラウンド {state.round} / {state.rules.rounds > 0 ? state.rules.rounds : '∞'}
        </span>
        <span
          className="flag-badge warn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Coins size={12} /> 最小ベット: {state.rules.minBet}
        </span>
        {me && (
          <span
            className="flag-badge info"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            所持: {me.chips}
          </span>
        )}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* ディーラーエリア */}
      <div
        className="card-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          background: 'radial-gradient(circle, rgba(20, 83, 45, 0.55) 0%, rgba(7, 25, 16, 0.65) 100%)',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#fde68a' }}>
            <Shield size={13} /> ディーラー
          </span>
          <span
            className={`flag-badge ${
              state.dealerEval.isBust
                ? 'danger'
                : state.dealerEval.isBlackjack
                ? 'warn'
                : 'info'
            }`}
          >
            {state.dealerHand.length === 0
              ? '待機中'
              : state.dealerHoleHidden
              ? `${state.dealerEval.total} + ?`
              : state.dealerEval.isBlackjack
              ? 'BJ 21'
              : state.dealerEval.isBust
              ? `BUST (${state.dealerEval.total})`
              : `${state.dealerEval.total}`}
          </span>
        </div>

        <div className="table-cards-row" style={{ minHeight: 74, alignItems: 'center' }}>
          {state.dealerHand.length === 0 ? (
            <div className="empty-table-hint">ベット確定後にカードが配られます</div>
          ) : (
            <>
              {state.dealerHand.map((card) => (
                <PlayingCard key={card.id} card={card} size="sm" animateIn />
              ))}
              {state.dealerHoleHidden && <PlayingCard faceDown size="sm" animateIn />}
            </>
          )}
        </div>
      </div>

      {/* プレイヤー一覧エリア */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: state.players.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        {state.players.map((p) => {
          const isActive =
            state.phase === 'playing' &&
            ((state.subPhase === 'playing' && p.id === state.turnPlayerId) ||
              (state.subPhase === 'betting' && !p.betConfirmed));
          const isMe = p.id === state.myId;
          const badge = resultBadgeStyle(p.result);

          return (
            <div
              key={p.id}
              className="card-panel"
              style={{
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                borderColor: isActive
                  ? 'var(--accent-gold)'
                  : isMe
                  ? 'rgba(16, 185, 129, 0.45)'
                  : 'var(--border-subtle)',
                background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 0, 0, 0.3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <strong
                  style={{
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.name}
                  {isMe ? ' (あなた)' : ''}
                </strong>
                {badge ? (
                  <span
                    className="flag-badge"
                    style={{ background: badge.bg, color: badge.color, fontSize: 10, padding: '2px 7px' }}
                  >
                    {badge.label}
                  </span>
                ) : p.hand.length > 0 ? (
                  <span
                    className={`flag-badge ${
                      p.eval.isBust ? 'danger' : p.eval.isBlackjack ? 'warn' : 'info'
                    }`}
                    style={{ fontSize: 10, padding: '2px 7px' }}
                  >
                    {p.eval.isBlackjack
                      ? 'BJ 21'
                      : p.eval.isBust
                      ? `BUST ${p.eval.total}`
                      : `${p.eval.total}${p.eval.isSoft ? ' (S)' : ''}`}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {p.status === 'out'
                      ? '破産'
                      : p.betConfirmed
                      ? 'ベット済'
                      : 'ベット中'}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                <span>チップ: {p.chips}</span>
                <span style={{ color: p.bet > 0 ? '#fde68a' : undefined }}>
                  BET: {p.bet}
                </span>
              </div>

              {p.hand.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    overflowX: 'auto',
                    paddingTop: 2,
                  }}
                >
                  {p.hand.map((c) => (
                    <PlayingCard key={c.id} card={c} size="xs" animateIn />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 下部操作エリア */}
      {state.phase === 'playing' && state.subPhase === 'betting' && (
        <div className="hand-area">
          {isMyBetTurn ? (
            <>
              <div className="bet-adjuster" style={{ marginBottom: 0 }}>
                <div className="bet-adjuster-top">
                  <span>ベット額を選択</span>
                  <span className="bet-adjuster-amount">
                    <Coins size={13} /> {betAmount} チップ
                  </span>
                </div>
                <div className="bet-presets-row">
                  <button
                    type="button"
                    className={`bet-preset-btn ${betAmount === minBet ? 'active' : ''}`}
                    onClick={() => setBetAmount(minBet)}
                  >
                    MIN ({minBet})
                  </button>
                  <button
                    type="button"
                    className={`bet-preset-btn ${betAmount === doubleBet ? 'active' : ''}`}
                    onClick={() => setBetAmount(doubleBet)}
                  >
                    2x ({doubleBet})
                  </button>
                  <button
                    type="button"
                    className={`bet-preset-btn ${betAmount === fiveBet ? 'active' : ''}`}
                    onClick={() => setBetAmount(fiveBet)}
                  >
                    5x ({fiveBet})
                  </button>
                  <button
                    type="button"
                    className={`bet-preset-btn allin ${betAmount === myChips ? 'active' : ''}`}
                    onClick={() => setBetAmount(myChips)}
                  >
                    ALL IN
                  </button>
                </div>
                <div className="bet-slider-row">
                  <button
                    type="button"
                    className="bet-step-btn"
                    disabled={betAmount <= minBet}
                    onClick={() => setBetAmount((v) => clampBet(v - step))}
                    aria-label="ベットを減らす"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="range"
                    className="bet-range-slider"
                    min={minBet}
                    max={myChips}
                    step={1}
                    value={Math.min(myChips, Math.max(minBet, betAmount))}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (raw >= myChips - step / 2) {
                        setBetAmount(myChips);
                      } else {
                        setBetAmount(clampBet(Math.round(raw / step) * step));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="bet-step-btn"
                    disabled={betAmount >= myChips}
                    onClick={() => setBetAmount((v) => clampBet(v + step))}
                    aria-label="ベットを増やす"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="primary-btn full-width"
                onClick={() => onAction({ type: 'placeBet', payload: { amount: betAmount } })}
              >
                {betAmount} チップでベット確定
              </button>
            </>
          ) : (
            <div className="waiting-banner">
              {me && me.chips <= 0
                ? 'チップが尽きたため観戦中です'
                : '他プレイヤーのベット確定を待っています...'}
            </div>
          )}
        </div>
      )}

      {state.phase === 'playing' && state.subPhase === 'playing' && (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {isMyPlayTurn ? 'あなたのターン' : '他プレイヤーの行動を待機中'}
            </span>
            {me && me.hand.length > 0 && (
              <span>
                合計: {me.eval.total}
                {me.eval.isSoft ? ' (ソフト)' : ''}
              </span>
            )}
          </div>
          <div className="action-bar">
            <button
              type="button"
              className="primary-btn flex-1"
              disabled={!isMyPlayTurn}
              onClick={() => onAction({ type: 'hit' })}
            >
              ヒット
            </button>
            <button
              type="button"
              className="secondary-btn flex-1"
              disabled={!isMyPlayTurn}
              onClick={() => onAction({ type: 'stand' })}
            >
              スタンド
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!canDouble}
              onClick={() => onAction({ type: 'double' })}
            >
              ダブル
            </button>
          </div>
        </div>
      )}

      {state.phase === 'playing' && state.subPhase === 'roundEnd' && (
        <div className="sticky-bottom-bar">
          <button
            type="button"
            className="primary-btn full-width"
            onClick={() => onAction({ type: 'nextRound' })}
          >
            次のラウンドへ進む
          </button>
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
