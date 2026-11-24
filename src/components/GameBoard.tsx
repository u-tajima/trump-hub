import React, { useState } from 'react';
import { ArrowLeft, BookOpen, ClipboardList, Eye, EyeOff, RotateCcw, Users, X } from 'lucide-react';
import type { AirHockeyClientState } from '../games/airhockey';
import type { BattleshipClientState } from '../games/battleship';
import type { BlackjackClientState } from '../games/blackjack';
import type { CarromClientState } from '../games/carrom';
import type { ChessClientState } from '../games/chess';
import type { ChinchiroClientState } from '../games/chinchiro';
import type { Connect4ClientState } from '../games/connect4';
import type { Crazy8ClientState } from '../games/crazy8';
import type { DaifugoClientState } from '../games/daifugo';
import type { DotsAndBoxesClientState } from '../games/dotsAndBoxes';
import type { DoubtClientState } from '../games/doubt';
import type { GomokuClientState } from '../games/gomoku';
import type { HitAndBlowClientState } from '../games/hitAndBlow';
import type { HoldemClientState } from '../games/holdem';
import type { IgoClientState } from '../games/igo';
import type { IndianPokerClientState } from '../games/indianPoker';
import type { LiarsDiceClientState } from '../games/liarsDice';
import type { MancalaClientState } from '../games/mancala';
import type { MemoryClientState } from '../games/memory';
import type { OldMaidClientState } from '../games/oldMaid';
import type { PokerClientState } from '../games/poker';
import type { ReversiClientState } from '../games/reversi';
import type { RouletteClientState } from '../games/roulette';
import { GAME_REGISTRY } from '../games/registry';
import type { SevensClientState } from '../games/sevens';
import type { ShogiClientState } from '../games/shogi';
import type { SpeedClientState } from '../games/speed';
import type { WerewolfClientState } from '../games/werewolf';
import type { YachtClientState } from '../games/yacht';
import type { GameId, GameRulesMap, ScoreBoardRoomRules } from '../types/game';
import type { ScoreBoardOp, ScoreBoardState } from '../utils/scoreBoard';
import { GameIcon } from './GameIcon';
import { RuleConfigurator } from './RuleConfigurator';
import { AirHockeyBoard } from './boards/AirHockeyBoard';
import { BattleshipBoard } from './boards/BattleshipBoard';
import { BlackjackBoard } from './boards/BlackjackBoard';
import { CarromBoard } from './boards/CarromBoard';
import { ChessBoard } from './boards/ChessBoard';
import { ChinchiroBoard } from './boards/ChinchiroBoard';
import { Connect4Board } from './boards/Connect4Board';
import { Crazy8Board } from './boards/Crazy8Board';
import { DaifugoBoard } from './boards/DaifugoBoard';
import { DotsAndBoxesBoard } from './boards/DotsAndBoxesBoard';
import { DoubtBoard } from './boards/DoubtBoard';
import { GomokuBoard } from './boards/GomokuBoard';
import { HitAndBlowBoard } from './boards/HitAndBlowBoard';
import { HoldemBoard } from './boards/HoldemBoard';
import { IgoBoard } from './boards/IgoBoard';
import { IndianPokerBoard } from './boards/IndianPokerBoard';
import { LiarsDiceBoard } from './boards/LiarsDiceBoard';
import { MancalaBoard } from './boards/MancalaBoard';
import { MemoryBoard } from './boards/MemoryBoard';
import { OldMaidBoard } from './boards/OldMaidBoard';
import { PokerBoard } from './boards/PokerBoard';
import { ReversiBoard } from './boards/ReversiBoard';
import { RouletteBoard } from './boards/RouletteBoard';
import { ScoreRoomBoard } from './boards/ScoreRoomBoard';
import { SevensBoard } from './boards/SevensBoard';
import { ShogiBoard } from './boards/ShogiBoard';
import { SpeedBoard } from './boards/SpeedBoard';
import { WerewolfBoard } from './boards/WerewolfBoard';
import { YachtBoard } from './boards/YachtBoard';
import './PassAndPlayOverlay.css';

interface GameBoardProps {
  gameId: GameId;
  roomCode: string;
  rules: GameRulesMap[GameId];
  gameState: unknown;
  isHost: boolean;
  isLocalPassAndPlay?: boolean;
  handoffPlayer?: { id: string; name: string } | null;
  onConfirmHandoff?: () => void;
  activeLocalPlayerName?: string | null;
  localPlayers?: { id: string; name: string }[];
  onAction: (action: { type: string; payload?: unknown }, overrideActorId?: string) => void;
  onRestart: () => void;
  onBackToLobby: () => void;
  onLeave: () => void;
  onOpenScoreBoard: () => void;
  roomScoreBoard?: ScoreBoardState | null;
  onScoreOp?: (op: ScoreBoardOp) => void;
  myPlayerName?: string;
  roomPlayerNames?: string[];
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameId,
  roomCode,
  rules,
  gameState,
  isHost,
  isLocalPassAndPlay = false,
  handoffPlayer = null,
  onConfirmHandoff,
  activeLocalPlayerName = null,
  localPlayers = [],
  onAction,
  onRestart,
  onBackToLobby,
  onLeave,
  onOpenScoreBoard,
  roomScoreBoard,
  onScoreOp,
  myPlayerName = '',
  roomPlayerNames = [],
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
          onClick={isHost && gameId !== 'scoreboard' ? onBackToLobby : onLeave}
        >
          <ArrowLeft size={16} />
          {isHost && gameId !== 'scoreboard' ? 'ロビー' : '退出'}
        </button>
        <div className="top-bar-center">
          <span className="top-bar-title title-with-icon">
            <GameIcon name={meta.icon} size={16} /> {meta.name}
          </span>
          <span className="top-bar-code">{roomCode}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {gameId !== 'scoreboard' && (
            <button
              type="button"
              className="icon-text-btn"
              style={{ minWidth: 52, padding: '8px 9px' }}
              onClick={onOpenScoreBoard}
            >
              <ClipboardList size={15} />
              得点
            </button>
          )}
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
        {handoffPlayer ? (
          <div className="handoff-screen">
            <div className="handoff-icon-circle">
              <EyeOff size={32} />
            </div>
            <div className="handoff-eyebrow">端末を渡してください</div>
            <h2 className="handoff-player-name">{handoffPlayer.name} の番</h2>
            <p className="handoff-hint">
              {gameId === 'werewolf'
                ? `役職や操作が見えないよう画面を隠しています。${handoffPlayer.name} に端末を渡してからボタンを押してください。`
                : gameId === 'battleship'
                ? `艦隊配置が見えないよう画面を隠しています。${handoffPlayer.name} に端末を渡してからボタンを押してください。`
                : gameId === 'liarsdice'
                ? `カップの中のサイコロが見えないよう画面を隠しています。${handoffPlayer.name} に端末を渡してからボタンを押してください。`
                : gameId === 'indianpoker'
                ? `自分のカードが見えないよう画面を切り替えています。${handoffPlayer.name} に端末を渡してからボタンを押してください。`
                : `手札が見えないよう画面を隠しています。${handoffPlayer.name} に端末を渡してからボタンを押してください。`}
            </p>
            <button
              type="button"
              className="primary-btn handoff-reveal-btn"
              onClick={onConfirmHandoff}
            >
              <Eye size={18} />
              {gameId === 'werewolf' || gameId === 'battleship' || gameId === 'liarsdice' || gameId === 'indianpoker'
                ? `${handoffPlayer.name} の画面を開く`
                : `${handoffPlayer.name} の手札を見る`}
            </button>
          </div>
        ) : (
          <>
            {isLocalPassAndPlay &&
              activeLocalPlayerName &&
              phase === 'playing' &&
              gameId !== 'speed' &&
              gameId !== 'airhockey' && (
                <div className="local-turn-bar">
                  <Users size={14} />
                  操作中: {activeLocalPlayerName}
                </div>
              )}
            {gameId === 'scoreboard' && roomScoreBoard && onScoreOp && (
              <ScoreRoomBoard
                roomCode={roomCode}
                rules={rules as ScoreBoardRoomRules}
                board={roomScoreBoard}
                onScoreOp={onScoreOp}
                isHost={isHost}
                myPlayerName={myPlayerName}
                roomPlayerNames={roomPlayerNames}
              />
            )}
            {gameId === 'daifugo' && (
              <DaifugoBoard state={gameState as DaifugoClientState} onAction={onAction} />
            )}
            {gameId === 'sevens' && (
              <SevensBoard state={gameState as SevensClientState} onAction={onAction} />
            )}
            {gameId === 'speed' && (
              <SpeedBoard
                state={gameState as SpeedClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'oldmaid' && (
              <OldMaidBoard state={gameState as OldMaidClientState} onAction={onAction} />
            )}
            {gameId === 'doubt' && (
              <DoubtBoard
                state={gameState as DoubtClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
                localPlayers={localPlayers}
              />
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
              <ReversiBoard
                state={gameState as ReversiClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'gomoku' && (
              <GomokuBoard
                state={gameState as GomokuClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'connect4' && (
              <Connect4Board
                state={gameState as Connect4ClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'shogi' && (
              <ShogiBoard
                state={gameState as ShogiClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'chess' && (
              <ChessBoard
                state={gameState as ChessClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'igo' && (
              <IgoBoard
                state={gameState as IgoClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'werewolf' && (
              <WerewolfBoard
                state={gameState as WerewolfClientState}
                isHost={isHost}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'chinchiro' && (
              <ChinchiroBoard state={gameState as ChinchiroClientState} onAction={onAction} />
            )}
            {gameId === 'roulette' && (
              <RouletteBoard
                state={gameState as RouletteClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'crazy8' && (
              <Crazy8Board state={gameState as Crazy8ClientState} onAction={onAction} />
            )}
            {gameId === 'blackjack' && (
              <BlackjackBoard state={gameState as BlackjackClientState} onAction={onAction} />
            )}
            {gameId === 'indianpoker' && (
              <IndianPokerBoard state={gameState as IndianPokerClientState} onAction={onAction} />
            )}
            {gameId === 'mancala' && (
              <MancalaBoard
                state={gameState as MancalaClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'dotsandboxes' && (
              <DotsAndBoxesBoard
                state={gameState as DotsAndBoxesClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'battleship' && (
              <BattleshipBoard
                state={gameState as BattleshipClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'hitandblow' && (
              <HitAndBlowBoard
                state={gameState as HitAndBlowClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'carrom' && (
              <CarromBoard
                state={gameState as CarromClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'airhockey' && (
              <AirHockeyBoard
                state={gameState as AirHockeyClientState}
                onAction={onAction}
                isLocalPassAndPlay={isLocalPassAndPlay}
              />
            )}
            {gameId === 'yacht' && (
              <YachtBoard state={gameState as YachtClientState} onAction={onAction} />
            )}
            {gameId === 'liarsdice' && (
              <LiarsDiceBoard state={gameState as LiarsDiceClientState} onAction={onAction} />
            )}
          </>
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
