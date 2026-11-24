import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Dices,
  Eye,
  Minus,
  Plus,
  ShieldAlert,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  getTotalActiveDice,
  isDieMatchingFace,
  isValidNextBid,
  type LiarsDiceBid,
  type LiarsDiceClientState,
} from '../../games/liarsDice';

interface LiarsDiceBoardProps {
  state: LiarsDiceClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

const PIP_COORDS: Record<number, Array<[number, number]>> = {
  1: [[32, 32]],
  2: [
    [19, 19],
    [45, 45],
  ],
  3: [
    [19, 19],
    [32, 32],
    [45, 45],
  ],
  4: [
    [19, 19],
    [45, 19],
    [19, 45],
    [45, 45],
  ],
  5: [
    [19, 19],
    [45, 19],
    [32, 32],
    [19, 45],
    [45, 45],
  ],
  6: [
    [19, 17],
    [45, 17],
    [19, 32],
    [45, 32],
    [19, 47],
    [45, 47],
  ],
};

interface DieSvgProps {
  value: number;
  size?: number;
  highlight?: boolean;
  wild?: boolean;
}

const DieSvg: React.FC<DieSvgProps> = ({ value, size = 40, highlight = false, wild = false }) => {
  const pips = PIP_COORDS[value] ?? PIP_COORDS[1];
  const isOne = value === 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`ld-die-svg ${highlight ? 'highlight' : ''}`}
      aria-label={`サイコロ ${value}`}
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="13"
        fill={highlight ? '#fef9c3' : '#f8fafc'}
        stroke={highlight ? '#f59e0b' : wild ? '#10b981' : '#cbd5e1'}
        strokeWidth={highlight ? '4.5' : '2.2'}
      />
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={isOne ? 7.6 : 5.4}
          fill={isOne ? '#dc2626' : '#0f172a'}
        />
      ))}
    </svg>
  );
};

function computeDefaultBid(currentBid: LiarsDiceBid | null, totalDice: number, onesWild: boolean): LiarsDiceBid {
  if (!currentBid) {
    return { quantity: 1, face: onesWild ? 2 : 1 };
  }
  if (currentBid.face < 6) {
    return { quantity: currentBid.quantity, face: currentBid.face + 1 };
  }
  return {
    quantity: Math.min(totalDice, currentBid.quantity + 1),
    face: onesWild ? 2 : 1,
  };
}

export const LiarsDiceBoard: React.FC<LiarsDiceBoardProps> = ({ state, onAction }) => {
  const current = state.players[state.turnIndex];
  const me = state.players.find((p) => p.id === state.myId) ?? null;
  const isMyTurn =
    state.phase === 'playing' &&
    state.subPhase === 'bidding' &&
    current?.id === state.myId;

  const totalDice =
    state.subPhase === 'reveal'
      ? state.players.reduce((acc, p) => acc + p.dice.length, 0)
      : getTotalActiveDice(state.players);

  const [draftQty, setDraftQty] = useState<number>(1);
  const [draftFace, setDraftFace] = useState<number>(state.rules.onesWild ? 2 : 1);

  // Sync draft bid to minimum valid next bid whenever turn or currentBid changes
  useEffect(() => {
    const def = computeDefaultBid(state.currentBid, totalDice, state.rules.onesWild);
    setDraftQty(def.quantity);
    setDraftFace(def.face);
  }, [state.currentBid, state.round, state.turnIndex, totalDice, state.rules.onesWild]);

  const canBidCurrentDraft = isValidNextBid(
    state.currentBid,
    { quantity: draftQty, face: draftFace },
    totalDice
  );

  const maxQty = Math.max(1, totalDice);
  const minQty = state.currentBid
    ? state.currentBid.face >= 6
      ? Math.min(maxQty, state.currentBid.quantity + 1)
      : state.currentBid.quantity
    : 1;

  const handleSelectFace = (face: number) => {
    setDraftFace(face);
    if (state.currentBid && draftQty === state.currentBid.quantity && face <= state.currentBid.face) {
      if (state.currentBid.quantity + 1 <= maxQty) {
        setDraftQty(state.currentBid.quantity + 1);
      }
    }
  };

  const handleChangeQty = (delta: number) => {
    const next = Math.max(minQty, Math.min(maxQty, draftQty + delta));
    setDraftQty(next);
    if (state.currentBid && next === state.currentBid.quantity && draftFace <= state.currentBid.face) {
      if (state.currentBid.face < 6) {
        setDraftFace(state.currentBid.face + 1);
      }
    }
  };

  const aliveCountAfterReveal = state.players.filter((p) => !p.eliminated && p.diceCount > 0).length;
  const bidderPlayer =
    state.lastBidderIndex !== null ? state.players[state.lastBidderIndex] : null;

  return (
    <div className="board-container ld-board">
      <style>{`
        .ld-board {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .ld-bid-hero {
          background: radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.16), rgba(7, 25, 16, 0.78));
          border: 1.5px solid rgba(245, 158, 11, 0.45);
          border-radius: var(--radius-lg);
          padding: 12px 14px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .ld-bid-hero.empty {
          border-color: var(--border-subtle);
          background: var(--bg-panel);
        }
        .ld-bid-eyebrow {
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.06em;
        }
        .ld-bid-main {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .ld-bid-text {
          font-size: 22px;
          font-weight: 900;
          color: #fef3c7;
        }
        .ld-bid-text strong {
          font-size: 28px;
          color: var(--accent-gold);
        }
        .ld-players-grid {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .ld-player-card {
          background: var(--bg-panel);
          border: 1.5px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 9px 11px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .ld-player-card.active {
          border-color: var(--accent-gold);
          background: rgba(245, 158, 11, 0.13);
        }
        .ld-player-card.me {
          border-style: dashed;
        }
        .ld-player-card.eliminated {
          opacity: 0.45;
        }
        .ld-player-card.loser {
          border-color: var(--danger);
          background: rgba(239, 68, 68, 0.14);
        }
        .ld-player-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }
        .ld-cup-dots {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ld-hidden-pip {
          width: 14px;
          height: 14px;
          border-radius: 4px;
          background: linear-gradient(135deg, #334155, #1e293b);
          border: 1px solid rgba(255, 255, 255, 0.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .ld-hidden-pip::after {
          content: '';
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
        }
        .ld-dice-inline {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .ld-die-svg {
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
          transition: transform 0.16s ease, filter 0.16s ease;
        }
        .ld-die-svg.highlight {
          transform: scale(1.08);
          filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.85));
        }
        .ld-reveal-banner {
          border-radius: var(--radius-lg);
          padding: 12px 14px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ld-reveal-banner.success {
          background: rgba(16, 185, 129, 0.18);
          border: 1.5px solid rgba(16, 185, 129, 0.65);
        }
        .ld-reveal-banner.fail {
          background: rgba(239, 68, 68, 0.18);
          border: 1.5px solid rgba(239, 68, 68, 0.65);
        }
        .ld-reveal-title {
          font-size: 16px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .ld-reveal-counts {
          font-size: 13px;
          font-weight: 700;
          color: #e2e8f0;
        }
        .ld-my-cup {
          background: rgba(0, 0, 0, 0.36);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: var(--radius-lg);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ld-my-cup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          color: #6ee7b7;
        }
        .ld-bid-controls {
          background: var(--bg-panel);
          border: 1.5px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 11px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ld-qty-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ld-qty-stepper {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .ld-step-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-main);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .ld-step-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .ld-qty-display {
          min-width: 58px;
          text-align: center;
          font-size: 20px;
          font-weight: 900;
          color: var(--accent-gold);
        }
        .ld-face-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 6px;
        }
        .ld-face-btn {
          position: relative;
          background: rgba(0, 0, 0, 0.28);
          border: 2px solid var(--border-subtle);
          border-radius: 10px;
          padding: 5px 2px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.14s ease, background 0.14s ease, transform 0.1s ease;
        }
        .ld-face-btn.selected {
          border-color: var(--accent-gold);
          background: rgba(245, 158, 11, 0.22);
          transform: translateY(-2px);
        }
        .ld-wild-tag {
          position: absolute;
          top: -6px;
          right: -4px;
          background: var(--accent-emerald);
          color: #052e16;
          font-size: 9px;
          font-weight: 900;
          padding: 1px 4px;
          border-radius: 999px;
        }
        .ld-action-row {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 8px;
        }
      `}</style>

      {/* 上部ステータスバッジ */}
      <div className="status-flags">
        <span className="flag-badge info">第 {state.round} ラウンド</span>
        <span className="flag-badge warn">場のダイス計 {totalDice}個</span>
        {state.rules.onesWild && (
          <span className="flag-badge" style={{ background: 'rgba(16, 185, 129, 0.24)', color: '#6ee7b7' }}>
            1はワイルド
          </span>
        )}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 現在の宣言カード */}
      {state.phase === 'playing' && (
        <div className={`ld-bid-hero ${state.currentBid ? '' : 'empty'}`}>
          {state.currentBid ? (
            <>
              <div className="ld-bid-eyebrow">
                現在の宣言 {bidderPlayer ? `(${bidderPlayer.name})` : ''}
              </div>
              <div className="ld-bid-main">
                <DieSvg value={state.currentBid.face} size={46} highlight />
                <span className="ld-bid-text">
                  が <strong>{state.currentBid.quantity}</strong> 個以上
                </span>
              </div>
              {state.rules.onesWild && state.currentBid.face !== 1 && (
                <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 700 }}>
                  1の目もワイルドとしてカウントされます
                </div>
              )}
            </>
          ) : (
            <>
              <div className="ld-bid-eyebrow">ラウンド開始</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>
                {isMyTurn
                  ? 'あなたの番です。最初の宣言をしてください'
                  : `${current?.name ?? ''} の最初の宣言を待っています`}
              </div>
            </>
          )}
        </div>
      )}

      {/* ダウト結果バナー（revealフェーズ） */}
      {state.phase === 'playing' && state.subPhase === 'reveal' && state.revealInfo && (
        <div
          className={`ld-reveal-banner ${
            state.revealInfo.challengeSucceeded ? 'success' : 'fail'
          }`}
        >
          <div className="ld-reveal-title">
            {state.revealInfo.challengeSucceeded ? (
              <>
                <CheckCircle2 size={18} color="#6ee7b7" />
                ダウト成功！
              </>
            ) : (
              <>
                <AlertTriangle size={18} color="#fca5a5" />
                ダウト失敗！
              </>
            )}
          </div>
          <div className="ld-reveal-counts">
            宣言: {state.revealInfo.bid.face}の目 {state.revealInfo.bid.quantity}個以上 ／ 実際:{' '}
            <strong style={{ color: 'var(--accent-gold)', fontSize: 16 }}>
              {state.revealInfo.actualCount}個
            </strong>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fecaca' }}>
            {state.revealInfo.loserName} がダイスを1個失った
            {state.revealInfo.loserEliminated ? '（脱落！）' : ''}
          </div>
        </div>
      )}

      {/* プレイヤー一覧（reveal時は全員のダイスを公開＆該当目をハイライト） */}
      <div className="ld-players-grid">
        {state.players.map((p, idx) => {
          const isTurn =
            state.phase === 'playing' && state.subPhase === 'bidding' && idx === state.turnIndex;
          const isMe = p.id === state.myId;
          const isLoser =
            state.subPhase === 'reveal' && state.revealInfo?.loserId === p.id;
          const showDiceRow =
            (state.subPhase === 'reveal' || state.phase === 'finished') && p.dice.length > 0;
          const targetFace = state.revealInfo?.bid.face ?? null;

          return (
            <div
              key={p.id}
              className={`ld-player-card ${isTurn ? 'active' : ''} ${isMe ? 'me' : ''} ${
                p.eliminated ? 'eliminated' : ''
              } ${isLoser ? 'loser' : ''}`}
            >
              <div className="ld-player-top">
                <div className="title-with-icon">
                  <strong>{p.name}</strong>
                  {isMe && <span className="badge me">自分</span>}
                  {p.eliminated && (
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                      脱落
                    </span>
                  )}
                </div>
                <div className="ld-cup-dots" aria-label={`残りダイス ${p.diceCount}個`}>
                  {p.diceCount > 0 ? (
                    <>
                      {Array.from({ length: p.diceCount }, (_, i) => (
                        <span key={i} className="ld-hidden-pip" />
                      ))}
                      <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 4 }}>
                        {p.diceCount}個
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-sm">0個</span>
                  )}
                </div>
              </div>

              {showDiceRow && (
                <div className="ld-dice-inline">
                  {p.dice.map((d, di) => {
                    const matched =
                      targetFace !== null &&
                      isDieMatchingFace(d, targetFace, state.rules.onesWild);
                    return (
                      <DieSvg
                        key={di}
                        value={d}
                        size={38}
                        highlight={matched}
                        wild={state.rules.onesWild && d === 1}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 自分のカップ（biddingフェーズのみ） */}
      {state.phase === 'playing' && state.subPhase === 'bidding' && me && !me.eliminated && (
        <div className="ld-my-cup">
          <div className="ld-my-cup-header">
            <span className="title-with-icon">
              <Eye size={14} /> あなたのカップ（非公開）
            </span>
            <span>残り {me.dice.length}個</span>
          </div>
          <div className="ld-dice-inline" style={{ justifyContent: 'center' }}>
            {me.dice.map((d, i) => (
              <DieSvg
                key={i}
                value={d}
                size={48}
                highlight={
                  state.currentBid !== null &&
                  isDieMatchingFace(d, state.currentBid.face, state.rules.onesWild)
                }
                wild={state.rules.onesWild && d === 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* 操作パネル or 結果カード */}
      {state.phase === 'playing' ? (
        state.subPhase === 'reveal' ? (
          <div className="sticky-bottom-bar">
            <button
              type="button"
              className="primary-btn full-width"
              onClick={() => onAction({ type: 'nextRound' })}
            >
              <ArrowRight size={18} />
              {aliveCountAfterReveal <= 1 ? '最終結果を見る' : '次のラウンドへ'}
            </button>
          </div>
        ) : isMyTurn ? (
          <div className="ld-bid-controls">
            <div className="ld-qty-row">
              <span style={{ fontSize: 13, fontWeight: 800 }}>宣言する個数</span>
              <div className="ld-qty-stepper">
                <button
                  type="button"
                  className="ld-step-btn"
                  disabled={draftQty <= minQty}
                  onClick={() => handleChangeQty(-1)}
                  aria-label="個数を減らす"
                >
                  <Minus size={16} />
                </button>
                <span className="ld-qty-display">{draftQty}個</span>
                <button
                  type="button"
                  className="ld-step-btn"
                  disabled={draftQty >= maxQty}
                  onClick={() => handleChangeQty(1)}
                  aria-label="個数を増やす"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="ld-face-grid">
              {[1, 2, 3, 4, 5, 6].map((face) => (
                <button
                  key={face}
                  type="button"
                  className={`ld-face-btn ${draftFace === face ? 'selected' : ''}`}
                  onClick={() => handleSelectFace(face)}
                >
                  {state.rules.onesWild && face === 1 && <span className="ld-wild-tag">W</span>}
                  <DieSvg value={face} size={34} />
                </button>
              ))}
            </div>

            <div className="ld-action-row">
              <button
                type="button"
                className="primary-btn"
                disabled={!canBidCurrentDraft}
                onClick={() =>
                  onAction({
                    type: 'bid',
                    payload: { quantity: draftQty, face: draftFace },
                  })
                }
              >
                <Dices size={17} />
                {draftFace}を{draftQty}個以上
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={!state.currentBid}
                onClick={() => onAction({ type: 'challenge' })}
              >
                <ShieldAlert size={17} />
                ダウト！
              </button>
            </div>
          </div>
        ) : (
          <div className="waiting-banner">
            {me?.eliminated
              ? `あなたは脱落しました（${current?.name ?? ''} の思考中…）`
              : `${current?.name ?? ''} の宣言を待っています…`}
          </div>
        )
      ) : (
        <div className="result-card">
          <h3 className="title-with-icon" style={{ justifyContent: 'center' }}>
            <Trophy size={18} color="#f59e0b" /> ゲーム終了
          </h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => b.diceCount - a.diceCount)
              .map((p, idx) => (
                <li key={p.id}>
                  <span className="title-with-icon">
                    {idx === 0 && <Sparkles size={14} color="#f59e0b" />}
                    <strong>{p.name}</strong>
                  </span>
                  <strong style={{ color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                    {p.diceCount > 0 ? `残 ${p.diceCount}個（勝者）` : '脱落'}
                  </strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
