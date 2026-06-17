import { useEffect, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DarkEmpressCard } from './src/components/DarkEmpressCard';
import { FinalizedBattleCard } from './src/components/FinalizedBattleCard';
import { HeroSprite } from './src/components/HeroSprite';
import { QuestCard, QuestLoadingCard } from './src/components/QuestCard';
import { WeeklyBattlePreview } from './src/components/WeeklyBattlePreview';
import {
  BONUS_EFFORT_TEMPLATES,
  DEFAULT_HERO_ATTRIBUTES,
  DEFAULT_PLAYER,
  DEFAULT_SHADOW,
  clearCurrentWeekResultInDatabase,
  completeBonusQuestInDatabase,
  finalizeCurrentWeekInDatabase,
  getDefaultQuestsForDate,
  getLocalDateString,
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
  HeroAttributes,
  KingdomChecklistFrequency,
  KingdomChecklistItem,
  Player,
  Quest,
  QuestTemplate,
  Shadow,
} from './src/types/game';
import type { WeeklyBattlePreview as WeeklyBattlePreviewData } from './src/types/game';

const DEFAULT_WEEKLY_BATTLE: WeeklyBattlePreviewData = {
  weekStart: getLocalDateString(),
  completionRate: 0,
  result: 'Defeat',
  flavorText:
    'The Dark Empress is displeased.\n\nEntropy spreads through the kingdom.',
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
const HERO_XP_TOAST_DURATION_MS = 1500;
const HERO_XP_ENTRY_ANIMATION_MS = 1000;
const DAILY_PROGRESS_ENTRY_ANIMATION_MS = 800;
const HERO_ATTRIBUTE_ENTRY_ANIMATION_MS = 850;
const LEVEL_UP_OVERLAY_DURATION_MS = 2600;

type AppView = 'home' | 'quests' | 'hero' | 'shadow' | 'kingdom';

type LevelUpEvent = {
  attributeGains: AttributeGainDisplay[];
  currentTitle: string;
  newTitle: string;
  previousLevel: number;
  nextLevel: number;
};

type AttributeGainDisplay = {
  label: string;
  value: number;
};

type HeroAttributeKey = 'body' | 'mind' | 'purpose';

const HERO_ATTRIBUTE_KEYS: {
  key: HeroAttributeKey;
  label: string;
}[] = [
  { key: 'body', label: 'Body' },
  { key: 'mind', label: 'Mind' },
  { key: 'purpose', label: 'Purpose' },
];
const HERO_ATTRIBUTE_MILESTONES = [100, 500, 1000, 2500, 5000];

const KINGDOM_FREQUENCY_ORDER: KingdomChecklistFrequency[] = [
  'Weekly',
  'Every 2 Weeks',
  'Every 3 Weeks',
  'Monthly',
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

function getHomeDateParts(date: string) {
  const localDate = parseLocalDateString(date);

  return {
    weekday: WEEKDAY_LABELS[localDate.getDay()],
    fullDate: `${localDate.getDate()} ${
      MONTH_LABELS[localDate.getMonth()]
    } ${localDate.getFullYear()}`,
  };
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

function getHeroTitle(level: number) {
  if (level >= 20) {
    return 'Entropy Breaker';
  }

  if (level >= 15) {
    return 'Kingdom Builder';
  }

  if (level >= 10) {
    return 'Shadow Hunter';
  }

  if (level >= 5) {
    return 'Disciplined Wanderer';
  }

  return 'Novice Adventurer';
}

function getHeroPath(level: number) {
  if (level >= 20) {
    return 'Path: Breaking Entropy';
  }

  if (level >= 15) {
    return 'Path: Protecting the Kingdom';
  }

  if (level >= 10) {
    return 'Path: Hunting the Shadow';
  }

  if (level >= 5) {
    return 'Path: Building Momentum';
  }

  return 'Path: Reclaiming Order';
}

function getHeroXpProgressPercentValue(player: Player) {
  const currentLevelXp = player.totalXp - (player.level - 1) * XP_GOAL;

  return Math.min(Math.max((currentLevelXp / XP_GOAL) * 100, 0), 100);
}

function getLevelRecapAttributeGains(
  previousHeroAttributes: HeroAttributes,
  nextHeroAttributes: HeroAttributes,
): AttributeGainDisplay[] {
  const levelStartAttributes = {
    body: previousHeroAttributes.levelStartBody,
    mind: previousHeroAttributes.levelStartMind,
    purpose: previousHeroAttributes.levelStartPurpose,
  };

  return HERO_ATTRIBUTE_KEYS.map((attribute) => ({
    label: attribute.label,
    value: Math.max(
      nextHeroAttributes[attribute.key] - levelStartAttributes[attribute.key],
      0,
    ),
  })).filter((attribute) => attribute.value > 0);
}

function getHeroAttributeMilestone(value: number) {
  const baseMilestone = HERO_ATTRIBUTE_MILESTONES.find(
    (milestone) => value <= milestone,
  );

  if (baseMilestone) {
    return baseMilestone;
  }

  return Math.ceil(value / 5000) * 5000;
}

export default function App() {
  const initialToday = getLocalDateString();
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [player, setPlayer] = useState<Player>(DEFAULT_PLAYER);
  const [heroAttributes, setHeroAttributes] = useState<HeroAttributes>(
    DEFAULT_HERO_ATTRIBUTES,
  );
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
  const [isBonusPickerOpen, setIsBonusPickerOpen] = useState(false);
  const [simulationStartDate, setSimulationStartDate] = useState(initialToday);
  const [debugDateOverride, setDebugDateOverride] = useState<string | null>(
    null,
  );
  const [xpToastAmount, setXpToastAmount] = useState<number | null>(null);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const completingQuestIdsRef = useRef(new Set<string>());
  const togglingKingdomItemIdsRef = useRef(new Set<string>());
  const heroXpProgressAnim = useRef(new Animated.Value(0)).current;
  const dailyProgressAnim = useRef(new Animated.Value(0)).current;
  const heroAttributeAnim = useRef(new Animated.Value(0)).current;
  const xpToastOpacity = useRef(new Animated.Value(0)).current;
  const xpToastTranslateY = useRef(new Animated.Value(12)).current;
  const levelUpOpacity = useRef(new Animated.Value(0)).current;
  const xpToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPlayerRef = useRef<Player>(DEFAULT_PLAYER);

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
      previousPlayerRef.current = gameState.player;
      setPlayer(gameState.player);
      setHeroAttributes(gameState.heroAttributes);
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

  useEffect(() => {
    const previousPlayer = previousPlayerRef.current;
    const nextPercent = getHeroXpProgressPercentValue(player);

    heroXpProgressAnim.stopAnimation();

    if (player.level > previousPlayer.level) {
      Animated.sequence([
        Animated.timing(heroXpProgressAnim, {
          duration: 450,
          toValue: 100,
          useNativeDriver: false,
        }),
        Animated.timing(heroXpProgressAnim, {
          duration: 1,
          toValue: 0,
          useNativeDriver: false,
        }),
        Animated.timing(heroXpProgressAnim, {
          duration: 500,
          toValue: nextPercent,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.timing(heroXpProgressAnim, {
        duration: 500,
        toValue: nextPercent,
        useNativeDriver: false,
      }).start();
    }

    previousPlayerRef.current = player;
  }, [heroXpProgressAnim, player]);

  useEffect(() => {
    if (isLoading || (activeView !== 'home' && activeView !== 'hero')) {
      return;
    }

    heroXpProgressAnim.stopAnimation();
    heroXpProgressAnim.setValue(0);
    Animated.timing(heroXpProgressAnim, {
      duration: HERO_XP_ENTRY_ANIMATION_MS,
      toValue: getHeroXpProgressPercentValue(player),
      useNativeDriver: false,
    }).start();
  }, [
    activeView,
    heroXpProgressAnim,
    isLoading,
    player.level,
    player.totalXp,
  ]);

  useEffect(() => {
    if (isLoading || activeView !== 'home') {
      return;
    }

    const nextDailyProgress = quests
      .filter((quest) => quest.completed)
      .reduce((total, quest) => total + quest.xp, 0);

    dailyProgressAnim.stopAnimation();
    dailyProgressAnim.setValue(0);
    Animated.timing(dailyProgressAnim, {
      duration: DAILY_PROGRESS_ENTRY_ANIMATION_MS,
      toValue: Math.min(nextDailyProgress, DAILY_PROGRESS_TARGET),
      useNativeDriver: false,
    }).start();
  }, [activeView, dailyProgressAnim, isLoading, quests, today]);

  useEffect(() => {
    if (isLoading || activeView !== 'hero') {
      return;
    }

    heroAttributeAnim.stopAnimation();
    heroAttributeAnim.setValue(0);
    Animated.timing(heroAttributeAnim, {
      duration: HERO_ATTRIBUTE_ENTRY_ANIMATION_MS,
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [
    activeView,
    heroAttributeAnim,
    heroAttributes.body,
    heroAttributes.mind,
    heroAttributes.purpose,
    isLoading,
  ]);

  useEffect(() => {
    return () => {
      if (xpToastTimeoutRef.current) {
        clearTimeout(xpToastTimeoutRef.current);
      }

      if (levelUpTimeoutRef.current) {
        clearTimeout(levelUpTimeoutRef.current);
      }
    };
  }, []);

  const showXpToast = (xpAmount: number) => {
    if (xpAmount <= 0) {
      return;
    }

    if (xpToastTimeoutRef.current) {
      clearTimeout(xpToastTimeoutRef.current);
    }

    setXpToastAmount(xpAmount);
    xpToastOpacity.stopAnimation();
    xpToastTranslateY.stopAnimation();
    xpToastOpacity.setValue(0);
    xpToastTranslateY.setValue(12);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(xpToastOpacity, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(950),
        Animated.timing(xpToastOpacity, {
          duration: 320,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(xpToastTranslateY, {
        duration: HERO_XP_TOAST_DURATION_MS,
        toValue: -8,
        useNativeDriver: true,
      }),
    ]).start();

    xpToastTimeoutRef.current = setTimeout(() => {
      setXpToastAmount(null);
    }, HERO_XP_TOAST_DURATION_MS);
  };

  const showLevelUpOverlay = (
    previousLevel: number,
    nextLevel: number,
    attributeGains: AttributeGainDisplay[],
  ) => {
    if (nextLevel <= previousLevel) {
      return;
    }

    if (levelUpTimeoutRef.current) {
      clearTimeout(levelUpTimeoutRef.current);
    }

    setLevelUpEvent({
      attributeGains,
      currentTitle: getHeroTitle(previousLevel),
      newTitle: getHeroTitle(nextLevel),
      previousLevel,
      nextLevel,
    });
    levelUpOpacity.stopAnimation();
    levelUpOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(levelUpOpacity, {
        duration: 250,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(1900),
      Animated.timing(levelUpOpacity, {
        duration: 350,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    levelUpTimeoutRef.current = setTimeout(() => {
      setLevelUpEvent(null);
    }, LEVEL_UP_OVERLAY_DURATION_MS);
  };

  const showQuestCompletionFeedback = (
    previousPlayer: Player,
    nextPlayer: Player,
    xpAmount: number,
    attributeGains: AttributeGainDisplay[],
  ) => {
    showXpToast(xpAmount);
    showLevelUpOverlay(previousPlayer.level, nextPlayer.level, attributeGains);
  };

  const toggleQuest = async (quest: Quest) => {
    if (!db || completingQuestIdsRef.current.has(quest.id)) {
      return;
    }

    completingQuestIdsRef.current.add(quest.id);

    try {
      const previousPlayer = player;
      const previousHeroAttributes = heroAttributes;
      await toggleQuestInDatabase(db, quest.id, today);
      const gameState = await loadGameState(db, today);
      setPlayer(gameState.player);
      setHeroAttributes(gameState.heroAttributes);
      setToday(gameState.today);
      setQuests(gameState.quests);
      setShadow(gameState.shadow);
      setWeeklyBattle(gameState.weeklyBattle);
      setFinalizedBattle(gameState.finalizedBattle);
      setKingdomChecklist(gameState.kingdomChecklist);

      if (!quest.completed && gameState.player.totalXp > previousPlayer.totalXp) {
        showQuestCompletionFeedback(
          previousPlayer,
          gameState.player,
          quest.xp,
          getLevelRecapAttributeGains(
            previousHeroAttributes,
            gameState.heroAttributes,
          ),
        );
      }
    } catch (error) {
      console.error('Failed to complete quest', error);
    } finally {
      completingQuestIdsRef.current.delete(quest.id);
    }
  };

  const reloadState = async (database: SQLiteDatabase, currentDate: string) => {
    const gameState = await loadGameState(database, currentDate);
    setPlayer(gameState.player);
    setHeroAttributes(gameState.heroAttributes);
    setToday(gameState.today);
    setQuests(gameState.quests);
    setShadow(gameState.shadow);
    setWeeklyBattle(gameState.weeklyBattle);
    setFinalizedBattle(gameState.finalizedBattle);
    setKingdomChecklist(gameState.kingdomChecklist);

    return gameState;
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

  const addBonusEffort = async (questTemplate: QuestTemplate) => {
    if (!db) {
      return;
    }

    try {
      const previousPlayer = player;
      const previousHeroAttributes = heroAttributes;
      await completeBonusQuestInDatabase(db, questTemplate.id, today);
      setIsBonusPickerOpen(false);
      const gameState = await reloadState(db, today);

      if (gameState.player.totalXp > previousPlayer.totalXp) {
        showQuestCompletionFeedback(
          previousPlayer,
          gameState.player,
          questTemplate.xp,
          getLevelRecapAttributeGains(
            previousHeroAttributes,
            gameState.heroAttributes,
          ),
        );
      }
    } catch (error) {
      console.error('Failed to add bonus effort', error);
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

  const heroTitle = getHeroTitle(player.level);
  const heroPath = getHeroPath(player.level);
  const homeDate = getHomeDateParts(today);
  const currentLevelXp = player.totalXp - (player.level - 1) * XP_GOAL;
  const heroXpProgressWidth = heroXpProgressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const dailyProgress = quests
    .filter((quest) => quest.completed)
    .reduce((total, quest) => total + quest.xp, 0);
  const dailyProgressWidth = dailyProgressAnim.interpolate({
    inputRange: [0, DAILY_PROGRESS_TARGET],
    outputRange: ['0%', '100%'],
  });
  const dailyProgressMessage = getDailyProgressMessage(dailyProgress);
  const questGroups = QUEST_CATEGORY_ORDER.map((category) => ({
    category,
    quests: quests.filter((quest) => quest.category === category),
  })).filter((group) => group.quests.length > 0);
  const todaysQuestTemplateIds = new Set(
    quests.map((quest) => quest.templateId),
  );
  const availableBonusEfforts = BONUS_EFFORT_TEMPLATES.filter(
    (questTemplate) => !todaysQuestTemplateIds.has(questTemplate.id),
  );
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
            <View style={styles.homeDateBlock}>
              <Text style={styles.homeDateWeekday}>{homeDate.weekday}</Text>
              <Text style={styles.homeDateFull}>{homeDate.fullDate}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('hero')}
              style={styles.heroSpriteCard}
            >
              <Text style={styles.heroTitle}>
                {heroTitle.toUpperCase()}
              </Text>
              <Text style={styles.heroPath}>{heroPath}</Text>
              <HeroSprite size={160} />
              <Text style={styles.homeHeroLevel}>Level {player.level}</Text>
              <Text style={styles.homeHeroTotalXp}>
                Total XP: {player.totalXp}
              </Text>
              <View style={styles.heroXpTrack}>
                <Animated.View
                  style={[
                    styles.heroXpFill,
                    { width: heroXpProgressWidth },
                  ]}
                />
              </View>
              <Text style={styles.homeHeroXpMeta}>
                {currentLevelXp} / {XP_GOAL}
              </Text>
              <Text style={styles.heroSpriteHint}>View Hero Progress</Text>
            </Pressable>

            <View style={styles.homeActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('quests')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>START QUEST</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('kingdom')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  PROTECT THE KINGDOM
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('shadow')}
                style={styles.shadowActionButton}
              >
                <Text style={styles.shadowActionButtonText}>
                  WEEKLY CHALLENGE
                </Text>
              </Pressable>
            </View>

            <View style={styles.dailyProgressCard}>
              <View style={styles.dailyProgressHeader}>
                <Text style={styles.dailyProgressTitle}>DAILY PROGRESS</Text>
                <Text style={styles.dailyProgressValue}>
                  {dailyProgress} / {DAILY_PROGRESS_TARGET}
                </Text>
              </View>
              <View style={styles.dailyProgressTrack}>
                <Animated.View
                  style={[
                    styles.dailyProgressFill,
                    { width: dailyProgressWidth },
                  ]}
                />
              </View>
              <Text style={styles.dailyProgressMessage}>
                {dailyProgressMessage}
              </Text>
            </View>

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
                      Simulation Index: {simulatedDayNumber}
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

              {!isLoading ? (
                <View style={styles.bonusEffortCard}>
                  <Text style={styles.bonusEffortTitle}>BONUS EFFORT</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setIsBonusPickerOpen((isOpen) => !isOpen)
                    }
                    style={styles.bonusEffortButton}
                  >
                    <Text style={styles.bonusEffortButtonText}>
                      + Add completed activity
                    </Text>
                  </Pressable>

                  {isBonusPickerOpen ? (
                    <View style={styles.bonusOptionList}>
                      {availableBonusEfforts.length > 0 ? (
                        availableBonusEfforts.map((questTemplate) => (
                          <Pressable
                            accessibilityRole="button"
                            key={questTemplate.id}
                            onPress={() => addBonusEffort(questTemplate)}
                            style={styles.bonusOption}
                          >
                            <View style={styles.bonusOptionTextBlock}>
                              <Text style={styles.bonusOptionTitle}>
                                {questTemplate.title}
                              </Text>
                              <Text style={styles.bonusOptionMeta}>
                                {questTemplate.category} · +{questTemplate.xp} XP
                              </Text>
                            </View>
                            <Text style={styles.bonusOptionAdd}>Add</Text>
                          </Pressable>
                        ))
                      ) : (
                        <Text style={styles.bonusEmptyText}>
                          No bonus activities available today.
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}
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

            <View style={styles.heroTitleBlock}>
              <Text style={styles.modalTitle}>{heroTitle.toUpperCase()}</Text>
              <Text style={styles.heroPath}>{heroPath}</Text>
            </View>
            <View style={styles.heroDetailSpriteCard}>
              <HeroSprite size={220} />
            </View>

            <View style={styles.heroProgressCard}>
              <Text style={styles.heroProgressTitle}>HERO XP</Text>
              <Text style={styles.heroProgressValue}>Level {player.level}</Text>
              <Text style={styles.heroProgressMeta}>
                Total XP: {player.totalXp}
              </Text>
              <View style={styles.heroXpTrack}>
                <Animated.View
                  style={[
                    styles.heroXpFill,
                    { width: heroXpProgressWidth },
                  ]}
                />
              </View>
              <Text style={styles.heroProgressMeta}>
                {currentLevelXp} / {XP_GOAL}
              </Text>
            </View>

            <View style={styles.heroProgressCard}>
              <Text style={styles.heroProgressTitle}>ATTRIBUTES</Text>
              {HERO_ATTRIBUTE_KEYS.map((attribute) => {
                const attributeValue = heroAttributes[attribute.key];
                const attributeMilestone =
                  getHeroAttributeMilestone(attributeValue);
                const attributePercent =
                  (attributeValue / attributeMilestone) * 100;
                const attributeWidth = heroAttributeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', `${attributePercent}%`],
                });

                return (
                  <View key={attribute.key} style={styles.statRow}>
                    <View style={styles.statTextBlock}>
                      <Text style={styles.statLabel}>{attribute.label}</Text>
                      <Text style={styles.statValue}>
                        {attributeValue} / {attributeMilestone}
                      </Text>
                    </View>
                    <View style={styles.statBarTrack}>
                      <Animated.View
                        style={[
                          styles.statBarFill,
                          { width: attributeWidth },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
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

            <Text style={styles.modalTitle}>WEEKLY CHALLENGE</Text>
            <DarkEmpressCard
              currentPower={shadow.currentPower}
              maxPower={shadow.maxPower}
              result={finalizedBattle?.result}
            />
            <WeeklyBattlePreview weeklyBattle={weeklyBattle} />
            {finalizedBattle ? (
              <FinalizedBattleCard finalizedBattle={finalizedBattle} />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {xpToastAmount ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.xpToast,
            {
              opacity: xpToastOpacity,
              transform: [{ translateY: xpToastTranslateY }],
            },
          ]}
        >
          <Text style={styles.xpToastText}>+{xpToastAmount} XP</Text>
        </Animated.View>
      ) : null}

      {levelUpEvent ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.levelUpOverlay, { opacity: levelUpOpacity }]}
        >
          <View style={styles.levelUpCard}>
            <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
            <Text style={styles.levelUpLevelText}>
              Level {levelUpEvent.previousLevel}
            </Text>
            <Text style={styles.levelUpArrow}>↓</Text>
            <Text style={styles.levelUpNewLevelText}>
              Level {levelUpEvent.nextLevel}
            </Text>
            <Text style={styles.levelUpTitleMeta}>
              Title: {levelUpEvent.currentTitle}
            </Text>
            {levelUpEvent.newTitle !== levelUpEvent.currentTitle ? (
              <Text style={styles.levelUpNewTitleMeta}>
                New Title: {levelUpEvent.newTitle}
              </Text>
            ) : null}
            {levelUpEvent.attributeGains.length > 0 ? (
              <View style={styles.levelUpStatsBox}>
                <Text style={styles.levelUpStatsLabel}>
                  Stats gained this level:
                </Text>
                {levelUpEvent.attributeGains.map((attribute) => (
                  <Text
                    key={attribute.label}
                    style={styles.levelUpStatsValue}
                  >
                    {attribute.label} +{attribute.value}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#171923',
    position: 'relative',
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
  homeDateBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  homeDateWeekday: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  homeDateFull: {
    color: '#F4F1DE',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  heroTitleBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#F4F1DE',
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroPath: {
    color: '#F6C453',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 18,
    textTransform: 'uppercase',
  },
  heroSpriteCard: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#A970FF',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 430,
    padding: 20,
    shadowColor: '#A970FF',
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  heroDetailSpriteCard: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#A970FF',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 280,
    padding: 22,
  },
  heroSpriteHint: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  characterStage: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 176,
    padding: 18,
  },
  pixelHero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 190,
    position: 'relative',
    width: 180,
  },
  heroAura: {
    backgroundColor: '#A970FF',
    borderRadius: 82,
    height: 164,
    opacity: 0.16,
    position: 'absolute',
    width: 164,
  },
  heroAuraLegend: {
    backgroundColor: '#F6C453',
    opacity: 0.22,
  },
  pixelHead: {
    backgroundColor: '#171923',
    borderColor: '#F4F1DE',
    borderRadius: 8,
    borderWidth: 2,
    height: 42,
    width: 42,
    zIndex: 4,
  },
  pixelHeadImproved: {
    borderColor: '#55D187',
    height: 44,
    width: 44,
  },
  pixelHeadArmored: {
    backgroundColor: '#242938',
    borderColor: '#F6C453',
    height: 46,
    width: 48,
  },
  pixelHeadHero: {
    backgroundColor: '#242938',
    borderColor: '#F4F1DE',
    height: 48,
    width: 50,
  },
  spriteCrown: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 20,
    justifyContent: 'center',
    marginBottom: -2,
    zIndex: 5,
  },
  spriteCrownHidden: {
    opacity: 0,
  },
  spriteCrownPoint: {
    backgroundColor: '#F6C453',
    borderRadius: 2,
    height: 10,
    width: 9,
  },
  spriteCrownCenter: {
    backgroundColor: '#F6C453',
    borderRadius: 2,
    height: 16,
    width: 10,
  },
  spriteNeck: {
    backgroundColor: '#F4F1DE',
    height: 10,
    width: 18,
    zIndex: 3,
  },
  spriteCape: {
    backgroundColor: '#6F42C1',
    borderColor: '#A970FF',
    borderRadius: 8,
    borderWidth: 1,
    height: 126,
    position: 'absolute',
    top: 54,
    width: 116,
    zIndex: 0,
  },
  spriteCapeHidden: {
    display: 'none',
  },
  spriteCapeImproved: {
    height: 104,
    width: 96,
  },
  spriteCapeHero: {
    backgroundColor: '#A970FF',
    borderColor: '#F6C453',
    height: 138,
    width: 132,
  },
  spriteUpperBody: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 2,
  },
  spriteCenter: {
    alignItems: 'center',
  },
  pixelShoulders: {
    backgroundColor: '#3E4661',
    borderColor: '#F4F1DE',
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    width: 88,
  },
  pixelShouldersBasic: {
    backgroundColor: '#242938',
    width: 72,
  },
  pixelShouldersArmored: {
    backgroundColor: '#A8B0C7',
    borderColor: '#F6C453',
    width: 98,
  },
  pixelShouldersHero: {
    backgroundColor: '#F6C453',
    borderColor: '#F4F1DE',
    width: 106,
  },
  pixelBody: {
    backgroundColor: '#242938',
    borderColor: '#55D187',
    borderRadius: 4,
    borderWidth: 2,
    height: 58,
    marginTop: -2,
    width: 56,
  },
  pixelBodyImproved: {
    height: 64,
    width: 64,
  },
  pixelBodyArmored: {
    backgroundColor: '#3E4661',
    borderColor: '#F6C453',
    height: 70,
    width: 70,
  },
  pixelBodyHero: {
    backgroundColor: '#6F42C1',
    borderColor: '#F6C453',
    height: 78,
    width: 78,
  },
  spriteBelt: {
    backgroundColor: '#F6C453',
    borderRadius: 4,
    height: 8,
    marginTop: -4,
    width: 62,
  },
  spriteBeltBasic: {
    backgroundColor: '#A8B0C7',
    width: 50,
  },
  spriteArm: {
    backgroundColor: '#171923',
    borderColor: '#55D187',
    borderRadius: 4,
    borderWidth: 2,
    height: 66,
    marginTop: 18,
    width: 20,
  },
  spriteArmArmored: {
    backgroundColor: '#A8B0C7',
    borderColor: '#F6C453',
  },
  spriteArmHero: {
    backgroundColor: '#6F42C1',
    borderColor: '#F6C453',
    height: 76,
  },
  spriteLegRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: -2,
    zIndex: 2,
  },
  pixelLeg: {
    backgroundColor: '#171923',
    borderColor: '#A970FF',
    borderRadius: 4,
    borderWidth: 2,
    height: 46,
    width: 22,
  },
  pixelLegArmored: {
    backgroundColor: '#A8B0C7',
    borderColor: '#F6C453',
    height: 50,
    width: 24,
  },
  pixelLegHero: {
    backgroundColor: '#F6C453',
    borderColor: '#F4F1DE',
    height: 54,
    width: 26,
  },
  homeHeroLevel: {
    color: '#F4F1DE',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  homeHeroTotalXp: {
    color: '#F6C453',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },
  heroXpTrack: {
    alignSelf: 'stretch',
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    height: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  heroXpFill: {
    backgroundColor: '#F6C453',
    borderRadius: 8,
    height: '100%',
  },
  homeHeroXpMeta: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  homeActions: {
    gap: 12,
    marginBottom: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F6C453',
    borderRadius: 10,
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
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#F4F1DE',
    fontSize: 15,
    fontWeight: '900',
  },
  shadowActionButton: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#6F42C1',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
  },
  shadowActionButtonText: {
    color: '#A970FF',
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
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  statTextBlock: {
    flex: 1,
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
  statBarTrack: {
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
    width: 120,
  },
  statBarFill: {
    backgroundColor: '#55D187',
    borderRadius: 8,
    height: '100%',
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
    marginBottom: 16,
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
  xpToast: {
    alignSelf: 'center',
    backgroundColor: '#242938',
    borderColor: '#F6C453',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 26,
    paddingHorizontal: 20,
    paddingVertical: 11,
    position: 'absolute',
    shadowColor: '#F6C453',
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  xpToastText: {
    color: '#F6C453',
    fontSize: 18,
    fontWeight: '900',
  },
  levelUpOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 25, 35, 0.72)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  levelUpCard: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#A970FF',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 26,
    shadowColor: '#A970FF',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    width: '100%',
  },
  levelUpTitle: {
    color: '#F6C453',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
  },
  levelUpLevelText: {
    color: '#A8B0C7',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  levelUpArrow: {
    color: '#A970FF',
    fontSize: 24,
    fontWeight: '900',
    marginVertical: 8,
  },
  levelUpNewLevelText: {
    color: '#F4F1DE',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'center',
  },
  levelUpTitleMeta: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  levelUpNewTitleMeta: {
    color: '#F6C453',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  levelUpStatsBox: {
    alignSelf: 'stretch',
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  levelUpStatsLabel: {
    color: '#A970FF',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  levelUpStatsValue: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  questList: {
    gap: 14,
  },
  bonusEffortCard: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  bonusEffortTitle: {
    color: '#F6C453',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  bonusEffortButton: {
    alignItems: 'center',
    backgroundColor: '#171923',
    borderColor: '#A970FF',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
  },
  bonusEffortButtonText: {
    color: '#F4F1DE',
    fontSize: 14,
    fontWeight: '900',
  },
  bonusOptionList: {
    gap: 8,
    marginTop: 12,
  },
  bonusOption: {
    alignItems: 'center',
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  bonusOptionTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  bonusOptionTitle: {
    color: '#F4F1DE',
    fontSize: 14,
    fontWeight: '800',
  },
  bonusOptionMeta: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  bonusOptionAdd: {
    color: '#55D187',
    fontSize: 13,
    fontWeight: '900',
  },
  bonusEmptyText: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
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
