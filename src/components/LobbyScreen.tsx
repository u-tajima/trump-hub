import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Bot,
  Check,
  ClipboardList,
  Copy,
  LogOut,
  Play,
  QrCode,
  Share2,
  SlidersHorizontal,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { GAME_REGISTRY } from '../games/registry';
import type { GameId, GameRulesMap, LobbyState } from '../types/game';
import { useFavoriteGames } from '../utils/favorites';
import { buildInviteUrl } from '../utils/roomCode';
import { GameIcon } from './GameIcon';
import { GamePicker } from './GamePicker';
import { RuleConfigurator } from './RuleConfigurator';
import './LobbyScreen.css';

interface LobbyScreenProps {
  lobby: LobbyState;
  myId: string;
  isHost: boolean;
  onAddBot: () => void;
  onAddLocalPlayer: () => void;
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
  onAddLocalPlayer,
  onRemovePlayer,
  onUpdateConfig,
  onStartGame,
  onLeave,
  onOpenScoreBoard,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const { favorites, toggleFavorite, isFavorite } = useFavoriteGames();

  const meta = GAME_REGISTRY[lobby.config.gameId];
  const inviteUrl = buildInviteUrl(lobby.config.roomCode);
  const canStart =
    lobby.players.length >= meta.minPlayers && lobby.players.length <= meta.maxPlayers;
  const quickFavorites = favorites
    .filter((id) => id !== 'scoreboard')
    .map((id) => GAME_REGISTRY[id]);

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
    setShowGamePicker(false);
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
          {isHost && lobby.config.gameId !== 'scoreboard' && lobby.players.length < meta.maxPlayers && (
            <div className="lobby-add-actions">
              {meta.localPlayMode !== 'none' && (
                <button type="button" className="chip-btn local-accent" onClick={onAddLocalPlayer}>
                  <Users size={15} />
                  ローカル追加
                </button>
              )}
              {meta.allowBots !== false && (
                <button type="button" className="chip-btn accent" onClick={onAddBot}>
                  <Bot size={15} />
                  CPU追加
                </button>
              )}
            </div>
          )}
        </div>

        <ul className="player-list">
          {lobby.players.map((p) => (
            <li key={p.id} className={`player-row ${p.id === myId ? 'is-me' : ''}`}>
              <div className="player-row-left">
                {p.isBot ? (
                  <Bot size={18} className="text-amber" />
                ) : p.isLocal ? (
                  <Users size={18} className="text-sky" />
                ) : (
                  <User size={18} />
                )}
                <span className="player-name">{p.name}</span>
                {p.isHost && <span className="badge host">HOST</span>}
                {p.id === myId && <span className="badge me">あなた</span>}
                {p.isLocal && <span className="badge local">ローカル</span>}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <h2 className="panel-title title-with-icon" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <GameIcon name={meta.icon} size={18} />
              {meta.name}
            </h2>
            {lobby.config.gameId !== 'scoreboard' && (
              <button
                type="button"
                className={`fav-star-btn ${isFavorite(lobby.config.gameId) ? 'is-fav' : ''}`}
                onClick={() => toggleFavorite(lobby.config.gameId)}
                aria-label={isFavorite(lobby.config.gameId) ? 'お気に入り解除' : 'お気に入り追加'}
              >
                <Star size={16} fill={isFavorite(lobby.config.gameId) ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
          <div className="lobby-game-actions">
            {isHost && lobby.config.gameId !== 'scoreboard' && (
              <button
                type="button"
                className="chip-btn accent"
                onClick={() => setShowGamePicker(true)}
              >
                <ArrowLeftRight size={14} />
                ゲーム変更
              </button>
            )}
            <button type="button" className="chip-btn" onClick={() => setShowRules((v) => !v)}>
              <SlidersHorizontal size={15} />
              {showRules ? '閉じる' : 'ルール'}
            </button>
          </div>
        </div>

        {isHost && lobby.config.gameId !== 'scoreboard' && quickFavorites.length > 0 && (
          <div className="lobby-fav-bar">
            <span className="lobby-fav-label">
              <Star size={12} fill="currentColor" />
              お気に入り
            </span>
            {quickFavorites.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`game-pill ${g.id === lobby.config.gameId ? 'active' : ''}`}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
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

      {showGamePicker && isHost && (
        <div className="modal-backdrop" onClick={() => setShowGamePicker(false)}>
          <div
            className="modal-card game-picker-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header-row" style={{ marginBottom: 4 }}>
              <h3 className="panel-title title-with-icon">
                <ArrowLeftRight size={16} />
                ゲームを変更する
              </h3>
              <button
                type="button"
                className="icon-text-btn"
                style={{ minWidth: 40, minHeight: 36, padding: '6px 8px' }}
                onClick={() => setShowGamePicker(false)}
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>
            <GamePicker
              selectedGame={lobby.config.gameId}
              onSelect={handleGameChange}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              currentPlayerCount={lobby.players.length}
              compact
            />
          </div>
        </div>
      )}

      {isHost ? (
        <div className="sticky-bottom-bar">
          {!canStart && (
            <div className="warn-text">
              {lobby.players.length < meta.minPlayers
                ? meta.allowBots === false
                  ? `あと ${meta.minPlayers - lobby.players.length} 人（招待またはローカル追加）必要です`
                  : meta.localPlayMode !== 'none'
                  ? `あと ${meta.minPlayers - lobby.players.length} 人（ローカル追加またはCPU）必要です`
                  : `あと ${meta.minPlayers - lobby.players.length} 人（またはCPU）必要です`
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
            {lobby.config.gameId === 'scoreboard' ? '得点管理専用ルームを開く' : 'ゲームスタート！'}
          </button>
        </div>
      ) : (
        <div className="waiting-banner">ホストがゲームを開始するのを待っています…</div>
      )}
    </div>
  );
};
