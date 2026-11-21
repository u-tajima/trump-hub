import React, { useState } from 'react';
import { ArrowLeft, BookOpen, ClipboardList, RotateCcw, X } from 'lucide-react';
import type { ChinchiroClientState } from '../games/chinchiro';
import type { Connect4ClientState } from '../games/connect4';
import type { DaifugoClientState } from '../games/daifugo';
import type { DoubtClientState } from '../games/doubt';
import type { GomokuClientState } from '../games/gomoku';
import type { HoldemClientState } from '../games/holdem';
import type { MemoryClientState } from '../games/memory';
import type { OldMaidClientState } from '../games/oldMaid';
import type { PokerClientState } from '../games/poker';
import type { ReversiClientState } from '../games/reversi';
import type { RouletteClientState } from '../games/roulette';
import { GAME_REGISTRY } from '../games/registry';
import type { SevensClientState } from '../games/sevens';
import type { SpeedClientState } from '../games/speed';
import type { GameId, GameRulesMap } from '../types/game';
import { GameIcon } from './GameIcon';
import { RuleConfigurator } from './RuleConfigurator';
import { ChinchiroBoard } from './boards/ChinchiroBoard';
import { Connect4Board } from './boards/Connect4Board';
import { DaifugoBoard } from './boards/DaifugoBoard';
import { DoubtBoard } from './boards/DoubtBoard';
import { GomokuBoard } from './boards/GomokuBoard';
import { HoldemBoard } from './boards/HoldemBoard';
import { MemoryBoard } from './boards/MemoryBoard';
import { OldMaidBoard } from './boards/OldMaidBoard';
import { PokerBoard } from './boards/PokerBoard';
import { ReversiBoard } from './boards/ReversiBoard';
import { RouletteBoard } from './boards/RouletteBoard';
import { SevensBoard } from './boards/SevensBoard';
import { SpeedBoard } from './boards/SpeedBoard';

interface GameBoardProps {
  gameId: GameId;
  roomCode: string;
  rules: GameRulesMap[GameId];
  gameState: unknown;
  isHost: boolean;
  onAction: (action: { type: string; payload?: unknown }) => void;
  onRestart: () => void;
  onBackToLobby: () => void;
  onLeave: () => void;
  onOpenScoreBoard: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameId,
  roomCode,
  rules,
  gameState,
  isHost,
  onAction,
  onRestart,
  onBackToLobby,
  onLeave,
  onOpenScoreBoard,
}) => {
  const [showRuleModal, setShowRuleModal] = useState(false);
  const meta = GAME_REGISTRY[gameId];
  const phase = (gameState as { phase?: string })?.phase;

  return (
    <div className="screen game-screen">
      <header className="top-bar">
        <button
          type="button"
          className="icon-text-btn"
          onClick={isHost ? onBackToLobby : onLeave}
        >
          <ArrowLeft size={16} />
          {isHost ? 'ロビー' : '退出'}
        </button>
        <div className="top-bar-center">
          <span className="top-bar-title title-with-icon">
            <GameIcon name={meta.icon} size={16} /> {meta.name}
          </span>
          <span className="top-bar-code">{roomCode}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="icon-text-btn"
            style={{ minWidth: 52, padding: '8px 9px' }}
            onClick={onOpenScoreBoard}
          >
            <ClipboardList size={15} />
            得点
          </button>
          <button
            type="button"
            className="icon-text-btn"
            style={{ minWidth: 52, padding: '8px 9px' }}
            onClick={() => setShowRuleModal(true)}
          >
            <BookOpen size={15} />
            ルール
          </button>
        </div>
      </header>

      <main className="game-main">
        {gameId === 'daifugo' && (
          <DaifugoBoard state={gameState as DaifugoClientState} onAction={onAction} />
        )}
        {gameId === 'sevens' && (
          <SevensBoard state={gameState as SevensClientState} onAction={onAction} />
        )}
        {gameId === 'speed' && (
          <SpeedBoard state={gameState as SpeedClientState} onAction={onAction} />
        )}
        {gameId === 'oldmaid' && (
          <OldMaidBoard state={gameState as OldMaidClientState} onAction={onAction} />
        )}
        {gameId === 'doubt' && (
          <DoubtBoard state={gameState as DoubtClientState} onAction={onAction} />
        )}
        {gameId === 'memory' && (
          <MemoryBoard state={gameState as MemoryClientState} onAction={onAction} />
        )}
        {gameId === 'poker' && (
          <PokerBoard state={gameState as PokerClientState} onAction={onAction} />
        )}
        {gameId === 'holdem' && (
          <HoldemBoard state={gameState as HoldemClientState} onAction={onAction} />
        )}
        {gameId === 'reversi' && (
          <ReversiBoard state={gameState as ReversiClientState} onAction={onAction} />
        )}
        {gameId === 'gomoku' && (
          <GomokuBoard state={gameState as GomokuClientState} onAction={onAction} />
        )}
        {gameId === 'connect4' && (
          <Connect4Board state={gameState as Connect4ClientState} onAction={onAction} />
        )}
        {gameId === 'chinchiro' && (
          <ChinchiroBoard state={gameState as ChinchiroClientState} onAction={onAction} />
        )}
        {gameId === 'roulette' && (
          <RouletteBoard state={gameState as RouletteClientState} onAction={onAction} />
        )}
      </main>

      {phase === 'finished' && isHost && (
        <div className="finished-footer">
          <button type="button" className="secondary-btn" onClick={onBackToLobby}>
            ロビーへ戻る
          </button>
          <button type="button" className="primary-btn flex-1" onClick={onRestart}>
            <RotateCcw size={16} />
            同じルールでもう一度
          </button>
        </div>
      )}

      {showRuleModal && (
        <div className="modal-backdrop" onClick={() => setShowRuleModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header-row">
              <h3 className="panel-title title-with-icon">
                <GameIcon name={meta.icon} size={16} /> {meta.name} ローカルルール
              </h3>
              <button
                type="button"
                className="icon-text-btn"
                onClick={() => setShowRuleModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="panel-desc">{meta.description}</p>
            <div className="rules-drawer">
              <RuleConfigurator gameId={gameId} rules={rules} readOnly />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
