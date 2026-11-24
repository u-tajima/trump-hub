import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Moon,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import {
  ONE_NIGHT_ROLE_META,
  type OneNightClientState,
  type OneNightRole,
  type OneNightTeam,
} from '../../games/oneNight';
import './WerewolfBoard.css';

export interface OneNightBoardProps {
  state: OneNightClientState;
  isHost: boolean;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const ROLE_ORDER: OneNightRole[] = ['werewolf', 'seer', 'thief', 'tanner', 'villager'];

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function getTeamClass(team: OneNightTeam): string {
  if (team === 'village') return 'team-village';
  if (team === 'werewolf') return 'team-werewolf';
  return 'team-fox';
}

function getWinnerTitle(team: OneNightTeam | null): string {
  if (team === 'village') return '村人陣営の勝利';
  if (team === 'werewolf') return '人狼陣営の勝利';
  if (team === 'tanner') return 'てるてる坊主の単独勝利';
  return 'ゲーム終了';
}

function getSubPhaseLabel(state: OneNightClientState): string {
  if (state.phase === 'finished') return '決着・全役職公開';
  if (state.subPhase === 'night') return '夜のフェーズ';
  if (state.subPhase === 'discussion') return '昼・議論タイム';
  return '投票タイム';
}

export const OneNightBoard: React.FC<OneNightBoardProps> = ({
  state,
  isHost,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [secretOpen, setSecretOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [seerMode, setSeerMode] = useState<'player' | 'center'>('player');
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    if (state.phase !== 'playing' || state.subPhase !== 'discussion' || !state.discussionEndsAt) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.phase, state.subPhase, state.discussionEndsAt]);

  const phaseKey = `${state.subPhase}-${state.myId}-${state.mySeerResult ? 's' : ''}-${state.myThiefResult ? 't' : ''}`;
  const [lastPhaseKey, setLastPhaseKey] = useState(phaseKey);
  if (phaseKey !== lastPhaseKey) {
    setLastPhaseKey(phaseKey);
    setSelectedTargetId(null);
    setSecretOpen(false);
    setSeerMode('player');
  }

  const remainingSec = state.discussionEndsAt
    ? Math.max(0, (state.discussionEndsAt - nowMs) / 1000)
    : null;
  const isTimeUp = remainingSec !== null && remainingSec <= 0;

  const myRoleMeta = state.myInitialRole ? ONE_NIGHT_ROLE_META[state.myInitialRole] : null;
  const otherPlayers = useMemo(
    () => state.players.filter((p) => p.id !== state.myId),
    [state.players, state.myId]
  );
  const fellowWolves = useMemo(
    () =>
      state.players.filter(
        (p) => p.id !== state.myId && state.fellowWolfIds.includes(p.id)
      ),
    [state.players, state.myId, state.fellowWolfIds]
  );

  const activeRoleSummary = useMemo(
    () =>
      ROLE_ORDER.filter((r) => (state.roleCounts[r] ?? 0) > 0).map((r) => ({
        role: r,
        name: ONE_NIGHT_ROLE_META[r].name,
        count: state.roleCounts[r],
      })),
    [state.roleCounts]
  );

  const isNightVisual = state.subPhase === 'night' && state.phase === 'playing';
  const showRoleToggleBar =
    state.phase === 'playing' &&
    state.subPhase !== 'night' &&
    myRoleMeta !== null &&
    !isLocalPassAndPlay;

  const nightDoneCount = state.players.filter((p) => p.hasActedNight).length;
  const votedCount = state.players.filter((p) => p.hasVoted).length;

  return (
    <div className={`ww-root ${isNightVisual ? 'is-night' : ''}`}>
      {/* ヘッダー */}
      <div className="ww-header-card">
        <div className="ww-phase-row">
          <div className="ww-phase-badge">
            {isNightVisual ? <Moon size={15} /> : <Sun size={15} />}
            <span>{getSubPhaseLabel(state)}</span>
          </div>
          <div className="ww-alive-count">
            <Users size={14} />
            <span>
              {state.players.length}人 + 中央2枚
            </span>
          </div>
        </div>

        <div className="ww-role-chips">
          {activeRoleSummary.map((item) => (
            <span key={item.role} className="ww-role-chip">
              {item.name} {item.count}
            </span>
          ))}
        </div>

        <div className="ww-log-line">{state.lastLog}</div>
      </div>

      {/* 議論・投票画面用：覗き見防止トグル */}
      {showRoleToggleBar && myRoleMeta && (
        <div className="ww-secret-drawer">
          <button
            type="button"
            className="ww-secret-toggle"
            onClick={() => setSecretOpen((v) => !v)}
          >
            {secretOpen ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{secretOpen ? '役職・夜結果を隠す' : '自分の初期役職・夜結果を確認する'}</span>
          </button>
          {secretOpen && (
            <div className="ww-secret-body">
              <div className="ww-my-role-head">
                <span className={`ww-team-pill ${getTeamClass(myRoleMeta.team)}`}>
                  {myRoleMeta.teamLabel}
                </span>
                <span className="ww-my-role-name">初期役職: {myRoleMeta.name}</span>
              </div>
              <p className="ww-role-desc">{myRoleMeta.summary}</p>

              {state.myInitialRole === 'werewolf' && (
                <div className="ww-secret-note">
                  {fellowWolves.length > 0
                    ? `仲間の人狼: ${fellowWolves.map((w) => w.name).join('・')}`
                    : 'あなたが唯一の人狼です。中央に人狼が眠っているかもしれません。'}
                </div>
              )}

              {state.mySeerResult && (
                <div className="ww-secret-note white-hint">
                  {state.mySeerResult.mode === 'player' && state.mySeerResult.targetRole ? (
                    <>
                      占い結果: <strong>{state.mySeerResult.targetName}</strong> は「
                      {ONE_NIGHT_ROLE_META[state.mySeerResult.targetRole].name}」でした
                    </>
                  ) : state.mySeerResult.centerRoles ? (
                    <>
                      中央の余りカード: 「
                      {ONE_NIGHT_ROLE_META[state.mySeerResult.centerRoles[0]].name}」と「
                      {ONE_NIGHT_ROLE_META[state.mySeerResult.centerRoles[1]].name}」
                    </>
                  ) : null}
                </div>
              )}

              {state.myThiefResult && (
                <div className="ww-secret-note white-hint">
                  {state.myThiefResult.swapped ? (
                    <>
                      交換結果: <strong>{state.myThiefResult.targetName}</strong> と交換 → あなたの新しい役職は「
                      {ONE_NIGHT_ROLE_META[state.myThiefResult.newRole].name}」
                    </>
                  ) : (
                    <>交換しませんでした（怪盗のまま）</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ 1. 夜フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'night' && (
        <section className="ww-panel ww-night-panel">
          <div className="ww-panel-header">
            <h3 className="ww-panel-title">
              <Moon size={16} />
              夜のアクション
            </h3>
            <span className="ww-progress-pill">
              {nightDoneCount} / {state.players.length} 完了
            </span>
          </div>

          {!myRoleMeta ? (
            <div className="ww-wait-box">
              他プレイヤーの夜行動を待っています（{nightDoneCount}/{state.players.length}人）
            </div>
          ) : state.myNightDone ? (
            <div className="ww-wait-box done">
              <Check size={16} />
              <span>
                夜行動が完了しました（全員の完了を待っています：{nightDoneCount}/{state.players.length}人）
              </span>
            </div>
          ) : (
            <>
              <div className="ww-role-reveal-card">
                <div className="ww-reveal-eyebrow">あなたの初期役職</div>
                <div className="ww-reveal-name">{myRoleMeta.name}</div>
                <span className={`ww-team-pill ${getTeamClass(myRoleMeta.team)}`}>
                  {myRoleMeta.teamLabel}
                </span>
                <p className="ww-role-desc">{myRoleMeta.summary}</p>
              </div>

              {/* 人狼 */}
              {state.myInitialRole === 'werewolf' && (
                <>
                  <div className="ww-secret-note">
                    {fellowWolves.length > 0
                      ? `仲間の人狼: ${fellowWolves.map((w) => w.name).join('・')}`
                      : 'あなたが唯一の人狼です。中央に人狼が眠っているかも。'}
                  </div>
                  <button
                    type="button"
                    className="primary-btn full-width"
                    onClick={() => onAction({ type: 'nightAction' })}
                  >
                    <Check size={16} />
                    確認して夜を終える
                  </button>
                </>
              )}

              {/* 占い師 */}
              {state.myInitialRole === 'seer' && (
                state.mySeerResult ? (
                  <div className="ww-seer-result-box">
                    <div className="ww-seer-result-label">
                      <Sparkles size={16} /> 占い結果
                    </div>
                    <div className="ww-seer-result-main">
                      {state.mySeerResult.mode === 'player' && state.mySeerResult.targetRole ? (
                        <>
                          <strong>{state.mySeerResult.targetName}</strong> の役職は{' '}
                          <span className="ww-res-white">
                            {ONE_NIGHT_ROLE_META[state.mySeerResult.targetRole].name}
                          </span>{' '}
                          でした
                        </>
                      ) : state.mySeerResult.centerRoles ? (
                        <>
                          中央の余りカードは{' '}
                          <span className="ww-res-white">
                            {ONE_NIGHT_ROLE_META[state.mySeerResult.centerRoles[0]].name}
                          </span>{' '}
                          と{' '}
                          <span className="ww-res-white">
                            {ONE_NIGHT_ROLE_META[state.mySeerResult.centerRoles[1]].name}
                          </span>{' '}
                          でした
                        </>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="primary-btn full-width"
                      onClick={() => onAction({ type: 'nightAction' })}
                    >
                      <Check size={16} />
                      結果を確認して夜を終える
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="ww-host-actions">
                      <button
                        type="button"
                        className={seerMode === 'player' ? 'primary-btn flex-1' : 'secondary-btn flex-1'}
                        onClick={() => setSeerMode('player')}
                      >
                        <Users size={15} />
                        1人の役職を見る
                      </button>
                      <button
                        type="button"
                        className={seerMode === 'center' ? 'primary-btn flex-1' : 'secondary-btn flex-1'}
                        onClick={() => {
                          setSeerMode('center');
                          setSelectedTargetId(null);
                        }}
                      >
                        <Layers size={15} />
                        中央の2枚を見る
                      </button>
                    </div>

                    {seerMode === 'player' ? (
                      <>
                        <p className="ww-panel-sub">役職を見たいプレイヤーを1人選んでください。</p>
                        <div className="ww-target-grid">
                          {otherPlayers.map((p) => {
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
                            onAction({
                              type: 'seerInspect',
                              payload: { mode: 'player', targetId: selectedTargetId },
                            });
                          }}
                        >
                          <Sparkles size={16} />
                          この人の役職を見る
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="ww-panel-sub">
                          誰にも配られなかった中央の余りカード2枚を確認します。
                        </p>
                        <button
                          type="button"
                          className="primary-btn full-width"
                          onClick={() =>
                            onAction({ type: 'seerInspect', payload: { mode: 'center' } })
                          }
                        >
                          <Layers size={16} />
                          中央の余りカード2枚を見る
                        </button>
                      </>
                    )}
                  </>
                )
              )}

              {/* 怪盗 */}
              {state.myInitialRole === 'thief' && (
                state.myThiefResult ? (
                  <div className="ww-seer-result-box">
                    <div className="ww-seer-result-label">
                      <RefreshCw size={16} /> 交換結果
                    </div>
                    <div className="ww-seer-result-main">
                      {state.myThiefResult.swapped ? (
                        <>
                          <strong>{state.myThiefResult.targetName}</strong> と交換しました！
                          <br />
                          あなたの新しい役職は{' '}
                          <span className="ww-res-white">
                            {ONE_NIGHT_ROLE_META[state.myThiefResult.newRole].name}
                          </span>{' '}
                          です
                        </>
                      ) : (
                        <>交換しませんでした（怪盗のまま進行します）</>
                      )}
                    </div>
                    <p className="ww-panel-sub">
                      勝敗は交換後の新しい役職（{ONE_NIGHT_ROLE_META[state.myThiefResult.newRole].teamLabel}）で決まります。
                    </p>
                    <button
                      type="button"
                      className="primary-btn full-width"
                      onClick={() => onAction({ type: 'nightAction' })}
                    >
                      <Check size={16} />
                      結果を確認して夜を終える
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="ww-panel-sub">
                      役職を交換する相手を1人選んでください（交換しないことも選べます）。
                    </p>
                    <div className="ww-target-grid">
                      {otherPlayers.map((p) => {
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
                    <div className="ww-host-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          onAction({ type: 'thiefSwap', payload: { targetId: null } })
                        }
                      >
                        交換しない
                      </button>
                      <button
                        type="button"
                        className="primary-btn flex-1"
                        disabled={!selectedTargetId}
                        onClick={() => {
                          if (!selectedTargetId) return;
                          onAction({
                            type: 'thiefSwap',
                            payload: { targetId: selectedTargetId },
                          });
                        }}
                      >
                        <RefreshCw size={15} />
                        この人と交換する
                      </button>
                    </div>
                  </>
                )
              )}

              {/* 村人 / てるてる坊主（ダミー操作付き） */}
              {(state.myInitialRole === 'villager' || state.myInitialRole === 'tanner') && (
                <>
                  <p className="ww-panel-sub">
                    夜の特殊行動はありません。周囲から役職が推測されないよう、気になる人を1人タップしてから完了を押せます（ダミー操作）。
                  </p>
                  <div className="ww-target-grid">
                    {otherPlayers.map((p) => {
                      const selected = selectedTargetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`ww-target-btn ${selected ? 'selected' : ''}`}
                          onClick={() =>
                            setSelectedTargetId((prev) => (prev === p.id ? null : p.id))
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
                    onClick={() => onAction({ type: 'nightAction' })}
                  >
                    <Check size={16} />
                    確認して夜を終える
                  </button>
                </>
              )}
            </>
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
            1回の投票で決着がつきます。怪盗による入れ替えや、中央に人狼が眠っている（平和村）可能性も踏まえて推理しましょう。
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
              最終投票
            </h3>
            <span className="ww-progress-pill">
              {votedCount} / {state.players.length} 完了
            </span>
          </div>

          {!myRoleMeta ? (
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
                人狼だと思うプレイヤーを1人選んでください。全員の票が1票ずつに割れると「平和村（処刑なし）」になります。
              </p>
              <div className="ww-target-grid">
                {otherPlayers.map((p) => {
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

      {/* ============ 4. 決着・全役職公開 ============ */}
      {state.phase === 'finished' && (
        <section className="ww-panel ww-result-panel">
          <div
            className={`ww-winner-banner ${
              state.winnerTeam ? getTeamClass(state.winnerTeam) : 'team-village'
            }`}
          >
            <Shield size={24} />
            <h2>{getWinnerTitle(state.winnerTeam)}</h2>
          </div>

          {state.voteResult && (
            <p className="ww-panel-sub" style={{ textAlign: 'center', fontWeight: 700 }}>
              {state.voteResult.reason}
            </p>
          )}

          {/* 全員の初期役職 → 最終役職 */}
          <div className="ww-final-roles">
            {state.players.map((p) => {
              const initMeta = p.initialRole ? ONE_NIGHT_ROLE_META[p.initialRole] : null;
              const finalMeta = p.finalRole ? ONE_NIGHT_ROLE_META[p.finalRole] : null;
              const swapped = p.initialRole && p.finalRole && p.initialRole !== p.finalRole;
              const isWinner = state.winnerIds.includes(p.id);
              const isExecuted = state.voteResult?.executedIds.includes(p.id) ?? false;

              return (
                <div
                  key={p.id}
                  className={`ww-final-row ${isWinner ? 'is-winner' : ''}`}
                >
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
                    {swapped && initMeta && finalMeta ? (
                      <>
                        <span
                          className={`ww-team-pill ${getTeamClass(initMeta.team)}`}
                          style={{ opacity: 0.72 }}
                        >
                          {initMeta.name}
                        </span>
                        <ArrowRight size={13} style={{ color: '#fbbf24' }} />
                        <span className={`ww-team-pill ${getTeamClass(finalMeta.team)}`}>
                          {finalMeta.name}
                        </span>
                      </>
                    ) : finalMeta ? (
                      <span className={`ww-team-pill ${getTeamClass(finalMeta.team)}`}>
                        {finalMeta.name}
                      </span>
                    ) : null}
                    {isWinner && <span className="ww-win-tag">WIN</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 中央の余りカード2枚 */}
          {state.centerCards && (
            <div className="ww-tally-box">
              <div className="ww-tally-title">中央の余りカード（2枚）</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {state.centerCards.map((role, idx) => {
                  const meta = ONE_NIGHT_ROLE_META[role];
                  return (
                    <span key={idx} className={`ww-team-pill ${getTeamClass(meta.team)}`}>
                      中央{idx + 1}: {meta.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 投票内訳 */}
          {state.voteResult && (
            <div className="ww-tally-box">
              <div className="ww-tally-title">投票内訳</div>
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
              if (state.subPhase === 'night') {
                statusText = p.hasActedNight ? '完了' : '行動中';
              } else if (state.subPhase === 'voting') {
                statusText = p.hasVoted ? '投票済' : '投票中';
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
