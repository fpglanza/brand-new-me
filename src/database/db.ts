import * as SQLite from 'expo-sqlite';

import type {
  GameState,
  FinalizedBattleResult,
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

type WeeklyQuestCountRow = {
  completed_count: number;
  total_count: number;
};

type WeeklyResultRow = {
  id: string;
  week_start: string;
  completion_rate: number;
  result: WeeklyResult;
  created_at: string;
};

export const XP_GOAL = 100;

const DATABASE_NAME = 'brand-new-me.db';
const PLAYER_ID = 'player';
const SHADOW_ID = 'shadow-steward';

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

export const DEFAULT_QUEST_TEMPLATES: QuestTemplate[] = [
  { id: 'workout', title: 'Workout', xp: 50 },
  { id: 'mobility', title: 'Mobility', xp: 25 },
  { id: 'walk', title: 'Walk', xp: 25 },
  { id: 'huel-breakfast', title: 'Huel Breakfast', xp: 15 },
  { id: 'side-project', title: 'Side Project', xp: 50 },
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
  return DEFAULT_QUEST_TEMPLATES.map((quest) => ({
    id: getQuestInstanceId(date, quest.id),
    templateId: quest.id,
    date,
    title: quest.title,
    xp: quest.xp,
    completed: false,
  }));
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
  await rollOverShadowWeekIfNeeded(db, today);
  const weeklyBattle = await calculateCurrentWeekBattlePreview(db, today);
  const finalizedBattle = await getCurrentWeekFinalizedBattle(db, today);

  const playerRow = await db.getFirstAsync<PlayerRow>(
    'SELECT id, total_xp, level FROM player WHERE id = ?',
    PLAYER_ID,
  );
  const questRows = await db.getAllAsync<QuestRow>(
    'SELECT id, template_id, date, title, xp_reward, completed FROM quests WHERE date = ? ORDER BY rowid ASC',
    today,
  );
  const shadowRow = await db.getFirstAsync<ShadowRow>(
    'SELECT id, name, class, description, current_power, max_power, week_start FROM shadow WHERE id = ?',
    SHADOW_ID,
  );

  return {
    player: playerRow ? mapPlayerRow(playerRow) : DEFAULT_PLAYER,
    quests: questRows.map(mapQuestRow),
    shadow: shadowRow ? mapShadowRow(shadowRow) : DEFAULT_SHADOW,
    today,
    weeklyBattle,
    finalizedBattle,
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
  const counts = await db.getFirstAsync<WeeklyQuestCountRow>(
    `SELECT
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_count,
      COUNT(*) AS total_count
    FROM quests
    WHERE date >= ? AND date <= ?`,
    weekStart,
    weekEnd,
  );
  const completedQuestCount = counts?.completed_count ?? 0;
  const totalQuestCount = counts?.total_count ?? 0;
  const completionRate =
    totalQuestCount > 0 ? completedQuestCount / totalQuestCount : 0;
  const result = getWeeklyResult(completionRate);

  return {
    weekStart,
    completionRate,
    result,
    flavorText: getWeeklyFlavorText(result),
    completedQuestCount,
    totalQuestCount,
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
      'UPDATE player SET total_xp = ?, level = ? WHERE id = ?',
      nextTotalXp,
      nextLevel,
      PLAYER_ID,
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
      'UPDATE player SET total_xp = ?, level = ? WHERE id = ?',
      nextTotalXp,
      nextLevel,
      PLAYER_ID,
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
    await db.execAsync(`
      DELETE FROM player;
      DELETE FROM quests;
      DELETE FROM shadow;
      DELETE FROM weekly_results;
    `);

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

    for (const quest of getDefaultQuestsForDate(today)) {
      await db.runAsync(
        'INSERT INTO quests (id, template_id, date, title, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?)',
        quest.id,
        quest.templateId,
        quest.date,
        quest.title,
        quest.xp,
        quest.completed ? 1 : 0,
      );
    }
  });
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
  `);

  await migrateQuestTableIfNeeded(db, today);
  await migrateShadowTableIfNeeded(db, today);

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
    return;
  }

  const legacyQuests = await db.getAllAsync<LegacyQuestRow>(
    'SELECT id, title, xp_reward, completed FROM quests ORDER BY rowid ASC',
  );

  await db.execAsync('DROP TABLE quests');
  await createQuestTable(db);

  for (const quest of legacyQuests) {
    await db.runAsync(
      'INSERT OR IGNORE INTO quests (id, template_id, date, title, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?)',
      getQuestInstanceId(today, quest.id),
      quest.id,
      today,
      quest.title,
      quest.xp_reward,
      quest.completed,
    );
  }
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

async function createQuestTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
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
  const existingQuest = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM quests WHERE date = ? LIMIT 1',
    date,
  );

  if (existingQuest) {
    return;
  }

  for (const quest of getDefaultQuestsForDate(date)) {
    await db.runAsync(
      'INSERT OR IGNORE INTO quests (id, template_id, date, title, xp_reward, completed) VALUES (?, ?, ?, ?, ?, ?)',
      quest.id,
      quest.templateId,
      quest.date,
      quest.title,
      quest.xp,
      quest.completed ? 1 : 0,
    );
  }
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

function getQuestInstanceId(date: string, templateId: string) {
  return `${date}:${templateId}`;
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

function getWeeklyResult(completionRate: number): WeeklyResult {
  if (completionRate >= 0.8) {
    return 'Victory';
  }

  if (completionRate >= 0.6) {
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
