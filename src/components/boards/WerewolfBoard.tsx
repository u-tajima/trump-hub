import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Moon,
  Plus,
  Scale,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import {
  WEREWOLF_ROLE_META,
  type WerewolfClientState,
  type WerewolfRole,
  type WerewolfTeam,
} from '../../games/werewolf';
import './WerewolfBoard.css';

export interface WerewolfBoardProps {
  state: WerewolfClientState;
  isHost: boolean;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const ROLE_ORDER: WerewolfRole[] = [
  'werewolf',
  'seer',
  'bodyguard',
  'medium',
  'madman',
  'fox',
  'villager',
];

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function getTeamWinnerTitle(team: WerewolfTeam | null): string {
  if (team === 'village') return '村人陣営の勝利';
  if (team === 'werewolf') return '人狼陣営の勝利';
  if (team === 'fox') return '妖狐陣営の単独勝利';
  return 'ゲーム終了';
}

function getSubPhaseLabel(state: WerewolfClientState): string {
  if (state.phase === 'finished') return '決着・全役職公開';
  switch (state.subPhase) {
    case 'roleReveal':
      return '役職確認';
    case 'morning':
      return `${state.day}日目 朝`;
    case 'discussion':
      return `${state.day}日目 昼・議論`;
    case 'voting':
      return state.isRunoff ? `${state.day}日目 決選投票` : `${state.day}日目 投票`;
    case 'execution':
      return `${state.day}日目 投票結果`;
    case 'night':
      return `${state.day}日目 夜`;
  }
}

export const WerewolfBoard: React.FC<WerewolfBoardProps> = ({
  state,
  isHost,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [secretOpen, setSecretOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  // 議論タイマーの1秒更新
  useEffect(() => {
    if (state.phase !== 'playing' || state.subPhase !== 'discussion' || !state.discussionEndsAt) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.phase, state.subPhase, state.discussionEndsAt]);

  // フェーズや操作プレイヤー切替時に選択・覗き見トグルをリセット
  const phaseKey = `${state.day}-${state.subPhase}-${state.isRunoff}-${state.myId}-${state.myNightTargetId ?? ''}`;
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

  const myRoleMeta = state.myRole ? WEREWOLF_ROLE_META[state.myRole] : null;
  const alivePlayers = useMemo(() => state.players.filter((p) => p.alive), [state.players]);
  const fellowWolves = useMemo(
    () =>
      state.players.filter(
        (p) => p.id !== state.myId && state.fellowWolfIds.includes(p.id)
      ),
    [state.players, state.myId, state.fellowWolfIds]
  );

  // 投票対象候補
  const voteCandidates = useMemo(() => {
    return alivePlayers.filter((p) => {
      if (p.id === state.myId) return false;
      if (state.isRunoff && !state.runoffCandidateIds.includes(p.id)) return false;
      return true;
    });
  }, [alivePlayers, state.myId, state.isRunoff, state.runoffCandidateIds]);

  // 夜アクション対象候補
  const isFirstNight = state.day === 1;
  const needsNightTarget =
    state.subPhase === 'night' &&
    state.myAlive &&
    !state.myNightDone &&
    ((state.myRole === 'seer' &&
      (!isFirstNight || state.rules.firstNightFortune === 'free') &&
      !state.myNightTargetId) ||
      (state.myRole === 'werewolf' && !isFirstNight) ||
      (state.myRole === 'bodyguard' && !isFirstNight));

  const seerJustInspected =
    state.subPhase === 'night' &&
    state.myRole === 'seer' &&
    Boolean(state.myNightTargetId) &&
    !state.myNightDone;

  const latestSeerLog =
    state.mySeerLogs.length > 0 ? state.mySeerLogs[state.mySeerLogs.length - 1] : null;
  const latestMediumLog =
    state.myMediumLogs.length > 0 ? state.myMediumLogs[state.myMediumLogs.length - 1] : null;

  const nightCandidates = useMemo(() => {
    if (state.subPhase !== 'night') return [];
    return alivePlayers.filter((p) => {
      if (p.id === state.myId) return false;
      if (state.myRole === 'werewolf' && !isFirstNight) {
        return !state.fellowWolfIds.includes(p.id);
      }
      return true;
    });
  }, [state.subPhase, alivePlayers, state.myId, state.myRole, isFirstNight, state.fellowWolfIds]);

  const activeRoleSummary = useMemo(
    () =>
      ROLE_ORDER.filter((r) => (state.roleCounts[r] ?? 0) > 0).map((r) => ({
        role: r,
        name: WEREWOLF_ROLE_META[r].name,
        count: state.roleCounts[r],
      })),
    [state.roleCounts]
  );

  const isNightVisual = state.subPhase === 'night' && state.phase === 'playing';
  const showRoleCardInline =
    state.phase === 'playing' &&
    myRoleMeta !== null &&
    (state.subPhase === 'roleReveal' || state.subPhase === 'night');
  const showRoleToggleBar =
    state.phase === 'playing' &&
    myRoleMeta !== null &&
    !showRoleCardInline &&
    !isLocalPassAndPlay;

  const readyCount = state.players.filter((p) => p.ready).length;
  const votedCount = alivePlayers.filter((p) => p.hasVoted).length;
  const nightDoneCount = alivePlayers.filter((p) => p.hasActedNight).length;

  return (
    <div className={`ww-root ${isNightVisual ? 'is-night' : ''}`}>
      {/* フェーズ＆生存者ヘッダー */}
      <div className="ww-header-card">
        <div className="ww-phase-row">
          <div className="ww-phase-badge">
            {isNightVisual ? <Moon size={15} /> : <Sun size={15} />}
            <span>{getSubPhaseLabel(state)}</span>
          </div>
          <div className="ww-alive-count">
            <Users size={14} />
            <span>
              生存 {alivePlayers.length} / {state.players.length}
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

      {/* 議論・朝・処刑画面用：自分の役職＆結果の覗き見防止トグル */}
      {showRoleToggleBar && myRoleMeta && (
        <div className="ww-secret-drawer">
          <button
            type="button"
            className="ww-secret-toggle"
            onClick={() => setSecretOpen((v) => !v)}
          >
            {secretOpen ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{secretOpen ? '役職・メモを隠す' : '自分の役職・結果を確認する'}</span>
          </button>
          {secretOpen && (
            <div className="ww-secret-body">
              <div className="ww-my-role-head">
                <span className={`ww-team-pill team-${myRoleMeta.team}`}>
                  {myRoleMeta.teamLabel}
                </span>
                <span className="ww-my-role-name">{myRoleMeta.name}</span>
              </div>
              <p className="ww-role-desc">{myRoleMeta.summary}</p>
              {fellowWolves.length > 0 && (
                <div className="ww-secret-note">
                  仲間の人狼: {fellowWolves.map((w) => w.name).join('・')}
                </div>
              )}
              {state.mySeerLogs.length > 0 && (
                <div className="ww-inspect-list">
                  <div className="ww-inspect-title">占い結果履歴</div>
                  {state.mySeerLogs.map((log, i) => (
                    <div key={i} className="ww-inspect-row">
                      <span>
                        {log.day}日目: {log.targetName}
                      </span>
                      <span className={log.isWolf ? 'ww-res-black' : 'ww-res-white'}>
                        {log.isWolf ? '人狼' : '人間'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {state.myMediumLogs.length > 0 && (
                <div className="ww-inspect-list">
                  <div className="ww-inspect-title">霊媒結果履歴</div>
                  {state.myMediumLogs.map((log, i) => (
                    <div key={i} className="ww-inspect-row">
                      <span>
                        {log.day}日目処刑: {log.targetName}
                      </span>
                      <span className={log.isWolf ? 'ww-res-black' : 'ww-res-white'}>
                        {log.isWolf ? '人狼' : '人間'}
                      </span>
                    </div>
                  ))}
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
                <span className={`ww-team-pill team-${myRoleMeta.team}`}>
                  {myRoleMeta.teamLabel}
                </span>
                <p className="ww-role-desc">{myRoleMeta.summary}</p>

                {fellowWolves.length > 0 && (
                  <div className="ww-secret-note">
                    仲間の人狼: {fellowWolves.map((w) => w.name).join('・')}
                  </div>
                )}

                {state.myRole === 'seer' && latestSeerLog && (
                  <div className="ww-secret-note white-hint">
                    初日占い通知: <strong>{latestSeerLog.targetName}</strong> は「人間」です
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
                {state.myReady ? `確認済み（${readyCount}/${state.players.length}人）` : '役職を確認しました'}
              </button>
            </>
          ) : (
            <div className="ww-wait-box">全員の役職確認を待っています（{readyCount}/{state.players.length}人）</div>
          )}

          {isHost && !isLocalPassAndPlay && (
            <button
              type="button"
              className="secondary-btn full-width ww-host-skip"
              onClick={() => onAction({ type: 'advancePhase' })}
            >
              ホスト操作: 確認を締め切って次へ進む
            </button>
          )}
        </section>
      )}

      {/* ============ 2. 朝の結果発表フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'morning' && (
        <section className="ww-panel">
          <div className="ww-announce-card">
            <div className="ww-announce-icon">
              {state.lastNightSummary?.peaceful ? <Sun size={28} /> : <Skull size={28} />}
            </div>
            <h3 className="ww-announce-title">
              {state.lastNightSummary?.peaceful
                ? '昨夜は誰も襲われませんでした'
                : '昨夜の犠牲者'}
            </h3>
            {state.lastNightSummary && !state.lastNightSummary.peaceful ? (
              <div className="ww-victim-list">
                {state.lastNightSummary.victims.map((v) => (
                  <span key={v.id} className="ww-victim-pill">
                    {v.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="ww-panel-sub">平和な朝を迎えました。</p>
            )}
          </div>

          {isHost ? (
            <button
              type="button"
              className="primary-btn full-width"
              onClick={() => onAction({ type: 'startDiscussion' })}
            >
              昼の議論を開始する
              <ChevronRight size={17} />
            </button>
          ) : (
            <div className="ww-wait-box">ホストが議論を開始するのを待っています…</div>
          )}
        </section>
      )}

      {/* ============ 3. 昼の議論フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'discussion' && (
        <section className="ww-panel">
          <div className={`ww-timer-box ${isTimeUp ? 'is-timeup' : ''}`}>
            <div className="ww-timer-label">
              <Clock size={15} />
              <span>{remainingSec === null ? '議論タイマー' : isTimeUp ? '議論時間終了' : '残り議論時間'}</span>
            </div>
            <div className="ww-timer-value">
              {remainingSec === null ? '無制限' : formatTimer(remainingSec)}
            </div>
          </div>

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

      {/* ============ 4. 投票フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'voting' && (
        <section className="ww-panel">
          <div className="ww-panel-header">
            <h3 className="ww-panel-title">
              <Scale size={16} />
              {state.isRunoff ? '決選投票' : '追放投票'}
            </h3>
            <span className="ww-progress-pill">
              {votedCount} / {alivePlayers.length} 完了
            </span>
          </div>

          {!state.myAlive ? (
            <div className="ww-wait-box">
              あなたは脱落しているため投票に参加できません（生存者の投票待ち…）
            </div>
          ) : state.myVotedTargetId ? (
            <div className="ww-wait-box done">
              <Check size={16} />
              <span>
                投票完了（他プレイヤーの投票を待っています：{votedCount}/{alivePlayers.length}人）
              </span>
            </div>
          ) : (
            <>
              <p className="ww-panel-sub">
                {state.isRunoff
                  ? '同票になった候補者から追放する1人を選んでください。'
                  : '人狼だと思うプレイヤーを1人選んで投票してください。'}
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

      {/* ============ 5. 処刑結果発表フェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'execution' && state.lastExecution && (
        <section className="ww-panel">
          <div className="ww-announce-card">
            <div className="ww-announce-icon">
              <Scale size={26} />
            </div>
            <h3 className="ww-announce-title">
              {state.lastExecution.executedName
                ? `${state.lastExecution.executedName} が追放されました`
                : '本日の追放はなし'}
            </h3>
            <p className="ww-panel-sub">{state.lastExecution.reason}</p>
          </div>

          <div className="ww-tally-box">
            <div className="ww-tally-title">得票結果</div>
            {state.lastExecution.tally
              .filter((t) => t.count > 0)
              .map((t) => (
                <div key={t.targetId} className="ww-tally-row">
                  <span>{t.targetName}</span>
                  <span className="ww-tally-count">{t.count}票</span>
                </div>
              ))}
          </div>

          {isHost ? (
            <button
              type="button"
              className="primary-btn full-width"
              onClick={() => onAction({ type: 'startNight' })}
            >
              <Moon size={16} />
              夜へ進む
            </button>
          ) : (
            <div className="ww-wait-box">ホストが夜フェーズへ進めるのを待っています…</div>
          )}
        </section>
      )}

      {/* ============ 6. 夜のアクションフェーズ ============ */}
      {state.phase === 'playing' && state.subPhase === 'night' && (
        <section className="ww-panel ww-night-panel">
          <div className="ww-panel-header">
            <h3 className="ww-panel-title">
              <Moon size={16} />
              {state.day}日目の夜
            </h3>
            <span className="ww-progress-pill">
              {nightDoneCount} / {alivePlayers.length} 完了
            </span>
          </div>

          {myRoleMeta && (
            <div className="ww-night-role-strip">
              <span className={`ww-team-pill team-${myRoleMeta.team}`}>
                {myRoleMeta.teamLabel}
              </span>
              <span className="ww-my-role-name">{myRoleMeta.name}</span>
            </div>
          )}

          {!state.myAlive ? (
            <div className="ww-wait-box">
              あなたは脱落しているため観戦中です（生存者の夜行動を待っています…）
            </div>
          ) : state.myNightDone ? (
            <div className="ww-wait-box done">
              <Check size={16} />
              <span>
                夜行動が完了しました（全員の完了を待っています：{nightDoneCount}/{alivePlayers.length}人）
              </span>
            </div>
          ) : seerJustInspected && latestSeerLog ? (
            <div className="ww-seer-result-box">
              <div className="ww-seer-result-label">
                <Sparkles size={16} /> 占い結果
              </div>
              <div className="ww-seer-result-main">
                <strong>{latestSeerLog.targetName}</strong> は{' '}
                <span className={latestSeerLog.isWolf ? 'ww-res-black' : 'ww-res-white'}>
                  {latestSeerLog.isWolf ? '人狼' : '人間'}
                </span>{' '}
                でした
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
          ) : needsNightTarget ? (
            <>
              <p className="ww-panel-sub">
                {state.myRole === 'werewolf'
                  ? '今夜襲撃するプレイヤーを1人選んでください。'
                  : state.myRole === 'seer'
                  ? '今夜占うプレイヤーを1人選んでください。'
                  : '今夜護衛するプレイヤーを1人選んでください。'}
              </p>

              {state.myRole === 'werewolf' && fellowWolves.length > 0 && (
                <div className="ww-secret-note">
                  仲間人狼の選択:{' '}
                  {fellowWolves
                    .map((w) => {
                      const tid = state.wolfAttackVotes[w.id];
                      const tName = state.players.find((p) => p.id === tid)?.name;
                      return `${w.name}→${tName ?? '未選択'}`;
                    })
                    .join(' / ')}
                </div>
              )}

              <div className="ww-target-grid">
                {nightCandidates.map((p) => {
                  const isBlockedConsecutive =
                    state.myRole === 'bodyguard' &&
                    !state.rules.consecutiveGuard &&
                    state.myLastGuardTargetId === p.id;
                  const selected = selectedTargetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isBlockedConsecutive}
                      className={`ww-target-btn ${selected ? 'selected' : ''} ${
                        isBlockedConsecutive ? 'blocked' : ''
                      }`}
                      onClick={() => setSelectedTargetId(p.id)}
                    >
                      <span className="ww-target-name">
                        {p.name}
                        {isBlockedConsecutive ? '（前回護衛）' : ''}
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
                  onAction({ type: 'nightAction', payload: { targetId: selectedTargetId } });
                }}
              >
                {state.myRole === 'werewolf'
                  ? '襲撃先を決定する'
                  : state.myRole === 'seer'
                  ? 'この人を占う'
                  : 'この人を護衛する'}
              </button>
            </>
          ) : (
            <>
              {state.myRole === 'medium' && latestMediumLog && (
                <div className="ww-secret-note">
                  霊媒結果（{latestMediumLog.day}日目処刑）:{' '}
                  <strong>{latestMediumLog.targetName}</strong> は{' '}
                  <span className={latestMediumLog.isWolf ? 'ww-res-black' : 'ww-res-white'}>
                    {latestMediumLog.isWolf ? '人狼' : '人間'}
                  </span>{' '}
                  でした
                </div>
              )}

              <p className="ww-panel-sub">
                今夜の特殊行動はありません。怪しい人をタップしてメモするか、そのまま完了を押してください（周囲から役職が推測されないためのダミー操作です）。
              </p>

              <div className="ww-target-grid">
                {nightCandidates.map((p) => {
                  const selected = selectedTargetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`ww-target-btn ${selected ? 'selected' : ''}`}
                      onClick={() => setSelectedTargetId((prev) => (prev === p.id ? null : p.id))}
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
                夜行動を完了する
              </button>
            </>
          )}
        </section>
      )}

      {/* ============ 7. 決着・全役職公開 ============ */}
      {state.phase === 'finished' && (
        <section className="ww-panel ww-result-panel">
          <div className={`ww-winner-banner team-${state.winnerTeam ?? 'village'}`}>
            <Shield size={24} />
            <h2>{getTeamWinnerTitle(state.winnerTeam)}</h2>
          </div>

          <div className="ww-final-roles">
            {state.players.map((p) => {
              const meta = p.role ? WEREWOLF_ROLE_META[p.role] : null;
              const isWinner = state.winnerIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`ww-final-row ${isWinner ? 'is-winner' : ''} ${
                    !p.alive ? 'is-dead' : ''
                  }`}
                >
                  <div className="ww-final-left">
                    <span className="ww-final-name">{p.name}</span>
                    {!p.alive && (
                      <span className="ww-dead-tag">
                        {p.deathCause === 'executed'
                          ? `${p.deathDay}日目追放`
                          : `${p.deathDay}日目脱落`}
                      </span>
                    )}
                  </div>
                  <div className="ww-final-right">
                    {meta && (
                      <span className={`ww-team-pill team-${meta.team}`}>{meta.name}</span>
                    )}
                    {isWinner && <span className="ww-win-tag">WIN</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ 生存者・脱落者ステータス一覧（終了時以外） ============ */}
      {state.phase === 'playing' && (
        <section className="ww-roster-card">
          <div className="ww-roster-title">参加者ステータス</div>
          <div className="ww-roster-grid">
            {state.players.map((p) => {
              let statusText = p.alive ? '生存' : '脱落';
              if (p.alive) {
                if (state.subPhase === 'roleReveal') {
                  statusText = p.ready ? '確認済' : '確認中';
                } else if (state.subPhase === 'voting') {
                  statusText = p.hasVoted ? '投票済' : '投票中';
                } else if (state.subPhase === 'night') {
                  statusText = p.hasActedNight ? '完了' : '行動中';
                }
              } else if (p.deathCause === 'executed') {
                statusText = '追放';
              }

              return (
                <div
                  key={p.id}
                  className={`ww-roster-pill ${!p.alive ? 'dead' : ''} ${
                    p.id === state.myId ? 'is-me' : ''
                  }`}
                >
                  <span className="ww-roster-name">{p.name}</span>
                  <span className="ww-roster-status">{statusText}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 進行タイムライン（折りたたみ） */}
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
