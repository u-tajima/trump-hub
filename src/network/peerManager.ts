import Peer, { type DataConnection } from 'peerjs';
import type { HostToPeerMessage, PeerToHostMessage } from '../types/game';
import { generateRoomCode, roomCodeToPeerId } from '../utils/roomCode';

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
  public roomCode = '';

  constructor(handlers: HostSessionHandlers) {
    this.handlers = handlers;
  }

  start(preferredCode?: string, retries = 3) {
    const code = preferredCode ?? generateRoomCode();
    this.roomCode = code;
    const peerId = roomCodeToPeerId(code);
    const peer = new Peer(peerId, {
      debug: 1,
    });
    this.peer = peer;

    peer.on('open', () => {
      this.handlers.onRoomReady(code);
    });

    peer.on('connection', (conn) => {
      conn.on('data', (raw) => {
        const msg = raw as PeerToHostMessage;
        if (!msg || typeof msg !== 'object') return;
        if (msg.kind === 'join') {
          this.connections.set(msg.playerId, conn);
          this.connToPlayer.set(conn, msg.playerId);
          this.handlers.onClientJoin(msg.playerId, msg.name, conn);
        } else if (msg.kind === 'ping') {
          conn.send({ kind: 'pong', ts: msg.ts } satisfies HostToPeerMessage);
        } else {
          this.handlers.onClientAction(msg.playerId, msg);
        }
      });

      conn.on('close', () => {
        const pid = this.connToPlayer.get(conn);
        if (pid) {
          this.connections.delete(pid);
          this.connToPlayer.delete(conn);
          this.handlers.onClientDisconnect(pid);
        }
      });
    });

    peer.on('error', (err: unknown) => {
      const type = (err as { type?: string })?.type;
      if (type === 'unavailable-id' && retries > 0) {
        peer.destroy();
        this.start(generateRoomCode(), retries - 1);
        return;
      }
      this.handlers.onError(`通信エラー: ${(err as Error)?.message ?? String(err)}`);
    });
  }

  sendTo(playerId: string, msg: HostToPeerMessage) {
    const conn = this.connections.get(playerId);
    if (conn && conn.open) {
      conn.send(msg);
    }
  }

  broadcast(msg: HostToPeerMessage) {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  destroy() {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.connToPlayer.clear();
    this.peer?.destroy();
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

  constructor(handlers: GuestSessionHandlers) {
    this.handlers = handlers;
  }

  connect(roomCode: string, playerId: string, playerName: string) {
    const peer = new Peer({ debug: 1 });
    this.peer = peer;
    const targetId = roomCodeToPeerId(roomCode);

    const timeout = window.setTimeout(() => {
      if (!this.conn || !this.conn.open) {
        this.handlers.onError('部屋が見つかりませんでした。コードを確認してください。');
      }
    }, 12000);

    peer.on('open', () => {
      const conn = peer.connect(targetId, { reliable: true });
      this.conn = conn;

      conn.on('open', () => {
        window.clearTimeout(timeout);
        conn.send({ kind: 'join', name: playerName, playerId } satisfies PeerToHostMessage);
        this.handlers.onConnected();
        this.heartbeatTimer = window.setInterval(() => {
          if (conn.open) {
            conn.send({ kind: 'ping', ts: Date.now() } satisfies PeerToHostMessage);
          }
        }, 15000);
      });

      conn.on('data', (raw) => {
        const msg = raw as HostToPeerMessage;
        if (msg && typeof msg === 'object' && msg.kind !== 'pong') {
          this.handlers.onMessage(msg);
        }
      });

      conn.on('close', () => {
        window.clearTimeout(timeout);
        this.handlers.onDisconnected();
      });

      conn.on('error', (err) => {
        window.clearTimeout(timeout);
        this.handlers.onError(`接続エラー: ${err.message}`);
      });
    });

    peer.on('error', (err: unknown) => {
      window.clearTimeout(timeout);
      const type = (err as { type?: string })?.type;
      if (type === 'peer-unavailable') {
        this.handlers.onError('その部屋コードは見つかりませんでした。ホストが部屋を開いているか確認してください。');
      } else {
        this.handlers.onError(`通信エラー: ${(err as Error)?.message ?? String(err)}`);
      }
    });
  }

  send(msg: PeerToHostMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    }
  }

  destroy() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }
}
