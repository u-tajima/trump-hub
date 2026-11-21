import React, { useState } from 'react';
import { ArrowLeft, BookOpen, RotateCcw, X } from 'lucide-react';
import type { DaifugoClientState } from '../games/daifugo';
import type { DoubtClientState } from '../games/doubt';
import type { MemoryClientState } from '../games/memory';
import type { OldMaidClientState } from '../games/oldMaid';
import { GAME_REGISTRY } from '../games/registry';
import type { SevensClientState } from '../games/sevens';
import type { SpeedClientState } from '../games/speed';
import type { GameId, GameRulesMap } from '../types/game';
import { RuleConfigurator } from './RuleConfigurator';
import { DaifugoBoard } from './boards/DaifugoBoard';
import { DoubtBoard } from './boards/DoubtBoard';
import { MemoryBoard } from './boards/MemoryBoard';
import { OldMaidBoard } from './boards/OldMaidBoard';
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
          <span className="top-bar-title">
            {meta.icon} {meta.name}
          </span>
          <span className="top-bar-code">{roomCode}</span>
        </div>
        <button
          type="button"
          className="icon-text-btn"
          onClick={() => setShowRuleModal(true)}
        >
          <BookOpen size={16} />
          ルール
        </button>
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
              <h3 className="panel-title">
                {meta.icon} {meta.name} ローカルルール
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
