import { useEffect, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FinalizedBattleCard } from './src/components/FinalizedBattleCard';
import { PlayerHeader } from './src/components/PlayerHeader';
import { QuestCard, QuestLoadingCard } from './src/components/QuestCard';
import { ShadowCard } from './src/components/ShadowCard';
import { WeeklyBattlePreview } from './src/components/WeeklyBattlePreview';
import {
  DEFAULT_PLAYER,
  DEFAULT_SHADOW,
  clearCurrentWeekResultInDatabase,
  finalizeCurrentWeekInDatabase,
  getDefaultQuestsForDate,
  getLocalDateString,
  getXpProgress,
  loadGameState,
  openGameDatabase,
  reseedQuestCatalogForDateInDatabase,
  resetAllDataInDatabase,
  resetKingdomChecklistForWeekInDatabase,
  resetTodaysQuestsInDatabase,
  setShadowPowerInDatabase,
  startNewWeekInDatabase,
  toggleKingdomChecklistItemInDatabase,
  toggleQuestInDatabase,
  XP_GOAL,
} from './src/database/db';
import type {
  FinalizedBattleResult,
  KingdomChecklistFrequency,
  KingdomChecklistItem,
  Player,
  Quest,
  Shadow,
} from './src/types/game';
import type { WeeklyBattlePreview as WeeklyBattlePreviewData } from './src/types/game';

const DEFAULT_WEEKLY_BATTLE: WeeklyBattlePreviewData = {
  weekStart: getLocalDateString(),
  completionRate: 0,
  result: 'Defeat',
  flavorText: 'Reset. Learn. Begin again.',
  victoryDays: 0,
  strongDays: 0,
  legendaryDays: 0,
};

const QUEST_CATEGORY_ORDER = [
  'Appearance',
  'Mind',
  'Fuel',
  'Body',
  'Purpose',
  'Stewardship',
  'Recovery',
];

const DAILY_PROGRESS_TARGET = 100;

type AppView = 'home' | 'quests' | 'hero' | 'shadow' | 'kingdom';

const HERO_STAT_PLACEHOLDERS = [
  'Body',
  'Mind',
  'Fuel',
  'Purpose',
  'Recovery',
  'Stewardship',
];

const KINGDOM_FREQUENCY_ORDER: KingdomChecklistFrequency[] = [
  'Weekly',
  'Every 2 Weeks',
  'Every 3 Weeks',
  'Monthly',
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseLocalDateString(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function addDaysToDateString(date: string, days: number) {
  const nextDate = parseLocalDateString(date);
  nextDate.setDate(nextDate.getDate() + days);

  return getLocalDateString(nextDate);
}

function getSimulatedDayNumber(startDate: string, currentDate: string) {
  const startTime = parseLocalDateString(startDate).getTime();
  const currentTime = parseLocalDateString(currentDate).getTime();

  return Math.round((currentTime - startTime) / DAY_IN_MS) + 1;
}

function getDailyProgressMessage(dailyProgress: number) {
  if (dailyProgress >= 150) {
    return 'Excellent day. Entropy routed.';
  }

  if (dailyProgress >= 100) {
    return 'Successful day. Order restored.';
  }

  if (dailyProgress >= 80) {
    return 'Good enough. Consistency held.';
  }

  return 'Keep pushing back entropy.';
}

export default function App() {
  const initialToday = getLocalDateString();
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [player, setPlayer] = useState<Player>(DEFAULT_PLAYER);
  const [today, setToday] = useState(initialToday);
  const [quests, setQuests] = useState<Quest[]>(
    getDefaultQuestsForDate(initialToday),
  );
  const [shadow, setShadow] = useState<Shadow>(DEFAULT_SHADOW);
  const [weeklyBattle, setWeeklyBattle] = useState<WeeklyBattlePreviewData>(
    DEFAULT_WEEKLY_BATTLE,
  );
  const [finalizedBattle, setFinalizedBattle] =
    useState<FinalizedBattleResult | null>(null);
  const [kingdomChecklist, setKingdomChecklist] = useState<
    KingdomChecklistItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('home');
  const [simulationStartDate, setSimulationStartDate] = useState(initialToday);
  const [debugDateOverride, setDebugDateOverride] = useState<string | null>(
    null,
  );
  const completingQuestIdsRef = useRef(new Set<string>());
  const togglingKingdomItemIdsRef = useRef(new Set<string>());

  useEffect(() => {
    let isMounted = true;

    async function loadPersistedState() {
      const currentDate = getLocalDateString();
      const database = await openGameDatabase(currentDate);
      const gameState = await loadGameState(database, currentDate);

      if (!isMounted) {
        return;
      }

      setDb(database);
      setPlayer(gameState.player);
      setToday(gameState.today);
      setQuests(gameState.quests);
      setShadow(gameState.shadow);
      setWeeklyBattle(gameState.weeklyBattle);
      setFinalizedBattle(gameState.finalizedBattle);
      setKingdomChecklist(gameState.kingdomChecklist);
      setIsLoading(false);
    }

    loadPersistedState().catch((error) => {
      console.error('Failed to load game state', error);
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleQuest = async (quest: Quest) => {
    if (!db || completingQuestIdsRef.current.has(quest.id)) {
      return;
    }

    completingQuestIdsRef.current.add(quest.id);

    try {
      await toggleQuestInDatabase(db, quest.id, today);
      const gameState = await loadGameState(db, today);
      setPlayer(gameState.player);
      setToday(gameState.today);
      setQuests(gameState.quests);
      setShadow(gameState.shadow);
      setWeeklyBattle(gameState.weeklyBattle);
      setFinalizedBattle(gameState.finalizedBattle);
      setKingdomChecklist(gameState.kingdomChecklist);
    } catch (error) {
      console.error('Failed to complete quest', error);
    } finally {
      completingQuestIdsRef.current.delete(quest.id);
    }
  };

  const reloadState = async (database: SQLiteDatabase, currentDate: string) => {
    const gameState = await loadGameState(database, currentDate);
    setPlayer(gameState.player);
    setToday(gameState.today);
    setQuests(gameState.quests);
    setShadow(gameState.shadow);
    setWeeklyBattle(gameState.weeklyBattle);
    setFinalizedBattle(gameState.finalizedBattle);
    setKingdomChecklist(gameState.kingdomChecklist);
  };

  const toggleKingdomChecklistItem = async (item: KingdomChecklistItem) => {
    if (!db || togglingKingdomItemIdsRef.current.has(item.id)) {
      return;
    }

    togglingKingdomItemIdsRef.current.add(item.id);

    try {
      await toggleKingdomChecklistItemInDatabase(db, item.id, today);
      await reloadState(db, today);
    } catch (error) {
      console.error('Failed to toggle kingdom checklist item', error);
    } finally {
      togglingKingdomItemIdsRef.current.delete(item.id);
    }
  };

  const runDebugAction = async (
    action: (database: SQLiteDatabase, currentDate: string) => Promise<void>,
  ) => {
    if (!db) {
      return;
    }

    try {
      await action(db, today);
      await reloadState(db, today);
    } catch (error) {
      console.error('Failed to run debug action', error);
    }
  };

  const loadDebugDate = async (nextDate: string) => {
    const realToday = getLocalDateString();
    setDebugDateOverride(nextDate === realToday ? null : nextDate);

    if (db) {
      await reloadState(db, nextDate);
    } else {
      setToday(nextDate);
    }
  };

  const moveDebugDate = async (days: number) => {
    const nextDate = addDaysToDateString(today, days);

    if (db) {
      await reloadState(db, today);
    }

    await loadDebugDate(nextDate);
  };

  const resetDebugDateToToday = async () => {
    const realToday = getLocalDateString();
    setSimulationStartDate(realToday);
    await loadDebugDate(realToday);
  };

  const currentXp = getXpProgress(player.totalXp);
  const dailyProgress = quests
    .filter((quest) => quest.completed)
    .reduce((total, quest) => total + quest.xp, 0);
  const dailyProgressPercent = `${Math.min(
    dailyProgress,
    DAILY_PROGRESS_TARGET,
  )}%` as `${number}%`;
  const dailyProgressMessage = getDailyProgressMessage(dailyProgress);
  const questGroups = QUEST_CATEGORY_ORDER.map((category) => ({
    category,
    quests: quests.filter((quest) => quest.category === category),
  })).filter((group) => group.quests.length > 0);
  const kingdomChecklistGroups = KINGDOM_FREQUENCY_ORDER.map((frequency) => ({
    frequency,
    items: kingdomChecklist.filter((item) => item.frequency === frequency),
  })).filter((group) => group.items.length > 0);
  const simulatedDayNumber = getSimulatedDayNumber(simulationStartDate, today);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {activeView === 'home' ? (
          <>
            <PlayerHeader
              currentXp={currentXp}
              level={player.level}
              totalXp={player.totalXp}
              xpGoal={XP_GOAL}
            />

            {isDebugOpen ? (
              <View style={styles.simulatedDayBanner}>
                <Text style={styles.simulatedDayTitle}>
                  Day {simulatedDayNumber}
                </Text>
                <Text style={styles.simulatedDayDate}>
                  Current Test Date: {today}
                </Text>
              </View>
            ) : null}

            <View style={styles.dailyProgressCard}>
              <View style={styles.dailyProgressHeader}>
                <Text style={styles.dailyProgressTitle}>DAILY PROGRESS</Text>
                <Text style={styles.dailyProgressValue}>
                  {dailyProgress} / {DAILY_PROGRESS_TARGET}
                </Text>
              </View>
              <View style={styles.dailyProgressTrack}>
                <View
                  style={[
                    styles.dailyProgressFill,
                    { width: dailyProgressPercent },
                  ]}
                />
              </View>
              <Text style={styles.dailyProgressMessage}>
                {dailyProgressMessage}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('hero')}
              style={styles.characterStage}
            >
              <View style={styles.pixelHero}>
                <View style={styles.pixelHead} />
                <View style={styles.pixelBody} />
                <View style={styles.pixelLegs} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('quests')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Start Quest</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('kingdom')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Protect the Kingdom</Text>
            </Pressable>

            <WeeklyBattlePreview
              onPress={() => setActiveView('shadow')}
              weeklyBattle={weeklyBattle}
            />

            <View style={styles.debugPanel}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isDebugOpen }}
                onPress={() => setIsDebugOpen((isOpen) => !isOpen)}
                style={styles.debugHeader}
              >
                <Text style={styles.debugTitle}>DEV DEBUG</Text>
                <Text style={styles.debugToggle}>
                  {isDebugOpen ? 'Hide' : 'Show'}
                </Text>
              </Pressable>

              {isDebugOpen ? (
                <View style={styles.debugActions}>
                  <View style={styles.debugMetaCard}>
                    <Text style={styles.debugMetaText}>
                      Simulated Day: Day {simulatedDayNumber}
                    </Text>
                    <Text style={styles.debugMetaText}>
                      Current Test Date: {today}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        resetTodaysQuestsInDatabase(database, currentDate),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Reset Today's Quests</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        reseedQuestCatalogForDateInDatabase(
                          database,
                          currentDate,
                        ),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Reseed Quest Catalog</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        resetAllDataInDatabase(database, currentDate),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Reset All Data</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        resetKingdomChecklistForWeekInDatabase(
                          database,
                          currentDate,
                        ),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>
                      Reset Kingdom Checklist
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database) =>
                        setShadowPowerInDatabase(database, 100),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>
                      Set Shadow Power to 100
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database) =>
                        setShadowPowerInDatabase(database, 0),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>
                      Set Shadow Power to 0
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        finalizeCurrentWeekInDatabase(database, currentDate),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Finalize Current Week</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        clearCurrentWeekResultInDatabase(database, currentDate),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>
                      Clear Current Week Result
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        startNewWeekInDatabase(database, currentDate),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Start New Week</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => moveDebugDate(-1)}
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Previous Day</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => moveDebugDate(1)}
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Next Day</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={resetDebugDateToToday}
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Reset To Today</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {activeView === 'quests' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('home')}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TODAY'S QUESTS</Text>
              {debugDateOverride ? (
                <Text style={styles.debugDateLabel}>
                  DEV DATE ACTIVE: {debugDateOverride}
                </Text>
              ) : null}
              <Text style={styles.sectionDate}>{today}</Text>

              <View style={styles.questList}>
                {isLoading ? <QuestLoadingCard /> : null}

                {!isLoading
                  ? questGroups.map((group) => (
                      <View key={group.category} style={styles.questGroupCard}>
                        <Text style={styles.questGroupTitle}>
                          {group.category.toUpperCase()}
                        </Text>
                        <View style={styles.questGroupList}>
                          {group.quests.map((quest) => (
                            <QuestCard
                              key={quest.id}
                              onToggle={toggleQuest}
                              quest={quest}
                            />
                          ))}
                        </View>
                      </View>
                    ))
                  : null}
              </View>
            </View>
          </>
        ) : null}

        {activeView === 'kingdom' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('home')}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PROTECT THE KINGDOM</Text>
              <Text style={styles.kingdomSubtitle}>
                Keep the realm from falling into disorder.
              </Text>
              <Text style={styles.sectionDate}>
                Week of {weeklyBattle.weekStart}
              </Text>

              <View style={styles.questList}>
                {kingdomChecklistGroups.map((group) => (
                  <View key={group.frequency} style={styles.questGroupCard}>
                    <Text style={styles.questGroupTitle}>
                      {group.frequency.toUpperCase()}
                    </Text>
                    <View style={styles.questGroupList}>
                      {group.items.map((item) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ checked: item.completed }}
                          key={item.id}
                          onPress={() => toggleKingdomChecklistItem(item)}
                          style={[
                            styles.kingdomChecklistRow,
                            item.completed
                              ? styles.kingdomChecklistRowCompleted
                              : null,
                          ]}
                        >
                          <View
                            style={[
                              styles.kingdomCheckmark,
                              item.completed
                                ? styles.kingdomCheckmarkCompleted
                                : null,
                            ]}
                          >
                            <Text style={styles.kingdomCheckmarkText}>
                              {item.completed ? '✓' : ''}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.kingdomChecklistTitle,
                              item.completed
                                ? styles.kingdomChecklistTitleCompleted
                                : null,
                            ]}
                          >
                            {item.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {activeView === 'hero' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('home')}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <Text style={styles.modalTitle}>HERO PROGRESS</Text>
            <View style={styles.characterStage}>
              <View style={styles.pixelHero}>
                <View style={styles.pixelHead} />
                <View style={styles.pixelBody} />
                <View style={styles.pixelLegs} />
              </View>
            </View>

            <View style={styles.heroProgressCard}>
              <Text style={styles.heroProgressTitle}>HERO XP</Text>
              <Text style={styles.heroProgressValue}>Level {player.level}</Text>
              <Text style={styles.heroProgressMeta}>
                Total XP: {player.totalXp}
              </Text>
            </View>

            <View style={styles.heroProgressCard}>
              <Text style={styles.heroProgressTitle}>STATS</Text>
              {HERO_STAT_PLACEHOLDERS.map((stat) => (
                <View key={stat} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat}</Text>
                  <Text style={styles.statValue}>Coming soon</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {activeView === 'shadow' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('home')}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <Text style={styles.modalTitle}>SHADOW BATTLE</Text>
            <ShadowCard shadow={shadow} />
            <WeeklyBattlePreview weeklyBattle={weeklyBattle} />
            {finalizedBattle ? (
              <FinalizedBattleCard finalizedBattle={finalizedBattle} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#171923',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  modalTitle: {
    color: '#F4F1DE',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#F4F1DE',
    fontSize: 13,
    fontWeight: '900',
  },
  characterStage: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 176,
    padding: 18,
  },
  pixelHero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixelHead: {
    backgroundColor: '#F4F1DE',
    borderColor: '#F6C453',
    borderRadius: 6,
    borderWidth: 2,
    height: 46,
    width: 46,
  },
  pixelBody: {
    backgroundColor: '#55D187',
    borderColor: '#171923',
    borderRadius: 4,
    borderWidth: 2,
    height: 58,
    marginTop: 4,
    width: 64,
  },
  pixelLegs: {
    backgroundColor: '#A970FF',
    borderRadius: 4,
    height: 28,
    marginTop: 4,
    width: 52,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F6C453',
    borderRadius: 10,
    marginBottom: 10,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#171923',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#A970FF',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#F4F1DE',
    fontSize: 15,
    fontWeight: '900',
  },
  heroProgressCard: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  heroProgressTitle: {
    color: '#A970FF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroProgressValue: {
    color: '#F4F1DE',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroProgressMeta: {
    color: '#F6C453',
    fontSize: 15,
    fontWeight: '800',
  },
  statRow: {
    alignItems: 'center',
    borderTopColor: '#3E4661',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  statLabel: {
    color: '#F4F1DE',
    fontSize: 14,
    fontWeight: '800',
  },
  statValue: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    color: '#F4F1DE',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionDate: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 14,
  },
  debugDateLabel: {
    color: '#F6C453',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  kingdomSubtitle: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  kingdomChecklistRow: {
    alignItems: 'center',
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  kingdomChecklistRowCompleted: {
    borderColor: '#55D187',
  },
  kingdomCheckmark: {
    alignItems: 'center',
    borderColor: '#3E4661',
    borderRadius: 7,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  kingdomCheckmarkCompleted: {
    backgroundColor: '#55D187',
    borderColor: '#55D187',
  },
  kingdomCheckmarkText: {
    color: '#171923',
    fontSize: 16,
    fontWeight: '900',
  },
  kingdomChecklistTitle: {
    color: '#F4F1DE',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  kingdomChecklistTitleCompleted: {
    color: '#55D187',
  },
  dailyProgressCard: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  dailyProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dailyProgressTitle: {
    color: '#F4F1DE',
    fontSize: 13,
    fontWeight: '900',
  },
  dailyProgressValue: {
    color: '#F6C453',
    fontSize: 18,
    fontWeight: '900',
  },
  dailyProgressTrack: {
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    height: 14,
    overflow: 'hidden',
  },
  dailyProgressFill: {
    backgroundColor: '#55D187',
    borderRadius: 8,
    height: '100%',
  },
  dailyProgressMessage: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  simulatedDayBanner: {
    backgroundColor: '#242938',
    borderColor: '#F6C453',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  simulatedDayTitle: {
    color: '#F6C453',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  simulatedDayDate: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
  },
  questList: {
    gap: 14,
  },
  questGroupCard: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  questGroupTitle: {
    color: '#A970FF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  questGroupList: {
    gap: 10,
  },
  debugPanel: {
    borderColor: '#3E4661',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 24,
    padding: 12,
  },
  debugHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debugTitle: {
    color: '#A970FF',
    fontSize: 13,
    fontWeight: '900',
  },
  debugToggle: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
  },
  debugActions: {
    gap: 8,
    marginTop: 12,
  },
  debugMetaCard: {
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  debugMetaText: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
  },
  debugButton: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  debugButtonText: {
    color: '#F4F1DE',
    fontSize: 13,
    fontWeight: '800',
  },
});
