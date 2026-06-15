export type Player = {
  id: string;
  totalXp: number;
  level: number;
};

export type Quest = {
  id: string;
  templateId: string;
  date: string;
  title: string;
  xp: number;
  completed: boolean;
};

export type QuestTemplate = {
  id: string;
  title: string;
  xp: number;
};

export type Shadow = {
  id: string;
  name: string;
  class: string;
  description: string;
  currentPower: number;
  maxPower: number;
  weekStart: string;
};

export type WeeklyResult = 'Victory' | 'Draw' | 'Defeat';

export type WeeklyBattlePreview = {
  weekStart: string;
  completionRate: number;
  result: WeeklyResult;
  flavorText: string;
  completedQuestCount: number;
  totalQuestCount: number;
};

export type FinalizedBattleResult = {
  id: string;
  weekStart: string;
  completionRate: number;
  result: WeeklyResult;
  flavorText: string;
  createdAt: string;
};

export type GameState = {
  player: Player;
  quests: Quest[];
  shadow: Shadow;
  today: string;
  weeklyBattle: WeeklyBattlePreview;
  finalizedBattle: FinalizedBattleResult | null;
};
