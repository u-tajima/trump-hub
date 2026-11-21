import { useCallback, useEffect, useRef, useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { ToolModeScreen } from './components/ToolModeScreen';
import {
  type AnyInternalState,
  applyGameAction,
  initGameEngine,
  sanitizeGameState,
  tickGameEngine,
} from './games/engineDispatcher';
import { GuestPeerSession, HostPeerSession } from './network/peerManager';
import type { GameId, GameRulesMap, LobbyState, PlayerInfo } from './types/game';
import { getRoomCodeFromUrl } from './utils/roomCode';

function getOrCreatePlayerId(): string {
  const key = 'trump_hub_player_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `p-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function App() {
  const [myId] = useState<string>(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState<string>(
    () => localStorage.getItem('trump_hub_name') || 'プレイヤー'
  );
  const [initialRoomCode] = useState<string | null>(() => getRoomCodeFromUrl());

  const [role, setRole] = useState<'none' | 'host' | 'guest'>('none');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [clientGameState, setClientGameState] = useState<unknown>(null);
  const [toolMode, setToolMode] = useState<boolean>(false);

  const hostSessionRef = useRef<HostPeerSession | null>(null);
  const guestSessionRef = useRef<GuestPeerSession | null>(null);
  const lobbyRef = useRef<LobbyState | null>(null);
  const internalGameRef = useRef<AnyInternalState | null>(null);

  const handleNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('trump_hub_name', name);
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const syncAllClients = useCallback((nextLobby: LobbyState, nextGame: AnyInternalState | null) => {
    lobbyRef.current = nextLobby;
    internalGameRef.current = nextGame;
    setLobby(nextLobby);

    const host = hostSessionRef.current;
    if (!host) return;

    host.broadcast({ kind: 'lobby', lobby: nextLobby });

    if (nextLobby.phase === 'playing' && nextGame) {
      setClientGameState(sanitizeGameState(nextLobby.config.gameId, nextGame, myId));
      for (const p of nextLobby.players) {
        if (!p.isHost && !p.isBot) {
          host.sendTo(p.id, {
            kind: 'gameState',
            gameId: nextLobby.config.gameId,
            state: sanitizeGameState(nextLobby.config.gameId, nextGame, p.id),
          });
        }
      }
    } else {
      setClientGameState(null);
    }
  }, [myId]);

  const cleanupSessions = useCallback(() => {
    hostSessionRef.current?.destroy();
    hostSessionRef.current = null;
    guestSessionRef.current?.destroy();
    guestSessionRef.current = null;
    lobbyRef.current = null;
    internalGameRef.current = null;
    setLobby(null);
    setClientGameState(null);
    setRole('none');
    setConnecting(false);
  }, []);

  useEffect(() => {
    return () => {
      hostSessionRef.current?.destroy();
      guestSessionRef.current?.destroy();
    };
  }, []);

  // ホスト側ゲームループ (Bot思考・タイムアウト処理)
  useEffect(() => {
    if (role !== 'host' || lobby?.phase !== 'playing') return;
    const intervalMs = lobby.config.gameId === 'speed' ? 500 : 850;

    const timer = window.setInterval(() => {
      const curLobby = lobbyRef.current;
      const curGame = internalGameRef.current;
      if (!curLobby || curLobby.phase !== 'playing' || !curGame) return;

      const updated = tickGameEngine(curLobby.config.gameId, curGame);
      if (updated) {
        syncAllClients(curLobby, updated);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [role, lobby?.phase, lobby?.config.gameId, syncAllClients]);

  const handleCreateRoom = (gameId: GameId, rules: GameRulesMap[GameId]) => {
    cleanupSessions();
    setError(null);
    setConnecting(true);

    const hostPlayer: PlayerInfo = {
      id: myId,
      name: playerName.trim() || 'ホスト',
      isHost: true,
      isBot: false,
      connected: true,
    };

    const host = new HostPeerSession({
      onRoomReady: (roomCode) => {
        const initialLobby: LobbyState = {
          phase: 'lobby',
          config: { roomCode, gameId, rules },
          players: [hostPlayer],
        };
        setRole('host');
        setConnecting(false);
        syncAllClients(initialLobby, null);
      },
      onClientJoin: (pid, name) => {
        const cur = lobbyRef.current;
        if (!cur) return;
        const exists = cur.players.some((p) => p.id === pid);
        let players = cur.players;
        if (exists) {
          players = cur.players.map((p) =>
            p.id === pid ? { ...p, name, connected: true } : p
          );
        } else {
          if (cur.phase !== 'lobby') {
            hostSessionRef.current?.sendTo(pid, {
              kind: 'error',
              message: 'すでにゲームが進行中です',
            });
            return;
          }
          players = [
            ...cur.players,
            { id: pid, name, isHost: false, isBot: false, connected: true },
          ];
        }
        const nextLobby: LobbyState = { ...cur, players };
        hostSessionRef.current?.sendTo(pid, { kind: 'welcome', playerId: pid, lobby: nextLobby });
        syncAllClients(nextLobby, internalGameRef.current);
      },
      onClientAction: (pid, msg) => {
        if (msg.kind !== 'action') return;
        const curLobby = lobbyRef.current;
        const curGame = internalGameRef.current;
        if (!curLobby || !curGame || curLobby.phase !== 'playing') return;

        const res = applyGameAction(curLobby.config.gameId, curGame, pid, msg.action);
        if (res.error) {
          hostSessionRef.current?.sendTo(pid, { kind: 'error', message: res.error });
          return;
        }
        syncAllClients(curLobby, res.state);
      },
      onClientDisconnect: (pid) => {
        const cur = lobbyRef.current;
        if (!cur) return;
        const nextLobby: LobbyState = {
          ...cur,
          players:
            cur.phase === 'lobby'
              ? cur.players.filter((p) => p.id !== pid)
              : cur.players.map((p) => (p.id === pid ? { ...p, connected: false } : p)),
        };
        syncAllClients(nextLobby, internalGameRef.current);
      },
      onError: (errMsg) => {
        setError(errMsg);
        setConnecting(false);
      },
    });

    hostSessionRef.current = host;
    host.start();
  };

  const handleJoinRoom = (roomCode: string) => {
    cleanupSessions();
    setError(null);
    setConnecting(true);

    const guest = new GuestPeerSession({
      onConnected: () => {
        setRole('guest');
        setConnecting(false);
      },
      onMessage: (msg) => {
        if (msg.kind === 'welcome' || msg.kind === 'lobby') {
          setLobby(msg.lobby);
          if (msg.lobby.phase === 'lobby') {
            setClientGameState(null);
          }
        } else if (msg.kind === 'gameState') {
          setClientGameState(msg.state);
        } else if (msg.kind === 'error') {
          showToast(msg.message);
        }
      },
      onDisconnected: () => {
        setError('ホストとの接続が切れました');
        cleanupSessions();
      },
      onError: (errMsg) => {
        setError(errMsg);
        cleanupSessions();
      },
    });

    guestSessionRef.current = guest;
    guest.connect(roomCode, myId, playerName.trim() || 'ゲスト');
  };

  const handleAddBot = () => {
    const cur = lobbyRef.current;
    if (!cur || role !== 'host') return;
    const botCount = cur.players.filter((p) => p.isBot).length + 1;
    const bot: PlayerInfo = {
      id: `bot-${Date.now()}-${botCount}`,
      name: `CPU ${botCount}`,
      isHost: false,
      isBot: true,
      connected: true,
    };
    syncAllClients({ ...cur, players: [...cur.players, bot] }, null);
  };

  const handleRemovePlayer = (pid: string) => {
    const cur = lobbyRef.current;
    if (!cur || role !== 'host') return;
    syncAllClients(
      { ...cur, players: cur.players.filter((p) => p.id !== pid) },
      null
    );
  };

  const handleUpdateConfig = (gameId: GameId, rules: GameRulesMap[GameId]) => {
    const cur = lobbyRef.current;
    if (!cur || role !== 'host') return;
    syncAllClients(
      { ...cur, config: { ...cur.config, gameId, rules } },
      null
    );
  };

  const handleStartGame = () => {
    const cur = lobbyRef.current;
    if (!cur || role !== 'host') return;
    const game = initGameEngine(cur.config.gameId, cur.players, cur.config.rules);
    syncAllClients({ ...cur, phase: 'playing' }, game);
  };

  const handleBackToLobby = () => {
    const cur = lobbyRef.current;
    if (!cur || role !== 'host') return;
    syncAllClients({ ...cur, phase: 'lobby' }, null);
  };

  const handleGameAction = (action: { type: string; payload?: unknown }) => {
    if (role === 'host') {
      const curLobby = lobbyRef.current;
      const curGame = internalGameRef.current;
      if (!curLobby || !curGame) return;
      const res = applyGameAction(curLobby.config.gameId, curGame, myId, action);
      if (res.error) {
        showToast(res.error);
        return;
      }
      syncAllClients(curLobby, res.state);
    } else if (role === 'guest') {
      guestSessionRef.current?.send({ kind: 'action', playerId: myId, action });
    }
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast-banner">{toast}</div>}

      {toolMode ? (
        <ToolModeScreen onBack={() => setToolMode(false)} />
      ) : !lobby ? (
        <HomeScreen
          playerName={playerName}
          onChangeName={handleNameChange}
          initialRoomCode={initialRoomCode}
          connecting={connecting}
          error={error}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenTools={() => setToolMode(true)}
        />
      ) : lobby.phase === 'lobby' || !clientGameState ? (
        <LobbyScreen
          lobby={lobby}
          myId={myId}
          isHost={role === 'host'}
          onAddBot={handleAddBot}
          onRemovePlayer={handleRemovePlayer}
          onUpdateConfig={handleUpdateConfig}
          onStartGame={handleStartGame}
          onLeave={cleanupSessions}
        />
      ) : (
        <GameBoard
          gameId={lobby.config.gameId}
          roomCode={lobby.config.roomCode}
          rules={lobby.config.rules}
          gameState={clientGameState}
          isHost={role === 'host'}
          onAction={handleGameAction}
          onRestart={handleStartGame}
          onBackToLobby={handleBackToLobby}
          onLeave={cleanupSessions}
        />
      )}
    </div>
  );
}

export default App;
