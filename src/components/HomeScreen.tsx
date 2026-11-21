import React, { useState } from 'react';
import { DoorOpen, PlusCircle, Sparkles, Users, Wrench } from 'lucide-react';
import { GAME_LIST, GAME_REGISTRY, type GameCategory } from '../games/registry';
import type { GameId, GameRulesMap } from '../types/game';
import { normalizeRoomCode } from '../utils/roomCode';
import { GameIcon } from './GameIcon';
import { RuleConfigurator } from './RuleConfigurator';

interface HomeScreenProps {
  playerName: string;
  onChangeName: (name: string) => void;
  initialRoomCode: string | null;
  connecting: boolean;
  error: string | null;
  onCreateRoom: (gameId: GameId, rules: GameRulesMap[GameId]) => void;
  onJoinRoom: (roomCode: string) => void;
  onOpenTools: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  playerName,
  onChangeName,
  initialRoomCode,
  connecting,
  error,
  onCreateRoom,
  onJoinRoom,
  onOpenTools,
}) => {
  const [tab, setTab] = useState<'join' | 'create'>(initialRoomCode ? 'join' : 'create');
  const [categoryFilter, setCategoryFilter] = useState<'all' | GameCategory>('all');
  const [roomInput, setRoomInput] = useState<string>(initialRoomCode ?? '');
  const [selectedGame, setSelectedGame] = useState<GameId>('daifugo');
  const [rulesByGame, setRulesByGame] = useState<GameRulesMap>(() => ({
    scoreboard: { ...GAME_REGISTRY.scoreboard.defaultRules },
    daifugo: { ...GAME_REGISTRY.daifugo.defaultRules },
    sevens: { ...GAME_REGISTRY.sevens.defaultRules },
    speed: { ...GAME_REGISTRY.speed.defaultRules },
    oldmaid: { ...GAME_REGISTRY.oldmaid.defaultRules },
    doubt: { ...GAME_REGISTRY.doubt.defaultRules },
    memory: { ...GAME_REGISTRY.memory.defaultRules },
    poker: { ...GAME_REGISTRY.poker.defaultRules },
    holdem: { ...GAME_REGISTRY.holdem.defaultRules },
    reversi: { ...GAME_REGISTRY.reversi.defaultRules },
    gomoku: { ...GAME_REGISTRY.gomoku.defaultRules },
    connect4: { ...GAME_REGISTRY.connect4.defaultRules },
    chinchiro: { ...GAME_REGISTRY.chinchiro.defaultRules },
    roulette: { ...GAME_REGISTRY.roulette.defaultRules },
  }));
  const [showRules, setShowRules] = useState(false);

  const visibleGames =
    categoryFilter === 'all'
      ? GAME_LIST
      : GAME_LIST.filter((g) => g.category === categoryFilter);

  const selectedMeta = GAME_REGISTRY[selectedGame];

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(roomInput);
    if (code.length < 4) return;
    onJoinRoom(code);
  };

  return (
    <div className="screen home-screen">
      <header className="hero-header">
        <div className="hero-badge">P2P ONLINE TABLE</div>
        <h1 className="hero-title">TABLE HUB</h1>
        <p className="hero-subtitle">スマホで集まってすぐ遊べる！トランプ・ボード・カジノ</p>
      </header>

      <section className="card-panel name-panel">
        <label className="field-label" htmlFor="nickname">
          あなたのニックネーム
        </label>
        <input
          id="nickname"
          type="text"
          className="text-input"
          maxLength={12}
          placeholder="例: たろう"
          value={playerName}
          onChange={(e) => onChangeName(e.target.value)}
        />
      </section>

      {error && <div className="error-banner">{error}</div>}

      <div className="tab-bar" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button
          type="button"
          className={`tab-btn ${tab === 'create' ? 'active' : ''}`}
          onClick={() => setTab('create')}
        >
          <PlusCircle size={18} />
          部屋をつくる
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'join' ? 'active' : ''}`}
          onClick={() => setTab('join')}
        >
          <DoorOpen size={18} />
          部屋に入る
        </button>
        <button
          type="button"
          className="tab-btn"
          onClick={onOpenTools}
        >
          <Wrench size={18} />
          ツール
        </button>
      </div>

      {tab === 'join' ? (
        <form className="card-panel join-panel" onSubmit={handleJoinSubmit}>
          <h2 className="panel-title">部屋コードを入力</h2>
          <p className="panel-desc">ホストの画面に表示されている5文字のコードを入力してください。</p>
          <input
            type="text"
            className="code-input"
            placeholder="A7K2P"
            value={roomInput}
            maxLength={8}
            autoCapitalize="characters"
            onChange={(e) => setRoomInput(normalizeRoomCode(e.target.value))}
          />
          <button
            type="submit"
            className="primary-btn full-width"
            disabled={connecting || normalizeRoomCode(roomInput).length < 4 || !playerName.trim()}
          >
            {connecting ? '接続中…' : 'この部屋に参加する'}
          </button>
        </form>
      ) : (
        <div className="create-panel">
          <div className="game-pills" style={{ marginBottom: 8 }}>
            {(
              [
                { id: 'all', label: 'すべて (14)' },
                { id: 'tool', label: '得点管理 (1)' },
                { id: 'card', label: 'カード (8)' },
                { id: 'board', label: 'ボード (3)' },
                { id: 'dice', label: 'ダイス・ルーレット (2)' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`game-pill ${categoryFilter === cat.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="game-grid">
            {visibleGames.map((game) => {
              const active = game.id === selectedGame;
              return (
                <button
                  key={game.id}
                  type="button"
                  className={`game-select-card ${active ? 'active' : ''}`}
                  onClick={() => setSelectedGame(game.id)}
                >
                  <div className="game-card-top">
                    <span className="game-icon">
                      <GameIcon name={game.icon} size={20} />
                    </span>
                    <span className="game-players">
                      <Users size={13} />
                      {game.minPlayers === game.maxPlayers
                        ? `${game.minPlayers}人`
                        : `${game.minPlayers}〜${game.maxPlayers}人`}
                    </span>
                  </div>
                  <div className="game-name">{game.name}</div>
                  <div className="game-sub">{game.subtitle}</div>
                </button>
              );
            })}
          </div>

          <section className="card-panel selected-game-detail">
            <div className="detail-header">
              <div>
                <h2 className="panel-title title-with-icon">
                  <GameIcon name={selectedMeta.icon} size={18} />
                  {selectedMeta.name}
                </h2>
                <p className="panel-desc">{selectedMeta.description}</p>
              </div>
            </div>

            <button
              type="button"
              className="secondary-btn full-width"
              onClick={() => setShowRules((v) => !v)}
            >
              <Sparkles size={16} />
              {showRules ? 'ローカルルール設定を閉じる' : 'ローカルルールを設定する'}
            </button>

            {showRules && (
              <div className="rules-drawer">
                <RuleConfigurator
                  gameId={selectedGame}
                  rules={rulesByGame[selectedGame]}
                  onChange={(next) =>
                    setRulesByGame((prev) => ({ ...prev, [selectedGame]: next }))
                  }
                />
              </div>
            )}

            <button
              type="button"
              className="primary-btn full-width mt-12"
              disabled={connecting || !playerName.trim()}
              onClick={() => onCreateRoom(selectedGame, rulesByGame[selectedGame])}
            >
              {connecting ? '部屋を作成中…' : `${selectedMeta.name} の部屋をつくる`}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
