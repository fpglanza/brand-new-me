import * as SQLite from 'expo-sqlite';

import type {
  GameState,
  FinalizedBattleResult,
  KingdomChecklistFrequency,
  KingdomChecklistItem,
  Player,
  Quest,
  QuestTemplate,
  Shadow,
  WeeklyBattlePreview,
  WeeklyResult,
} from '../types/game';

type QuestRow = {
  id: string;
  template_id: string;
  date: string;
  title: string;
  category: string;
  description: string;
  xp_reward: number;
  completed: number;
};

type LegacyQuestRow = {
  id: string;
  title: string;
  xp_reward: number;
  completed: number;
};

type PlayerRow = {
  id: string;
  total_xp: number;
  level: number;
};

type ShadowRow = {
  id: string;
  name: string;
  class: string;
  description: string;
  current_power: number;
  max_power: number;
  week_start: string;
};

type WeeklyDailyProgressRow = {
  date: string;
  daily_progress: number;
};

type WeeklyResultRow = {
  id: string;
  week_start: string;
  completion_rate: number;
  result: WeeklyResult;
  created_at: string;
};

type KingdomChecklistRow = {
  id: string;
  template_id: string;
  week_start: string;
  window_key: string;
  title: string;
  frequency: KingdomChecklistFrequency;
  completed: number;
};

export const XP_GOAL = 100;

const DATABASE_NAME = 'brand-new-me.db';
const PLAYER_ID = 'player';
const SHADOW_ID = 'shadow-steward';
const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const CADENCE_ANCHOR_WEEK_START = '1970-01-05';

export const DEFAULT_PLAYER: Player = {
  id: PLAYER_ID,
  totalXp: 0,
  level: 1,
};

export const DEFAULT_SHADOW: Shadow = {
  id: SHADOW_ID,
  name: 'Shadow Steward',
  class: 'Steward',
  description: 'The house slowly falls into disorder.',
  currentPower: 100,
  maxPower: 100,
  weekStart: getWeekStartDateString(),
};

const DAILY_BASELINE_QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: 'morning-care',
    title: 'Morning Care',
    category: 'Appearance',
    description: 'Skincare morning routine + hair care.',
    xp: 10,
  },
  {
    id: 'mindfulness',
    title: 'Mindfulness',
    category: 'Mind',
    description: '5 minutes of breathing / mindfulness.',
    xp: 10,
  },
  {
    id: 'huel-breakfast',
    title: 'Huel Breakfast',
    category: 'Fuel',
    description: 'Huel breakfast + multivitamin.',
    xp: 15,
  },
  {
    id: 'hydration',
    title: 'Hydration',
    category: 'Fuel',
    description: '2.5-3 liters water.',
    xp: 10,
  },
  {
    id: 'supplements',
    title: 'Supplements',
    category: 'Fuel',
    description: 'Creatine and daily supplements.',
    xp: 5,
  },
  {
    id: 'writing',
    title: 'Writing',
    category: 'Mind',
    description: '5-10 minutes writing, ideas, journal, acting notes.',
    xp: 10,
  },
  {
    id: 'side-project',
    title: 'Side Project',
    category: 'Purpose',
    description: 'At least 1 hour on side project.',
    xp: 35,
  },
  {
    id: 'sleep-routine',
    title: 'Sleep Routine',
    category: 'Recovery',
    description: 'Screens off 30 minutes before sleep, target 7-8h.',
    xp: 15,
  },
  {
    id: 'walk-6k-10k-steps',
    title: 'Walk 6k-10k Steps',
    category: 'Body',
    description: 'Walk 6k-10k steps.',
    xp: 25,
  },
];

const WEEKDAY_QUEST_TEMPLATES: Record<number, QuestTemplate[]> = {
  0: [
    {
      id: 'meal-prep',
      title: 'Meal Prep',
      category: 'Stewardship',
      description: 'Prepare simple meals for the week ahead.',
      xp: 25,
    },
    {
      id: 'grocery-shopping',
      title: 'Grocery Shopping',
      category: 'Stewardship',
      description: 'Stock the kitchen with useful food.',
      xp: 20,
    },
    {
      id: 'house-reset',
      title: 'House Reset',
      category: 'Stewardship',
      description: 'Reset the home base for the next run.',
      xp: 25,
    },
  ],
  1: [
    {
      id: 'workout-a',
      title: 'Workout A',
      category: 'Body',
      description: 'Complete the scheduled Workout A session.',
      xp: 25,
    },
    {
      id: 'mobility',
      title: 'Mobility',
      category: 'Body',
      description: '10 minutes mobility / stretching.',
      xp: 15,
    },
  ],
  2: [
    {
      id: 'mobility',
      title: 'Mobility',
      category: 'Body',
      description: '10 minutes mobility / stretching.',
      xp: 15,
    },
  ],
  3: [
    {
      id: 'workout-b',
      title: 'Workout B',
      category: 'Body',
      description: 'Complete the scheduled Workout B session.',
      xp: 25,
    },
    {
      id: 'mobility',
      title: 'Mobility',
      category: 'Body',
      description: '10 minutes mobility / stretching.',
      xp: 15,
    },
  ],
  4: [
    {
      id: 'mobility',
      title: 'Mobility',
      category: 'Body',
      description: '10 minutes mobility / stretching.',
      xp: 15,
    },
  ],
  5: [
    {
      id: 'workout-c',
      title: 'Workout C',
      category: 'Body',
      description: 'Complete the scheduled Workout C session.',
      xp: 25,
    },
    {
      id: 'mobility',
      title: 'Mobility',
      category: 'Body',
      description: '10 minutes mobility / stretching.',
      xp: 15,
    },
  ],
  6: [
    {
      id: 'active-recovery',
      title: 'Active Recovery',
      category: 'Recovery',
      description: 'Low-intensity recovery movement.',
      xp: 20,
    },
    {
      id: 'light-stretching',
      title: 'Light Stretching',
      category: 'Recovery',
      description: 'Easy stretching to stay loose.',
      xp: 15,
    },
  ],
};

const WORKOUT_CARRYOVER_TEMPLATES: Record<number, QuestTemplate> = {
  2: {
    id: 'workout-a-carried-over',
    title: 'Workout A — Carried Over',
    category: 'Body',
    description: 'Complete the postponed Workout A session.',
    xp: 25,
  },
  4: {
    id: 'workout-b-carried-over',
    title: 'Workout B — Carried Over',
    category: 'Body',
    description: 'Complete the postponed Workout B session.',
    xp: 25,
  },
  6: {
    id: 'workout-c-carried-over',
    title: 'Workout C — Carried Over',
    category: 'Body',
    description: 'Complete the postponed Workout C session.',
    xp: 25,
  },
};

const PREVIOUS_DAY_WORKOUT_TEMPLATE_IDS: Record<number, string> = {
  2: 'workout-a',
  4: 'workout-b',
  6: 'workout-c',
};

const KINGDOM_FREQUENCY_ORDER: KingdomChecklistFrequency[] = [
  'Weekly',
  'Every 2 Weeks',
  'Every 3 Weeks',
  'Monthly',
];

const KINGDOM_CHECKLIST_TEMPLATES: {
  id: string;
  title: string;
  frequency: KingdomChecklistFrequency;
}[] = [
  { id: 'laundry', title: 'Laundry', frequency: 'Weekly' },
  { id: 'vacuum-sweep', title: 'Vacuum / Sweep', frequency: 'Weekly' },
  { id: 'mop', title: 'Mop', frequency: 'Weekly' },
  { id: 'empty-bins', title: 'Empty Bins', frequency: 'Weekly' },
  {
    id: 'general-reset-20-30-min',
    title: 'General Reset 20-30 min',
    frequency: 'Weekly',
  },
  { id: 'fridge-check', title: 'Fridge Check', frequency: 'Weekly' },
  { id: 'grocery-support', title: 'Grocery Support', frequency: 'Weekly' },
  { id: 'change-sheets', title: 'Change Sheets', frequency: 'Every 2 Weeks' },
  {
    id: 'deep-bathroom-clean',
    title: 'Deep Bathroom Clean',
    frequency: 'Every 2 Weeks',
  },
  {
    id: 'mirrors-surfaces',
    title: 'Mirrors + Surfaces',
    frequency: 'Every 2 Weeks',
  },
  {
    id: 'full-fridge-clean',
    title: 'Full Fridge Clean',
    frequency: 'Every 3 Weeks',
  },
  {
    id: 'pantry-check',
    title: 'Pantry Check',
    frequency: 'Every 3 Weeks',
  },
  {
    id: 'decluttering-15-30-min',
    title: 'Decluttering 15-30 min',
    frequency: 'Every 3 Weeks',
  },
  {
    id: 'personal-budget-review',
    title: 'Personal Budget Review',
    frequency: 'Monthly',
  },
];

export const DEFAULT_QUEST_TEMPLATES: QuestTemplate[] = [
  ...DAILY_BASELINE_QUEST_TEMPLATES,
  ...Object.values(WEEKDAY_QUEST_TEMPLATES).flat(),
  ...Object.values(WORKOUT_CARRYOVER_TEMPLATES),
];

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getWeekStartDateString(date = new Date()) {
  const weekStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayOfWeek = weekStart.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);

  return getLocalDateString(weekStart);
}

export function getDefaultQuestsForDate(date: string): Quest[] {
  return getQuestTemplatesForDate(date).map((quest) => ({
    id: getQuestInstanceId(date, quest.id),
    templateId: quest.id,
    date,
    title: quest.title,
    category: quest.category,
    description: quest.description,
    xp: quest.xp,
    completed: false,
  }));
}

function getQuestTemplatesForDate(date: string) {
  const dayOfWeek = parseLocalDate(date).getDay();
  const scheduledQuests = WEEKDAY_QUEST_TEMPLATES[dayOfWeek] ?? [];

  return [...DAILY_BASELINE_QUEST_TEMPLATES, ...scheduledQuests];
}

export async function openGameDatabase(today = getLocalDateString()) {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await setupDatabase(db, today);
  return db;
}

export async function loadGameState(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
): Promise<GameState> {
  await createQuestsFromWeekStartThroughDateIfNeeded(db, today);
  await createKingdomChecklistForWeekIfNeeded(db, today);
  await rollOverShadowWeekIfNeeded(db, today);
  const weeklyBattle = await calculateCurrentWeekBattlePreview(db, today);
  const finalizedBattle = await getCurrentWeekFinalizedBattle(db, today);
  const activeKingdomWindowKeys = getActiveKingdomWindowKeys(today);

  const playerRow = await db.getFirstAsync<PlayerRow>(
    'SELECT id, total_xp, level FROM player WHERE id = ?',
    PLAYER_ID,
  );
  const questRows = await db.getAllAsync<QuestRow>(
    'SELECT id, template_id, date, title, category, description, xp_reward, completed FROM quests WHERE date = ? ORDER BY rowid ASC',
    today,
  );
  const shadowRow = await db.getFirstAsync<ShadowRow>(
    'SELECT id, name, class, description, current_power, max_power, week_start FROM shadow WHERE id = ?',
    SHADOW_ID,
  );
  const kingdomChecklistRows = await db.getAllAsync<KingdomChecklistRow>(
    `SELECT id, template_id, week_start, window_key, title, frequency, completed
    FROM kingdom_checklist
    WHERE window_key IN (${activeKingdomWindowKeys.map(() => '?').join(', ')})
    ORDER BY rowid ASC`,
    ...activeKingdomWindowKeys,
  );

  return {
    player: playerRow ? mapPlayerRow(playerRow) : DEFAULT_PLAYER,
    quests: questRows.map(mapQuestRow),
    shadow: shadowRow ? mapShadowRow(shadowRow) : DEFAULT_SHADOW,
    today,
    weeklyBattle,
    finalizedBattle,
    kingdomChecklist: kingdomChecklistRows.map(mapKingdomChecklistRow),
  };
}

export async function getCurrentWeekFinalizedBattle(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
): Promise<FinalizedBattleResult | null> {
  const weekStart = getWeekStartDateString(parseLocalDate(today));
  const row = await db.getFirstAsync<WeeklyResultRow>(
    'SELECT id, week_start, completion_rate, result, created_at FROM weekly_results WHERE week_start = ?',
    weekStart,
  );

  return row ? mapWeeklyResultRow(row) : null;
}

export async function calculateCurrentWeekBattlePreview(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
): Promise<WeeklyBattlePreview> {
  const weekStart = getWeekStartDateString(parseLocalDate(today));
  const weekEnd = getWeekEndDateString(weekStart);
  const dailyProgressRows = await db.getAllAsync<WeeklyDailyProgressRow>(
    `SELECT
      date,
      SUM(CASE WHEN completed = 1 THEN xp_reward ELSE 0 END) AS daily_progress
    FROM quests
    WHERE date >= ? AND date <= ?
    GROUP BY date`,
    weekStart,
    weekEnd,
  );
  const victoryDays = dailyProgressRows.filter(
    (row) => row.daily_progress >= 80,
  ).length;
  const strongDays = dailyProgressRows.filter(
    (row) => row.daily_progress >= 100 && row.daily_progress < 150,
  ).length;
  const legendaryDays = dailyProgressRows.filter(
    (row) => row.daily_progress >= 150,
  ).length;
  const completionRate = victoryDays / 7;
  const result = getWeeklyResult(victoryDays);

  return {
    weekStart,
    completionRate,
    result,
    flavorText: getWeeklyFlavorText(result),
    victoryDays,
    strongDays,
    legendaryDays,
  };
}

export async function toggleQuestInDatabase(
  db: SQLite.SQLiteDatabase,
  questId: string,
  today = getLocalDateString(),
) {
  await db.withTransactionAsync(async () => {
    const latestQuest = await db.getFirstAsync<QuestRow>(
      'SELECT id, template_id, date, title, xp_reward, completed FROM quests WHERE id = ? AND date = ?',
      questId,
      today,
    );
    const latestPlayer = await db.getFirstAsync<PlayerRow>(
      'SELECT id, total_xp, level FROM player WHERE id = ?',
      PLAYER_ID,
    );
    const latestShadow = await db.getFirstAsync<ShadowRow>(
      'SELECT id, name, class, description, current_power, max_power, week_start FROM shadow WHERE id = ?',
      SHADOW_ID,
    );

    if (!latestQuest || !latestPlayer || !latestShadow) {
      return;
    }

    const isCompleting = latestQuest.completed === 0;
    const xpChange = isCompleting
      ? latestQuest.xp_reward
      : -latestQuest.xp_reward;
    const nextTotalXp = Math.max(latestPlayer.total_xp + xpChange, 0);
    const nextLevel = getLevelForXp(nextTotalXp);
    const shadowDamage = getShadowDamage(latestQuest.xp_reward);
    const shadowPowerChange = isCompleting ? -shadowDamage : shadowDamage;
    const nextShadowPower = clamp(
      latestShadow.current_power + shadowPowerChange,
      0,
      latestShadow.max_power,
    );
    const nextCompleted = isCompleting ? 1 : 0;

    await db.runAsync(
      'UPDATE quests SET completed = ? WHERE id = ? AND date = ?',
      nextCompleted,
      questId,
      today,
    );
    await db.runAsync(
      `INSERT INTO player (id, total_xp, level) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        total_xp = excluded.total_xp,
        level = excluded.level`,
      PLAYER_ID,
      nextTotalXp,
      nextLevel,
    );
    await db.runAsync(
      'UPDATE shadow SET current_power = ? WHERE id = ?',
      nextShadowPower,
      SHADOW_ID,
    );
  });
}

export async function resetTodaysQuestsInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  await db.withTransactionAsync(async () => {
    const completedQuests = await db.getAllAsync<QuestRow>(
      'SELECT id, template_id, date, title, xp_reward, completed FROM quests WHERE date = ? AND completed = 1',
      today,
    );
    const latestPlayer = await db.getFirstAsync<PlayerRow>(
      'SELECT id, total_xp, level FROM player WHERE id = ?',
      PLAYER_ID,
    );
    const latestShadow = await db.getFirstAsync<ShadowRow>(
      'SELECT id, name, class, description, current_power, max_power, week_start FROM shadow WHERE id = ?',
      SHADOW_ID,
    );

    if (!latestPlayer || !latestShadow) {
      return;
    }

    const earnedToday = completedQuests.reduce(
      (total, quest) => total + quest.xp_reward,
      0,
    );
    const shadowDamageToday = completedQuests.reduce(
      (total, quest) => total + getShadowDamage(quest.xp_reward),
      0,
    );
    const nextTotalXp = Math.max(latestPlayer.total_xp - earnedToday, 0);
    const nextLevel = getLevelForXp(nextTotalXp);
    const nextShadowPower = clamp(
      latestShadow.current_power + shadowDamageToday,
      0,
      latestShadow.max_power,
    );

    await db.runAsync(
      'UPDATE quests SET completed = 0 WHERE date = ?',
      today,
    );
    await db.runAsync(
      `INSERT INTO player (id, total_xp, level) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        total_xp = excluded.total_xp,
        level = excluded.level`,
      PLAYER_ID,
      nextTotalXp,
      nextLevel,
    );
    await db.runAsync(
      'UPDATE shadow SET current_power = ? WHERE id = ?',
      nextShadowPower,
      SHADOW_ID,
    );
  });
}

export async function resetAllDataInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM player');
    await db.runAsync('DELETE FROM quests');
    await db.runAsync('DELETE FROM shadow');
    await db.runAsync('DELETE FROM weekly_results');
    await db.runAsync('DELETE FROM kingdom_checklist');

    await db.runAsync(
      'INSERT INTO player (id, total_xp, level) VALUES (?, ?, ?)',
      DEFAULT_PLAYER.id,
      DEFAULT_PLAYER.totalXp,
      DEFAULT_PLAYER.level,
    );
    await db.runAsync(
      'INSERT INTO shadow (id, name, class, description, current_power, max_power, week_start) VALUES (?, ?, ?, ?, ?, ?, ?)',
      DEFAULT_SHADOW.id,
      DEFAULT_SHADOW.name,
      DEFAULT_SHADOW.class,
      DEFAULT_SHADOW.description,
      DEFAULT_SHADOW.currentPower,
      DEFAULT_SHADOW.maxPower,
      getWeekStartDateString(parseLocalDate(today)),
    );

    for (const quest of await getQuestInstancesForDate(db, today)) {
      await db.runAsync(
        'INSERT INTO quests (id, template_id, date, title, category, description, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        quest.id,
        quest.templateId,
        quest.date,
        quest.title,
        quest.category,
        quest.description,
        quest.xp,
        quest.completed ? 1 : 0,
      );
    }

    await createKingdomChecklistForWeekIfNeeded(db, today);
  });

  await createKingdomChecklistForWeekIfNeeded(db, today);
}

export async function reseedQuestCatalogForDateInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM quests WHERE date = ?', today);

    for (const quest of await getQuestInstancesForDate(db, today)) {
      await db.runAsync(
        'INSERT INTO quests (id, template_id, date, title, category, description, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        quest.id,
        quest.templateId,
        quest.date,
        quest.title,
        quest.category,
        quest.description,
        quest.xp,
        quest.completed ? 1 : 0,
      );
    }
  });
}

export async function toggleKingdomChecklistItemInDatabase(
  db: SQLite.SQLiteDatabase,
  itemId: string,
  today = getLocalDateString(),
) {
  const activeKingdomWindowKeys = getActiveKingdomWindowKeys(today);
  const item = await db.getFirstAsync<KingdomChecklistRow>(
    `SELECT id, template_id, week_start, window_key, title, frequency, completed
    FROM kingdom_checklist
    WHERE id = ? AND window_key IN (${activeKingdomWindowKeys.map(() => '?').join(', ')})`,
    itemId,
    ...activeKingdomWindowKeys,
  );

  if (!item) {
    return;
  }

  await db.runAsync(
    'UPDATE kingdom_checklist SET completed = ? WHERE id = ? AND window_key = ?',
    item.completed === 1 ? 0 : 1,
    itemId,
    item.window_key,
  );
}

export async function resetKingdomChecklistForWeekInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  const activeKingdomWindowKeys = getActiveKingdomWindowKeys(today);
  await createKingdomChecklistForWeekIfNeeded(db, today);
  await db.runAsync(
    `UPDATE kingdom_checklist
    SET completed = 0
    WHERE window_key IN (${activeKingdomWindowKeys.map(() => '?').join(', ')})`,
    ...activeKingdomWindowKeys,
  );
}

export async function setShadowPowerInDatabase(
  db: SQLite.SQLiteDatabase,
  power: number,
) {
  const shadow = await db.getFirstAsync<ShadowRow>(
    'SELECT id, name, class, description, current_power, max_power, week_start FROM shadow WHERE id = ?',
    SHADOW_ID,
  );

  if (!shadow) {
    return;
  }

  const nextPower = clamp(power, 0, shadow.max_power);

  await db.runAsync(
    'UPDATE shadow SET current_power = ? WHERE id = ?',
    nextPower,
    SHADOW_ID,
  );
}

export async function finalizeCurrentWeekInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  const weeklyBattle = await calculateCurrentWeekBattlePreview(db, today);
  const id = getWeeklyResultId(weeklyBattle.weekStart);
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO weekly_results (id, week_start, completion_rate, result, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      completion_rate = excluded.completion_rate,
      result = excluded.result,
      created_at = excluded.created_at`,
    id,
    weeklyBattle.weekStart,
    weeklyBattle.completionRate,
    weeklyBattle.result,
    createdAt,
  );
}

export async function clearCurrentWeekResultInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  const weekStart = getWeekStartDateString(parseLocalDate(today));

  await db.runAsync(
    'DELETE FROM weekly_results WHERE week_start = ?',
    weekStart,
  );
}

export async function startNewWeekInDatabase(
  db: SQLite.SQLiteDatabase,
  today = getLocalDateString(),
) {
  const weekStart = getWeekStartDateString(parseLocalDate(today));

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE shadow SET current_power = ?, week_start = ? WHERE id = ?',
      DEFAULT_SHADOW.currentPower,
      weekStart,
      SHADOW_ID,
    );
    await db.runAsync(
      'DELETE FROM weekly_results WHERE week_start = ?',
      weekStart,
    );
  });
}

export function getXpProgress(totalXp: number) {
  return totalXp % XP_GOAL;
}

function getLevelForXp(totalXp: number) {
  return Math.floor(totalXp / XP_GOAL) + 1;
}

function getShadowDamage(xpReward: number) {
  return Math.floor(xpReward / 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function setupDatabase(db: SQLite.SQLiteDatabase, today: string) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS player (
      id TEXT PRIMARY KEY NOT NULL,
      total_xp INTEGER NOT NULL,
      level INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shadow (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      description TEXT NOT NULL,
      current_power INTEGER NOT NULL,
      max_power INTEGER NOT NULL,
      week_start TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_results (
      id TEXT PRIMARY KEY NOT NULL,
      week_start TEXT NOT NULL,
      completion_rate REAL NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS weekly_results_week_start_idx ON weekly_results (week_start);
    CREATE TABLE IF NOT EXISTS kingdom_checklist (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      window_key TEXT NOT NULL,
      title TEXT NOT NULL,
      frequency TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS kingdom_checklist_week_start_idx ON kingdom_checklist (week_start);
  `);

  await migrateQuestTableIfNeeded(db, today);
  await migrateShadowTableIfNeeded(db, today);
  await migrateKingdomChecklistTableIfNeeded(db);
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS kingdom_checklist_window_key_idx ON kingdom_checklist (window_key)',
  );

  await db.runAsync(
    'INSERT OR IGNORE INTO player (id, total_xp, level) VALUES (?, ?, ?)',
    DEFAULT_PLAYER.id,
    DEFAULT_PLAYER.totalXp,
    DEFAULT_PLAYER.level,
  );

  await db.runAsync(
    'INSERT OR IGNORE INTO shadow (id, name, class, description, current_power, max_power, week_start) VALUES (?, ?, ?, ?, ?, ?, ?)',
    DEFAULT_SHADOW.id,
    DEFAULT_SHADOW.name,
    DEFAULT_SHADOW.class,
    DEFAULT_SHADOW.description,
    DEFAULT_SHADOW.currentPower,
    DEFAULT_SHADOW.maxPower,
    getWeekStartDateString(parseLocalDate(today)),
  );

  await createQuestsFromWeekStartThroughDateIfNeeded(db, today);
  await createKingdomChecklistForWeekIfNeeded(db, today);
}

async function rollOverShadowWeekIfNeeded(
  db: SQLite.SQLiteDatabase,
  today: string,
) {
  const activeWeekStart = getWeekStartDateString(parseLocalDate(today));
  const shadow = await db.getFirstAsync<ShadowRow>(
    'SELECT id, name, class, description, current_power, max_power, week_start FROM shadow WHERE id = ?',
    SHADOW_ID,
  );

  if (!shadow) {
    return;
  }

  if (activeWeekStart > shadow.week_start) {
    await db.runAsync(
      'UPDATE shadow SET current_power = ?, week_start = ? WHERE id = ?',
      DEFAULT_SHADOW.currentPower,
      activeWeekStart,
      SHADOW_ID,
    );
  }
}

function mapPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    totalXp: row.total_xp,
    level: row.level,
  };
}

function mapQuestRow(row: QuestRow): Quest {
  return {
    id: row.id,
    templateId: row.template_id,
    date: row.date,
    title: row.title,
    category: row.category,
    description: row.description,
    xp: row.xp_reward,
    completed: row.completed === 1,
  };
}

function mapShadowRow(row: ShadowRow): Shadow {
  return {
    id: row.id,
    name: row.name,
    class: row.class,
    description: row.description,
    currentPower: row.current_power,
    maxPower: row.max_power,
    weekStart: row.week_start,
  };
}

function mapWeeklyResultRow(row: WeeklyResultRow): FinalizedBattleResult {
  return {
    id: row.id,
    weekStart: row.week_start,
    completionRate: row.completion_rate,
    result: row.result,
    flavorText: getWeeklyFlavorText(row.result),
    createdAt: row.created_at,
  };
}

function mapKingdomChecklistRow(row: KingdomChecklistRow): KingdomChecklistItem {
  return {
    id: row.id,
    templateId: row.template_id,
    weekStart: row.week_start,
    windowKey: row.window_key,
    title: row.title,
    frequency: row.frequency,
    completed: row.completed === 1,
  };
}

async function migrateQuestTableIfNeeded(
  db: SQLite.SQLiteDatabase,
  today: string,
) {
  const tableInfo = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(quests)',
  );
  const hasQuestTable = tableInfo.length > 0;
  const hasDateColumn = tableInfo.some((column) => column.name === 'date');
  const hasTemplateIdColumn = tableInfo.some(
    (column) => column.name === 'template_id',
  );

  if (!hasQuestTable) {
    await createQuestTable(db);
    return;
  }

  if (hasDateColumn && hasTemplateIdColumn) {
    await migrateQuestCatalogColumnsIfNeeded(db, tableInfo);
    return;
  }

  const legacyQuests = await db.getAllAsync<LegacyQuestRow>(
    'SELECT id, title, xp_reward, completed FROM quests ORDER BY rowid ASC',
  );

  await db.execAsync('DROP TABLE quests');
  await createQuestTable(db);

  for (const quest of legacyQuests) {
    await db.runAsync(
      'INSERT OR IGNORE INTO quests (id, template_id, date, title, category, description, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      getQuestInstanceId(today, quest.id),
      quest.id,
      today,
      quest.title,
      'Legacy',
      '',
      quest.xp_reward,
      quest.completed,
    );
  }
}

async function migrateQuestCatalogColumnsIfNeeded(
  db: SQLite.SQLiteDatabase,
  tableInfo: { name: string }[],
) {
  const hasCategoryColumn = tableInfo.some(
    (column) => column.name === 'category',
  );
  const hasDescriptionColumn = tableInfo.some(
    (column) => column.name === 'description',
  );

  if (!hasCategoryColumn) {
    await db.execAsync('ALTER TABLE quests ADD COLUMN category TEXT');
  }

  if (!hasDescriptionColumn) {
    await db.execAsync('ALTER TABLE quests ADD COLUMN description TEXT');
  }

  for (const quest of DEFAULT_QUEST_TEMPLATES) {
    await db.runAsync(
      'UPDATE quests SET category = ?, description = ? WHERE template_id = ? AND (category IS NULL OR description IS NULL)',
      quest.category,
      quest.description,
      quest.id,
    );
  }

  await db.runAsync(
    "UPDATE quests SET category = 'Legacy' WHERE category IS NULL",
  );
  await db.runAsync("UPDATE quests SET description = '' WHERE description IS NULL");
}

async function migrateShadowTableIfNeeded(
  db: SQLite.SQLiteDatabase,
  today: string,
) {
  const tableInfo = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(shadow)',
  );
  const hasShadowTable = tableInfo.length > 0;
  const hasWeekStartColumn = tableInfo.some(
    (column) => column.name === 'week_start',
  );

  if (!hasShadowTable || hasWeekStartColumn) {
    return;
  }

  const activeWeekStart = getWeekStartDateString(parseLocalDate(today));

  await db.execAsync('ALTER TABLE shadow ADD COLUMN week_start TEXT');
  await db.runAsync(
    'UPDATE shadow SET week_start = ? WHERE week_start IS NULL',
    activeWeekStart,
  );
}

async function migrateKingdomChecklistTableIfNeeded(db: SQLite.SQLiteDatabase) {
  const tableInfo = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(kingdom_checklist)',
  );
  const hasKingdomChecklistTable = tableInfo.length > 0;
  const hasWindowKeyColumn = tableInfo.some(
    (column) => column.name === 'window_key',
  );

  if (!hasKingdomChecklistTable) {
    return;
  }

  if (!hasWindowKeyColumn) {
    await db.execAsync('ALTER TABLE kingdom_checklist ADD COLUMN window_key TEXT');
  }

  const rowsToMigrate = await db.getAllAsync<KingdomChecklistRow>(
    `SELECT
      id,
      template_id,
      week_start,
      COALESCE(window_key, '') AS window_key,
      title,
      frequency,
      completed
    FROM kingdom_checklist
    WHERE window_key IS NULL OR window_key = ''`,
  );

  for (const row of rowsToMigrate) {
    const windowKey = getKingdomCadenceWindowKey(row.frequency, row.week_start);
    const nextId = getKingdomChecklistItemId(windowKey, row.template_id);
    const existingRow = await db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM kingdom_checklist WHERE id = ?',
      nextId,
    );

    if (existingRow) {
      await db.runAsync(
        'UPDATE kingdom_checklist SET completed = ? WHERE id = ?',
        existingRow.completed === 1 || row.completed === 1 ? 1 : 0,
        nextId,
      );
      await db.runAsync('DELETE FROM kingdom_checklist WHERE id = ?', row.id);
      continue;
    }

    await db.runAsync(
      'UPDATE kingdom_checklist SET id = ?, window_key = ? WHERE id = ?',
      nextId,
      windowKey,
      row.id,
    );
  }

  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS kingdom_checklist_window_key_idx ON kingdom_checklist (window_key)',
  );
}

async function createQuestTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      xp_reward INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS quests_date_idx ON quests (date);
  `);
}

async function createQuestsForDateIfNeeded(
  db: SQLite.SQLiteDatabase,
  date: string,
) {
  for (const quest of await getQuestInstancesForDate(db, date)) {
    await db.runAsync(
      'INSERT OR IGNORE INTO quests (id, template_id, date, title, category, description, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      quest.id,
      quest.templateId,
      quest.date,
      quest.title,
      quest.category,
      quest.description,
      quest.xp,
      quest.completed ? 1 : 0,
    );
  }
}

async function getQuestInstancesForDate(
  db: SQLite.SQLiteDatabase,
  date: string,
) {
  const quests = getDefaultQuestsForDate(date);
  const carryoverTemplate = await getCarryoverWorkoutTemplateForDate(db, date);

  if (!carryoverTemplate) {
    return quests;
  }

  return [
    ...quests,
    {
      id: getQuestInstanceId(date, carryoverTemplate.id),
      templateId: carryoverTemplate.id,
      date,
      title: carryoverTemplate.title,
      category: carryoverTemplate.category,
      description: carryoverTemplate.description,
      xp: carryoverTemplate.xp,
      completed: false,
    },
  ];
}

async function getCarryoverWorkoutTemplateForDate(
  db: SQLite.SQLiteDatabase,
  date: string,
) {
  const dayOfWeek = parseLocalDate(date).getDay();
  const previousWorkoutTemplateId =
    PREVIOUS_DAY_WORKOUT_TEMPLATE_IDS[dayOfWeek];

  if (!previousWorkoutTemplateId) {
    return null;
  }

  const previousDate = parseLocalDate(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateString = getLocalDateString(previousDate);
  const previousWorkout = await db.getFirstAsync<{ completed: number }>(
    'SELECT completed FROM quests WHERE date = ? AND template_id = ?',
    previousDateString,
    previousWorkoutTemplateId,
  );

  if (!previousWorkout || previousWorkout.completed === 1) {
    return null;
  }

  return WORKOUT_CARRYOVER_TEMPLATES[dayOfWeek] ?? null;
}

async function createQuestsFromWeekStartThroughDateIfNeeded(
  db: SQLite.SQLiteDatabase,
  today: string,
) {
  const weekStart = getWeekStartDateString(parseLocalDate(today));
  const currentDate = parseLocalDate(weekStart);
  const endDate = parseLocalDate(today);

  while (currentDate <= endDate) {
    await createQuestsForDateIfNeeded(db, getLocalDateString(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

async function createKingdomChecklistForWeekIfNeeded(
  db: SQLite.SQLiteDatabase,
  today: string,
) {
  const weekStart = getWeekStartDateString(parseLocalDate(today));

  for (const item of KINGDOM_CHECKLIST_TEMPLATES) {
    const windowKey = getKingdomCadenceWindowKey(item.frequency, today);

    await db.runAsync(
      'INSERT OR IGNORE INTO kingdom_checklist (id, template_id, week_start, window_key, title, frequency, completed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      getKingdomChecklistItemId(windowKey, item.id),
      item.id,
      weekStart,
      windowKey,
      item.title,
      item.frequency,
      0,
    );
  }
}

function getQuestInstanceId(date: string, templateId: string) {
  return `${date}:${templateId}`;
}

function getActiveKingdomWindowKeys(date: string) {
  return KINGDOM_FREQUENCY_ORDER.map((frequency) =>
    getKingdomCadenceWindowKey(frequency, date),
  );
}

function getKingdomCadenceWindowKey(
  frequency: KingdomChecklistFrequency,
  date: string,
) {
  switch (frequency) {
    case 'Weekly':
      return `kingdom:weekly:${getWeekStartDateString(parseLocalDate(date))}`;
    case 'Every 2 Weeks':
      return `kingdom:biweekly:${getMultiWeekWindowStartDateString(date, 2)}`;
    case 'Every 3 Weeks':
      return `kingdom:triweekly:${getMultiWeekWindowStartDateString(date, 3)}`;
    case 'Monthly':
      return `kingdom:monthly:${date.slice(0, 7)}`;
  }
}

function getMultiWeekWindowStartDateString(date: string, cadenceWeeks: number) {
  const weekStart = parseLocalDate(getWeekStartDateString(parseLocalDate(date)));
  const anchor = parseLocalDate(CADENCE_ANCHOR_WEEK_START);
  const weeksSinceAnchor = Math.floor(
    (weekStart.getTime() - anchor.getTime()) / ONE_WEEK_IN_MS,
  );
  const windowStartOffsetWeeks =
    Math.floor(weeksSinceAnchor / cadenceWeeks) * cadenceWeeks;
  const windowStart = new Date(anchor);
  windowStart.setDate(anchor.getDate() + windowStartOffsetWeeks * 7);

  return getLocalDateString(windowStart);
}

function getKingdomChecklistItemId(windowKey: string, templateId: string) {
  return `${windowKey}:${templateId}`;
}

function getWeekEndDateString(weekStart: string) {
  const weekEnd = parseLocalDate(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return getLocalDateString(weekEnd);
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function getWeeklyResult(victoryDays: number): WeeklyResult {
  if (victoryDays >= 5) {
    return 'Victory';
  }

  if (victoryDays === 4) {
    return 'Draw';
  }

  return 'Defeat';
}

function getWeeklyFlavorText(result: WeeklyResult) {
  switch (result) {
    case 'Victory':
      return 'Order held the line this week.';
    case 'Draw':
      return 'The Shadow remains, but so do you.';
    case 'Defeat':
      return 'Reset. Learn. Begin again.';
  }
}

function getWeeklyResultId(weekStart: string) {
  return `week:${weekStart}`;
}
