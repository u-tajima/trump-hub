import type { DaifugoInternalState } from '../games/daifugo';
import type { DoubtInternalState } from '../games/doubt';
import type { AnyInternalState } from '../games/engineDispatcher';
import type { HoldemInternalState } from '../games/holdem';
import type { PokerInternalState } from '../games/poker';
import { GAME_REGISTRY } from '../games/registry';
import type { RouletteInternalState } from '../games/roulette';
import type { LobbyState, PlayerInfo } from '../types/game';

export const SPECTATOR_VIEW_ID = '__spectator__';

export interface HostLocalView {
  viewPlayerId: string;
  actionPlayerId: string;
  activeLocalPlayer: PlayerInfo | null;
  needsHandoff: boolean;
}

export function isLocallyControlled(lobby: LobbyState, playerId: string, hostId: string): boolean {
  if (playerId === hostId) return true;
  return lobby.players.some((p) => p.id === playerId && Boolean(p.isLocal));
}

export function getLocalControlledPlayers(lobby: LobbyState, hostId: string): PlayerInfo[] {
  return lobby.players.filter((p) => p.id === hostId || Boolean(p.isLocal));
}

export function resolveHostLocalView(
  lobby: LobbyState,
  game: AnyInternalState | null,
  hostId: string
): HostLocalView {
  const hasLocalPeers = lobby.players.some((p) => Boolean(p.isLocal));
  const meta = GAME_REGISTRY[lobby.config.gameId];

  if (!hasLocalPeers || !game || meta.localPlayMode === 'none') {
    return {
      viewPlayerId: hostId,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  if (game.phase !== 'playing') {
    return {
      viewPlayerId: hostId,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  const findLocalPlayer = (pid: string | undefined): PlayerInfo | null => {
    if (!pid || !isLocallyControlled(lobby, pid, hostId)) return null;
    return lobby.players.find((p) => p.id === pid) ?? null;
  };

  const gameId = lobby.config.gameId;

  // ルーレット: 未確定のローカルプレイヤーから順にベット、投球はスピナーがローカルならその人
  if (gameId === 'roulette') {
    const rState = game as RouletteInternalState;
    if (rState.subPhase === 'betting') {
      const nextUnconfirmed = lobby.players.find((lp) => {
        if (!isLocallyControlled(lobby, lp.id, hostId)) return false;
        const rp = rState.players.find((p) => p.id === lp.id);
        return rp && !rp.confirmed;
      });
      if (nextUnconfirmed) {
        return {
          viewPlayerId: nextUnconfirmed.id,
          actionPlayerId: nextUnconfirmed.id,
          activeLocalPlayer: nextUnconfirmed,
          needsHandoff: false,
        };
      }
      return {
        viewPlayerId: hostId,
        actionPlayerId: hostId,
        activeLocalPlayer: null,
        needsHandoff: false,
      };
    }
    if (rState.subPhase === 'readyToSpin') {
      const spinner = findLocalPlayer(rState.spinnerPlayerId);
      const id = spinner?.id ?? hostId;
      return {
        viewPlayerId: id,
        actionPlayerId: id,
        activeLocalPlayer: spinner,
        needsHandoff: false,
      };
    }
    return {
      viewPlayerId: hostId,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  // ポーカー / ホールデム: ショーダウンは全員公開（渡し画面不要）
  if (gameId === 'poker' || gameId === 'holdem') {
    const pState = game as PokerInternalState | HoldemInternalState;
    if (pState.subPhase === 'showdown') {
      return {
        viewPlayerId: hostId,
        actionPlayerId: hostId,
        activeLocalPlayer: null,
        needsHandoff: false,
      };
    }
    const turnId = pState.players[pState.turnIndex]?.id;
    const localPlayer = findLocalPlayer(turnId);
    if (localPlayer) {
      return {
        viewPlayerId: localPlayer.id,
        actionPlayerId: localPlayer.id,
        activeLocalPlayer: localPlayer,
        needsHandoff: true,
      };
    }
    return {
      viewPlayerId: SPECTATOR_VIEW_ID,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  // ダウト: ダウト判定ウィンドウ中は誰の手札も見せず観戦視点でダウトボタンを表示
  if (gameId === 'doubt') {
    const dState = game as DoubtInternalState;
    if (dState.subPhase === 'doubtWindow') {
      return {
        viewPlayerId: SPECTATOR_VIEW_ID,
        actionPlayerId: hostId,
        activeLocalPlayer: null,
        needsHandoff: false,
      };
    }
    const turnId = dState.players[dState.turnIndex]?.id;
    const localPlayer = findLocalPlayer(turnId);
    if (localPlayer) {
      return {
        viewPlayerId: localPlayer.id,
        actionPlayerId: localPlayer.id,
        activeLocalPlayer: localPlayer,
        needsHandoff: true,
      };
    }
    return {
      viewPlayerId: SPECTATOR_VIEW_ID,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  // 大富豪: 7渡し・10捨て・Qボンバーの pendingEffect 中はその効果発動者が操作者
  if (gameId === 'daifugo') {
    const dState = game as DaifugoInternalState;
    const actorId = dState.pendingEffect
      ? dState.pendingEffect.playerId
      : dState.players[dState.turnIndex]?.id;
    const localPlayer = findLocalPlayer(actorId);
    if (localPlayer) {
      return {
        viewPlayerId: localPlayer.id,
        actionPlayerId: localPlayer.id,
        activeLocalPlayer: localPlayer,
        needsHandoff: true,
      };
    }
    return {
      viewPlayerId: SPECTATOR_VIEW_ID,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  // その他のターン制ゲーム（sevens, oldmaid, memory, chinchiro, reversi, gomoku, connect4）
  if ('players' in game && 'turnIndex' in game) {
    const turnState = game as { players: { id: string }[]; turnIndex: number };
    const turnId = turnState.players[turnState.turnIndex]?.id;
    const localPlayer = findLocalPlayer(turnId);
    const needsHandoff = meta.localPlayMode === 'passAndPlay';
    if (localPlayer) {
      return {
        viewPlayerId: localPlayer.id,
        actionPlayerId: localPlayer.id,
        activeLocalPlayer: localPlayer,
        needsHandoff,
      };
    }
    return {
      viewPlayerId: needsHandoff ? SPECTATOR_VIEW_ID : hostId,
      actionPlayerId: hostId,
      activeLocalPlayer: null,
      needsHandoff: false,
    };
  }

  return {
    viewPlayerId: hostId,
    actionPlayerId: hostId,
    activeLocalPlayer: null,
    needsHandoff: false,
  };
}
