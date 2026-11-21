import React, { useState } from 'react';
import { Check, Copy, QrCode, Share2, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { ScoreBoardRoomRules } from '../../types/game';
import { buildInviteUrl } from '../../utils/roomCode';
import type { ScoreBoardOp, ScoreBoardState } from '../../utils/scoreBoard';
import { ScoreBoardPanel } from '../tools/ScoreBoardPanel';

interface ScoreRoomBoardProps {
  roomCode: string;
  rules: ScoreBoardRoomRules;
  board: ScoreBoardState;
  onScoreOp: (op: ScoreBoardOp) => void;
  isHost: boolean;
  myPlayerName: string;
  roomPlayerNames: string[];
}

export const ScoreRoomBoard: React.FC<ScoreRoomBoardProps> = ({
  roomCode,
  rules,
  board,
  onScoreOp,
  isHost,
  myPlayerName,
  roomPlayerNames,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const inviteUrl = buildInviteUrl(roomCode);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
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
          title: `TABLE HUB - 得点管理専用部屋 (${roomCode})`,
          text: `得点管理部屋「${roomCode}」に参加して得点を同時記録しよう！`,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback to clipboard
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

  return (
    <div className="board-container" style={{ gap: 10 }}>
      <div className="scoreroom-invite-bar">
        <div className="scoreroom-invite-top">
          <div className="scoreroom-code-badge">
            <span>部屋コード:</span>
            <strong>{roomCode}</strong>
            <span className="flag-badge info" style={{ marginLeft: 4 }}>
              <Users size={11} /> 接続 {roomPlayerNames.length}名
            </span>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button type="button" className="chip-btn" onClick={handleCopyCode}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'コピー済' : 'コード'}
            </button>
            <button type="button" className="chip-btn" onClick={handleShare}>
              <Share2 size={13} />
              招待
            </button>
            <button type="button" className="chip-btn" onClick={() => setShowQr((v) => !v)}>
              <QrCode size={13} />
              QR
            </button>
          </div>
        </div>
        {showQr && (
          <div className="qr-box" style={{ marginTop: 4 }}>
            <QRCodeSVG
              value={inviteUrl}
              size={148}
              includeMargin
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
            <div className="qr-hint">途中参加もOK！カメラで読み取るとそのまま入室できます</div>
          </div>
        )}
      </div>

      <ScoreBoardPanel
        board={board}
        onOp={onScoreOp}
        isRoomMode
        canRestoreSaved={isHost}
        roomPlayerNames={roomPlayerNames}
        myPlayerName={myPlayerName}
        unitStep={rules.unitStep}
        zeroSumCheck={rules.zeroSumCheck}
      />
    </div>
  );
};
