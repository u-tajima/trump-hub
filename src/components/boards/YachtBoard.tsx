import React, { useEffect, useState } from 'react';
import { Award, Check, Dices, Lock, Sparkles, Trophy, Unlock } from 'lucide-react';
import {
  evaluateYachtCategory,
  YACHT_CATEGORY_LABELS,
  YACHT_LOWER_CATEGORIES,
  YACHT_UPPER_BONUS_POINTS,
  YACHT_UPPER_CATEGORIES,
  type YachtCategory,
  type YachtClientState,
} from '../../games/yacht';
import { GameDice3DTray } from '../GameDice3DTray';

interface YachtBoardProps {
  state: YachtClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const YachtBoard: React.FC<YachtBoardProps> = ({ state, onAction }) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current?.id === state.myId;
  const rollsLeft = Math.max(0, 3 - state.rollsUsed);
  const canRoll = isMyTurn && state.rollsUsed < 3;
  const canHold = isMyTurn && state.rollsUsed >= 1 && state.rollsUsed < 3;
  const canScore = isMyTurn && state.rollsUsed >= 1;

  // Which player's scorecard is currently displayed (defaults to my scorecard)
  const [viewingId, setViewingId] = useState<string>(state.myId);

  // Auto-switch back to my sheet when my turn begins
  useEffect(() => {
    if (isMyTurn) {
      setViewingId(state.myId);
    }
  }, [isMyTurn, state.myId, state.turnIndex]);

  const viewedPlayer =
    state.players.find((p) => p.id === viewingId) ??
    state.players.find((p) => p.id === state.myId) ??
    state.players[0];

  const isViewingMyTurnSheet = canScore && viewedPlayer.id === state.myId;
  const bonusPct = Math.min(
    100,
    Math.round((viewedPlayer.upperSum / Math.max(1, state.rules.bonusThreshold)) * 100)
  );

  const renderCategoryRow = (cat: YachtCategory) => {
    const scored = viewedPlayer.scores[cat];
    const isFilled = scored !== undefined;
    const preview = isViewingMyTurnSheet && !isFilled ? evaluateYachtCategory(state.dice, cat) : null;
    const isJustScored =
      state.lastScored?.playerId === viewedPlayer.id && state.lastScored?.category === cat;
    const clickable = isViewingMyTurnSheet && !isFilled;

    return (
      <button
        key={cat}
        type="button"
        disabled={!clickable}
        onClick={() => {
          if (clickable) {
            onAction({ type: 'selectCategory', payload: { category: cat } });
          }
        }}
        className={`yacht-cat-row ${isFilled ? 'filled' : ''} ${clickable ? 'selectable' : ''} ${
          preview !== null && preview > 0 ? 'has-points' : ''
        } ${isJustScored ? 'just-scored' : ''}`}
      >
        <span className="yacht-cat-name">{YACHT_CATEGORY_LABELS[cat]}</span>
        <span className="yacht-cat-score">
          {isFilled ? (
            <span className="yacht-score-final">{scored}</span>
          ) : preview !== null ? (
            <span className={`yacht-score-preview ${preview > 0 ? 'positive' : 'zero'}`}>
              {preview > 0 ? `+${preview}` : '0'}
            </span>
          ) : (
            <span className="yacht-score-empty">-</span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="board-container yacht-board">
      <style>{`
        .yacht-board {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .yacht-players-strip {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .yacht-player-tab {
          flex: 1;
          min-width: 84px;
          background: rgba(0, 0, 0, 0.28);
          border: 1.5px solid var(--border-subtle);
          border-radius: 10px;
          padding: 6px 8px;
          color: var(--text-main);
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .yacht-player-tab.turn {
          border-color: var(--accent-gold);
          background: rgba(245, 158, 11, 0.14);
        }
        .yacht-player-tab.viewing {
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.75);
        }
        .yacht-player-tab-name {
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .yacht-player-tab-score {
          font-size: 15px;
          font-weight: 900;
          color: var(--accent-gold);
        }
        .yacht-dice-tray {
          background: radial-gradient(circle at 50% 30%, rgba(20, 83, 45, 0.65), rgba(7, 25, 16, 0.72));
          border: 1.5px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 12px 10px 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .yacht-dice-tray-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          color: #cbd5e1;
        }
        .yacht-rolls-dots {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .yacht-roll-pip {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .yacht-roll-pip.avail {
          background: var(--accent-gold);
          border-color: #fde68a;
          box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
        }
        .yacht-hold-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 6px;
        }
        .yacht-hold-btn {
          background: rgba(0, 0, 0, 0.34);
          border: 1.5px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 5px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          min-height: 44px;
          color: var(--text-main);
          cursor: pointer;
          transition: border-color 0.14s ease, background 0.14s ease, transform 0.1s ease;
        }
        .yacht-hold-btn:disabled {
          cursor: default;
          opacity: 0.72;
        }
        .yacht-hold-btn:not(:disabled):active {
          transform: scale(0.96);
        }
        .yacht-hold-btn.held {
          border-color: var(--accent-gold);
          background: rgba(245, 158, 11, 0.22);
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.28);
        }
        .yacht-hold-val {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
          color: #f8fafc;
        }
        .yacht-hold-val.is-one {
          color: #f87171;
        }
        .yacht-hold-tag {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }
        .yacht-hold-btn.held .yacht-hold-tag {
          color: #fde68a;
        }
        .yacht-sheet-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .yacht-sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 800;
          color: #e2e8f0;
        }
        .yacht-sheet-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .yacht-sheet-col {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .yacht-col-title {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          padding-left: 4px;
        }
        .yacht-cat-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          padding: 7px 8px;
          border-radius: 9px;
          border: 1px solid var(--border-subtle);
          background: rgba(0, 0, 0, 0.24);
          color: var(--text-main);
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          min-height: 36px;
          transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
        }
        .yacht-cat-row.filled {
          background: rgba(0, 0, 0, 0.36);
          border-color: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
        }
        .yacht-cat-row.selectable {
          cursor: pointer;
          border-color: rgba(245, 158, 11, 0.42);
          background: rgba(245, 158, 11, 0.08);
        }
        .yacht-cat-row.selectable.has-points {
          border-color: rgba(16, 185, 129, 0.65);
          background: rgba(16, 185, 129, 0.14);
        }
        .yacht-cat-row.selectable:active {
          transform: scale(0.98);
        }
        .yacht-cat-row.just-scored {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.45);
        }
        .yacht-cat-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 11px;
        }
        .yacht-score-final {
          font-size: 13px;
          font-weight: 900;
          color: #f8fafc;
        }
        .yacht-score-preview {
          font-size: 12px;
          font-weight: 900;
          padding: 1px 6px;
          border-radius: 999px;
        }
        .yacht-score-preview.positive {
          background: rgba(16, 185, 129, 0.28);
          color: #6ee7b7;
        }
        .yacht-score-preview.zero {
          background: rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }
        .yacht-score-empty {
          color: rgba(148, 163, 184, 0.45);
        }
        .yacht-bonus-box {
          margin-top: 2px;
          padding: 7px 9px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .yacht-bonus-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 800;
        }
        .yacht-bonus-bar {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }
        .yacht-bonus-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--accent-gold), var(--accent-emerald));
          transition: width 0.25s ease;
        }
      `}</style>

      <div className="status-flags">
        <span className="flag-badge info">第 {state.round} / 12 ラウンド</span>
        {state.phase === 'playing' && current && (
          <span className="flag-badge warn">
            {isMyTurn ? 'あなたの番' : `${current.name} の番`}
          </span>
        )}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* プレイヤー一覧 & スコア切替 */}
      <div className="yacht-players-strip">
        {state.players.map((p, idx) => {
          const isTurn = state.phase === 'playing' && idx === state.turnIndex;
          const isViewing = p.id === viewedPlayer.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`yacht-player-tab ${isTurn ? 'turn' : ''} ${isViewing ? 'viewing' : ''}`}
              onClick={() => setViewingId(p.id)}
            >
              <span className="yacht-player-tab-name">
                {p.name}
                {p.id === state.myId ? ' (自分)' : ''}
              </span>
              <span className="yacht-player-tab-score">{p.total}点</span>
            </button>
          );
        })}
      </div>

      {/* サイコロトレイ */}
      {state.phase === 'playing' && (
        <div className="yacht-dice-tray">
          <div className="yacht-dice-tray-head">
            <span>
              {state.rollsUsed === 0
                ? 'サイコロを振ってください'
                : canHold
                ? '残すダイスをタップでホールド'
                : isMyTurn
                ? '下のスコアシートから役を選んで確定'
                : `${current?.name ?? ''} の出目`}
            </span>
            <span className="yacht-rolls-dots" aria-label={`残りロール ${rollsLeft}回`}>
              <span>残{rollsLeft}回</span>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`yacht-roll-pip ${i < rollsLeft ? 'avail' : ''}`} />
              ))}
            </span>
          </div>

          <GameDice3DTray
            dice={state.dice}
            rollTrigger={state.rollSeq}
            held={state.held}
            dimmed={state.rollsUsed === 0}
            height={146}
            interactive={canHold}
            onDieClick={(idx) => onAction({ type: 'toggleHold', payload: { index: idx } })}
          />

          <div className="yacht-hold-row">
            {state.dice.map((die, idx) => {
              const isHeld = state.held[idx];
              return (
                <button
                  key={idx}
                  type="button"
                  className={`yacht-hold-btn ${isHeld ? 'held' : ''}`}
                  disabled={!canHold}
                  onClick={() => {
                    if (canHold) {
                      onAction({ type: 'toggleHold', payload: { index: idx } });
                    }
                  }}
                  aria-label={`サイコロ ${idx + 1} (${die}) ${isHeld ? 'ホールド中' : '解除'}`}
                >
                  <span className={`yacht-hold-val ${die === 1 ? 'is-one' : ''}`}>
                    {state.rollsUsed === 0 ? '-' : die}
                  </span>
                  <span className="yacht-hold-tag">
                    {isHeld ? (
                      <>
                        <Lock size={9} /> KEEP
                      </>
                    ) : canHold ? (
                      <>
                        <Unlock size={9} /> FREE
                      </>
                    ) : (
                      <span>{state.rollsUsed === 0 ? 'WAIT' : 'LOCK'}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 12カテゴリ スコアシート */}
      <div className="yacht-sheet-card">
        <div className="yacht-sheet-header">
          <span className="title-with-icon">
            <Sparkles size={14} />
            {viewedPlayer.id === state.myId
              ? 'あなたのスコアシート'
              : `${viewedPlayer.name} のスコアシート`}
          </span>
          <span style={{ color: 'var(--accent-gold)' }}>合計 {viewedPlayer.total}点</span>
        </div>

        {isViewingMyTurnSheet && (
          <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 700 }}>
            空いている役をタップすると点数を確定します
          </div>
        )}

        <div className="yacht-sheet-grid">
          <div className="yacht-sheet-col">
            <div className="yacht-col-title">上段 (数字)</div>
            {YACHT_UPPER_CATEGORIES.map(renderCategoryRow)}
          </div>
          <div className="yacht-sheet-col">
            <div className="yacht-col-title">下段 (役)</div>
            {YACHT_LOWER_CATEGORIES.map(renderCategoryRow)}
          </div>
        </div>

        <div className="yacht-bonus-box">
          <div className="yacht-bonus-top">
            <span className="title-with-icon">
              <Award size={13} color="#f59e0b" />
              上段ボーナス ({viewedPlayer.upperSum} / {state.rules.bonusThreshold})
            </span>
            <span style={{ color: viewedPlayer.bonus > 0 ? '#6ee7b7' : 'var(--text-muted)' }}>
              {viewedPlayer.bonus > 0 ? (
                <span className="title-with-icon">
                  <Check size={13} /> +{YACHT_UPPER_BONUS_POINTS}点 達成
                </span>
              ) : (
                `達成で +${YACHT_UPPER_BONUS_POINTS}点`
              )}
            </span>
          </div>
          <div className="yacht-bonus-bar">
            <div className="yacht-bonus-fill" style={{ width: `${bonusPct}%` }} />
          </div>
        </div>
      </div>

      {/* 下部アクションバー or 最終結果 */}
      {state.phase === 'playing' ? (
        <div className="sticky-bottom-bar">
          <button
            type="button"
            className="primary-btn full-width"
            disabled={!canRoll}
            onClick={() => onAction({ type: 'roll' })}
          >
            <Dices size={18} />
            {!isMyTurn
              ? `${current?.name ?? ''} のターン`
              : state.rollsUsed === 0
              ? 'サイコロを振る（1回目）'
              : rollsLeft > 0
              ? `未ホールドを振り直す（残り ${rollsLeft} 回）`
              : '上のスコアシートから役を選んで確定'}
          </button>
        </div>
      ) : (
        <div className="result-card">
          <h3 className="title-with-icon" style={{ justifyContent: 'center' }}>
            <Trophy size={18} color="#f59e0b" />
            {state.players.length === 1 ? '最終スコア' : '最終ランキング'}
          </h3>
          <ul className="result-list">
            {(() => {
              const ranked = [...state.players].sort((a, b) => b.total - a.total);
              let currentRank = 1;
              return ranked.map((p, idx) => {
                if (idx > 0 && p.total < ranked[idx - 1].total) {
                  currentRank = idx + 1;
                }
                return (
                  <li key={p.id}>
                    <span>
                      {state.players.length > 1 ? `${currentRank}位 ` : ''}
                      <strong>{p.name}</strong>
                    </span>
                    <strong style={{ color: 'var(--accent-gold)' }}>
                      {p.total}点{p.bonus > 0 ? ' (B+35)' : ''}
                    </strong>
                  </li>
                );
              });
            })()}
          </ul>
        </div>
      )}
    </div>
  );
};
