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
  resetAllDataInDatabase,
  resetTodaysQuestsInDatabase,
  setShadowPowerInDatabase,
  startNewWeekInDatabase,
  toggleQuestInDatabase,
  XP_GOAL,
} from './src/database/db';
import type {
  FinalizedBattleResult,
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
  completedQuestCount: 0,
  totalQuestCount: 0,
};

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getLocalDateString(tomorrow);
}

function getNextMondayDateString() {
  const nextMonday = new Date();
  const dayOfWeek = nextMonday.getDay();
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday);

  return getLocalDateString(nextMonday);
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugDateOverride, setDebugDateOverride] = useState<string | null>(
    null,
  );
  const completingQuestIdsRef = useRef(new Set<string>());

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

  const setDebugDate = async (debugDate: string | null) => {
    const nextDate = debugDate ?? getLocalDateString();
    setDebugDateOverride(debugDate);

    if (db) {
      await reloadState(db, nextDate);
    } else {
      setToday(nextDate);
    }
  };

  const currentXp = getXpProgress(player.totalXp);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <PlayerHeader
          currentXp={currentXp}
          level={player.level}
          xpGoal={XP_GOAL}
        />

        <ShadowCard shadow={shadow} />

        <WeeklyBattlePreview weeklyBattle={weeklyBattle} />

        {finalizedBattle ? (
          <FinalizedBattleCard finalizedBattle={finalizedBattle} />
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TODAY'S QUESTS</Text>
          {debugDateOverride ? (
            <Text style={styles.debugDateLabel}>
              DEV DATE ACTIVE: {debugDateOverride}
            </Text>
          ) : null}
          <Text style={styles.sectionDate}>{today}</Text>

          <View style={styles.questList}>
            {isLoading ? (
              <QuestLoadingCard />
            ) : null}

            {!isLoading
              ? quests.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    onToggle={toggleQuest}
                    quest={quest}
                  />
                ))
              : null}
          </View>
        </View>

        <View style={styles.debugPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isDebugOpen }}
            onPress={() => setIsDebugOpen((isOpen) => !isOpen)}
            style={styles.debugHeader}
          >
            <Text style={styles.debugTitle}>DEV DEBUG</Text>
            <Text style={styles.debugToggle}>{isDebugOpen ? 'Hide' : 'Show'}</Text>
          </Pressable>

          {isDebugOpen ? (
            <View style={styles.debugActions}>
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
                  runDebugAction((database) =>
                    setShadowPowerInDatabase(database, 100),
                  )
                }
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>Set Shadow Power to 100</Text>
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
                <Text style={styles.debugButtonText}>Set Shadow Power to 0</Text>
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
                <Text style={styles.debugButtonText}>Clear Current Week Result</Text>
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
                onPress={() => setDebugDate(getLocalDateString())}
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>Set Debug Date: Today</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setDebugDate(getTomorrowDateString())}
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>Set Debug Date: Tomorrow</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setDebugDate(getNextMondayDateString())}
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>Set Debug Date: Next Monday</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setDebugDate(null)}
                style={styles.debugButton}
              >
                <Text style={styles.debugButtonText}>Clear Debug Date</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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
  questList: {
    gap: 12,
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
