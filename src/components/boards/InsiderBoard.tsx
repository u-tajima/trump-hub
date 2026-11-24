import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Crown,
  Eye,
  EyeOff,
  HelpCircle,
  Plus,
  Scale,
  Shield,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import {
  INSIDER_ROLE_META,
  type InsiderClientState,
  type InsiderRole,
} from '../../games/insider';
import './WerewolfBoard.css';

export interface InsiderBoardProps {
  state: InsiderClientState;
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

function getRoleTeamClass(role: InsiderRole): string {
  if (role === 'insider') return 'team-werewolf';
  if (role === 'master') return 'team-fox';
  return 'team-village';
}

function getSubPhaseLabel(state: InsiderClientState): string {
  if (state.phase === 'finished') return '決着・全役職公開';
  switch (state.subPhase) {
    case 'roleReveal':
      return '役職確認';
    case 'question':
      return 'お題当て質問タイム';
    case 'discussion':
      return '告発議論タイム';
    case 'voting':
      return state.isRunoff ? '決選投票' : 'インサイダー投票';
  }
}

export const InsiderBoard: React.FC<InsiderBoardProps> = ({
  state,
  isHost,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [secretOpen, setSecretOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedSolverId, setSelectedSolverId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const activeTimerEndsAt =
    state.subPhase === 'question'
      ? state.questionEndsAt
      : state.subPhase === 'discussion'
      ? state.discussionEndsAt
      : null;

  useEffect(() => {
    if (state.phase !== 'playing' || !activeTimerEndsAt) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.phase, activeTimerEndsAt]);

  const phaseKey = `${state.subPhase}-${state.isRunoff}-${state.myId}`;
  const [lastPhaseKey, setLastPhaseKey] = useState(phaseKey);
  if (phaseKey !== lastPhaseKey) {
    setLastPhaseKey(phaseKey);
    setSelectedTargetId(null);
    setSelectedSolverId(null);
    setSecretOpen(false);
  }

  const remainingSec = activeTimerEndsAt
    ? Math.max(0, (activeTimerEndsAt - nowMs) / 1000)
    : null;
  const isTimeUp = remainingSec !== null && remainingSec <= 0;

  const myRoleMeta = state.myRole ? INSIDER_ROLE_META[state.myRole] : null;
  const canControlQuestion = isHost || state.myRole === 'master';

  const solverCandidates = useMemo(
    () => state.players.filter((p) => p.id !== state.masterId),
    [state.players, state.masterId]
  );

  const voteCandidates = useMemo(() => {
    return state.players.filter((p) => {
      if (p.id === state.myId) return false;
      if (p.id === state.masterId) return false;
      if (state.isRunoff && !state.runoffCandidateIds.includes(p.id)) return false;
      return true;
    });
  }, [state.players, state.myId, state.masterId, state.isRunoff, state.runoffCandidateIds]);

  const showRoleToggleBar =
    state.phase === 'playing' &&
    state.subPhase !== 'roleReveal' &&
    myRoleMeta !== null &&
    !isLocalPassAndPlay;

  const readyCount = state.players.filter((p) => p.ready).length;
  const votedCount = state.players.filter((p) => p.hasVoted).length;
  const commonCount = Math.max(0, state.players.length - 2);

  const winnerTitle =
    state.winnerTeam === 'commons'
      ? 'マスター＆庶民チームの勝利'
      : state.winnerTeam === 'insider'
      ? 'インサイダーの単独勝利'
      : '時間切れ・全員敗北';

  const winnerBannerClass =
    state.winnerTeam === 'commons'
      ? 'team-village'
      : state.winnerTeam === 'insider'
      ? 'team-werewolf'
      : 'team-fox';

  return (
    <div className="ww-root">
      {/* ヘッダー */}
      <div className="ww-header-card">
        <div className="ww-phase-row">
          <div className="ww-phase-badge">
            <HelpCircle size={15} />
            <span>{getSubPhaseLabel(state)}</span>
          </div>
          <div className="ww-alive-count">
            <Users size={14} />
            <span>{state.players.length}人参加</span>
          </div>
        </div>

        <div className="ww-role-chips">
          <span className="ww-role-chip">マスター 1</span>
          <span className="ww-role-chip">インサイダー 1</span>
          <span className="ww-role-chip">庶民 {commonCount}</span>
          {state.masterName && (
            <span
              className="ww-role-chip"
              style={{
                background: 'rgba(245, 158, 11, 0.22)',
                color: '#fde68a',
              }}
            >
              マスター: {state.masterName}
            </span>
          )}
        </div>

        <div className="ww-log-line">{state.lastLog}</div>
      </div>

      {/* 質問・議論・投票中の覗き見防止トグル */}
      {showRoleToggleBar && myRoleMeta && (
        <div className="ww-secret-drawer">
          <button
            type="button"
            className="ww-secret-toggle"
            onClick={() => setSecretOpen((v) => !v)}
          >
            {secretOpen ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{secretOpen ? '役職・お題を隠す' : '自分の役職・秘密のお題を確認する'}</span>
          </button>
          {secretOpen && (
            <div className="ww-secret-body">
              <div className="ww-my-role-head">
                <span className={`ww-team-pill ${getRoleTeamClass(myRoleMeta.role)}`}>
                  {myRoleMeta.teamLabel}
                </span>
                <span className="ww-my-role-name">{myRoleMeta.name}</span>
              </div>
              <p className="ww-role-desc">{myRoleMeta.summary}</p>
              {state.mySecretWord && (
                <div className="ww-secret-note white-hint" style={{ textAlign: 'center' }}>
                  秘密のお題: <strong style={{ fontSize: 16 }}>{state.mySecretWord}</strong>（{state.category}）
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ 1. 役職確認フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'roleReveal' && (
        <section className="ww-panel">
          {myRoleMeta ? (
            <>
              <div className="ww-role-reveal-card">
                <div className="ww-reveal-eyebrow">あなたの役職</div>
                <div className="ww-reveal-name">{myRoleMeta.name}</div>
                <span className={`ww-team-pill ${getRoleTeamClass(myRoleMeta.role)}`}>
                  {myRoleMeta.teamLabel}
                </span>
                <p className="ww-role-desc">{myRoleMeta.summary}</p>

                {state.mySecretWord ? (
                  <div
                    className="ww-secret-note white-hint"
                    style={{ width: '100%', textAlign: 'center', marginTop: 4 }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.85 }}>秘密のお題（{state.category}）</div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
                      {state.mySecretWord}
                    </div>
                  </div>
                ) : (
                  <div className="ww-secret-note" style={{ width: '100%', textAlign: 'center', marginTop: 4 }}>
                    庶民：質問して秘密のお題を当てよう！
                  </div>
                )}
              </div>

              <button
                type="button"
                className="primary-btn full-width"
                disabled={state.myReady}
                onClick={() => onAction({ type: 'confirmRole' })}
              >
                <Check size={17} />
                {state.myReady
                  ? `確認済み（${readyCount}/${state.players.length}人）`
                  : '役職を確認しました'}
              </button>
            </>
          ) : (
            <div className="ww-wait-box">
              全員の役職確認を待っています（{readyCount}/{state.players.length}人）
            </div>
          )}

          {isHost && !isLocalPassAndPlay && (
            <button
              type="button"
              className="secondary-btn full-width ww-host-skip"
              onClick={() => onAction({ type: 'advancePhase' })}
            >
              ホスト操作: 確認を締め切って質問タイムへ
            </button>
          )}
        </section>
      )}

      {/* ============ 2. お題当て質問タイム ============ */}
      {state.phase === 'playing' && state.subPhase === 'question' && (
        <section className="ww-panel">
          <div className={`ww-timer-box ${isTimeUp ? 'is-timeup' : ''}`}>
            <div className="ww-timer-label">
              <Clock size={15} />
              <span>
                {remainingSec === null
                  ? '質問タイマー'
                  : isTimeUp
                  ? '時間切れ！'
                  : 'お題当て 残り時間'}
              </span>
            </div>
            <div className="ww-timer-value">
              {remainingSec === null ? '無制限' : formatTimer(remainingSec)}
            </div>
          </div>

          <div className="ww-announce-card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fde68a', fontWeight: 800, fontSize: 13 }}>
              <Crown size={16} />
              <span>マスター: {state.masterName}</span>
            </div>
            <p className="ww-panel-sub">
              マスターへ「はい」「いいえ」「わからない」で答えられる質問をして、秘密のお題を当てましょう！
            </p>
          </div>

          {canControlQuestion ? (
            <>
              <p className="ww-panel-sub" style={{ fontWeight: 700, color: '#f8fafc' }}>
                お題が当てられたら、正解したプレイヤーを選んで確定してください：
              </p>
              <div className="ww-target-grid">
                {solverCandidates.map((p) => {
                  const selected = selectedSolverId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`ww-target-btn ${selected ? 'selected' : ''}`}
                      onClick={() =>
                        setSelectedSolverId((prev) => (prev === p.id ? null : p.id))
                      }
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
                onClick={() =>
                  onAction({ type: 'markSolved', payload: { solverId: selectedSolverId } })
                }
              >
                <Sparkles size={16} />
                {selectedSolverId
                  ? `お題が当てられた！（正解者: ${
                      solverCandidates.find((p) => p.id === selectedSolverId)?.name ?? ''
                    }）`
                  : 'お題が当てられた！（正解者なしで次へ）'}
              </button>

              <button
                type="button"
                className="secondary-btn full-width"
                onClick={() => onAction({ type: 'markTimeout' })}
              >
                <XCircle size={15} />
                時間切れ（当てられず全員敗北）
              </button>
            </>
          ) : (
            <div className="ww-wait-box">
              マスター（{state.masterName}）に質問してお題を当ててください。正解すると次のフェーズへ進みます。
            </div>
          )}
        </section>
      )}

      {/* ============ 3. 告発議論タイム ============ */}
      {state.phase === 'playing' && state.subPhase === 'discussion' && (
        <section className="ww-panel">
          <div className="ww-role-reveal-card" style={{ padding: '12px' }}>
            <div className="ww-reveal-eyebrow">当てられたお題</div>
            <div className="ww-reveal-name" style={{ fontSize: 24 }}>
              {state.revealedWord}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {state.solverName && (
                <span className="ww-team-pill team-village">正解者: {state.solverName}</span>
              )}
              {state.solvedElapsedSec !== null && (
                <span className="ww-role-chip">解答時間: {formatTimer(state.solvedElapsedSec)}</span>
              )}
            </div>
          </div>

          <div className={`ww-timer-box ${isTimeUp ? 'is-timeup' : ''}`}>
            <div className="ww-timer-label">
              <Clock size={15} />
              <span>
                {remainingSec === null
                  ? '告発議論タイマー'
                  : isTimeUp
                  ? '議論時間終了'
                  : '告発議論 残り時間'}
              </span>
            </div>
            <div className="ww-timer-value">
              {remainingSec === null ? '無制限' : formatTimer(remainingSec)}
            </div>
          </div>

          <p className="ww-panel-sub">
            鋭すぎる質問や不自然な誘導をしていた「インサイダー」は誰でしょうか？全員で話し合いましょう。
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
                議論を終えて告発投票へ
              </button>
            </div>
          ) : (
            <div className="ww-wait-box">自由に議論してください。ホストの操作で投票に進みます。</div>
          )}
        </section>
      )}

      {/* ============ 4. 投票フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'voting' && (
        <section className="ww-panel">
          <div className="ww-panel-header">
            <h3 className="ww-panel-title">
              <Scale size={16} />
              {state.isRunoff ? '決選投票' : 'インサイダー告発投票'}
            </h3>
            <span className="ww-progress-pill">
              {votedCount} / {state.players.length} 完了
            </span>
          </div>

          {state.myRole === null ? (
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
                  ? '同票になった容疑者からインサイダーだと思う1人を選んでください。'
                  : `マスター（${state.masterName ?? ''}）以外のプレイヤーの中から、インサイダーだと思う1人を選んでください。`}
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
                      <span className="ww-target-name">
                        {p.name}
                        {state.solverId === p.id ? '（正解者）' : ''}
                      </span>
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
                告発投票を確定する
              </button>
            </>
          )}
        </section>
      )}

      {/* ============ 5. 決着・全公開 ============ */}
      {state.phase === 'finished' && (
        <section className="ww-panel ww-result-panel">
          <div className={`ww-winner-banner ${winnerBannerClass}`}>
            <Shield size={24} />
            <h2>{winnerTitle}</h2>
          </div>

          <div className="ww-role-reveal-card" style={{ padding: '12px' }}>
            <div className="ww-reveal-eyebrow">秘密のお題（{state.category}）</div>
            <div className="ww-reveal-name" style={{ fontSize: 24 }}>
              {state.revealedWord}
            </div>
            {state.solverName && (
              <span className="ww-team-pill team-village">お題正解者: {state.solverName}</span>
            )}
          </div>

          {/* 全員の役職公開 */}
          <div className="ww-final-roles">
            {state.players.map((p) => {
              const meta = p.role ? INSIDER_ROLE_META[p.role] : null;
              const isWinner = state.winnerIds.includes(p.id);
              const isAccused = state.voteResult?.accusedId === p.id;
              return (
                <div key={p.id} className={`ww-final-row ${isWinner ? 'is-winner' : ''}`}>
                  <div className="ww-final-left">
                    <span className="ww-final-name">{p.name}</span>
                    {state.solverId === p.id && (
                      <span className="ww-dead-tag">正解者</span>
                    )}
                    {isAccused && (
                      <span
                        className="ww-dead-tag"
                        style={{
                          background: 'rgba(239, 68, 68, 0.25)',
                          color: '#fecaca',
                        }}
                      >
                        告発
                      </span>
                    )}
                  </div>
                  <div className="ww-final-right">
                    {meta && (
                      <span className={`ww-team-pill ${getRoleTeamClass(meta.role)}`}>
                        {meta.name}
                      </span>
                    )}
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
              let statusText = p.isMaster ? 'マスター' : '参加中';
              if (state.subPhase === 'roleReveal') {
                statusText = p.ready ? '確認済' : '確認中';
              } else if (state.subPhase === 'voting') {
                statusText = p.hasVoted ? '投票済' : '投票中';
              }
              return (
                <div
                  key={p.id}
                  className={`ww-roster-pill ${p.id === state.myId ? 'is-me' : ''}`}
                >
                  <span className="ww-roster-name">
                    {p.name}
                  </span>
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
