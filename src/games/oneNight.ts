import type { OneNightRules, PlayerInfo } from '../types/game';

export type OneNightRole = 'villager' | 'werewolf' | 'seer' | 'thief' | 'tanner';

export type OneNightTeam = 'village' | 'werewolf' | 'tanner';

export type OneNightSubPhase = 'night' | 'discussion' | 'voting';

export interface OneNightRoleMeta {
  role: OneNightRole;
  name: string;
  team: OneNightTeam;
  teamLabel: string;
  summary: string;
}

export const ONE_NIGHT_ROLE_META: Record<OneNightRole, OneNightRoleMeta> = {
  villager: {
    role: 'villager',
    name: '村人',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '特殊能力はありません。議論と推理で人狼を見つけ出し、追放しましょう。',
  },
  werewolf: {
    role: 'werewolf',
    name: '人狼',
    team: 'werewolf',
    teamLabel: '人狼陣営',
    summary: '夜に仲間の人狼を確認できます。投票で人狼が1人も処刑されなければ勝利です。',
  },
  seer: {
    role: 'seer',
    name: '占い師',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '夜に「他プレイヤー1人の役職」または「中央の余りカード2枚」のどちらかを見られます。',
  },
  thief: {
    role: 'thief',
    name: '怪盗',
    team: 'village',
    teamLabel: '村人陣営',
    summary: '夜に他プレイヤー1人と役職カードを交換できます（交換しないことも可能）。交換後の役職で勝敗が決まります。',
  },
  tanner: {
    role: 'tanner',
    name: 'てるてる坊主',
    team: 'tanner',
    teamLabel: '第三陣営',
    summary: '投票で自分が処刑されれば単独勝利！人狼のふりをして票を集めましょう。',
  },
};

export interface OneNightSeerResult {
  mode: 'player' | 'center';
  targetId?: string;
  targetName?: string;
  targetRole?: OneNightRole;
  centerRoles?: [OneNightRole, OneNightRole];
}

export interface OneNightThiefResult {
  swapped: boolean;
  targetId: string | null;
  targetName: string | null;
  newRole: OneNightRole;
}

export interface OneNightPlayerInternal {
  id: string;
  name: string;
  isHost: boolean;
  initialRole: OneNightRole;
  finalRole: OneNightRole;
}

export interface OneNightVoteEntry {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
}

export interface OneNightVoteResult {
  peacefulVillage: boolean;
  executedIds: string[];
  executedNames: string[];
  votes: OneNightVoteEntry[];
  tally: { targetId: string; targetName: string; count: number }[];
  reason: string;
}

export interface OneNightInternalState {
  rules: OneNightRules;
  players: OneNightPlayerInternal[];
  centerCards: [OneNightRole, OneNightRole];
  roleCounts: Record<OneNightRole, number>;
  subPhase: OneNightSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: OneNightTeam | null;
  winnerIds: string[];
  discussionEndsAt: number | null;
  // 夜アクション管理
  nightDoneIds: string[];
  seerResults: Record<string, OneNightSeerResult>;
  thiefResults: Record<string, OneNightThiefResult>;
  // 投票管理
  votes: Record<string, string>; // voterId -> targetId
  voteResult: OneNightVoteResult | null;
  timeline: string[];
  lastLog: string;
}

export interface OneNightClientPlayer {
  id: string;
  name: string;
  isHost: boolean;
  hasActedNight: boolean;
  hasVoted: boolean;
  /** 決着時のみ公開 */
  initialRole?: OneNightRole;
  /** 決着時のみ公開 */
  finalRole?: OneNightRole;
}

export interface OneNightClientState {
  myId: string;
  rules: OneNightRules;
  players: OneNightClientPlayer[];
  roleCounts: Record<OneNightRole, number>;
  subPhase: OneNightSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: OneNightTeam | null;
  winnerIds: string[];
  discussionEndsAt: number | null;
  voteResult: OneNightVoteResult | null;
  /** 決着時のみ公開 */
  centerCards: [OneNightRole, OneNightRole] | null;
  timeline: string[];
  lastLog: string;
  // 自分専用の秘密情報（観戦者視点では null / 空）
  myInitialRole: OneNightRole | null;
  myNightDone: boolean;
  fellowWolfIds: string[];
  mySeerResult: OneNightSeerResult | null;
  myThiefResult: OneNightThiefResult | null;
  myVotedTargetId: string | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildOneNightDeck(
  playerCount: number,
  rules: OneNightRules
): { deck: OneNightRole[]; counts: Record<OneNightRole, number> } {
  const totalCards = playerCount + 2;
  const counts: Record<OneNightRole, number> = {
    werewolf: 0,
    seer: 0,
    thief: 0,
    tanner: 0,
    villager: 0,
  };

  let remaining = totalCards;
  const wolves = Math.min(remaining, Math.max(1, rules.werewolfCount ?? 2));
  counts.werewolf = wolves;
  remaining -= wolves;

  if (remaining > 0) {
    counts.seer = 1;
    remaining -= 1;
  }
  if (rules.includeThief && remaining > 0) {
    counts.thief = 1;
    remaining -= 1;
  }
  if (rules.includeTanner && remaining > 0) {
    counts.tanner = 1;
    remaining -= 1;
  }
  counts.villager = Math.max(0, remaining);

  const deck: OneNightRole[] = [];
  (Object.keys(counts) as OneNightRole[]).forEach((role) => {
    for (let i = 0; i < counts[role]; i++) {
      deck.push(role);
    }
  });

  return { deck: shuffleArray(deck), counts };
}

export function initOneNight(
  playersInfo: PlayerInfo[],
  rules: OneNightRules
): OneNightInternalState {
  const { deck, counts } = buildOneNightDeck(playersInfo.length, rules);

  const players: OneNightPlayerInternal[] = playersInfo.map((p, idx) => {
    const role = deck[idx] ?? 'villager';
    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      initialRole: role,
      finalRole: role,
    };
  });

  const centerCards: [OneNightRole, OneNightRole] = [
    deck[playersInfo.length] ?? 'villager',
    deck[playersInfo.length + 1] ?? 'villager',
  ];

  return {
    rules: { ...rules },
    players,
    centerCards,
    roleCounts: counts,
    subPhase: 'night',
    phase: 'playing',
    winnerTeam: null,
    winnerIds: [],
    discussionEndsAt: null,
    nightDoneIds: [],
    seerResults: {},
    thiefResults: {},
    votes: {},
    voteResult: null,
    timeline: ['ゲーム開始：夜のフェーズ（各自の役職確認と夜アクション）'],
    lastLog: '各自、自分の役職を確認して夜のアクションを行ってください',
  };
}

function finalizeNightAndStartDiscussion(state: OneNightInternalState): OneNightInternalState {
  const nextPlayers = state.players.map((p) => ({ ...p, finalRole: p.initialRole }));

  // 怪盗の交換を finalRole に反映
  for (const [thiefId, res] of Object.entries(state.thiefResults)) {
    if (!res.swapped || !res.targetId) continue;
    const thiefIdx = nextPlayers.findIndex((p) => p.id === thiefId);
    const targetIdx = nextPlayers.findIndex((p) => p.id === res.targetId);
    if (thiefIdx !== -1 && targetIdx !== -1) {
      const tmp = nextPlayers[thiefIdx].finalRole;
      nextPlayers[thiefIdx].finalRole = nextPlayers[targetIdx].finalRole;
      nextPlayers[targetIdx].finalRole = tmp;
    }
  }

  const endsAt =
    state.rules.discussionSec > 0 ? Date.now() + state.rules.discussionSec * 1000 : null;
  const log = '夜が明けました！議論を開始してください';

  return {
    ...state,
    players: nextPlayers,
    subPhase: 'discussion',
    discussionEndsAt: endsAt,
    timeline: [...state.timeline, log],
    lastLog: log,
  };
}

function resolveOneNightVotes(state: OneNightInternalState): OneNightInternalState {
  const tallyMap = new Map<string, number>();
  for (const p of state.players) {
    tallyMap.set(p.id, 0);
  }

  const voteEntries: OneNightVoteEntry[] = [];
  for (const voter of state.players) {
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

  const maxVotes = tally[0]?.count ?? 0;

  let peacefulVillage = false;
  let executedIds: string[] = [];
  let reason = '';

  // 公式準拠: 最多得票が1票以下（全員に1票ずつ等）なら平和村（誰も処刑されない）
  if (maxVotes <= 1) {
    peacefulVillage = true;
    executedIds = [];
    reason = '票が割れたため平和村（誰も処刑されません）';
  } else {
    executedIds = tally.filter((t) => t.count === maxVotes).map((t) => t.targetId);
    const names = executedIds
      .map((id) => state.players.find((p) => p.id === id)?.name ?? '')
      .filter(Boolean);
    reason =
      executedIds.length > 1
        ? `同票最多（${maxVotes}票）により ${names.join('・')} が処刑されました`
        : `最多得票（${maxVotes}票）により ${names[0]} が処刑されました`;
  }

  const executedPlayers = state.players.filter((p) => executedIds.includes(p.id));
  const hasWolfAmongPlayers = state.players.some((p) => p.finalRole === 'werewolf');

  let winnerTeam: OneNightTeam;
  let winHeadline: string;

  if (peacefulVillage) {
    if (!hasWolfAmongPlayers) {
      winnerTeam = 'village';
      winHeadline = '平和村成立！プレイヤーの中に人狼はいなかったため村人陣営の勝利！';
    } else {
      winnerTeam = 'werewolf';
      winHeadline = '平和村となりましたが人狼が潜んでいたため人狼陣営の勝利！';
    }
  } else {
    const tannerExecuted = executedPlayers.some((p) => p.finalRole === 'tanner');
    const wolfExecuted = executedPlayers.some((p) => p.finalRole === 'werewolf');

    if (tannerExecuted) {
      winnerTeam = 'tanner';
      winHeadline = 'てるてる坊主が処刑されました！てるてる坊主の単独勝利！';
    } else if (wolfExecuted) {
      winnerTeam = 'village';
      winHeadline = '人狼の処刑に成功！村人陣営の勝利！';
    } else {
      winnerTeam = 'werewolf';
      winHeadline = '人狼は処刑されませんでした！人狼陣営の勝利！';
    }
  }

  let winnerIds: string[] = [];
  if (winnerTeam === 'tanner') {
    winnerIds = executedPlayers
      .filter((p) => p.finalRole === 'tanner')
      .map((p) => p.id);
  } else {
    winnerIds = state.players
      .filter((p) => ONE_NIGHT_ROLE_META[p.finalRole].team === winnerTeam)
      .map((p) => p.id);
  }

  const voteResult: OneNightVoteResult = {
    peacefulVillage,
    executedIds,
    executedNames: executedPlayers.map((p) => p.name),
    votes: voteEntries,
    tally,
    reason,
  };

  return {
    ...state,
    phase: 'finished',
    winnerTeam,
    winnerIds,
    voteResult,
    timeline: [...state.timeline, reason, winHeadline],
    lastLog: winHeadline,
  };
}

export function applyOneNightAction(
  state: OneNightInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: OneNightInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームはすでに終了しています' };
  }

  const actor = state.players.find((p) => p.id === playerId);
  if (!actor) {
    return { state, error: '参加者が見つかりません' };
  }

  // 1. 夜フェーズ
  if (state.subPhase === 'night') {
    if (action.type === 'seerInspect') {
      if (actor.initialRole !== 'seer') {
        return { state, error: '占い師のみ占えます' };
      }
      if (state.seerResults[actor.id]) {
        return { state, error: 'すでに占いを実行済みです' };
      }
      const payload = (action.payload ?? {}) as { mode?: 'player' | 'center'; targetId?: string };
      if (payload.mode === 'center') {
        const res: OneNightSeerResult = {
          mode: 'center',
          centerRoles: [state.centerCards[0], state.centerCards[1]],
        };
        return {
          state: {
            ...state,
            seerResults: { ...state.seerResults, [actor.id]: res },
          },
        };
      }
      if (payload.mode === 'player') {
        if (!payload.targetId || payload.targetId === actor.id) {
          return { state, error: '自分以外のプレイヤーを選んでください' };
        }
        const target = state.players.find((p) => p.id === payload.targetId);
        if (!target) {
          return { state, error: '対象のプレイヤーが見つかりません' };
        }
        const res: OneNightSeerResult = {
          mode: 'player',
          targetId: target.id,
          targetName: target.name,
          targetRole: target.initialRole,
        };
        return {
          state: {
            ...state,
            seerResults: { ...state.seerResults, [actor.id]: res },
          },
        };
      }
      return { state, error: '占い対象を選んでください' };
    }

    if (action.type === 'thiefSwap') {
      if (actor.initialRole !== 'thief') {
        return { state, error: '怪盗のみ交換できます' };
      }
      if (state.thiefResults[actor.id]) {
        return { state, error: 'すでに交換の選択を完了しています' };
      }
      const payload = (action.payload ?? {}) as { targetId?: string | null };
      if (!payload.targetId) {
        const res: OneNightThiefResult = {
          swapped: false,
          targetId: null,
          targetName: null,
          newRole: actor.initialRole,
        };
        return {
          state: {
            ...state,
            thiefResults: { ...state.thiefResults, [actor.id]: res },
          },
        };
      }
      if (payload.targetId === actor.id) {
        return { state, error: '自分自身とは交換できません' };
      }
      const target = state.players.find((p) => p.id === payload.targetId);
      if (!target) {
        return { state, error: '交換対象が見つかりません' };
      }
      const res: OneNightThiefResult = {
        swapped: true,
        targetId: target.id,
        targetName: target.name,
        newRole: target.initialRole,
      };
      return {
        state: {
          ...state,
          thiefResults: { ...state.thiefResults, [actor.id]: res },
        },
      };
    }

    if (action.type === 'nightAction' || action.type === 'confirmNight') {
      if (actor.initialRole === 'seer' && !state.seerResults[actor.id]) {
        return { state, error: '先に占い対象を選んでください' };
      }
      if (actor.initialRole === 'thief' && !state.thiefResults[actor.id]) {
        return { state, error: '先に交換する相手（または交換しない）を選んでください' };
      }
      if (state.nightDoneIds.includes(actor.id)) {
        return { state };
      }

      const nextDone = [...state.nightDoneIds, actor.id];
      const nextState: OneNightInternalState = { ...state, nightDoneIds: nextDone };

      if (state.players.every((p) => nextDone.includes(p.id))) {
        return { state: finalizeNightAndStartDiscussion(nextState) };
      }

      return {
        state: {
          ...nextState,
          lastLog: `夜フェーズ進行中（${nextDone.length}/${state.players.length}人 完了）`,
        },
      };
    }

    return { state, error: '夜フェーズではこの操作はできません' };
  }

  // 2. 議論フェーズ
  if (state.subPhase === 'discussion') {
    if (action.type === 'extendDiscussion') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ議論時間を延長できます' };
      }
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
        return { state, error: 'ホストのみ投票へ進められます' };
      }
      const log = '投票フェーズ：人狼だと思うプレイヤーを1人選んでください';
      return {
        state: {
          ...state,
          subPhase: 'voting',
          discussionEndsAt: null,
          votes: {},
          timeline: [...state.timeline, log],
          lastLog: log,
        },
      };
    }

    return { state, error: '議論フェーズではこの操作はできません' };
  }

  // 3. 投票フェーズ
  if (state.subPhase === 'voting') {
    if (action.type === 'castVote') {
      const targetId = (action.payload as { targetId?: string })?.targetId;
      if (!targetId) {
        return { state, error: '投票先を選んでください' };
      }
      if (targetId === actor.id) {
        return { state, error: '自分自身には投票できません' };
      }
      const target = state.players.find((p) => p.id === targetId);
      if (!target) {
        return { state, error: '無効な投票先です' };
      }

      const nextVotes = { ...state.votes, [actor.id]: targetId };
      const nextState: OneNightInternalState = { ...state, votes: nextVotes };

      if (state.players.every((p) => Boolean(nextVotes[p.id]))) {
        return { state: resolveOneNightVotes(nextState) };
      }

      const votedCount = Object.keys(nextVotes).length;
      return {
        state: {
          ...nextState,
          lastLog: `投票中（${votedCount}/${state.players.length}人 完了）`,
        },
      };
    }

    return { state, error: '投票フェーズではこの操作はできません' };
  }

  return { state, error: '不明なアクションです' };
}

export function sanitizeOneNightState(
  state: OneNightInternalState,
  playerId: string
): OneNightClientState {
  const me = state.players.find((p) => p.id === playerId) ?? null;
  const isFinished = state.phase === 'finished';
  const isInitialWolf = me?.initialRole === 'werewolf';

  const fellowWolfIds = isInitialWolf
    ? state.players.filter((p) => p.initialRole === 'werewolf').map((p) => p.id)
    : [];

  const clientPlayers: OneNightClientPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    hasActedNight: state.nightDoneIds.includes(p.id),
    hasVoted: Boolean(state.votes[p.id]),
    ...(isFinished ? { initialRole: p.initialRole, finalRole: p.finalRole } : {}),
  }));

  return {
    myId: playerId,
    rules: state.rules,
    players: clientPlayers,
    roleCounts: state.roleCounts,
    subPhase: state.subPhase,
    phase: state.phase,
    winnerTeam: state.winnerTeam,
    winnerIds: state.winnerIds,
    discussionEndsAt: state.discussionEndsAt,
    voteResult: state.voteResult,
    centerCards: isFinished ? [state.centerCards[0], state.centerCards[1]] : null,
    timeline: state.timeline,
    lastLog: state.lastLog,
    myInitialRole: me?.initialRole ?? null,
    myNightDone: me ? state.nightDoneIds.includes(me.id) : false,
    fellowWolfIds,
    mySeerResult: me?.initialRole === 'seer' ? (state.seerResults[me.id] ?? null) : null,
    myThiefResult: me?.initialRole === 'thief' ? (state.thiefResults[me.id] ?? null) : null,
    myVotedTargetId: me ? (state.votes[me.id] ?? null) : null,
  };
}

export function computeOneNightBotAction(
  _state: OneNightInternalState,
  _botId: string
): { type: string; payload?: unknown } | null {
  return null;
}
