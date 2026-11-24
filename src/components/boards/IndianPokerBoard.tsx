import React, { useEffect, useState } from 'react';
import { Coins, Eye, EyeOff, Minus, Plus, Trophy } from 'lucide-react';
import type { IndianPokerClientState } from '../../games/indianPoker';
import { formatCardShort } from '../../types/card';
import { PlayingCard } from '../PlayingCard';
import '../BetControl.css';

interface IndianPokerBoardProps {
  state: IndianPokerClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const IndianPokerBoard: React.FC<IndianPokerBoardProps> = ({ state, onAction }) => {
  const me = state.players.find((p) => p.id === state.myId);
  const opponents = state.players.filter((p) => p.id !== state.myId);

  const isMyTurn =
    state.phase === 'playing' &&
    state.subPhase === 'betting' &&
    state.turnPlayerId === state.myId;

  const ante = Math.max(1, state.rules.ante);
  const toCall = me ? Math.max(0, state.highestBet - me.currentBet) : 0;
  const maxRaise = Math.max(0, (me?.chips ?? 0) - toCall);
  const minRaise = Math.min(maxRaise, ante);

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaise);

  useEffect(() => {
    setRaiseAmount((prev) => {
      if (maxRaise <= 0) return 0;
      if (prev < minRaise || prev > maxRaise) return minRaise;
      return prev;
    });
  }, [minRaise, maxRaise, state.round, state.subPhase]);

  const clampRaise = (v: number) => Math.max(minRaise, Math.min(maxRaise, v));
  const raise1x = clampRaise(ante);
  const raise2x = clampRaise(ante * 2);
  const raise3x = clampRaise(ante * 3);
  const isAllIn = maxRaise > 0 && raiseAmount >= maxRaise;

  const isShowdown = state.subPhase === 'showdown' || state.phase === 'finished';

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
          <Coins size={12} /> ポット: {state.pot}
        </span>
        <span className="flag-badge info">アンティ: {state.rules.ante}</span>
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 相手プレイヤーの公開カードエリア（画面上部に大きく表向き表示） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            opponents.length === 1
              ? '1fr'
              : opponents.length === 2
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(auto-fit, minmax(112px, 1fr))',
          gap: 8,
        }}
      >
        {opponents.map((opp) => {
          const isTurn =
            state.phase === 'playing' &&
            state.subPhase === 'betting' &&
            opp.id === state.turnPlayerId;
          const isWinner = isShowdown && state.roundWinnerId === opp.id;

          return (
            <div
              key={opp.id}
              className="card-panel"
              style={{
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                opacity: opp.folded || opp.eliminated ? 0.55 : 1,
                borderColor: isWinner
                  ? 'var(--accent-emerald)'
                  : isTurn
                  ? 'var(--accent-gold)'
                  : 'var(--border-subtle)',
                background: isWinner
                  ? 'rgba(16, 185, 129, 0.16)'
                  : isTurn
                  ? 'rgba(245, 158, 11, 0.14)'
                  : 'rgba(0, 0, 0, 0.3)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                }}
              >
                <strong
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {opp.name}
                </strong>
                {isWinner ? (
                  <span
                    className="flag-badge"
                    style={{
                      background: 'rgba(16, 185, 129, 0.28)',
                      color: '#6ee7b7',
                      fontSize: 10,
                      padding: '1px 6px',
                    }}
                  >
                    WIN
                  </span>
                ) : opp.eliminated ? (
                  <span className="flag-badge danger" style={{ fontSize: 10, padding: '1px 6px' }}>
                    OUT
                  </span>
                ) : opp.folded ? (
                  <span className="flag-badge danger" style={{ fontSize: 10, padding: '1px 6px' }}>
                    FOLD
                  </span>
                ) : null}
              </div>

              <PlayingCard
                card={opp.card ?? undefined}
                faceDown={!opp.card}
                size={opponents.length <= 2 ? 'lg' : 'md'}
                animateIn
                highlight={isWinner}
              />

              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span>チップ {opp.chips}</span>
                {opp.currentBet > 0 && (
                  <span style={{ color: '#fde68a', fontWeight: 700 }}>BET {opp.currentBet}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 自分のおでこカードエリア */}
      {me && (
        <div
          className="table-center"
          style={{
            minHeight: 150,
            borderColor:
              isShowdown && state.roundWinnerId === me.id
                ? 'var(--accent-emerald)'
                : isMyTurn
                ? 'var(--accent-gold)'
                : 'rgba(255, 255, 255, 0.16)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 800,
              color: isShowdown ? '#fde68a' : '#cbd5e1',
            }}
          >
            {me.card ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>
              {me.eliminated
                ? 'チップが尽きたため観戦中'
                : me.card
                ? `あなたのカード: ${formatCardShort(me.card)}${
                    state.roundWinnerId === me.id ? ' — WIN!' : ''
                  }`
                : 'あなたのおでこカード（自分だけ見えません）'}
            </span>
          </div>

          <PlayingCard
            card={me.card ?? undefined}
            faceDown={!me.card}
            size="lg"
            flipIn={isShowdown && !!me.card}
            highlight={isShowdown && state.roundWinnerId === me.id}
            badge={
              isShowdown && state.roundWinnerId === me.id
                ? 'WIN'
                : me.folded && !me.eliminated
                ? 'FOLD'
                : undefined
            }
          />

          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'flex',
              gap: 12,
            }}
          >
            <span>所持チップ: {me.chips}</span>
            <span style={{ color: '#fde68a', fontWeight: 700 }}>
              現在ベット: {me.currentBet}
            </span>
          </div>
        </div>
      )}

      {/* ショーダウン時の次ラウンドボタン */}
      {state.phase === 'playing' && state.subPhase === 'showdown' && (
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

      {/* ベット操作エリア */}
      {state.phase === 'playing' && state.subPhase === 'betting' && (
        <div className="hand-area">
          <div className="hand-header">
            <span>{isMyTurn ? 'あなたのターン' : '相手の行動を待機中'}</span>
            <span>{toCall > 0 ? `コール必要額: ${toCall}` : 'チェック可能'}</span>
          </div>

          {isMyTurn && maxRaise > 0 && (
            <div className="bet-adjuster">
              <div className="bet-adjuster-top">
                <span>{toCall === 0 ? 'ベット額（アンティ単位）' : '上乗せレイズ額'}</span>
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
                  className={`bet-preset-btn ${raiseAmount === raise1x ? 'active' : ''}`}
                  onClick={() => setRaiseAmount(raise1x)}
                >
                  +{raise1x}
                </button>
                <button
                  type="button"
                  className={`bet-preset-btn ${raiseAmount === raise2x ? 'active' : ''}`}
                  onClick={() => setRaiseAmount(raise2x)}
                >
                  +{raise2x}
                </button>
                <button
                  type="button"
                  className={`bet-preset-btn ${raiseAmount === raise3x ? 'active' : ''}`}
                  onClick={() => setRaiseAmount(raise3x)}
                >
                  +{raise3x}
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
                  onClick={() => setRaiseAmount((v) => clampRaise(v - ante))}
                  aria-label="レイズ額を減らす"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="range"
                  className="bet-range-slider"
                  min={minRaise}
                  max={maxRaise}
                  step={1}
                  value={Math.min(maxRaise, Math.max(minRaise, raiseAmount))}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (raw >= maxRaise - ante / 2) {
                      setRaiseAmount(maxRaise);
                    } else {
                      setRaiseAmount(clampRaise(Math.round(raw / ante) * ante));
                    }
                  }}
                />
                <button
                  type="button"
                  className="bet-step-btn"
                  disabled={raiseAmount >= maxRaise}
                  onClick={() => setRaiseAmount((v) => clampRaise(v + ante))}
                  aria-label="レイズ額を増やす"
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
              onClick={() => onAction({ type: toCall === 0 ? 'check' : 'call' })}
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
