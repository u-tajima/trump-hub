import React, { useState } from 'react';
import {
  ClipboardList,
  Dices,
  DoorOpen,
  PlusCircle,
  Sparkles,
  Star,
  Target,
  Wrench,
} from 'lucide-react';
import { GAME_REGISTRY } from '../games/registry';
import type { GameId, GameRulesMap, ScoreBoardRoomRules } from '../types/game';
import { useFavoriteGames } from '../utils/favorites';
import { normalizeRoomCode } from '../utils/roomCode';
import { GameIcon } from './GameIcon';
import { GamePicker } from './GamePicker';
import { RuleConfigurator } from './RuleConfigurator';

export type ToolChoiceId = 'dice' | 'roulette' | 'scoreboard';

interface ToolCardMeta {
  id: ToolChoiceId;
  name: string;
  subtitle: string;
  badge: string;
  description: string;
  actionLabel: string;
}

const TOOL_CATALOG: ToolCardMeta[] = [
  {
    id: 'scoreboard',
    name: '得点管理（専用部屋）',
    subtitle: 'コード共有で全員同時入力＆ゼロサム検証',
    badge: '同時編集ルーム',
    description:
      '得点管理専用部屋を立ち上げて、参加メンバー全員のスマホから同時に入力・共有できます。自分の得点変動を素早く入力でき、全体の収支がゼロサム（合計±0）になっていない時は警告を表示します。データはホスト端末に3日間保存されます。',
    actionLabel: '得点管理専用部屋を使用する',
  },
  {
    id: 'dice',
    name: '3D物理ダイス',
    subtitle: '1〜6個の角丸サイコロを茶碗で振る',
    badge: '1〜6個対応',
    description:
      '3D物理エンジンで茶碗の中のサイコロを振れるツールです。ダイスの個数（1〜6個）を自由に切り替えられ、出目の合計やロール履歴も自動で記録されます。',
    actionLabel: '3D物理ダイスを使用する',
  },
  {
    id: 'roulette',
    name: '3Dカスタムルーレット',
    subtitle: '選択肢・割り当て枠数を自由に設定',
    badge: '最大36枠・余り振直',
    description:
      'ホイールの総枠数（2〜36枠）と各選択肢の割り当て枠数を自由に設定できる3D物理ルーレットです。デフォルトは選択肢数で等分され、余り枠は緑（振り直し）になります。',
    actionLabel: '3Dカスタムルーレットを使用する',
  },
];

interface HomeScreenProps {
  playerName: string;
  onChangeName: (name: string) => void;
  initialRoomCode: string | null;
  connecting: boolean;
  error: string | null;
  onCreateRoom: (gameId: GameId, rules: GameRulesMap[GameId]) => void;
  onJoinRoom: (roomCode: string) => void;
  onOpenTool: (tool: 'dice' | 'roulette') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  playerName,
  onChangeName,
  initialRoomCode,
  connecting,
  error,
  onCreateRoom,
  onJoinRoom,
  onOpenTool,
}) => {
  const [tab, setTab] = useState<'join' | 'create' | 'tools'>(
    initialRoomCode ? 'join' : 'create'
  );
  const [roomInput, setRoomInput] = useState<string>(initialRoomCode ?? '');
  const [selectedGame, setSelectedGame] = useState<GameId>('daifugo');
  const [selectedTool, setSelectedTool] = useState<ToolChoiceId>('scoreboard');
  const { favorites, toggleFavorite, isFavorite } = useFavoriteGames();
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
    crazy8: { ...GAME_REGISTRY.crazy8.defaultRules },
    blackjack: { ...GAME_REGISTRY.blackjack.defaultRules },
    indianpoker: { ...GAME_REGISTRY.indianpoker.defaultRules },
    reversi: { ...GAME_REGISTRY.reversi.defaultRules },
    gomoku: { ...GAME_REGISTRY.gomoku.defaultRules },
    connect4: { ...GAME_REGISTRY.connect4.defaultRules },
    shogi: { ...GAME_REGISTRY.shogi.defaultRules },
    chess: { ...GAME_REGISTRY.chess.defaultRules },
    igo: { ...GAME_REGISTRY.igo.defaultRules },
    mancala: { ...GAME_REGISTRY.mancala.defaultRules },
    dotsandboxes: { ...GAME_REGISTRY.dotsandboxes.defaultRules },
    battleship: { ...GAME_REGISTRY.battleship.defaultRules },
    hitandblow: { ...GAME_REGISTRY.hitandblow.defaultRules },
    hex: { ...GAME_REGISTRY.hex.defaultRules },
    checkers: { ...GAME_REGISTRY.checkers.defaultRules },
    backgammon: { ...GAME_REGISTRY.backgammon.defaultRules },
    gunjinshogi: { ...GAME_REGISTRY.gunjinshogi.defaultRules },
    carrom: { ...GAME_REGISTRY.carrom.defaultRules },
    airhockey: { ...GAME_REGISTRY.airhockey.defaultRules },
    coinsoccer: { ...GAME_REGISTRY.coinsoccer.defaultRules },
    crokinole: { ...GAME_REGISTRY.crokinole.defaultRules },
    werewolf: { ...GAME_REGISTRY.werewolf.defaultRules },
    onenight: { ...GAME_REGISTRY.onenight.defaultRules },
    wordwolf: { ...GAME_REGISTRY.wordwolf.defaultRules },
    insider: { ...GAME_REGISTRY.insider.defaultRules },
    chinchiro: { ...GAME_REGISTRY.chinchiro.defaultRules },
    roulette: { ...GAME_REGISTRY.roulette.defaultRules },
    yacht: { ...GAME_REGISTRY.yacht.defaultRules },
    liarsdice: { ...GAME_REGISTRY.liarsdice.defaultRules },
  }));
  const [showRules, setShowRules] = useState(false);
  const [showScoreToolRules, setShowScoreToolRules] = useState(false);

  const selectedMeta = GAME_REGISTRY[selectedGame];
  const selectedToolMeta =
    TOOL_CATALOG.find((t) => t.id === selectedTool) ?? TOOL_CATALOG[0];

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(roomInput);
    if (code.length < 4) return;
    onJoinRoom(code);
  };

  const handleUseSelectedTool = () => {
    if (selectedTool === 'scoreboard') {
      onCreateRoom('scoreboard', rulesByGame.scoreboard);
    } else {
      onOpenTool(selectedTool);
    }
  };

  const renderToolIcon = (toolId: ToolChoiceId, size = 20) => {
    if (toolId === 'dice') return <Dices size={size} />;
    if (toolId === 'roulette') return <Target size={size} />;
    return <ClipboardList size={size} />;
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
          className={`tab-btn ${tab === 'tools' ? 'active' : ''}`}
          onClick={() => setTab('tools')}
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
      ) : tab === 'tools' ? (
        <div className="create-panel">
          <div className="game-grid">
            {TOOL_CATALOG.map((tool) => {
              const active = tool.id === selectedTool;
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={`game-select-card ${active ? 'active' : ''}`}
                  onClick={() => setSelectedTool(tool.id)}
                >
                  <div className="game-card-top">
                    <span className="game-icon">{renderToolIcon(tool.id, 20)}</span>
                    <span className="game-players">{tool.badge}</span>
                  </div>
                  <div className="game-name">{tool.name}</div>
                  <div className="game-sub">{tool.subtitle}</div>
                </button>
              );
            })}
          </div>

          <section className="card-panel selected-game-detail">
            <div className="detail-header">
              <div>
                <h2 className="panel-title title-with-icon">
                  {renderToolIcon(selectedToolMeta.id, 18)}
                  {selectedToolMeta.name}
                </h2>
                <p className="panel-desc">{selectedToolMeta.description}</p>
              </div>
            </div>

            {selectedTool === 'scoreboard' && (
              <>
                <button
                  type="button"
                  className="secondary-btn full-width"
                  onClick={() => setShowScoreToolRules((v) => !v)}
                >
                  <Sparkles size={16} />
                  {showScoreToolRules ? '得点管理の設定を閉じる' : '初期点・単位・ゼロサム設定'}
                </button>

                {showScoreToolRules && (
                  <div className="rules-drawer">
                    <RuleConfigurator
                      gameId="scoreboard"
                      rules={rulesByGame.scoreboard}
                      onChange={(next) =>
                        setRulesByGame((prev) => ({
                          ...prev,
                          scoreboard: next as ScoreBoardRoomRules,
                        }))
                      }
                    />
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              className="primary-btn full-width mt-12"
              disabled={
                connecting || (selectedTool === 'scoreboard' && !playerName.trim())
              }
              onClick={handleUseSelectedTool}
            >
              {selectedTool === 'scoreboard' && connecting
                ? '得点管理専用部屋を作成中…'
                : selectedToolMeta.actionLabel}
            </button>
          </section>
        </div>
      ) : (
        <div className="create-panel">
          <GamePicker
            selectedGame={selectedGame}
            onSelect={setSelectedGame}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />

          <section className="card-panel selected-game-detail">
            <div className="detail-header">
              <div style={{ flex: 1 }}>
                <div className="panel-header-row" style={{ marginBottom: 4 }}>
                  <h2 className="panel-title title-with-icon">
                    <GameIcon name={selectedMeta.icon} size={18} />
                    {selectedMeta.name}
                  </h2>
                  <button
                    type="button"
                    className={`chip-btn ${isFavorite(selectedGame) ? 'active' : ''}`}
                    style={
                      isFavorite(selectedGame)
                        ? {
                            background: 'rgba(250, 204, 21, 0.2)',
                            borderColor: 'rgba(250, 204, 21, 0.6)',
                            color: '#fef08a',
                          }
                        : undefined
                    }
                    onClick={() => toggleFavorite(selectedGame)}
                  >
                    <Star size={14} fill={isFavorite(selectedGame) ? 'currentColor' : 'none'} />
                    {isFavorite(selectedGame) ? 'お気に入り済' : 'お気に入り'}
                  </button>
                </div>
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
