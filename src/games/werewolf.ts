import type { PlayerInfo, WerewolfRules } from '../types/game';

export type WerewolfRole =
  | 'villager'
  | 'werewolf'
  | 'seer'
  | 'medium'
  | 'bodyguard'
  | 'madman'
  | 'fox';

export type WerewolfTeam = 'village' | 'werewolf' | 'fox';

export type WerewolfSubPhase =
  | 'roleReveal'
  | 'morning'
  | 'discussion'
  | 'voting'
  | 'execution'
  | 'night';

export interface WerewolfRoleMeta {
  role: WerewolfRole;
  name: string;
  team: WerewolfTeam;
  teamLabel: string;
  summary: string;
}

export const WEREWOLF_ROLE_META: Record<WerewolfRole, WerewolfRoleMeta> = {
  villager: {
    role: 'villager',
    name: '村人',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '特殊能力はありません。議論と投票で人狼を見つけ出しましょう。',
  },
  werewolf: {
    role: 'werewolf',
    name: '人狼',
    team: 'werewolf',
    teamLabel: '人狼陣営',
    summary: '夜に村人を1人襲撃します。人狼の数が人間以上になれば勝利です。',
  },
  seer: {
    role: 'seer',
    name: '占い師',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '毎晩1人を占い「人狼」か「人間」かを知ります。妖狐を占うと呪殺します。',
  },
  medium: {
    role: 'medium',
    name: '霊媒師',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '昼に処刑されたプレイヤーが「人狼」だったか「人間」だったかを知ります。',
  },
  bodyguard: {
    role: 'bodyguard',
    name: '騎士',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '毎晩1人を人狼の襲撃から護衛します（自分自身は護衛できません）。',
  },
  madman: {
    role: 'madman',
    name: '狂人',
    team: 'werewolf',
    teamLabel: '人狼陣営',
    summary: '人狼の味方をする人間です。占い・霊媒では「人間」と判定されます。',
  },
  fox: {
    role: 'fox',
    name: '妖狐',
    team: 'fox',
    teamLabel: '妖狐陣営',
    summary: '人狼に襲撃されても死にませんが、占い師に占われると呪殺されます。決着時に生存していれば単独勝利！',
  },
};

export interface WerewolfInspectionRecord {
  day: number;
  targetId: string;
  targetName: string;
  isWolf: boolean; // 妖狐・狂人・村人陣営は false（人間）
}

export interface WerewolfPlayerInternal {
  id: string;
  name: string;
  isHost: boolean;
  role: WerewolfRole;
  alive: boolean;
  deathCause: 'executed' | 'attacked' | 'cursed' | null;
  deathDay: number | null;
  ready: boolean;
  lastGuardTargetId: string | null;
  seerLogs: WerewolfInspectionRecord[];
  mediumLogs: WerewolfInspectionRecord[];
}

export interface WerewolfVoteEntry {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
}

export interface WerewolfExecutionRecord {
  day: number;
  executedId: string | null;
  executedName: string | null;
  wasRunoff: boolean;
  reason: string;
  votes: WerewolfVoteEntry[];
  tally: { targetId: string; targetName: string; count: number }[];
}

export interface WerewolfNightEventSummary {
  day: number;
  victims: { id: string; name: string }[];
  peaceful: boolean;
}

export interface WerewolfInternalState {
  rules: WerewolfRules;
  players: WerewolfPlayerInternal[];
  roleCounts: Record<WerewolfRole, number>;
  day: number;
  subPhase: WerewolfSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: WerewolfTeam | null;
  winnerIds: string[];
  discussionEndsAt: number | null;
  // 投票管理
  votes: Record<string, string>; // voterId -> targetId
  isRunoff: boolean;
  runoffCandidateIds: string[];
  lastExecution: WerewolfExecutionRecord | null;
  // 夜アクション管理
  nightDoneIds: string[];
  wolfAttackVotes: Record<string, string>; // wolfId -> targetId
  guardTargets: Record<string, string>; // bodyguardId -> targetId
  seerNightTargets: Record<string, string>; // seerId -> targetId (その夜に占った対象)
  lastNightSummary: WerewolfNightEventSummary | null;
  timeline: string[];
  lastLog: string;
}

export interface WerewolfClientPlayer {
  id: string;
  name: string;
  isHost: boolean;
  alive: boolean;
  deathCause: 'executed' | 'attacked' | 'cursed' | null;
  deathDay: number | null;
  ready: boolean;
  hasVoted: boolean;
  hasActedNight: boolean;
  /** 終了時、または自分自身・仲間人狼のみ開示 */
  role?: WerewolfRole;
}

export interface WerewolfClientState {
  myId: string;
  rules: WerewolfRules;
  players: WerewolfClientPlayer[];
  roleCounts: Record<WerewolfRole, number>;
  day: number;
  subPhase: WerewolfSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: WerewolfTeam | null;
  winnerIds: string[];
  discussionEndsAt: number | null;
  isRunoff: boolean;
  runoffCandidateIds: string[];
  lastExecution: WerewolfExecutionRecord | null;
  lastNightSummary: WerewolfNightEventSummary | null;
  timeline: string[];
  lastLog: string;
  // 自分専用の秘密情報（観戦者視点では空/null）
  myRole: WerewolfRole | null;
  myAlive: boolean;
  myReady: boolean;
  myVotedTargetId: string | null;
  myNightDone: boolean;
  myNightTargetId: string | null;
  myLastGuardTargetId: string | null;
  fellowWolfIds: string[];
  wolfAttackVotes: Record<string, string>;
  mySeerLogs: WerewolfInspectionRecord[];
  myMediumLogs: WerewolfInspectionRecord[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 参加人数とルール設定から安全な配役リストを生成する
 */
export function buildWerewolfRoleDeck(
  playerCount: number,
  rules: WerewolfRules
): { deck: WerewolfRole[]; counts: Record<WerewolfRole, number> } {
  const counts: Record<WerewolfRole, number> = {
    werewolf: 0,
    seer: 0,
    bodyguard: 0,
    medium: 0,
    madman: 0,
    fox: 0,
    villager: 0,
  };

  // 開始時点で必ず aliveWolves < aliveHumans（妖狐は人間数から除外）を満たすよう調整
  // 条件: 2 * werewolf + fox <= playerCount - 1
  const maxFox = Math.max(0, playerCount - 3);
  counts.fox = Math.max(0, Math.min(maxFox, Math.trunc(rules.foxCount || 0)));

  const maxWolves = Math.max(1, Math.floor((playerCount - counts.fox - 1) / 2));
  counts.werewolf = Math.max(1, Math.min(maxWolves, Math.trunc(rules.werewolfCount || 1)));

  while (counts.fox > 0 && playerCount - counts.fox - counts.werewolf <= counts.werewolf) {
    counts.fox -= 1;
  }

  let remaining = Math.max(0, playerCount - counts.werewolf - counts.fox);
  const assign = (
    role: Exclude<WerewolfRole, 'werewolf' | 'fox' | 'villager'>,
    requested: number
  ) => {
    const n = Math.max(0, Math.min(remaining, Math.trunc(requested || 0)));
    counts[role] = n;
    remaining -= n;
  };

  assign('seer', rules.seerCount);
  assign('bodyguard', rules.bodyguardCount);
  assign('medium', rules.mediumCount);
  assign('madman', rules.madmanCount);
  counts.villager = Math.max(0, remaining);

  const deck: WerewolfRole[] = [];
  (Object.keys(counts) as WerewolfRole[]).forEach((role) => {
    for (let i = 0; i < counts[role]; i++) {
      deck.push(role);
    }
  });

  return { deck: shuffleArray(deck), counts };
}

/**
 * 公式ルール準拠の勝敗判定
 * - 生存人狼 0 → 妖狐生存なら妖狐勝ち、それ以外は村人陣営勝ち
 * - 生存人狼 >= 生存人間（妖狐を除く非人狼） → 妖狐生存なら妖狐勝ち、それ以外は人狼陣営勝ち
 */
export function checkWerewolfVictory(
  players: WerewolfPlayerInternal[]
): { winnerTeam: WerewolfTeam; winnerIds: string[] } | null {
  const alive = players.filter((p) => p.alive);
  const aliveWolves = alive.filter((p) => p.role === 'werewolf').length;
  const aliveFoxes = alive.filter((p) => p.role === 'fox').length;
  const aliveHumans = alive.filter((p) => p.role !== 'werewolf' && p.role !== 'fox').length;

  let winnerTeam: WerewolfTeam | null = null;
  if (aliveWolves === 0) {
    winnerTeam = aliveFoxes > 0 ? 'fox' : 'village';
  } else if (aliveWolves >= aliveHumans) {
    winnerTeam = aliveFoxes > 0 ? 'fox' : 'werewolf';
  }

  if (!winnerTeam) return null;

  const winnerIds = players
    .filter((p) => WEREWOLF_ROLE_META[p.role].team === winnerTeam)
    .map((p) => p.id);

  return { winnerTeam, winnerIds };
}

function teamWinLabel(team: WerewolfTeam): string {
  if (team === 'village') return '村人陣営の勝利！';
  if (team === 'werewolf') return '人狼陣営の勝利！';
  return '妖狐陣営の単独勝利！';
}

export function initWerewolf(
  playersInfo: PlayerInfo[],
  rules: WerewolfRules
): WerewolfInternalState {
  const { deck, counts } = buildWerewolfRoleDeck(playersInfo.length, rules);

  const players: WerewolfPlayerInternal[] = playersInfo.map((p, idx) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    role: deck[idx] ?? 'villager',
    alive: true,
    deathCause: null,
    deathDay: null,
    ready: false,
    lastGuardTargetId: null,
    seerLogs: [],
    mediumLogs: [],
  }));

  // 初日ランダム白通知（人狼と妖狐を除いた自分以外の生存者からランダム1名を白通知）
  if (rules.firstNightFortune === 'randomWhite') {
    for (const seer of players) {
      if (seer.role !== 'seer') continue;
      const whiteCandidates = players.filter(
        (p) => p.id !== seer.id && p.role !== 'werewolf' && p.role !== 'fox'
      );
      if (whiteCandidates.length > 0) {
        const picked = whiteCandidates[Math.floor(Math.random() * whiteCandidates.length)];
        seer.seerLogs.push({
          day: 1,
          targetId: picked.id,
          targetName: picked.name,
          isWolf: false,
        });
      }
    }
  }

  return {
    rules: { ...rules },
    players,
    roleCounts: counts,
    day: 1,
    subPhase: 'roleReveal',
    phase: 'playing',
    winnerTeam: null,
    winnerIds: [],
    discussionEndsAt: null,
    votes: {},
    isRunoff: false,
    runoffCandidateIds: [],
    lastExecution: null,
    nightDoneIds: [],
    wolfAttackVotes: {},
    guardTargets: {},
    seerNightTargets: {},
    lastNightSummary: null,
    timeline: ['ゲーム開始：各自の役職を確認してください'],
    lastLog: '役職が配られました。全員が役職を確認したら進行します',
  };
}

function enterDiscussion(state: WerewolfInternalState): WerewolfInternalState {
  const endsAt = state.rules.discussionSec > 0 ? Date.now() + state.rules.discussionSec * 1000 : null;
  const log = `${state.day}日目の昼：議論を開始してください`;
  return {
    ...state,
    subPhase: 'discussion',
    discussionEndsAt: endsAt,
    votes: {},
    isRunoff: false,
    runoffCandidateIds: [],
    timeline: [...state.timeline, log],
    lastLog: log,
  };
}

function enterNight(state: WerewolfInternalState, nextDay: boolean): WerewolfInternalState {
  const day = nextDay ? state.day + 1 : state.day;
  const log =
    day === 1
      ? '1日目の夜：各自アクションを確認してください（初日の襲撃はありません）'
      : `${day}日目の夜：各自、夜のアクションを行ってください`;
  return {
    ...state,
    day,
    subPhase: 'night',
    discussionEndsAt: null,
    nightDoneIds: [],
    wolfAttackVotes: {},
    guardTargets: {},
    seerNightTargets: {},
    timeline: [...state.timeline, log],
    lastLog: log,
  };
}

function resolveVotes(state: WerewolfInternalState): WerewolfInternalState {
  const alivePlayers = state.players.filter((p) => p.alive);
  const candidates = state.isRunoff
    ? alivePlayers.filter((p) => state.runoffCandidateIds.includes(p.id))
    : alivePlayers;

  const tallyMap = new Map<string, number>();
  for (const c of candidates) {
    tallyMap.set(c.id, 0);
  }

  const voteEntries: WerewolfVoteEntry[] = [];
  for (const voter of alivePlayers) {
    const targetId = state.votes[voter.id];
    if (!targetId) continue;
    const target = state.players.find((p) => p.id === targetId);
    if (!target) continue;
    tallyMap.set(targetId, (tallyMap.get(targetId) ?? 0) + 1);
    voteEntries.push({
      voterId: voter.id,
      voterName: voter.name,
      targetId: target.id,
      targetName: target.name,
    });
  }

  const tally = Array.from(tallyMap.entries())
    .map(([targetId, count]) => ({
      targetId,
      targetName: state.players.find((p) => p.id === targetId)?.name ?? '',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topCount = tally[0]?.count ?? 0;
  const topCandidates = tally.filter((t) => t.count === topCount && topCount > 0);

  // 同票かつ決選投票ルール（1回目）なら決選投票へ
  if (topCandidates.length > 1 && state.rules.tieBreak === 'runoff' && !state.isRunoff) {
    const names = topCandidates.map((t) => t.targetName).join('・');
    const log = `同票（${names}）のため決選投票を行います`;
    return {
      ...state,
      votes: {},
      isRunoff: true,
      runoffCandidateIds: topCandidates.map((t) => t.targetId),
      lastExecution: {
        day: state.day,
        executedId: null,
        executedName: null,
        wasRunoff: false,
        reason: `同票のため決選投票へ（${names}）`,
        votes: voteEntries,
        tally,
      },
      timeline: [...state.timeline, log],
      lastLog: log,
    };
  }

  let executedId: string | null = null;
  let reason = '最多得票により追放';

  if (topCandidates.length === 1) {
    executedId = topCandidates[0].targetId;
  } else if (topCandidates.length > 1) {
    if (state.rules.tieBreak === 'noExecution') {
      executedId = null;
      reason = '同票のため本日の処刑はなし';
    } else {
      const picked = topCandidates[Math.floor(Math.random() * topCandidates.length)];
      executedId = picked.targetId;
      reason = state.isRunoff
        ? '決選投票でも同票のためランダムで追放'
        : '同票のためランダムで追放';
    }
  } else {
    executedId = null;
    reason = '有効票がないため本日の処刑はなし';
  }

  const nextPlayers = state.players.map((p) => ({
    ...p,
    seerLogs: [...p.seerLogs],
    mediumLogs: [...p.mediumLogs],
  }));

  let executedPlayer: WerewolfPlayerInternal | null = null;
  if (executedId) {
    const idx = nextPlayers.findIndex((p) => p.id === executedId);
    if (idx !== -1) {
      nextPlayers[idx].alive = false;
      nextPlayers[idx].deathCause = 'executed';
      nextPlayers[idx].deathDay = state.day;
      executedPlayer = nextPlayers[idx];
    }
  }

  // 生存している霊媒師へ処刑結果を記録
  if (executedPlayer) {
    const isWolf = executedPlayer.role === 'werewolf';
    for (const p of nextPlayers) {
      if (p.alive && p.role === 'medium') {
        p.mediumLogs.push({
          day: state.day,
          targetId: executedPlayer.id,
          targetName: executedPlayer.name,
          isWolf,
        });
      }
    }
  }

  const execRecord: WerewolfExecutionRecord = {
    day: state.day,
    executedId: executedPlayer?.id ?? null,
    executedName: executedPlayer?.name ?? null,
    wasRunoff: state.isRunoff,
    reason,
    votes: voteEntries,
    tally,
  };

  const baseLog = executedPlayer
    ? `${state.day}日目の投票結果：${executedPlayer.name} が追放されました（${reason}）`
    : `${state.day}日目の投票結果：${reason}`;

  // 処刑直後の勝敗判定
  const victory = checkWerewolfVictory(nextPlayers);
  if (victory) {
    const winMsg = `${baseLog} — ${teamWinLabel(victory.winnerTeam)}`;
    return {
      ...state,
      players: nextPlayers,
      votes: {},
      isRunoff: false,
      runoffCandidateIds: [],
      lastExecution: execRecord,
      subPhase: 'execution',
      phase: 'finished',
      winnerTeam: victory.winnerTeam,
      winnerIds: victory.winnerIds,
      timeline: [...state.timeline, baseLog, teamWinLabel(victory.winnerTeam)],
      lastLog: winMsg,
    };
  }

  return {
    ...state,
    players: nextPlayers,
    votes: {},
    isRunoff: false,
    runoffCandidateIds: [],
    lastExecution: execRecord,
    subPhase: 'execution',
    timeline: [...state.timeline, baseLog],
    lastLog: baseLog,
  };
}

function resolveNight(state: WerewolfInternalState): WerewolfInternalState {
  // 1日目の夜（自由占いモード）は襲撃・呪殺の解決後（襲撃は無し）に1日目の昼へ進む
  const nextPlayers = state.players.map((p) => ({
    ...p,
    seerLogs: [...p.seerLogs],
    mediumLogs: [...p.mediumLogs],
  }));

  const victimMap = new Map<string, { id: string; name: string; cause: 'attacked' | 'cursed' }>();

  // 1. 騎士の護衛先を確定＆lastGuardTargetId 更新
  const guardedSet = new Set<string>();
  for (const p of nextPlayers) {
    if (p.alive && p.role === 'bodyguard') {
      const targetId = state.guardTargets[p.id] ?? null;
      p.lastGuardTargetId = targetId;
      if (targetId && state.day >= 2) {
        guardedSet.add(targetId);
      }
    }
  }

  // 2. 人狼の襲撃（2日目以降のみ）
  if (state.day >= 2) {
    const attackCount = new Map<string, number>();
    for (const targetId of Object.values(state.wolfAttackVotes)) {
      attackCount.set(targetId, (attackCount.get(targetId) ?? 0) + 1);
    }
    const sortedAttacks = Array.from(attackCount.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedAttacks.length > 0) {
      const topVotes = sortedAttacks[0][1];
      const tiedTargets = sortedAttacks.filter(([, cnt]) => cnt === topVotes).map(([id]) => id);
      const chosenTargetId = tiedTargets[Math.floor(Math.random() * tiedTargets.length)];
      const target = nextPlayers.find((p) => p.id === chosenTargetId && p.alive);
      if (target && !guardedSet.has(target.id) && target.role !== 'fox') {
        victimMap.set(target.id, { id: target.id, name: target.name, cause: 'attacked' });
      }
    }
  }

  // 3. 占い師による妖狐の呪殺（初日自由占いでも2日目以降でも適用）
  for (const targetId of Object.values(state.seerNightTargets)) {
    const target = nextPlayers.find((p) => p.id === targetId && p.alive);
    if (target && target.role === 'fox') {
      victimMap.set(target.id, { id: target.id, name: target.name, cause: 'cursed' });
    }
  }

  // 犠牲者の死亡反映
  const victims: { id: string; name: string }[] = [];
  for (const v of victimMap.values()) {
    const idx = nextPlayers.findIndex((p) => p.id === v.id);
    if (idx !== -1 && nextPlayers[idx].alive) {
      nextPlayers[idx].alive = false;
      nextPlayers[idx].deathCause = v.cause;
      nextPlayers[idx].deathDay = state.day;
      victims.push({ id: v.id, name: v.name });
    }
  }

  // 犠牲者表示順で死因（襲撃か呪殺か）が推測されないようシャッフル
  const shuffledVictims = shuffleArray(victims);

  const summary: WerewolfNightEventSummary = {
    day: state.day,
    victims: shuffledVictims,
    peaceful: shuffledVictims.length === 0,
  };

  const morningLog =
    shuffledVictims.length === 0
      ? `${state.day}日目の朝：昨夜は誰も犠牲になりませんでした（平和な朝）`
      : `${state.day}日目の朝：${shuffledVictims.map((v) => v.name).join('・')} が無残な姿で発見されました`;

  const victory = checkWerewolfVictory(nextPlayers);
  if (victory) {
    const winMsg = `${morningLog} — ${teamWinLabel(victory.winnerTeam)}`;
    return {
      ...state,
      players: nextPlayers,
      nightDoneIds: [],
      wolfAttackVotes: {},
      guardTargets: {},
      seerNightTargets: {},
      lastNightSummary: summary,
      subPhase: 'morning',
      phase: 'finished',
      winnerTeam: victory.winnerTeam,
      winnerIds: victory.winnerIds,
      timeline: [...state.timeline, morningLog, teamWinLabel(victory.winnerTeam)],
      lastLog: winMsg,
    };
  }

  // 初日夜（day === 1）で犠牲者なしならそのまま1日目の議論へ直行しても自然だが、
  // 呪殺が起きた場合や朝アナウンスの統一感のため morning フェーズを経由する
  return {
    ...state,
    players: nextPlayers,
    nightDoneIds: [],
    wolfAttackVotes: {},
    guardTargets: {},
    seerNightTargets: {},
    lastNightSummary: summary,
    subPhase: 'morning',
    timeline: [...state.timeline, morningLog],
    lastLog: morningLog,
  };
}

export function applyWerewolfAction(
  state: WerewolfInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: WerewolfInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームはすでに終了しています' };
  }

  const actor = state.players.find((p) => p.id === playerId);
  if (!actor) {
    return { state, error: '参加者が見つかりません' };
  }

  // 1. 役職確認フェーズ
  if (state.subPhase === 'roleReveal') {
    if (action.type === 'confirmRole') {
      const nextPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, ready: true } : p
      );
      const allReady = nextPlayers.every((p) => p.ready);
      const nextState: WerewolfInternalState = { ...state, players: nextPlayers };
      if (allReady) {
        if (state.rules.firstNightFortune === 'free') {
          return { state: enterNight(nextState, false) };
        }
        return { state: enterDiscussion(nextState) };
      }
      const readyCount = nextPlayers.filter((p) => p.ready).length;
      return {
        state: {
          ...nextState,
          lastLog: `役職確認中（${readyCount}/${nextPlayers.length}人 完了）`,
        },
      };
    }

    if (action.type === 'advancePhase' && actor.isHost) {
      const nextPlayers = state.players.map((p) => ({ ...p, ready: true }));
      const nextState: WerewolfInternalState = { ...state, players: nextPlayers };
      if (state.rules.firstNightFortune === 'free') {
        return { state: enterNight(nextState, false) };
      }
      return { state: enterDiscussion(nextState) };
    }

    return { state, error: '役職確認フェーズではこの操作はできません' };
  }

  // 2. 朝の結果発表フェーズ
  if (state.subPhase === 'morning') {
    if (action.type === 'startDiscussion' || action.type === 'advancePhase') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ進行できます' };
      }
      return { state: enterDiscussion(state) };
    }
    return { state, error: '朝の結果発表中です' };
  }

  // 3. 昼の議論フェーズ
  if (state.subPhase === 'discussion') {
    if (action.type === 'extendDiscussion' && actor.isHost) {
      if (state.rules.discussionSec <= 0) return { state };
      const base = Math.max(Date.now(), state.discussionEndsAt ?? Date.now());
      return {
        state: {
          ...state,
          discussionEndsAt: base + 60 * 1000,
          lastLog: '議論時間を60秒延長しました',
        },
      };
    }

    if (action.type === 'startVoting' || action.type === 'advancePhase') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ進行できます' };
      }
      const log = `${state.day}日目の投票：追放するプレイヤーを選んでください`;
      return {
        state: {
          ...state,
          subPhase: 'voting',
          discussionEndsAt: null,
          votes: {},
          isRunoff: false,
          runoffCandidateIds: [],
          timeline: [...state.timeline, log],
          lastLog: log,
        },
      };
    }

    return { state, error: '議論フェーズではこの操作はできません' };
  }

  // 4. 昼の投票フェーズ
  if (state.subPhase === 'voting') {
    if (action.type === 'castVote') {
      if (!actor.alive) {
        return { state, error: '脱落したプレイヤーは投票できません' };
      }
      const targetId = (action.payload as { targetId?: string })?.targetId;
      if (!targetId) {
        return { state, error: '投票先を選んでください' };
      }
      if (targetId === actor.id) {
        return { state, error: '自分自身には投票できません' };
      }
      const target = state.players.find((p) => p.id === targetId && p.alive);
      if (!target) {
        return { state, error: '無効な投票先です' };
      }
      if (state.isRunoff && !state.runoffCandidateIds.includes(targetId)) {
        return { state, error: '決選投票の候補者から選んでください' };
      }

      const nextVotes = { ...state.votes, [actor.id]: targetId };
      const aliveIds = state.players.filter((p) => p.alive).map((p) => p.id);
      const allVoted = aliveIds.every((id) => Boolean(nextVotes[id]));

      const nextState: WerewolfInternalState = { ...state, votes: nextVotes };
      if (allVoted) {
        return { state: resolveVotes(nextState) };
      }

      const votedCount = aliveIds.filter((id) => Boolean(nextVotes[id])).length;
      return {
        state: {
          ...nextState,
          lastLog: `${state.isRunoff ? '決選投票中' : '投票中'}（${votedCount}/${aliveIds.length}人 完了）`,
        },
      };
    }

    return { state, error: '投票フェーズではこの操作はできません' };
  }

  // 5. 処刑結果発表フェーズ
  if (state.subPhase === 'execution') {
    if (action.type === 'startNight' || action.type === 'advancePhase') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ進行できます' };
      }
      return { state: enterNight(state, true) };
    }
    return { state, error: '処刑結果の確認中です' };
  }

  // 6. 夜のアクションフェーズ
  if (state.subPhase === 'night') {
    if (!actor.alive) {
      return { state, error: '脱落したプレイヤーは夜行動できません' };
    }

    if (action.type === 'nightAction') {
      const targetId = (action.payload as { targetId?: string })?.targetId;
      const isFirstNight = state.day === 1;

      const nextPlayers = state.players.map((p) => ({
        ...p,
        seerLogs: [...p.seerLogs],
        mediumLogs: [...p.mediumLogs],
      }));
      const nextWolfVotes = { ...state.wolfAttackVotes };
      const nextGuardTargets = { ...state.guardTargets };
      const nextSeerTargets = { ...state.seerNightTargets };
      const nextDone = new Set(state.nightDoneIds);

      if (actor.role === 'seer' && (!isFirstNight || state.rules.firstNightFortune === 'free')) {
        // すでにこの夜占っていれば確認完了のみ
        if (!nextSeerTargets[actor.id]) {
          if (!targetId) {
            return { state, error: '占う対象を選んでください' };
          }
          if (targetId === actor.id) {
            return { state, error: '自分自身は占えません' };
          }
          const target = nextPlayers.find((p) => p.id === targetId && p.alive);
          if (!target) {
            return { state, error: '無効な占い対象です' };
          }
          const seerIdx = nextPlayers.findIndex((p) => p.id === actor.id);
          nextPlayers[seerIdx].seerLogs.push({
            day: state.day,
            targetId: target.id,
            targetName: target.name,
            isWolf: target.role === 'werewolf',
          });
          nextSeerTargets[actor.id] = target.id;

          // 結果を見てもらうため、ここではまだ nightDone にせず seerNightTargets のみ記録
          return {
            state: {
              ...state,
              players: nextPlayers,
              seerNightTargets: nextSeerTargets,
            },
          };
        }
        nextDone.add(actor.id);
      } else if (actor.role === 'werewolf' && !isFirstNight) {
        if (!targetId) {
          return { state, error: '襲撃先を選んでください' };
        }
        const target = nextPlayers.find(
          (p) => p.id === targetId && p.alive && p.role !== 'werewolf'
        );
        if (!target) {
          return { state, error: '人狼以外の生存者から選んでください' };
        }
        nextWolfVotes[actor.id] = target.id;
        nextDone.add(actor.id);
      } else if (actor.role === 'bodyguard' && !isFirstNight) {
        if (!targetId) {
          return { state, error: '護衛する対象を選んでください' };
        }
        if (targetId === actor.id) {
          return { state, error: '自分自身は護衛できません' };
        }
        if (!state.rules.consecutiveGuard && actor.lastGuardTargetId === targetId) {
          return { state, error: '連続して同じ人を護衛することはできません' };
        }
        const target = nextPlayers.find((p) => p.id === targetId && p.alive);
        if (!target) {
          return { state, error: '無効な護衛対象です' };
        }
        nextGuardTargets[actor.id] = target.id;
        nextDone.add(actor.id);
      } else {
        // 村人・狂人・妖狐・霊媒師、および初日夜の非占い師は確認完了
        nextDone.add(actor.id);
      }

      const aliveIds = nextPlayers.filter((p) => p.alive).map((p) => p.id);
      const doneArr = Array.from(nextDone);
      const allDone = aliveIds.every((id) => nextDone.has(id));

      const nextState: WerewolfInternalState = {
        ...state,
        players: nextPlayers,
        nightDoneIds: doneArr,
        wolfAttackVotes: nextWolfVotes,
        guardTargets: nextGuardTargets,
        seerNightTargets: nextSeerTargets,
      };

      if (allDone) {
        return { state: resolveNight(nextState) };
      }

      const doneCount = aliveIds.filter((id) => nextDone.has(id)).length;
      return {
        state: {
          ...nextState,
          lastLog: `${state.day}日目の夜：行動完了（${doneCount}/${aliveIds.length}人）`,
        },
      };
    }

    return { state, error: '夜のフェーズではこの操作はできません' };
  }

  return { state, error: '不明なアクションです' };
}

export function sanitizeWerewolfState(
  state: WerewolfInternalState,
  playerId: string
): WerewolfClientState {
  const me = state.players.find((p) => p.id === playerId) ?? null;
  const isFinished = state.phase === 'finished';
  const isWolf = me?.role === 'werewolf';
  const fellowWolfIds = isWolf
    ? state.players.filter((p) => p.role === 'werewolf').map((p) => p.id)
    : [];

  const clientPlayers: WerewolfClientPlayer[] = state.players.map((p) => {
    const revealRole = isFinished || p.id === playerId || (isWolf && p.role === 'werewolf');
    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      alive: p.alive,
      deathCause: !isFinished && p.deathCause === 'cursed' ? 'attacked' : p.deathCause,
      deathDay: p.deathDay,
      ready: p.ready,
      hasVoted: Boolean(state.votes[p.id]),
      hasActedNight: state.nightDoneIds.includes(p.id),
      ...(revealRole ? { role: p.role } : {}),
    };
  });

  let myNightTargetId: string | null = null;
  if (me) {
    if (me.role === 'werewolf') myNightTargetId = state.wolfAttackVotes[me.id] ?? null;
    else if (me.role === 'bodyguard') myNightTargetId = state.guardTargets[me.id] ?? null;
    else if (me.role === 'seer') myNightTargetId = state.seerNightTargets[me.id] ?? null;
  }

  return {
    myId: playerId,
    rules: state.rules,
    players: clientPlayers,
    roleCounts: state.roleCounts,
    day: state.day,
    subPhase: state.subPhase,
    phase: state.phase,
    winnerTeam: state.winnerTeam,
    winnerIds: state.winnerIds,
    discussionEndsAt: state.discussionEndsAt,
    isRunoff: state.isRunoff,
    runoffCandidateIds: state.runoffCandidateIds,
    lastExecution: state.lastExecution,
    lastNightSummary: state.lastNightSummary,
    timeline: state.timeline,
    lastLog: state.lastLog,
    myRole: me?.role ?? null,
    myAlive: me?.alive ?? false,
    myReady: me?.ready ?? false,
    myVotedTargetId: me ? (state.votes[me.id] ?? null) : null,
    myNightDone: me ? state.nightDoneIds.includes(me.id) : false,
    myNightTargetId,
    myLastGuardTargetId: me?.lastGuardTargetId ?? null,
    fellowWolfIds,
    wolfAttackVotes: isWolf ? { ...state.wolfAttackVotes } : {},
    mySeerLogs: me?.role === 'seer' ? [...me.seerLogs] : [],
    myMediumLogs: me?.role === 'medium' ? [...me.mediumLogs] : [],
  };
}
