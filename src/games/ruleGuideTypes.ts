export interface GameRuleGuideData {
  /** 勝利条件（1〜2文で端的に） */
  goal: string;
  /** 基本の流れ・操作手順（3〜5ステップ） */
  flow: string[];
  /** 重要ルール・役・反則・得点計算の要点（3〜6項目） */
  points: string[];
}
