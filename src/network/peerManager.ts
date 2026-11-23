import Peer, { type DataConnection } from 'peerjs';
import type { HostToPeerMessage, PeerToHostMessage } from '../types/game';
import { generateRoomCode, roomCodeToPeerId } from '../utils/roomCode';

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

function safeSend(conn: DataConnection, msg: HostToPeerMessage | PeerToHostMessage) {
  if (conn.open) {
    try {
      conn.send(msg);
    } catch {
      // ignore send errors on closing channel
    }
    return;
  }
  conn.once('open', () => {
    try {
      conn.send(msg);
    } catch {
      // ignore
    }
  });
}

export interface HostSessionHandlers {
  onRoomReady: (roomCode: string) => void;
  onClientJoin: (playerId: string, name: string, conn: DataConnection) => void;
  onClientAction: (playerId: string, msg: PeerToHostMessage) => void;
  onClientDisconnect: (playerId: string) => void;
  onError: (err: string) => void;
}

export class HostPeerSession {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private connToPlayer = new Map<DataConnection, string>();
  private handlers: HostSessionHandlers;
  private destroyed = false;
  private readyTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  public roomCode = '';

  constructor(handlers: HostSessionHandlers) {
    this.handlers = handlers;
  }

  private tryReconnectSignaling() {
    if (this.destroyed || !this.peer || this.peer.destroyed) return;
    if (this.peer.disconnected) {
      try {
        this.peer.reconnect();
      } catch {
        // ignore reconnect errors
      }
    }
  }

  start(preferredCode?: string, retries = 3) {
    if (this.destroyed) return;
    const code = preferredCode ?? generateRoomCode();
    this.roomCode = code;
    const peerId = roomCodeToPeerId(code);
    const peer = new Peer(peerId, PEER_CONFIG);
    this.peer = peer;

    if (this.readyTimer !== null) {
      window.clearTimeout(this.readyTimer);
    }
    this.readyTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      if (!peer.open) {
        this.handlers.onError('通信サーバーへの接続がタイムアウトしました。もう一度お試しください。');
        this.destroy();
      }
    }, 15000);

    if (!this.visibilityHandler && typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          this.tryReconnectSignaling();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    peer.on('open', () => {
      if (this.destroyed) return;
      if (this.readyTimer !== null) {
        window.clearTimeout(this.readyTimer);
        this.readyTimer = null;
      }
      this.handlers.onRoomReady(code);
    });

    peer.on('disconnected', () => {
      if (this.destroyed) return;
      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer);
      }
      this.reconnectTimer = window.setTimeout(() => {
        this.tryReconnectSignaling();
      }, 1000);
    });

    peer.on('connection', (conn) => {
      if (this.destroyed) {
        conn.close();
        return;
      }

      conn.on('data', (raw) => {
        if (this.destroyed) return;
        const msg = raw as PeerToHostMessage;
        if (!msg || typeof msg !== 'object') return;
        if (msg.kind === 'join') {
          this.connections.set(msg.playerId, conn);
          this.connToPlayer.set(conn, msg.playerId);
          this.handlers.onClientJoin(msg.playerId, msg.name, conn);
        } else if (msg.kind === 'ping') {
          safeSend(conn, { kind: 'pong', ts: msg.ts } satisfies HostToPeerMessage);
        } else {
          this.handlers.onClientAction(msg.playerId, msg);
        }
      });

      conn.on('close', () => {
        if (this.destroyed) return;
        const pid = this.connToPlayer.get(conn);
        if (pid) {
          if (this.connections.get(pid) === conn) {
            this.connections.delete(pid);
          }
          this.connToPlayer.delete(conn);
          this.handlers.onClientDisconnect(pid);
        }
      });
    });

    peer.on('error', (err: unknown) => {
      if (this.destroyed) return;
      const type = (err as { type?: string })?.type;
      if (type === 'unavailable-id' && retries > 0) {
        if (this.readyTimer !== null) {
          window.clearTimeout(this.readyTimer);
          this.readyTimer = null;
        }
        peer.destroy();
        this.start(generateRoomCode(), retries - 1);
        return;
      }
      if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
        // 一時的なシグナリング断は自動再接続を試みる（部屋作成済みの場合）
        if (peer.open) {
          this.tryReconnectSignaling();
          return;
        }
      }
      if (this.readyTimer !== null) {
        window.clearTimeout(this.readyTimer);
        this.readyTimer = null;
      }
      this.handlers.onError(`通信エラー: ${(err as Error)?.message ?? String(err)}`);
    });
  }

  sendTo(playerId: string, msg: HostToPeerMessage) {
    if (this.destroyed) return;
    const conn = this.connections.get(playerId);
    if (conn) {
      safeSend(conn, msg);
    }
  }

  broadcast(msg: HostToPeerMessage) {
    if (this.destroyed) return;
    for (const conn of this.connections.values()) {
      safeSend(conn, msg);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.readyTimer !== null) {
      window.clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
    this.connToPlayer.clear();
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    this.peer = null;
  }
}

export interface GuestSessionHandlers {
  onConnected: () => void;
  onMessage: (msg: HostToPeerMessage) => void;
  onDisconnected: () => void;
  onError: (err: string) => void;
}

export class GuestPeerSession {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private handlers: GuestSessionHandlers;
  private heartbeatTimer: number | null = null;
  private joinRetryTimer: number | null = null;
  private connectTimeout: number | null = null;
  private destroyed = false;
  private receivedFirstMessage = false;

  constructor(handlers: GuestSessionHandlers) {
    this.handlers = handlers;
  }

  private clearTimers() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.joinRetryTimer !== null) {
      window.clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    if (this.connectTimeout !== null) {
      window.clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  connect(roomCode: string, playerId: string, playerName: string) {
    if (this.destroyed) return;
    const peer = new Peer(PEER_CONFIG);
    this.peer = peer;
    const targetId = roomCodeToPeerId(roomCode);

    this.connectTimeout = window.setTimeout(() => {
      if (this.destroyed) return;
      if (!this.receivedFirstMessage) {
        this.handlers.onError('部屋に接続できませんでした。コードやホストの画面が開いているか確認してください。');
      }
    }, 15000);

    peer.on('open', () => {
      if (this.destroyed) return;
      const conn = peer.connect(targetId, { reliable: true });
      this.conn = conn;

      const sendJoin = () => {
        if (this.destroyed || this.receivedFirstMessage || !conn.open) return;
        safeSend(conn, { kind: 'join', name: playerName, playerId } satisfies PeerToHostMessage);
      };

      conn.on('open', () => {
        if (this.destroyed) return;
        sendJoin();
        // ホストからの初回応答(welcome/lobby)が届くまで最大5回 join を再送
        let retries = 0;
        this.joinRetryTimer = window.setInterval(() => {
          if (this.destroyed || this.receivedFirstMessage || retries >= 5) {
            if (this.joinRetryTimer !== null) {
              window.clearInterval(this.joinRetryTimer);
              this.joinRetryTimer = null;
            }
            return;
          }
          retries++;
          sendJoin();
        }, 1500);

        this.heartbeatTimer = window.setInterval(() => {
          if (!this.destroyed && conn.open) {
            safeSend(conn, { kind: 'ping', ts: Date.now() } satisfies PeerToHostMessage);
          }
        }, 15000);
      });

      conn.on('data', (raw) => {
        if (this.destroyed) return;
        const msg = raw as HostToPeerMessage;
        if (!msg || typeof msg !== 'object') return;
        if (msg.kind === 'pong') return;

        if (!this.receivedFirstMessage) {
          this.receivedFirstMessage = true;
          if (this.connectTimeout !== null) {
            window.clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          if (this.joinRetryTimer !== null) {
            window.clearInterval(this.joinRetryTimer);
            this.joinRetryTimer = null;
          }
          this.handlers.onConnected();
        }
        this.handlers.onMessage(msg);
      });

      conn.on('close', () => {
        if (this.destroyed) return;
        this.clearTimers();
        this.handlers.onDisconnected();
      });

      conn.on('error', (err) => {
        if (this.destroyed) return;
        this.clearTimers();
        this.handlers.onError(`接続エラー: ${err.message}`);
      });
    });

    peer.on('error', (err: unknown) => {
      if (this.destroyed) return;
      this.clearTimers();
      const type = (err as { type?: string })?.type;
      if (type === 'peer-unavailable') {
        this.handlers.onError('その部屋コードは見つかりませんでした。ホストが部屋を開いているか確認してください。');
      } else {
        this.handlers.onError(`通信エラー: ${(err as Error)?.message ?? String(err)}`);
      }
    });
  }

  send(msg: PeerToHostMessage) {
    if (this.destroyed) return;
    if (this.conn) {
      safeSend(this.conn, msg);
    }
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    try {
      this.conn?.close();
    } catch {
      // ignore
    }
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    this.conn = null;
    this.peer = null;
  }
}
