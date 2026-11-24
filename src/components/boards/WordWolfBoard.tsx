import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Scale,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { WordWolfClientState } from '../../games/wordWolf';
import './WerewolfBoard.css';

export interface WordWolfBoardProps {
  state: WordWolfClientState;
  isHost: boolean;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function getSubPhaseLabel(state: WordWolfClientState): string {
  if (state.phase === 'finished') return '決着・お題公開';
  switch (state.subPhase) {
    case 'wordReveal':
      return 'お題確認';
    case 'discussion':
      return '議論タイム';
    case 'voting':
      return state.isRunoff ? '決選投票' : '投票タイム';
    case 'reversal':
      return 'ウルフ逆転チャンス';
  }
}

export const WordWolfBoard: React.FC<WordWolfBoardProps> = ({
  state,
  isHost,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [secretOpen, setSecretOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    if (state.phase !== 'playing' || state.subPhase !== 'discussion' || !state.discussionEndsAt) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.phase, state.subPhase, state.discussionEndsAt]);

  const phaseKey = `${state.subPhase}-${state.isRunoff}-${state.myId}`;
  const [lastPhaseKey, setLastPhaseKey] = useState(phaseKey);
  if (phaseKey !== lastPhaseKey) {
    setLastPhaseKey(phaseKey);
    setSelectedTargetId(null);
    setSecretOpen(false);
  }

  const remainingSec = state.discussionEndsAt
    ? Math.max(0, (state.discussionEndsAt - nowMs) / 1000)
    : null;
  const isTimeUp = remainingSec !== null && remainingSec <= 0;

  const voteCandidates = useMemo(() => {
    return state.players.filter((p) => {
      if (p.id === state.myId) return false;
      if (state.isRunoff && !state.runoffCandidateIds.includes(p.id)) return false;
      return true;
    });
  }, [state.players, state.myId, state.isRunoff, state.runoffCandidateIds]);

  const showWordToggleBar =
    state.phase === 'playing' &&
    state.subPhase !== 'wordReveal' &&
    state.myWord !== null &&
    !isLocalPassAndPlay;

  const readyCount = state.players.filter((p) => p.ready).length;
  const votedCount = state.players.filter((p) => p.hasVoted).length;
  const citizenCount = state.players.length - state.wolfCount;

  const winnerTitle =
    state.winnerTeam === 'citizen'
      ? '市民陣営の勝利'
      : state.reversalSuccess
      ? 'ウルフの逆転勝利'
      : 'ウルフ陣営の勝利';

  return (
    <div className="ww-root">
      {/* ヘッダー */}
      <div className="ww-header-card">
        <div className="ww-phase-row">
          <div className="ww-phase-badge">
            <MessageSquare size={15} />
            <span>{getSubPhaseLabel(state)}</span>
          </div>
          <div className="ww-alive-count">
            <Users size={14} />
            <span>{state.players.length}人参加</span>
          </div>
        </div>

        <div className="ww-role-chips">
          <span className="ww-role-chip">市民 {citizenCount}</span>
          <span className="ww-role-chip">ウルフ {state.wolfCount}</span>
          <span className="ww-role-chip">ジャンル: {state.category}</span>
        </div>

        <div className="ww-log-line">{state.lastLog}</div>
      </div>

      {/* 議論・投票中の覗き見防止トグル */}
      {showWordToggleBar && state.myWord && (
        <div className="ww-secret-drawer">
          <button
            type="button"
            className="ww-secret-toggle"
            onClick={() => setSecretOpen((v) => !v)}
          >
            {secretOpen ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{secretOpen ? '自分のお題を隠す' : '自分のお題を再確認する'}</span>
          </button>
          {secretOpen && (
            <div className="ww-secret-body" style={{ textAlign: 'center' }}>
              <div className="ww-reveal-eyebrow">あなたのお題</div>
              <div className="ww-reveal-name" style={{ fontSize: 24 }}>
                {state.myWord}
              </div>
              <p className="ww-role-desc">
                自分が多数派か少数派かはわかりません。会話のズレから探りましょう。
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============ 1. お題確認フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'wordReveal' && (
        <section className="ww-panel">
          {state.myWord ? (
            <>
              <div className="ww-role-reveal-card">
                <div className="ww-reveal-eyebrow">あなたのお題</div>
                <div className="ww-reveal-name">{state.myWord}</div>
                <p className="ww-role-desc">
                  このお題についてみんなで話し合います。自分が多数派（市民）か少数派（ウルフ）かは秘密です。
                </p>
              </div>

              <button
                type="button"
                className="primary-btn full-width"
                disabled={state.myReady}
                onClick={() => onAction({ type: 'confirmWord' })}
              >
                <Check size={17} />
                {state.myReady
                  ? `確認済み（${readyCount}/${state.players.length}人）`
                  : 'お題を確認しました'}
              </button>
            </>
          ) : (
            <div className="ww-wait-box">
              全員のお題確認を待っています（{readyCount}/{state.players.length}人）
            </div>
          )}

          {isHost && !isLocalPassAndPlay && (
            <button
              type="button"
              className="secondary-btn full-width ww-host-skip"
              onClick={() => onAction({ type: 'advancePhase' })}
            >
              ホスト操作: 確認を締め切って議論を開始
            </button>
          )}
        </section>
      )}

      {/* ============ 2. 議論フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'discussion' && (
        <section className="ww-panel">
          <div className={`ww-timer-box ${isTimeUp ? 'is-timeup' : ''}`}>
            <div className="ww-timer-label">
              <Clock size={15} />
              <span>
                {remainingSec === null
                  ? '議論タイマー'
                  : isTimeUp
                  ? '議論時間終了'
                  : '残り議論時間'}
              </span>
            </div>
            <div className="ww-timer-value">
              {remainingSec === null ? '無制限' : formatTimer(remainingSec)}
            </div>
          </div>

          <p className="ww-panel-sub">
            自分のお題をそのまま言わずに、特徴や思い出を話し合って少数派（ウルフ）を見つけ出しましょう。
          </p>

          {isHost ? (
            <div className="ww-host-actions">
              {state.rules.discussionSec > 0 && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => onAction({ type: 'extendDiscussion' })}
                >
                  <Plus size={15} />
                  1分延長
                </button>
              )}
              <button
                type="button"
                className="primary-btn flex-1"
                onClick={() => onAction({ type: 'startVoting' })}
              >
                <Scale size={16} />
                議論を終えて投票へ
              </button>
            </div>
          ) : (
            <div className="ww-wait-box">自由に議論してください。ホストの操作で投票に進みます。</div>
          )}
        </section>
      )}

      {/* ============ 3. 投票フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'voting' && (
        <section className="ww-panel">
          <div className="ww-panel-header">
            <h3 className="ww-panel-title">
              <Scale size={16} />
              {state.isRunoff ? '決選投票' : 'ウルフ投票'}
            </h3>
            <span className="ww-progress-pill">
              {votedCount} / {state.players.length} 完了
            </span>
          </div>

          {state.myWord === null ? (
            <div className="ww-wait-box">
              プレイヤーの投票完了を待っています（{votedCount}/{state.players.length}人）
            </div>
          ) : state.myVotedTargetId ? (
            <div className="ww-wait-box done">
              <Check size={16} />
              <span>
                投票完了（他プレイヤーの投票を待っています：{votedCount}/{state.players.length}人）
              </span>
            </div>
          ) : (
            <>
              <p className="ww-panel-sub">
                {state.isRunoff
                  ? '同票になった候補者から少数派（ウルフ）だと思う1人を選んでください。'
                  : '少数派（ウルフ）だと思うプレイヤーを1人選んで投票してください。'}
              </p>
              <div className="ww-target-grid">
                {voteCandidates.map((p) => {
                  const selected = selectedTargetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`ww-target-btn ${selected ? 'selected' : ''}`}
                      onClick={() => setSelectedTargetId(p.id)}
                    >
                      <span className="ww-target-name">{p.name}</span>
                      {selected && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="primary-btn full-width"
                disabled={!selectedTargetId}
                onClick={() => {
                  if (!selectedTargetId) return;
                  onAction({ type: 'castVote', payload: { targetId: selectedTargetId } });
                }}
              >
                投票を確定する
              </button>
            </>
          )}
        </section>
      )}

      {/* ============ 4. 逆転チャンスフェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'reversal' && state.voteResult && (
        <section className="ww-panel">
          <div className="ww-announce-card">
            <div className="ww-announce-icon">
              <Sparkles size={26} />
            </div>
            <h3 className="ww-announce-title">
              {state.voteResult.executedName} はウルフでした！
            </h3>
            <p className="ww-panel-sub">
              逆転チャンス！{state.voteResult.executedName} は「多数派のお題」を口頭で宣言してください。当てることができればウルフの逆転勝利です！
            </p>
          </div>

          {state.reversalWordRevealed && state.majorityWord && (
            <div className="ww-role-reveal-card">
              <div className="ww-reveal-eyebrow">多数派のお題（答え合わせ）</div>
              <div className="ww-reveal-name" style={{ fontSize: 24 }}>
                {state.majorityWord}
              </div>
            </div>
          )}

          {isHost ? (
            <>
              {!state.reversalWordRevealed && (
                <button
                  type="button"
                  className="secondary-btn full-width"
                  onClick={() => onAction({ type: 'revealReversalWord' })}
                >
                  <Eye size={16} />
                  宣言が終わったら多数派のお題を表示する
                </button>
              )}
              <div className="ww-host-actions">
                <button
                  type="button"
                  className="primary-btn flex-1"
                  onClick={() => onAction({ type: 'judgeReversal', payload: { correct: true } })}
                >
                  <Check size={16} />
                  正解（ウルフ逆転勝ち）
                </button>
                <button
                  type="button"
                  className="secondary-btn flex-1"
                  onClick={() => onAction({ type: 'judgeReversal', payload: { correct: false } })}
                >
                  <X size={16} />
                  不正解（市民の勝ち）
                </button>
              </div>
            </>
          ) : (
            <div className="ww-wait-box">
              ウルフの宣言後、ホストが正誤を判定します…
            </div>
          )}
        </section>
      )}

      {/* ============ 5. 決着・全公開 ============ */}
      {state.phase === 'finished' && (
        <section className="ww-panel ww-result-panel">
          <div
            className={`ww-winner-banner ${
              state.winnerTeam === 'citizen' ? 'team-village' : 'team-werewolf'
            }`}
          >
            <Shield size={24} />
            <h2>{winnerTitle}</h2>
          </div>

          {/* 多数派・少数派お題の対比 */}
          <div className="ww-target-grid">
            <div
              className="ww-role-reveal-card"
              style={{ borderColor: 'rgba(52, 211, 153, 0.45)', padding: '12px 10px' }}
            >
              <div className="ww-reveal-eyebrow">多数派（市民）</div>
              <div className="ww-reveal-name" style={{ fontSize: 20, color: '#a7f3d0' }}>
                {state.majorityWord}
              </div>
            </div>
            <div
              className="ww-role-reveal-card"
              style={{ borderColor: 'rgba(248, 113, 113, 0.5)', padding: '12px 10px' }}
            >
              <div className="ww-reveal-eyebrow">少数派（ウルフ）</div>
              <div className="ww-reveal-name" style={{ fontSize: 20, color: '#fecaca' }}>
                {state.minorityWord}
              </div>
            </div>
          </div>

          {/* 全員の正体 */}
          <div className="ww-final-roles">
            {state.players.map((p) => {
              const isWinner = state.winnerIds.includes(p.id);
              const isExecuted = state.voteResult?.executedId === p.id;
              return (
                <div key={p.id} className={`ww-final-row ${isWinner ? 'is-winner' : ''}`}>
                  <div className="ww-final-left">
                    <span className="ww-final-name">{p.name}</span>
                    {isExecuted && (
                      <span
                        className="ww-dead-tag"
                        style={{
                          background: 'rgba(239, 68, 68, 0.25)',
                          color: '#fecaca',
                        }}
                      >
                        処刑
                      </span>
                    )}
                  </div>
                  <div className="ww-final-right">
                    <span
                      className={`ww-team-pill ${p.isWolf ? 'team-werewolf' : 'team-village'}`}
                    >
                      {p.isWolf ? 'ウルフ' : '市民'}
                    </span>
                    {isWinner && <span className="ww-win-tag">WIN</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 投票結果 */}
          {state.voteResult && (
            <div className="ww-tally-box">
              <div className="ww-tally-title">投票結果</div>
              {state.voteResult.tally
                .filter((t) => t.count > 0)
                .map((t) => (
                  <div key={t.targetId} className="ww-tally-row">
                    <span>{t.targetName}</span>
                    <span className="ww-tally-count">{t.count}票</span>
                  </div>
                ))}
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {state.voteResult.votes.map((v) => (
                  <div
                    key={v.voterId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#cbd5e1',
                    }}
                  >
                    <span>{v.voterName}</span>
                    <span>→ {v.targetName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 参加者ステータス */}
      {state.phase === 'playing' && (
        <section className="ww-roster-card">
          <div className="ww-roster-title">参加者ステータス</div>
          <div className="ww-roster-grid">
            {state.players.map((p) => {
              let statusText = '議論中';
              if (state.subPhase === 'wordReveal') {
                statusText = p.ready ? '確認済' : '確認中';
              } else if (state.subPhase === 'voting') {
                statusText = p.hasVoted ? '投票済' : '投票中';
              } else if (state.subPhase === 'reversal') {
                statusText = state.voteResult?.executedId === p.id ? '逆転挑戦中' : '待機中';
              }
              return (
                <div
                  key={p.id}
                  className={`ww-roster-pill ${p.id === state.myId ? 'is-me' : ''}`}
                >
                  <span className="ww-roster-name">{p.name}</span>
                  <span className="ww-roster-status">{statusText}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* タイムライン */}
      <div className="ww-timeline-wrap">
        <button
          type="button"
          className="ww-timeline-toggle"
          onClick={() => setShowTimeline((v) => !v)}
        >
          {showTimeline ? '進行ログを閉じる' : `進行ログを見る (${state.timeline.length})`}
        </button>
        {showTimeline && (
          <ul className="ww-timeline-list">
            {state.timeline.map((entry, idx) => (
              <li key={idx}>{entry}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
