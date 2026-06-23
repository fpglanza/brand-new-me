export type Player = {
  id: string;
  totalXp: number;
  level: number;
};

export type HeroAttributes = {
  id: string;
  body: number;
  levelStartBody: number;
  levelStartMind: number;
  levelStartPurpose: number;
  mind: number;
  purpose: number;
};

export type Quest = {
  id: string;
  templateId: string;
  date: string;
  title: string;
  category: string;
  description: string;
  xp: number;
  completed: boolean;
  source: QuestSource;
};

export type QuestSource = 'scheduled' | 'carryover' | 'bonus';

export type QuestTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
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
  victoryDays: number;
  strongDays: number;
  legendaryDays: number;
  kingdomFavor: number;
  kingdomFavorCounted: number;
  empressScore: number;
};

export type FinalizedBattleResult = {
  id: string;
  weekStart: string;
  completionRate: number;
  result: WeeklyResult;
  flavorText: string;
  kingdomFavor: number;
  kingdomFavorCounted: number;
  empressScore: number;
  createdAt: string;
};

export type KingdomChecklistFrequency =
  | 'Weekly'
  | 'Every 2 Weeks'
  | 'Every 3 Weeks'
  | 'Monthly';

export type KingdomChecklistItem = {
  id: string;
  templateId: string;
  weekStart: string;
  windowKey: string;
  title: string;
  frequency: KingdomChecklistFrequency;
  completed: boolean;
};

export type KingdomState = {
  id: string;
  prosperity: number;
  legacy: number;
};

export type KingdomDecreeType = 'Order' | 'Restoration' | 'Stewardship';

export type KingdomDecree = {
  id: string;
  date: string;
  templateId: string;
  type: KingdomDecreeType;
  title: string;
  flavorText: string;
  prosperityReward: number;
  legacyReward: number;
  completed: boolean;
  completedAt: string | null;
};

export type GameState = {
  player: Player;
  heroAttributes: HeroAttributes;
  quests: Quest[];
  shadow: Shadow;
  today: string;
  weeklyBattle: WeeklyBattlePreview;
  finalizedBattle: FinalizedBattleResult | null;
  kingdomChecklist: KingdomChecklistItem[];
  kingdomDecrees: KingdomDecree[];
  kingdomState: KingdomState;
};
