import React, { useState } from 'react';
import { Bot, Check, ClipboardList, Copy, LogOut, Play, QrCode, Share2, SlidersHorizontal, Trash2, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { GAME_LIST, GAME_REGISTRY } from '../games/registry';
import type { GameId, GameRulesMap, LobbyState } from '../types/game';
import { buildInviteUrl } from '../utils/roomCode';
import { GameIcon } from './GameIcon';
import { RuleConfigurator } from './RuleConfigurator';

interface LobbyScreenProps {
  lobby: LobbyState;
  myId: string;
  isHost: boolean;
  onAddBot: () => void;
  onRemovePlayer: (playerId: string) => void;
  onUpdateConfig: (gameId: GameId, rules: GameRulesMap[GameId]) => void;
  onStartGame: () => void;
  onLeave: () => void;
  onOpenScoreBoard: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  lobby,
  myId,
  isHost,
  onAddBot,
  onRemovePlayer,
  onUpdateConfig,
  onStartGame,
  onLeave,
  onOpenScoreBoard,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const meta = GAME_REGISTRY[lobby.config.gameId];
  const inviteUrl = buildInviteUrl(lobby.config.roomCode);
  const canStart =
    lobby.players.length >= meta.minPlayers && lobby.players.length <= meta.maxPlayers;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lobby.config.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `TRUMP HUB - ${meta.name}`,
          text: `トランプ部屋「${lobby.config.roomCode}」(${meta.name}) に参加しよう！`,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback to copy URL
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleGameChange = (newGameId: GameId) => {
    if (!isHost) return;
    onUpdateConfig(newGameId, { ...GAME_REGISTRY[newGameId].defaultRules });
  };

  return (
    <div className="screen lobby-screen">
      <header className="top-bar">
        <button type="button" className="icon-text-btn" onClick={onLeave}>
          <LogOut size={16} />
          退出
        </button>
        <span className="top-bar-title">待機ロビー</span>
        <button type="button" className="icon-text-btn" onClick={onOpenScoreBoard}>
          <ClipboardList size={16} />
          得点
        </button>
      </header>

      <section className="card-panel room-code-panel">
        <div className="room-code-label">部屋コード</div>
        <div className="room-code-value">{lobby.config.roomCode}</div>
        <div className="room-share-actions">
          <button type="button" className="chip-btn" onClick={handleCopy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'コピー済' : 'コードコピー'}
          </button>
          <button type="button" className="chip-btn" onClick={handleShare}>
            <Share2 size={15} />
            招待リンク
          </button>
          <button type="button" className="chip-btn" onClick={() => setShowQr((v) => !v)}>
            <QrCode size={15} />
            QR
          </button>
        </div>
        {showQr && (
          <div className="qr-box">
            <QRCodeSVG value={inviteUrl} size={168} includeMargin bgColor="#ffffff" fgColor="#0f172a" />
            <div className="qr-hint">カメラで読み取るとそのまま参加できます</div>
          </div>
        )}
      </section>

      <section className="card-panel">
        <div className="panel-header-row">
          <h2 className="panel-title">
            参加者 ({lobby.players.length}/{meta.maxPlayers})
          </h2>
          {isHost && lobby.players.length < meta.maxPlayers && (
            <button type="button" className="chip-btn accent" onClick={onAddBot}>
              <Bot size={15} />
              CPU追加
            </button>
          )}
        </div>

        <ul className="player-list">
          {lobby.players.map((p) => (
            <li key={p.id} className={`player-row ${p.id === myId ? 'is-me' : ''}`}>
              <div className="player-row-left">
                {p.isBot ? <Bot size={18} className="text-amber" /> : <User size={18} />}
                <span className="player-name">{p.name}</span>
                {p.isHost && <span className="badge host">HOST</span>}
                {p.id === myId && <span className="badge me">あなた</span>}
                {p.isBot && <span className="badge bot">CPU</span>}
              </div>
              {isHost && p.id !== myId && (
                <button
                  type="button"
                  className="icon-danger-btn"
                  onClick={() => onRemovePlayer(p.id)}
                  aria-label={`${p.name} を削除`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card-panel">
        <div className="panel-header-row">
          <h2 className="panel-title title-with-icon">
            <GameIcon name={meta.icon} size={18} />
            {meta.name}
          </h2>
          <button type="button" className="chip-btn" onClick={() => setShowRules((v) => !v)}>
            <SlidersHorizontal size={15} />
            {showRules ? '閉じる' : 'ルール'}
          </button>
        </div>

        {isHost && (
          <div className="game-pills">
            {GAME_LIST.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`game-pill ${g.id === lobby.config.gameId ? 'active' : ''}`}
                onClick={() => handleGameChange(g.id)}
              >
                <GameIcon name={g.icon} size={13} /> {g.name}
              </button>
            ))}
          </div>
        )}

        <p className="panel-desc mt-8">{meta.description}</p>

        {showRules && (
          <div className="rules-drawer">
            <RuleConfigurator
              gameId={lobby.config.gameId}
              rules={lobby.config.rules}
              readOnly={!isHost}
              onChange={(nextRules) => onUpdateConfig(lobby.config.gameId, nextRules)}
            />
          </div>
        )}
      </section>

      {isHost ? (
        <div className="sticky-bottom-bar">
          {!canStart && (
            <div className="warn-text">
              {lobby.players.length < meta.minPlayers
                ? `あと ${meta.minPlayers - lobby.players.length} 人（またはCPU）必要です`
                : `最大 ${meta.maxPlayers} 人までプレイできます`}
            </div>
          )}
          <button
            type="button"
            className="primary-btn full-width"
            disabled={!canStart}
            onClick={onStartGame}
          >
            <Play size={18} />
            ゲームスタート！
          </button>
        </div>
      ) : (
        <div className="waiting-banner">ホストがゲームを開始するのを待っています…</div>
      )}
    </div>
  );
};
