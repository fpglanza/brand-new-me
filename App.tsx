import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  Animated,
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { DarkEmpressCard } from './src/components/DarkEmpressCard';
import { FinalizedBattleCard } from './src/components/FinalizedBattleCard';
import { FloatingBackButton } from './src/components/FloatingBackButton';
import { HeroWalkSprite } from './src/components/HeroWalkSprite';
import { QuestCard, QuestLoadingCard } from './src/components/QuestCard';
import { RpgSectionHeader } from './src/components/RpgSectionHeader';
import { WeeklyBattlePreview } from './src/components/WeeklyBattlePreview';
import { theme } from './src/theme';
import {
  BONUS_EFFORT_TEMPLATES,
  DEFAULT_HERO_ATTRIBUTES,
  DEFAULT_KINGDOM_STATE,
  DEFAULT_PLAYER,
  DEFAULT_RETURN_STATE,
  DEFAULT_SHADOW,
  clearReturnStateInDatabase,
  clearCurrentWeekResultInDatabase,
  completeBonusQuestInDatabase,
  finalizeCurrentWeekInDatabase,
  getDefaultQuestsForDate,
  getXpNeededForLevel,
  getXpProgress,
  getLocalDateString,
  loadEmpressChronicleSummary,
  loadHeroChronicleDeeds,
  loadKingdomChronicleSummary,
  loadQuestChronicleSummary,
  loadGameState,
  openGameDatabase,
  reseedQuestCatalogForDateInDatabase,
  resetAllDataInDatabase,
  resetKingdomChecklistForWeekInDatabase,
  resetTodaysQuestsInDatabase,
  setShadowPowerInDatabase,
  startNewWeekInDatabase,
  toggleKingdomDecreeInDatabase,
  toggleQuestInDatabase,
  triggerReturnInDatabase,
} from './src/database/db';
import type {
  EmpressChronicleJudgment,
  EmpressChronicleSummary,
  FinalizedBattleResult,
  HeroAttributes,
  HeroChronicleDeed,
  KingdomChronicleSummary,
  KingdomDecree,
  KingdomState,
  Player,
  Quest,
  HeroChronicleReturnEvent,
  QuestChronicleSummary,
  QuestTemplate,
  ReturnState,
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
  kingdomFavor: 0,
  kingdomFavorCounted: 0,
  empressScore: 0,
};

const DEFAULT_QUEST_CHRONICLE_SUMMARY: QuestChronicleSummary = {
  totalCompleted: 0,
  victoryDays: 0,
  strongDays: 0,
  legendaryDays: 0,
  bonusEfforts: 0,
  carryoversCompleted: 0,
  topCategory: null,
  recentDays: [],
};

const DEFAULT_EMPRESS_CHRONICLE_SUMMARY: EmpressChronicleSummary = {
  totalJudgments: 0,
  victories: 0,
  draws: 0,
  defeats: 0,
  totalKingdomFavor: 0,
  bestWeek: null,
  recentJudgments: [],
};

const DEFAULT_KINGDOM_CHRONICLE_SUMMARY: KingdomChronicleSummary = {
  prosperity: DEFAULT_KINGDOM_STATE.prosperity,
  legacy: DEFAULT_KINGDOM_STATE.legacy,
  decreesFulfilled: 0,
  orderDecrees: 0,
  restorationDecrees: 0,
  stewardshipDecrees: 0,
  mostChosenType: null,
  recentDecrees: [],
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

const QUEST_CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  Appearance: '✦ APPEARANCE ✦',
  Mind: '◆ MIND ◆',
  Fuel: '✚ FUEL ✚',
  Body: '⚔ BODY ⚔',
  Purpose: '✦ PURPOSE ✦',
  Recovery: '☾ RECOVERY ☾',
};

const DAILY_PROGRESS_TARGET = 100;
const HERO_XP_TOAST_DURATION_MS = 1500;
const HERO_XP_ENTRY_ANIMATION_MS = 1000;
const DAILY_PROGRESS_ENTRY_ANIMATION_MS = 800;
const HERO_ATTRIBUTE_ENTRY_ANIMATION_MS = 850;
const LEVEL_UP_OVERLAY_DURATION_MS = 2600;
const TRAINING_COMPLETE_DURATION_MS = 3600;
const PAGE_TRANSITION_DURATION_MS = 180;
const PAGE_TRANSITION_START_OPACITY = 0.86;
const PAGE_TRANSITION_START_TRANSLATE_Y = 6;
const KINGDOM_DECREE_CARD_GAP = 6;
const KINGDOM_DECREE_LIST_HORIZONTAL_PADDING = 2;
const KINGDOM_DECREE_PANEL_HORIZONTAL_PADDING = 10;

type AppView =
  | 'home'
  | 'quests'
  | 'hero'
  | 'shadow'
  | 'kingdom'
  | 'chronicles'
  | 'heroChronicle'
  | 'questChronicle'
  | 'empressChronicle'
  | 'kingdomChronicle';

type LevelUpEvent = {
  attributeGains: AttributeGainDisplay[];
  currentTitle: string;
  newTitle: string;
  previousLevel: number;
  nextLevel: number;
};

type TrainingCompleteEvent = {
  bodyAfter: number;
  bodyBefore: number;
  bodyGain: number;
  bodyMilestone: number | null;
  nextLevel: number;
  previousLevel: number;
  returnBonusXp: number;
  totalXpGain: number;
  xpGain: number;
  xpProgressAfter: number;
  xpProgressBefore: number;
  xpTargetAfter: number;
  xpTargetBefore: number;
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
const KINGDOM_PROSPERITY_MILESTONES = [100, 250, 500, 1000, 2000];
const CASTLE_PLACEHOLDER = require('./src/assets/kingdom/castle-placeholder.jpeg');

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

function getChronicleDateLabel(date: string) {
  const localDate = parseLocalDateString(date);

  return `${localDate.getDate()} ${
    MONTH_LABELS[localDate.getMonth()]
  } ${localDate.getFullYear()}`;
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

function getHeroAttributeDisplayLabel(label: string) {
  switch (label) {
    case 'Body':
      return 'BODY ⚔';
    case 'Mind':
      return 'MIND ◆';
    case 'Purpose':
      return 'PURPOSE ✦';
    default:
      return label;
  }
}

function getHeroXpProgressPercentValue(player: Player) {
  const currentLevelXp = getXpProgress(player.totalXp);
  const nextLevelXp = getXpNeededForLevel(player.level);

  return Math.min(Math.max((currentLevelXp / nextLevelXp) * 100, 0), 100);
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

function getDistanceToHeroAttributeMilestone(value: number) {
  return Math.max(getHeroAttributeMilestone(value) - value, 0);
}

function isReturnChronicleDeed(
  deed: HeroChronicleDeed,
): deed is HeroChronicleReturnEvent {
  return 'kind' in deed && deed.kind === 'return';
}

function getQuestCategoryDisplayLabel(category: string) {
  return QUEST_CATEGORY_DISPLAY_LABELS[category] ?? category.toUpperCase();
}

function getKingdomProsperityMilestone(value: number) {
  const baseMilestone = KINGDOM_PROSPERITY_MILESTONES.find(
    (milestone) => value <= milestone,
  );

  if (baseMilestone) {
    return baseMilestone;
  }

  return Math.ceil(value / 1000) * 1000;
}

function getKingdomStateLabel(prosperity: number) {
  if (prosperity >= 2000) {
    return 'Prosperous Realm';
  }

  if (prosperity >= 1000) {
    return 'Fortified Hold';
  }

  if (prosperity >= 500) {
    return 'Restored Village';
  }

  if (prosperity >= 250) {
    return 'Reclaimed Outpost';
  }

  if (prosperity >= 100) {
    return 'Stabilizing';
  }

  return 'Ruins';
}

function getKingdomDecreeTypeLabel(type: KingdomDecree['type']) {
  switch (type) {
    case 'Order':
      return 'ORDER';
    case 'Restoration':
      return 'RESTORE';
    case 'Stewardship':
      return 'STEWARD';
  }
}

function getKingdomDecreeRewardText(decree: KingdomDecree) {
  return `+${decree.prosperityReward} Prosperity · +${decree.legacyReward} Legacy`;
}

function getKingdomDecreeGlyph(type: KingdomDecree['type']) {
  switch (type) {
    case 'Order':
      return '⚖';
    case 'Restoration':
      return '✦';
    case 'Stewardship':
      return '♜';
  }
}

function getHeroChronicleDeedTitle(deed: HeroChronicleDeed) {
  if (isReturnChronicleDeed(deed)) {
    return deed.title;
  }

  return deed.title.replace(' — Carried Over', '');
}

function getHeroChronicleDeedTag(deed: HeroChronicleDeed) {
  if (isReturnChronicleDeed(deed)) {
    return 'RETURN';
  }

  if (deed.source === 'bonus') {
    return 'BONUS';
  }

  if (
    deed.source === 'carryover' ||
    deed.title.endsWith(' — Carried Over')
  ) {
    return 'CARRIED OVER';
  }

  return null;
}

function groupHeroChronicleDeeds(deeds: HeroChronicleDeed[]) {
  const groups: {
    date: string;
    deeds: HeroChronicleDeed[];
  }[] = [];

  for (const deed of deeds) {
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.date === deed.date) {
      currentGroup.deeds.push(deed);
      continue;
    }

    groups.push({
      date: deed.date,
      deeds: [deed],
    });
  }

  return groups;
}

function getQuestChronicleStatusGlyph(status: string) {
  switch (status) {
    case 'Legendary':
      return '✦';
    case 'Strong':
      return '◆';
    case 'Victory':
      return '✓';
    default:
      return '·';
  }
}

function getQuestChronicleStatusStyle(status: string) {
  switch (status) {
    case 'Legendary':
      return styles.questTrailLegendary;
    case 'Strong':
      return styles.questTrailStrong;
    case 'Victory':
      return styles.questTrailVictory;
    default:
      return styles.questTrailMissed;
  }
}

function getEmpressJudgmentGlyph(result: EmpressChronicleJudgment['result']) {
  switch (result) {
    case 'Victory':
      return '✦';
    case 'Draw':
      return '◇';
    case 'Defeat':
      return '☾';
  }
}

function getEmpressJudgmentFlavor(
  result: EmpressChronicleJudgment['result'],
) {
  switch (result) {
    case 'Victory':
      return 'The Empress was pleased.';
    case 'Draw':
      return 'The Empress watched in silence.';
    case 'Defeat':
      return 'The Empress was displeased.';
  }
}

function getEmpressResultStyle(result: EmpressChronicleJudgment['result']) {
  switch (result) {
    case 'Victory':
      return styles.empressJudgmentVictory;
    case 'Draw':
      return styles.empressJudgmentDraw;
    case 'Defeat':
      return styles.empressJudgmentDefeat;
  }
}

function formatChronicleNumber(value: number | null) {
  return value === null ? '—' : String(value);
}

function getKingdomChronicleTypeLabel(type: KingdomDecree['type']) {
  switch (type) {
    case 'Order':
      return 'ORDER';
    case 'Restoration':
      return 'RESTORATION';
    case 'Stewardship':
      return 'STEWARDSHIP';
  }
}

function getKingdomChronicleTypeFlavor(type: KingdomDecree['type']) {
  switch (type) {
    case 'Order':
      return 'Order was restored.';
    case 'Restoration':
      return 'Ruins were reclaimed.';
    case 'Stewardship':
      return 'The realm was prepared.';
  }
}

function getBackView(activeView: AppView): AppView {
  switch (activeView) {
    case 'chronicles':
      return 'hero';
    case 'heroChronicle':
    case 'questChronicle':
    case 'empressChronicle':
    case 'kingdomChronicle':
      return 'chronicles';
    default:
      return 'home';
  }
}

export default function App() {
  const windowDimensions = useWindowDimensions();
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
  const [returnState, setReturnState] =
    useState<ReturnState>(DEFAULT_RETURN_STATE);
  const [heroChronicleDeeds, setHeroChronicleDeeds] = useState<
    HeroChronicleDeed[]
  >([]);
  const [questChronicleSummary, setQuestChronicleSummary] =
    useState<QuestChronicleSummary>(DEFAULT_QUEST_CHRONICLE_SUMMARY);
  const [empressChronicleSummary, setEmpressChronicleSummary] =
    useState<EmpressChronicleSummary>(DEFAULT_EMPRESS_CHRONICLE_SUMMARY);
  const [kingdomChronicleSummary, setKingdomChronicleSummary] =
    useState<KingdomChronicleSummary>(DEFAULT_KINGDOM_CHRONICLE_SUMMARY);
  const [shadow, setShadow] = useState<Shadow>(DEFAULT_SHADOW);
  const [weeklyBattle, setWeeklyBattle] = useState<WeeklyBattlePreviewData>(
    DEFAULT_WEEKLY_BATTLE,
  );
  const [finalizedBattle, setFinalizedBattle] =
    useState<FinalizedBattleResult | null>(null);
  const [kingdomDecrees, setKingdomDecrees] = useState<KingdomDecree[]>([]);
  const [kingdomState, setKingdomState] = useState<KingdomState>(
    DEFAULT_KINGDOM_STATE,
  );
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
  const [trainingCompleteEvent, setTrainingCompleteEvent] =
    useState<TrainingCompleteEvent | null>(null);
  const completingQuestIdsRef = useRef(new Set<string>());
  const togglingKingdomDecreeIdsRef = useRef(new Set<string>());
  const heroXpProgressAnim = useRef(new Animated.Value(0)).current;
  const dailyProgressAnim = useRef(new Animated.Value(0)).current;
  const heroAttributeAnim = useRef(new Animated.Value(0)).current;
  const xpToastOpacity = useRef(new Animated.Value(0)).current;
  const xpToastTranslateY = useRef(new Animated.Value(12)).current;
  const levelUpOpacity = useRef(new Animated.Value(0)).current;
  const trainingOverlayOpacity = useRef(new Animated.Value(0)).current;
  const trainingOverlayScale = useRef(new Animated.Value(0.96)).current;
  const trainingSpriteTranslateY = useRef(new Animated.Value(0)).current;
  const trainingImpactOpacity = useRef(new Animated.Value(0)).current;
  const trainingAuraScale = useRef(new Animated.Value(0.72)).current;
  const trainingRewardOpacity = useRef(new Animated.Value(0)).current;
  const trainingRewardTranslateY = useRef(new Animated.Value(16)).current;
  const trainingXpProgress = useRef(new Animated.Value(0)).current;
  const pageTransitionOpacity = useRef(
    new Animated.Value(PAGE_TRANSITION_START_OPACITY),
  ).current;
  const pageTransitionTranslateY = useRef(
    new Animated.Value(PAGE_TRANSITION_START_TRANSLATE_Y),
  ).current;
  const xpToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trainingCompleteTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPlayerRef = useRef<Player>(DEFAULT_PLAYER);

  useEffect(() => {
    let isMounted = true;

    async function loadPersistedState() {
      const currentDate = getLocalDateString();
      const database = await openGameDatabase(currentDate);
      const gameState = await loadGameState(database, currentDate);
      const completedDeeds = await loadHeroChronicleDeeds(database);
      const questSummary = await loadQuestChronicleSummary(
        database,
        currentDate,
      );
      const empressSummary = await loadEmpressChronicleSummary(database);
      const kingdomSummary = await loadKingdomChronicleSummary(database);

      if (!isMounted) {
        return;
      }

      setDb(database);
      previousPlayerRef.current = gameState.player;
      setPlayer(gameState.player);
      setHeroAttributes(gameState.heroAttributes);
      setToday(gameState.today);
      setQuests(gameState.quests);
      setReturnState(gameState.returnState);
      setHeroChronicleDeeds(completedDeeds);
      setQuestChronicleSummary(questSummary);
      setEmpressChronicleSummary(empressSummary);
      setKingdomChronicleSummary(kingdomSummary);
      setShadow(gameState.shadow);
      setWeeklyBattle(gameState.weeklyBattle);
      setFinalizedBattle(gameState.finalizedBattle);
      setKingdomDecrees(gameState.kingdomDecrees);
      setKingdomState(gameState.kingdomState);
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
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (trainingCompleteEvent) {
          setTrainingCompleteEvent(null);
          return true;
        }

        if (levelUpEvent) {
          setLevelUpEvent(null);
          return true;
        }

        if (isBonusPickerOpen) {
          setIsBonusPickerOpen(false);
          return true;
        }

        if (activeView !== 'home') {
          setActiveView(getBackView(activeView));
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [
    activeView,
    isBonusPickerOpen,
    levelUpEvent,
    trainingCompleteEvent,
  ]);

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

  useLayoutEffect(() => {
    pageTransitionOpacity.stopAnimation();
    pageTransitionTranslateY.stopAnimation();
    pageTransitionOpacity.setValue(PAGE_TRANSITION_START_OPACITY);
    pageTransitionTranslateY.setValue(PAGE_TRANSITION_START_TRANSLATE_Y);

    Animated.parallel([
      Animated.timing(pageTransitionOpacity, {
        duration: PAGE_TRANSITION_DURATION_MS,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(pageTransitionTranslateY, {
        duration: PAGE_TRANSITION_DURATION_MS,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeView, pageTransitionOpacity, pageTransitionTranslateY]);

  useEffect(() => {
    return () => {
      if (xpToastTimeoutRef.current) {
        clearTimeout(xpToastTimeoutRef.current);
      }

      if (levelUpTimeoutRef.current) {
        clearTimeout(levelUpTimeoutRef.current);
      }

      if (trainingCompleteTimeoutRef.current) {
        clearTimeout(trainingCompleteTimeoutRef.current);
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

  const showTrainingCompleteOverlay = (event: TrainingCompleteEvent) => {
    if (trainingCompleteTimeoutRef.current) {
      clearTimeout(trainingCompleteTimeoutRef.current);
    }

    setTrainingCompleteEvent(event);
    trainingOverlayOpacity.stopAnimation();
    trainingOverlayScale.stopAnimation();
    trainingSpriteTranslateY.stopAnimation();
    trainingImpactOpacity.stopAnimation();
    trainingAuraScale.stopAnimation();
    trainingRewardOpacity.stopAnimation();
    trainingRewardTranslateY.stopAnimation();
    trainingXpProgress.stopAnimation();
    trainingOverlayOpacity.setValue(0);
    trainingOverlayScale.setValue(0.92);
    trainingSpriteTranslateY.setValue(18);
    trainingImpactOpacity.setValue(0);
    trainingAuraScale.setValue(0.72);
    trainingRewardOpacity.setValue(0);
    trainingRewardTranslateY.setValue(16);
    trainingXpProgress.setValue(
      (event.xpProgressBefore / event.xpTargetBefore) * 100,
    );

    Animated.parallel([
      Animated.sequence([
        Animated.parallel([
          Animated.timing(trainingOverlayOpacity, {
            duration: 160,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(trainingOverlayScale, {
            friction: 6,
            tension: 90,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(2940),
        Animated.timing(trainingOverlayOpacity, {
          duration: 300,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(trainingSpriteTranslateY, {
          duration: 360,
          toValue: -8,
          useNativeDriver: true,
        }),
        Animated.spring(trainingSpriteTranslateY, {
          friction: 6,
          tension: 72,
          toValue: -2,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(trainingImpactOpacity, {
          duration: 90,
          toValue: 0.72,
          useNativeDriver: true,
        }),
        Animated.timing(trainingImpactOpacity, {
          duration: 420,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(trainingAuraScale, {
        friction: 7,
        tension: 48,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(trainingRewardOpacity, {
            duration: 260,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(trainingRewardTranslateY, {
            friction: 7,
            tension: 80,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(1050),
        event.nextLevel > event.previousLevel
          ? Animated.sequence([
              Animated.timing(trainingXpProgress, {
                duration: 520,
                toValue: 100,
                useNativeDriver: false,
              }),
              Animated.timing(trainingXpProgress, {
                duration: 1,
                toValue: 0,
                useNativeDriver: false,
              }),
              Animated.timing(trainingXpProgress, {
                duration: 520,
                toValue:
                  (event.xpProgressAfter / event.xpTargetAfter) * 100,
                useNativeDriver: false,
              }),
            ])
          : Animated.timing(trainingXpProgress, {
              duration: 900,
              toValue:
                (event.xpProgressAfter / event.xpTargetAfter) * 100,
              useNativeDriver: false,
            }),
      ]),
    ]).start();

    trainingCompleteTimeoutRef.current = setTimeout(() => {
      setTrainingCompleteEvent(null);
    }, TRAINING_COMPLETE_DURATION_MS);
  };

  const showQuestCompletionFeedback = (
    previousPlayer: Player,
    nextPlayer: Player,
    xpAmount: number,
    attributeGains: AttributeGainDisplay[],
    trainingEvent?: TrainingCompleteEvent,
  ) => {
    if (trainingEvent) {
      showTrainingCompleteOverlay(trainingEvent);
      return;
    }
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
      const completionResult = await toggleQuestInDatabase(db, quest.id, today);
      const gameState = await loadGameState(db, today);
      const completedDeeds = await loadHeroChronicleDeeds(db);
      const questSummary = await loadQuestChronicleSummary(db, today);
      const empressSummary = await loadEmpressChronicleSummary(db);
      const kingdomSummary = await loadKingdomChronicleSummary(db);
      setPlayer(gameState.player);
      setHeroAttributes(gameState.heroAttributes);
      setToday(gameState.today);
      setQuests(gameState.quests);
      setHeroChronicleDeeds(completedDeeds);
      setQuestChronicleSummary(questSummary);
      setEmpressChronicleSummary(empressSummary);
      setKingdomChronicleSummary(kingdomSummary);
      setShadow(gameState.shadow);
      setWeeklyBattle(gameState.weeklyBattle);
      setFinalizedBattle(gameState.finalizedBattle);
      setKingdomDecrees(gameState.kingdomDecrees);
      setKingdomState(gameState.kingdomState);

      if (!quest.completed && gameState.player.totalXp > previousPlayer.totalXp) {
        const bodyGain = Math.max(
          gameState.heroAttributes.body - previousHeroAttributes.body,
          0,
        );

        showQuestCompletionFeedback(
          previousPlayer,
          gameState.player,
          gameState.player.totalXp - previousPlayer.totalXp,
          getLevelRecapAttributeGains(
            previousHeroAttributes,
            gameState.heroAttributes,
          ),
          completionResult.trainingCompleted
            ? {
                bodyAfter: gameState.heroAttributes.body,
                bodyBefore: previousHeroAttributes.body,
                bodyGain,
                bodyMilestone: completionResult.bodyAscendedMilestone,
                nextLevel: gameState.player.level,
                previousLevel: previousPlayer.level,
                returnBonusXp: completionResult.returnBonusXpAwarded,
                totalXpGain:
                  gameState.player.totalXp - previousPlayer.totalXp,
                xpGain: quest.xp,
                xpProgressAfter: getXpProgress(gameState.player.totalXp),
                xpProgressBefore: getXpProgress(previousPlayer.totalXp),
                xpTargetAfter: getXpNeededForLevel(gameState.player.level),
                xpTargetBefore: getXpNeededForLevel(previousPlayer.level),
              }
            : undefined,
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
    const completedDeeds = await loadHeroChronicleDeeds(database);
    const questSummary = await loadQuestChronicleSummary(database, currentDate);
    const empressSummary = await loadEmpressChronicleSummary(database);
    const kingdomSummary = await loadKingdomChronicleSummary(database);
    setPlayer(gameState.player);
    setHeroAttributes(gameState.heroAttributes);
    setToday(gameState.today);
    setQuests(gameState.quests);
    setReturnState(gameState.returnState);
    setHeroChronicleDeeds(completedDeeds);
    setQuestChronicleSummary(questSummary);
    setEmpressChronicleSummary(empressSummary);
    setKingdomChronicleSummary(kingdomSummary);
    setShadow(gameState.shadow);
    setWeeklyBattle(gameState.weeklyBattle);
    setFinalizedBattle(gameState.finalizedBattle);
    setKingdomDecrees(gameState.kingdomDecrees);
    setKingdomState(gameState.kingdomState);

    return gameState;
  };

  const toggleKingdomDecree = async (decree: KingdomDecree) => {
    if (!db || togglingKingdomDecreeIdsRef.current.has(decree.id)) {
      return;
    }

    togglingKingdomDecreeIdsRef.current.add(decree.id);

    try {
      await toggleKingdomDecreeInDatabase(db, decree.id, today);
      await reloadState(db, today);
    } catch (error) {
      console.error('Failed to toggle kingdom decree', error);
    } finally {
      togglingKingdomDecreeIdsRef.current.delete(decree.id);
    }
  };

  const addBonusEffort = async (questTemplate: QuestTemplate) => {
    if (!db) {
      return;
    }

    try {
      const previousPlayer = player;
      const previousHeroAttributes = heroAttributes;
      const completionResult = await completeBonusQuestInDatabase(
        db,
        questTemplate.id,
        today,
      );
      setIsBonusPickerOpen(false);
      const gameState = await reloadState(db, today);

      if (gameState.player.totalXp > previousPlayer.totalXp) {
        const bodyGain = Math.max(
          gameState.heroAttributes.body - previousHeroAttributes.body,
          0,
        );

        showQuestCompletionFeedback(
          previousPlayer,
          gameState.player,
          gameState.player.totalXp - previousPlayer.totalXp,
          getLevelRecapAttributeGains(
            previousHeroAttributes,
            gameState.heroAttributes,
          ),
          completionResult.trainingCompleted
            ? {
                bodyAfter: gameState.heroAttributes.body,
                bodyBefore: previousHeroAttributes.body,
                bodyGain,
                bodyMilestone: completionResult.bodyAscendedMilestone,
                nextLevel: gameState.player.level,
                previousLevel: previousPlayer.level,
                returnBonusXp: completionResult.returnBonusXpAwarded,
                totalXpGain:
                  gameState.player.totalXp - previousPlayer.totalXp,
                xpGain: questTemplate.xp,
                xpProgressAfter: getXpProgress(gameState.player.totalXp),
                xpProgressBefore: getXpProgress(previousPlayer.totalXp),
                xpTargetAfter: getXpNeededForLevel(gameState.player.level),
                xpTargetBefore: getXpNeededForLevel(previousPlayer.level),
              }
            : undefined,
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
  const currentLevelXp = getXpProgress(player.totalXp);
  const nextLevelXp = getXpNeededForLevel(player.level);
  const xpUntilNextLevel = Math.max(nextLevelXp - currentLevelXp, 0);
  const heroXpProgressWidth = heroXpProgressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const trainingXpProgressWidth = trainingXpProgress.interpolate({
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
  const isReturnQuestActive = returnState.active;
  const heroChronicleGroups = groupHeroChronicleDeeds(heroChronicleDeeds);
  const completedKingdomDecree = kingdomDecrees.find(
    (decree) => decree.completed,
  );
  const kingdomProsperityMilestone = getKingdomProsperityMilestone(
    kingdomState.prosperity,
  );
  const kingdomProsperityPercent = `${
    (kingdomState.prosperity / kingdomProsperityMilestone) * 100
  }%` as `${number}%`;
  const kingdomLegacyMilestone = getKingdomProsperityMilestone(
    kingdomState.legacy,
  );
  const kingdomLegacyPercent = `${
    (kingdomState.legacy / kingdomLegacyMilestone) * 100
  }%` as `${number}%`;
  const kingdomStateLabel = getKingdomStateLabel(kingdomState.prosperity);
  const simulatedDayNumber = getSimulatedDayNumber(simulationStartDate, today);
  const isCompactMobile = windowDimensions.width <= 480;
  const homeHeroSpriteSize = isCompactMobile ? 118 : 160;
  const heroDetailSpriteSize = isCompactMobile ? 150 : 220;
  const shouldUseCompactPageSpacing =
    isCompactMobile &&
    (activeView === 'home' || activeView === 'hero' || activeView === 'shadow');
  const kingdomPageHorizontalPadding = 40;
  const kingdomDecreeAvailableWidth =
    windowDimensions.width -
    kingdomPageHorizontalPadding -
    KINGDOM_DECREE_PANEL_HORIZONTAL_PADDING * 2 -
    KINGDOM_DECREE_CARD_GAP * 2 -
    KINGDOM_DECREE_LIST_HORIZONTAL_PADDING * 2;
  const kingdomDecreeCardWidth = Math.min(
    isCompactMobile ? 104 : 154,
    Math.max(78, kingdomDecreeAvailableWidth / 3),
  );

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          contentContainerStyle={[
            styles.container,
            shouldUseCompactPageSpacing ? styles.compactContainer : null,
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.appScroll}
        >
        <Animated.View
          style={[
            styles.pageTransition,
            {
              opacity: pageTransitionOpacity,
              transform: [{ translateY: pageTransitionTranslateY }],
            },
          ]}
        >
          {activeView === 'home' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('hero')}
              style={({ pressed }) => [
                styles.homeHeroScene,
                isCompactMobile ? styles.homeHeroSceneCompact : null,
                pressed ? styles.homeActionPressed : null,
              ]}
            >
              <View style={styles.homeHeroAtmosphere} />
              <View style={styles.homeHeroTopline}>
                <View>
                  <Text style={styles.homeDateWeekday}>{homeDate.weekday}</Text>
                  <Text style={styles.homeDateFull}>{homeDate.fullDate}</Text>
                </View>
                <View style={styles.homeLevelSeal}>
                  <Text style={styles.homeLevelSealLabel}>LEVEL</Text>
                  <Text style={styles.homeLevelSealValue}>{player.level}</Text>
                </View>
              </View>
              <Text style={styles.homeHeroEyebrow}>THE HERO AWAKENS</Text>
              <Text
                style={[
                  styles.heroTitle,
                  isCompactMobile ? styles.heroTitleCompact : null,
                ]}
              >
                {heroTitle.toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.heroPath,
                  isCompactMobile ? styles.homeHeroPathCompact : null,
                ]}
              >
                {heroPath}
              </Text>
              <View style={styles.homeHeroStage}>
                <View style={styles.homeHeroAuraOuter} />
                <View style={styles.homeHeroAuraInner} />
                <HeroWalkSprite size={homeHeroSpriteSize} />
                <View style={styles.homeHeroGround} />
              </View>
              <View style={styles.homeXpBlock}>
                <View style={styles.homeXpHeader}>
                  <Text style={styles.homeXpLabel}>HERO EXPERIENCE</Text>
                  <Text style={styles.homeXpGainTarget}>
                    {xpUntilNextLevel} XP TO LEVEL {player.level + 1}
                  </Text>
                </View>
                <View style={styles.heroXpTrack}>
                  <Animated.View
                    style={[
                      styles.heroXpFill,
                      { width: heroXpProgressWidth },
                    ]}
                  >
                    <View style={styles.progressHighlight} />
                  </Animated.View>
                </View>
                <View style={styles.homeXpMetaRow}>
                  <Text style={styles.homeHeroXpMeta}>
                    {currentLevelXp} / {nextLevelXp}
                  </Text>
                  <Text style={styles.homeHeroTotalXp}>
                    TOTAL {player.totalXp}
                  </Text>
                </View>
              </View>
              <View style={styles.homeAttributeStrip}>
                <View style={styles.homeAttributeItem}>
                  <Text style={styles.homeAttributeGlyph}>◆</Text>
                  <Text style={styles.homeAttributeValue}>{heroAttributes.body}</Text>
                  <Text style={styles.homeAttributeLabel}>BODY</Text>
                </View>
                <View style={styles.homeAttributeDivider} />
                <View style={styles.homeAttributeItem}>
                  <Text style={styles.homeAttributeGlyph}>✦</Text>
                  <Text style={styles.homeAttributeValue}>{heroAttributes.mind}</Text>
                  <Text style={styles.homeAttributeLabel}>MIND</Text>
                </View>
                <View style={styles.homeAttributeDivider} />
                <View style={styles.homeAttributeItem}>
                  <Text style={styles.homeAttributeGlyph}>▲</Text>
                  <Text style={styles.homeAttributeValue}>{heroAttributes.purpose}</Text>
                  <Text style={styles.homeAttributeLabel}>PURPOSE</Text>
                </View>
              </View>
              <Text style={styles.heroSpriteHint}>OPEN CHARACTER SHEET</Text>
            </Pressable>

            <View
              style={[
                styles.dailyProgressCard,
                isCompactMobile ? styles.dailyProgressCardCompact : null,
              ]}
            >
              <View style={styles.dailyProgressHeader}>
                <View>
                  <Text style={styles.dailyProgressEyebrow}>TODAY'S RITUAL</Text>
                  <Text style={styles.dailyProgressTitle}>DAILY PROGRESS</Text>
                </View>
                <Text style={styles.dailyProgressValue}>
                  {dailyProgress}<Text style={styles.dailyProgressTarget}> / {DAILY_PROGRESS_TARGET}</Text>
                </Text>
              </View>
              <View style={styles.dailyProgressTrack}>
                <Animated.View
                  style={[
                    styles.dailyProgressFill,
                    { width: dailyProgressWidth },
                  ]}
                >
                  <View style={styles.progressHighlight} />
                </Animated.View>
              </View>
              <Text style={styles.dailyProgressMessage}>
                {dailyProgressMessage}
              </Text>
            </View>

            {isReturnQuestActive ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('quests')}
                style={({ pressed }) => [
                  styles.returnQuestCard,
                  isCompactMobile ? styles.returnQuestCardCompact : null,
                  pressed ? styles.homeActionPressed : null,
                ]}
              >
                <View style={styles.returnQuestEmber} />
                <Text style={styles.returnQuestEyebrow}>
                  THE FIRE STILL BURNS
                </Text>
                <Text style={styles.returnQuestText}>
                  The road has been quiet.
                </Text>
                <Text style={styles.returnQuestText}>
                  Your story continues.
                </Text>
                <View style={styles.returnQuestDivider} />
                <Text style={styles.returnQuestTitle}>RETURN QUEST</Text>
                <Text style={styles.returnQuestObjective}>
                  Complete one workout.
                </Text>
              </Pressable>
            ) : null}

            <View
              style={[
                styles.homeActions,
                isCompactMobile ? styles.homeActionsCompact : null,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('quests')}
                style={({ pressed }) => [
                  styles.gameButton,
                  styles.primaryButton,
                  isCompactMobile ? styles.homeButtonCompact : null,
                  pressed ? styles.homeActionPressed : null,
                ]}
              >
                <Text style={styles.primaryButtonEyebrow}>THE PATH AWAITS</Text>
                <Text style={styles.primaryButtonText}>ENTER QUEST LOG</Text>
              </Pressable>
              <View style={styles.worldActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveView('kingdom')}
                  style={({ pressed }) => [
                    styles.worldAction,
                    styles.kingdomAction,
                    pressed ? styles.homeActionPressed : null,
                  ]}
                >
                  <Text style={styles.worldActionGlyph}>♜</Text>
                  <Text style={styles.worldActionLabel}>THE KINGDOM</Text>
                  <Text style={styles.worldActionValue}>{kingdomStateLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveView('shadow')}
                  style={({ pressed }) => [
                    styles.worldAction,
                    styles.empressAction,
                    pressed ? styles.homeActionPressed : null,
                  ]}
                >
                  <Text style={styles.worldActionGlyph}>☾</Text>
                  <Text style={styles.worldActionLabel}>DARK EMPRESS</Text>
                  <Text style={styles.worldActionValue}>{weeklyBattle.result}</Text>
                </Pressable>
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
                    <Text style={styles.debugMetaText}>
                      Return Active: {isReturnQuestActive ? 'Yes' : 'No'}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database, currentDate) =>
                        triggerReturnInDatabase(database, currentDate),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>Trigger Return</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      runDebugAction((database) =>
                        clearReturnStateInDatabase(database),
                      )
                    }
                    style={styles.debugButton}
                  >
                    <Text style={styles.debugButtonText}>
                      Clear Return State
                    </Text>
                  </Pressable>

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
            <View style={styles.section}>
              <RpgSectionHeader
                eyebrow="QUEST LOG"
                meta={debugDateOverride ? `DEV DATE · ${debugDateOverride}` : today}
                subtitle="Every completed duty becomes power."
                title="TODAY'S QUESTS"
              />
              <View style={styles.questList}>
                {isLoading ? <QuestLoadingCard /> : null}

                {!isLoading
                  ? questGroups.map((group) => (
                      <View key={group.category} style={styles.questGroupCard}>
                        <Text style={styles.questGroupTitle}>
                          {getQuestCategoryDisplayLabel(group.category)}
                        </Text>
                        <View style={styles.questGroupList}>
                          {group.quests.map((quest) => (
                            <QuestCard
                              key={quest.id}
                              onToggle={toggleQuest}
                              quest={quest}
                              showCategoryLabel={false}
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
            <View style={styles.section}>
              <RpgSectionHeader
                eyebrow="THE FALLEN REALM"
                meta={`WEEK OF ${weeklyBattle.weekStart}`}
                subtitle="Your discipline restores what neglect surrendered."
                title="THE KINGDOM"
              />

              <View style={styles.kingdomCard}>
                <Image
                  resizeMode="cover"
                  source={CASTLE_PLACEHOLDER}
                  style={styles.kingdomCastleImage}
                />
                <View style={styles.kingdomImageShade} />
                <View style={styles.kingdomIdentity}>
                  <Text style={styles.kingdomCardTitle}>REALM CONDITION</Text>
                  <Text style={styles.kingdomStateLabel}>
                    {kingdomStateLabel}
                  </Text>
                </View>
                <View style={styles.kingdomMetricsPanel}>
                  <View style={styles.kingdomMetricRow}>
                    <Text style={styles.kingdomMetricLabel}>PROSPERITY</Text>
                    <Text style={styles.kingdomMetricValue}>
                      {kingdomState.prosperity} / {kingdomProsperityMilestone}
                    </Text>
                  </View>
                  <View style={styles.kingdomProsperityTrack}>
                    <View
                      style={[
                        styles.kingdomProsperityFill,
                        { width: kingdomProsperityPercent },
                      ]}
                    />
                  </View>
                  <View style={styles.kingdomMetricRow}>
                    <Text style={styles.kingdomMetricLabel}>LEGACY</Text>
                    <Text style={styles.kingdomMetricValue}>
                      {kingdomState.legacy} / {kingdomLegacyMilestone}
                    </Text>
                  </View>
                  <View style={styles.kingdomLegacyTrack}>
                    <View
                      style={[
                        styles.kingdomLegacyFill,
                        { width: kingdomLegacyPercent },
                      ]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.kingdomDecreesPanel}>
                <View style={styles.kingdomDecreesSeal} />
                <Text style={styles.kingdomDecreesTitle}>KINGDOM DECREES</Text>
                <Text style={styles.kingdomDecreesSubtitle}>
                  Choose one duty to restore the realm today.
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.kingdomDecreeList}
                >
                  {kingdomDecrees.map((decree) => {
                    const isDisabled =
                      Boolean(completedKingdomDecree) && !decree.completed;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          checked: decree.completed,
                          disabled: isDisabled,
                        }}
                        disabled={isDisabled}
                        key={decree.id}
                        onPress={() => toggleKingdomDecree(decree)}
                        style={({ pressed }) => [
                          styles.kingdomDecreeCard,
                          { width: kingdomDecreeCardWidth },
                          decree.completed
                            ? styles.kingdomDecreeCardCompleted
                            : null,
                          isDisabled ? styles.kingdomDecreeCardDisabled : null,
                          pressed ? styles.homeActionPressed : null,
                        ]}
                      >
                        <Text style={styles.kingdomDecreeGlyph}>
                          {getKingdomDecreeGlyph(decree.type)}
                        </Text>
                        <Text style={styles.kingdomDecreeType}>
                          {getKingdomDecreeTypeLabel(decree.type)}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={styles.kingdomDecreeTask}
                        >
                          {decree.title.toUpperCase()}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={styles.kingdomDecreeReward}
                        >
                          {getKingdomDecreeRewardText(decree)}
                        </Text>
                        <View
                          style={[
                            styles.kingdomDecreeStatePill,
                            decree.completed
                              ? styles.kingdomDecreeStatePillCompleted
                              : null,
                            isDisabled
                              ? styles.kingdomDecreeStatePillDisabled
                              : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.kingdomDecreeState,
                              decree.completed
                                ? styles.kingdomDecreeStateCompleted
                                : null,
                            ]}
                          >
                            {decree.completed
                              ? 'FULFILLED'
                              : isDisabled
                                ? 'SEALED'
                                : 'AVAILABLE'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={styles.kingdomDecreesFootnote}>
                  The Empress favors a ruler who keeps his realm intact.
                </Text>
              </View>

            </View>
          </>
          ) : null}

          {activeView === 'hero' ? (
          <>
            <RpgSectionHeader
              eyebrow="CHARACTER SHEET"
              meta={`LEVEL ${player.level} · ${player.totalXp} TOTAL XP`}
              subtitle={heroPath}
              title={heroTitle.toUpperCase()}
            />
            <View
              style={[
                styles.heroDetailSpriteCard,
                isCompactMobile ? styles.heroDetailSpriteCardCompact : null,
              ]}
            >
              <View style={styles.heroSpriteAura} />
              <HeroWalkSprite size={heroDetailSpriteSize} />
              <View style={styles.heroSpritePedestal} />
            </View>

            <View
              style={[
                styles.heroProgressCard,
                isCompactMobile ? styles.heroProgressCardCompact : null,
              ]}
            >
              <View style={styles.heroProgressHeadingRow}>
                <View>
                  <Text style={styles.heroProgressTitle}>HERO LEVEL</Text>
                  <Text style={styles.heroProgressValue}>{player.level}</Text>
                </View>
                <View style={styles.heroXpCountdown}>
                  <Text style={styles.heroXpCountdownValue}>{xpUntilNextLevel}</Text>
                  <Text style={styles.heroXpCountdownLabel}>XP TO ASCEND</Text>
                </View>
              </View>
              <View style={styles.heroXpTrack}>
                <Animated.View
                  style={[
                    styles.heroXpFill,
                    { width: heroXpProgressWidth },
                  ]}
                >
                  <View style={styles.progressHighlight} />
                </Animated.View>
              </View>
              <View style={styles.heroXpMetaRow}>
                <Text style={styles.heroProgressMeta}>
                  {currentLevelXp} / {nextLevelXp}
                </Text>
                <Text style={styles.heroProgressMetaRight}>
                  Total XP {player.totalXp}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroProgressCard,
                isCompactMobile ? styles.heroProgressCardCompact : null,
              ]}
            >
              <Text style={styles.heroProgressEyebrow}>POWER IS MADE VISIBLE</Text>
              <Text style={styles.heroProgressTitle}>CORE ATTRIBUTES</Text>
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
                  <View
                    key={attribute.key}
                    style={[
                      styles.statRow,
                      isCompactMobile ? styles.statRowCompact : null,
                    ]}
                  >
                    <View style={styles.statSigil}>
                      <Text style={styles.statSigilText}>
                        {attribute.key === 'body'
                          ? '◆'
                          : attribute.key === 'mind'
                            ? '✦'
                            : '▲'}
                      </Text>
                    </View>
                    <View style={styles.statTextBlock}>
                      <Text style={styles.statLabel}>
                        {getHeroAttributeDisplayLabel(attribute.label)}
                      </Text>
                      <Text style={styles.statMilestoneHint}>
                        {getDistanceToHeroAttributeMilestone(attributeValue)} TO MILESTONE
                      </Text>
                    </View>
                    <View style={styles.statProgressBlock}>
                      <View style={styles.statValueRow}>
                        <Text style={styles.statPowerValue}>{attributeValue}</Text>
                        <Text style={styles.statValue}> / {attributeMilestone}</Text>
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
                  </View>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveView('chronicles')}
              style={({ pressed }) => [
                styles.chroniclesEntryButton,
                pressed ? styles.homeActionPressed : null,
              ]}
            >
              <Text style={styles.chroniclesEntryText}>VIEW CHRONICLES</Text>
              <Text style={styles.chroniclesEntrySubtext}>
                Records of the path reclaimed.
              </Text>
            </Pressable>
          </>
          ) : null}

          {activeView === 'chronicles' ? (
          <>
            <RpgSectionHeader
              eyebrow="THE LIVING RECORD"
              subtitle="Every deed leaves its mark upon the realm."
              title="THE CHRONICLES"
            />

            <View style={styles.chroniclesCardList}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('heroChronicle')}
                style={({ pressed }) => [
                  styles.chronicleNavCard,
                  styles.chronicleHeroCard,
                  pressed ? styles.homeActionPressed : null,
                ]}
              >
                <Text style={[styles.chronicleGlyph, styles.chronicleHeroGlyph]}>
                  ⚔
                </Text>
                <View style={styles.chronicleNavTextBlock}>
                  <Text style={styles.chronicleNavTitle}>HERO CHRONICLE</Text>
                  <Text style={styles.chronicleNavFlavor}>
                    The record of who you are becoming.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('questChronicle')}
                style={({ pressed }) => [
                  styles.chronicleNavCard,
                  styles.chronicleQuestCard,
                  pressed ? styles.homeActionPressed : null,
                ]}
              >
                <Text style={[styles.chronicleGlyph, styles.chronicleQuestGlyph]}>
                  ✦
                </Text>
                <View style={styles.chronicleNavTextBlock}>
                  <Text style={styles.chronicleNavTitle}>QUEST CHRONICLE</Text>
                  <Text style={styles.chronicleNavFlavor}>
                    The path of duties completed.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('empressChronicle')}
                style={({ pressed }) => [
                  styles.chronicleNavCard,
                  styles.chronicleEmpressCard,
                  pressed ? styles.homeActionPressed : null,
                ]}
              >
                <Text style={[styles.chronicleGlyph, styles.chronicleEmpressGlyph]}>
                  ☾
                </Text>
                <View style={styles.chronicleNavTextBlock}>
                  <Text style={styles.chronicleNavTitle}>EMPRESS CHRONICLE</Text>
                  <Text style={styles.chronicleNavFlavor}>
                    The archive of weekly judgments.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('kingdomChronicle')}
                style={({ pressed }) => [
                  styles.chronicleNavCard,
                  styles.chronicleKingdomCard,
                  pressed ? styles.homeActionPressed : null,
                ]}
              >
                <Text style={[styles.chronicleGlyph, styles.chronicleKingdomGlyph]}>
                  ♜
                </Text>
                <View style={styles.chronicleNavTextBlock}>
                  <Text style={styles.chronicleNavTitle}>KINGDOM CHRONICLE</Text>
                  <Text style={styles.chronicleNavFlavor}>
                    The history of the realm restored.
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
          ) : null}

          {activeView === 'heroChronicle' ? (
          <View style={[styles.chronicleDetailCard, styles.chronicleHeroDetail]}>
            <Text style={styles.chronicleDetailEyebrow}>ILLUMINATED LEDGER</Text>
            <Text style={styles.chronicleDetailTitle}>HERO CHRONICLE</Text>
            <Text style={styles.chronicleDetailFlavor}>
              The record of duties completed by the Hero.
            </Text>
            <View
              style={[
                styles.chronicleDetailDivider,
                styles.chronicleHeroDivider,
              ]}
            />
            <View style={styles.heroChronicleSummary}>
              <Text style={styles.heroChronicleSummaryLabel}>
                Deeds Recorded
              </Text>
              <Text style={styles.heroChronicleSummaryValue}>
                {heroChronicleDeeds.length}
              </Text>
            </View>
            {heroChronicleGroups.length > 0 ? (
              <View style={styles.heroChronicleDayList}>
                {heroChronicleGroups.map((group) => (
                  <View key={group.date} style={styles.heroChronicleDayPanel}>
                    <Text style={styles.heroChronicleDate}>
                      {getChronicleDateLabel(group.date)}
                    </Text>
                    <View style={styles.heroChronicleDeedList}>
                      {group.deeds.map((deed) => {
                        const deedTag = getHeroChronicleDeedTag(deed);

                        return (
                          <View key={deed.id} style={styles.heroChronicleDeedRow}>
                            <Text style={styles.heroChronicleBullet}>•</Text>
                            <View style={styles.heroChronicleDeedTextBlock}>
                              <Text style={styles.heroChronicleDeedTitle}>
                                {getHeroChronicleDeedTitle(deed)}
                              </Text>
                              {isReturnChronicleDeed(deed) ? (
                                <Text style={styles.heroChronicleDeedFlavor}>
                                  {deed.description}
                                </Text>
                              ) : null}
                            </View>
                            {deedTag ? (
                              <Text style={styles.heroChronicleDeedTag}>
                                {deedTag}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.heroChronicleEmptyState}>
                <Text style={styles.heroChronicleEmptyText}>
                  No deeds recorded yet.
                </Text>
              </View>
            )}
          </View>
          ) : null}

          {activeView === 'questChronicle' ? (
          <View style={[styles.chronicleDetailCard, styles.chronicleQuestDetail]}>
            <Text style={styles.chronicleDetailEyebrow}>QUEST BOARD ARCHIVE</Text>
            <Text style={styles.chronicleDetailTitle}>QUEST CHRONICLE</Text>
            <Text style={styles.chronicleDetailFlavor}>
              The trail of duties completed.
            </Text>
            <View
              style={[
                styles.chronicleDetailDivider,
                styles.chronicleQuestDivider,
              ]}
            />
            {questChronicleSummary.totalCompleted > 0 ? (
              <>
                <View style={styles.questChroniclePrimaryGrid}>
                  <View style={styles.questChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Completed</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.totalCompleted}
                    </Text>
                  </View>
                  <View style={styles.questChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Victory</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.victoryDays}
                    </Text>
                  </View>
                  <View style={styles.questChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Strong</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.strongDays}
                    </Text>
                  </View>
                  <View style={styles.questChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Legendary</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.legendaryDays}
                    </Text>
                  </View>
                </View>

                <View style={styles.questChronicleSecondaryGrid}>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.questArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Bonus</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.bonusEfforts}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.questArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Carryovers</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.carryoversCompleted}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.questArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Top Category</Text>
                    <Text style={styles.chronicleStatValue}>
                      {questChronicleSummary.topCategory ?? 'None'}
                    </Text>
                  </View>
                </View>

                <View style={styles.questTrailPanel}>
                  <Text style={styles.questTrailTitle}>RECENT 7 DAYS</Text>
                  <View style={styles.questTrailList}>
                    {questChronicleSummary.recentDays.map((day) => (
                      <View key={day.date} style={styles.questTrailDay}>
                        <View
                          style={[
                            styles.questTrailMarker,
                            getQuestChronicleStatusStyle(day.status),
                          ]}
                        >
                          <Text style={styles.questTrailMarkerText}>
                            {getQuestChronicleStatusGlyph(day.status)}
                          </Text>
                        </View>
                        <Text style={styles.questTrailDate}>
                          {getChronicleDateLabel(day.date)}
                        </Text>
                        <Text style={styles.questTrailStatus}>{day.status}</Text>
                        <Text style={styles.questTrailProgress}>
                          {day.dailyProgress}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.heroChronicleEmptyState}>
                <Text style={styles.heroChronicleEmptyText}>
                  No quest records yet.
                </Text>
              </View>
            )}
          </View>
          ) : null}

          {activeView === 'empressChronicle' ? (
          <View style={[styles.chronicleDetailCard, styles.chronicleEmpressDetail]}>
            <Text style={styles.chronicleDetailEyebrow}>DARK COURT ARCHIVE</Text>
            <Text style={styles.chronicleDetailTitle}>EMPRESS CHRONICLE</Text>
            <Text style={styles.chronicleDetailFlavor}>
              The sealed record of weekly judgment.
            </Text>
            <View
              style={[
                styles.chronicleDetailDivider,
                styles.chronicleEmpressDivider,
              ]}
            />
            {empressChronicleSummary.totalJudgments > 0 ? (
              <>
                <View style={styles.empressChroniclePrimaryGrid}>
                  <View style={styles.empressChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Judgments</Text>
                    <Text style={styles.chronicleStatValue}>
                      {empressChronicleSummary.totalJudgments}
                    </Text>
                  </View>
                  <View style={styles.empressChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Victories</Text>
                    <Text style={styles.chronicleStatValue}>
                      {empressChronicleSummary.victories}
                    </Text>
                  </View>
                  <View style={styles.empressChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Draws</Text>
                    <Text style={styles.chronicleStatValue}>
                      {empressChronicleSummary.draws}
                    </Text>
                  </View>
                  <View style={styles.empressChronicleStatTile}>
                    <Text style={styles.chronicleStatLabel}>Defeats</Text>
                    <Text style={styles.chronicleStatValue}>
                      {empressChronicleSummary.defeats}
                    </Text>
                  </View>
                </View>

                <View style={styles.empressChronicleSecondaryGrid}>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.empressArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Total Favor</Text>
                    <Text style={styles.chronicleStatValue}>
                      +{empressChronicleSummary.totalKingdomFavor}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.empressArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Best Score</Text>
                    <Text style={styles.chronicleStatValue}>
                      {formatChronicleNumber(
                        empressChronicleSummary.bestWeek?.empressScore ?? null,
                      )}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.empressArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Best Week</Text>
                    <Text style={styles.chronicleStatValue}>
                      {empressChronicleSummary.bestWeek
                        ? `Week of ${empressChronicleSummary.bestWeek.weekStart}`
                        : '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.empressJudgmentList}>
                  <Text style={styles.empressJudgmentListTitle}>
                    RECENT JUDGMENTS
                  </Text>
                  {empressChronicleSummary.recentJudgments.map((judgment) => (
                    <View key={judgment.id} style={styles.empressJudgmentCard}>
                      <View style={styles.empressJudgmentHeader}>
                        <View
                          style={[
                            styles.empressJudgmentGlyph,
                            getEmpressResultStyle(judgment.result),
                          ]}
                        >
                          <Text style={styles.empressJudgmentGlyphText}>
                            {getEmpressJudgmentGlyph(judgment.result)}
                          </Text>
                        </View>
                        <View style={styles.empressJudgmentHeaderText}>
                          <Text style={styles.empressJudgmentWeek}>
                            Week of {judgment.weekStart}
                          </Text>
                          <Text style={styles.empressJudgmentFlavor}>
                            {getEmpressJudgmentFlavor(judgment.result)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.empressJudgmentResult,
                            getEmpressResultStyle(judgment.result),
                          ]}
                        >
                          {judgment.result}
                        </Text>
                      </View>

                      <View style={styles.empressJudgmentMetricGrid}>
                        <View style={styles.empressJudgmentMetric}>
                          <Text style={styles.empressJudgmentMetricLabel}>
                            Victory
                          </Text>
                          <Text style={styles.empressJudgmentMetricValue}>
                            {judgment.victoryDays} / 7
                          </Text>
                        </View>
                        <View style={styles.empressJudgmentMetric}>
                          <Text style={styles.empressJudgmentMetricLabel}>
                            Favor
                          </Text>
                          <Text style={styles.empressJudgmentMetricValue}>
                            +{formatChronicleNumber(judgment.kingdomFavor)}
                          </Text>
                        </View>
                        <View style={styles.empressJudgmentMetric}>
                          <Text style={styles.empressJudgmentMetricLabel}>
                            Score
                          </Text>
                          <Text style={styles.empressJudgmentMetricValue}>
                            {formatChronicleNumber(judgment.empressScore)}
                          </Text>
                        </View>
                        <View style={styles.empressJudgmentMetric}>
                          <Text style={styles.empressJudgmentMetricLabel}>
                            Strong
                          </Text>
                          <Text style={styles.empressJudgmentMetricValue}>
                            {formatChronicleNumber(judgment.strongDays)}
                          </Text>
                        </View>
                        <View style={styles.empressJudgmentMetric}>
                          <Text style={styles.empressJudgmentMetricLabel}>
                            Legendary
                          </Text>
                          <Text style={styles.empressJudgmentMetricValue}>
                            {formatChronicleNumber(judgment.legendaryDays)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.heroChronicleEmptyState}>
                <Text style={styles.heroChronicleEmptyText}>
                  No judgments recorded yet.
                </Text>
                <Text style={styles.empressChronicleEmptyFlavor}>
                  The Empress has not yet sealed a week into the archive.
                </Text>
              </View>
            )}
          </View>
          ) : null}

          {activeView === 'kingdomChronicle' ? (
          <View style={[styles.chronicleDetailCard, styles.chronicleKingdomDetail]}>
            <Text style={styles.chronicleDetailEyebrow}>ROYAL REALM ARCHIVE</Text>
            <Text style={styles.chronicleDetailTitle}>KINGDOM CHRONICLE</Text>
            <Text style={styles.chronicleDetailFlavor}>
              The record of the realm restored.
            </Text>
            <View
              style={[
                styles.chronicleDetailDivider,
                styles.chronicleKingdomDivider,
              ]}
            />
            <View style={styles.kingdomChroniclePrimaryGrid}>
              <View style={styles.kingdomChronicleStatTile}>
                <Text style={styles.chronicleStatLabel}>Prosperity</Text>
                <Text style={styles.chronicleStatValue}>
                  {kingdomChronicleSummary.prosperity}
                </Text>
              </View>
              <View style={styles.kingdomChronicleStatTile}>
                <Text style={styles.chronicleStatLabel}>Legacy</Text>
                <Text style={styles.chronicleStatValue}>
                  {kingdomChronicleSummary.legacy}
                </Text>
              </View>
              <View style={styles.kingdomChronicleStatTile}>
                <Text style={styles.chronicleStatLabel}>Decrees</Text>
                <Text style={styles.chronicleStatValue}>
                  {kingdomChronicleSummary.decreesFulfilled}
                </Text>
              </View>
            </View>

            {kingdomChronicleSummary.decreesFulfilled > 0 ? (
              <>
                <View style={styles.kingdomChronicleSecondaryGrid}>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.kingdomArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Order</Text>
                    <Text style={styles.chronicleStatValue}>
                      {kingdomChronicleSummary.orderDecrees}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.kingdomArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Restoration</Text>
                    <Text style={styles.chronicleStatValue}>
                      {kingdomChronicleSummary.restorationDecrees}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.kingdomArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Stewardship</Text>
                    <Text style={styles.chronicleStatValue}>
                      {kingdomChronicleSummary.stewardshipDecrees}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chronicleStatCard,
                      styles.kingdomArchiveStatCard,
                    ]}
                  >
                    <Text style={styles.chronicleStatLabel}>Rule Style</Text>
                    <Text style={styles.chronicleStatValue}>
                      {kingdomChronicleSummary.mostChosenType ?? '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.kingdomRecordList}>
                  <Text style={styles.kingdomRecordListTitle}>
                    RECENT DECREES
                  </Text>
                  {kingdomChronicleSummary.recentDecrees.map((decree) => (
                    <View key={decree.id} style={styles.kingdomRecordCard}>
                      <View style={styles.kingdomRecordHeader}>
                        <View style={styles.kingdomRecordGlyph}>
                          <Text style={styles.kingdomRecordGlyphText}>
                            {getKingdomDecreeGlyph(decree.type)}
                          </Text>
                        </View>
                        <View style={styles.kingdomRecordHeaderText}>
                          <Text style={styles.kingdomRecordDate}>
                            {getChronicleDateLabel(decree.date)}
                          </Text>
                          <Text style={styles.kingdomRecordFlavor}>
                            {getKingdomChronicleTypeFlavor(decree.type)}
                          </Text>
                        </View>
                        <Text style={styles.kingdomRecordType}>
                          {getKingdomChronicleTypeLabel(decree.type)}
                        </Text>
                      </View>

                      <Text style={styles.kingdomRecordTask}>{decree.title}</Text>

                      <View style={styles.kingdomRecordMetricGrid}>
                        <View style={styles.kingdomRecordMetric}>
                          <Text style={styles.kingdomRecordMetricLabel}>
                            Prosperity
                          </Text>
                          <Text style={styles.kingdomRecordMetricValue}>
                            +{decree.prosperityReward}
                          </Text>
                        </View>
                        <View style={styles.kingdomRecordMetric}>
                          <Text style={styles.kingdomRecordMetricLabel}>
                            Legacy
                          </Text>
                          <Text style={styles.kingdomRecordMetricValue}>
                            +{decree.legacyReward}
                          </Text>
                        </View>
                        <View style={styles.kingdomRecordMetric}>
                          <Text style={styles.kingdomRecordMetricLabel}>
                            Favor
                          </Text>
                          <Text style={styles.kingdomRecordMetricValue}>+1</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.heroChronicleEmptyState}>
                <Text style={styles.heroChronicleEmptyText}>
                  No decrees fulfilled yet.
                </Text>
                <Text style={styles.kingdomChronicleEmptyFlavor}>
                  The realm awaits its first restoration.
                </Text>
              </View>
            )}
          </View>
          ) : null}

          {activeView === 'shadow' ? (
          <>
            <DarkEmpressCard
              compact={isCompactMobile}
              currentPower={shadow.currentPower}
              maxPower={shadow.maxPower}
              result={finalizedBattle?.result}
            />
            <WeeklyBattlePreview
              compact={isCompactMobile}
              weeklyBattle={weeklyBattle}
            />
            {finalizedBattle ? (
              <FinalizedBattleCard finalizedBattle={finalizedBattle} />
            ) : null}
          </>
          ) : null}
        </Animated.View>
        </ScrollView>

      {activeView !== 'home' ? (
        <FloatingBackButton onPress={() => setActiveView(getBackView(activeView))} />
      ) : null}

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

      {trainingCompleteEvent ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.trainingCompleteOverlay,
            {
              opacity: trainingOverlayOpacity,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.trainingImpactFlash,
              { opacity: trainingImpactOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.trainingCompleteCard,
              {
                transform: [{ scale: trainingOverlayScale }],
              },
            ]}
          >
            <View style={styles.trainingCompleteHeaderGlow} />
            <Text style={styles.trainingCompleteEyebrow}>QUEST RESOLVED</Text>
            <Animated.View
              style={[
                styles.trainingHeroStage,
                {
                  transform: [{ scale: trainingAuraScale }],
                },
              ]}
            >
              <View style={styles.trainingAuraOuter} />
              <View style={styles.trainingAuraInner} />
              <Animated.View
                style={[
                  styles.trainingCompleteSprite,
                  {
                    transform: [{ translateY: trainingSpriteTranslateY }],
                  },
                ]}
              >
                <HeroWalkSprite size={112} />
              </Animated.View>
            </Animated.View>
            <Text style={styles.trainingCompleteTitle}>
              TRAINING COMPLETE
            </Text>
            <Text style={styles.trainingCompleteSubhead}>
              YOUR EFFORT BECAME POWER
            </Text>
            <Animated.View
              style={[
                styles.trainingRewardSequence,
                {
                  opacity: trainingRewardOpacity,
                  transform: [
                    { translateY: trainingRewardTranslateY },
                  ],
                },
              ]}
            >
              <View style={styles.trainingPrimaryReward}>
                <Text style={styles.trainingRewardLabel}>BODY INCREASED</Text>
                <View style={styles.trainingStatTransition}>
                  <Text style={styles.trainingStatPrevious}>
                    {trainingCompleteEvent.bodyBefore}
                  </Text>
                  <Text style={styles.trainingStatArrow}>→</Text>
                  <Text style={styles.trainingStatCurrent}>
                    {trainingCompleteEvent.bodyAfter}
                  </Text>
                </View>
                <Text style={styles.trainingBodyReward}>
                  +{trainingCompleteEvent.bodyGain} BODY
                </Text>
              </View>
              <View style={styles.trainingXpPanel}>
                <View style={styles.trainingXpHeader}>
                  <Text style={styles.trainingRewardLabel}>
                    HERO XP · LEVEL {trainingCompleteEvent.nextLevel}
                  </Text>
                  <Text style={styles.trainingXpReward}>
                    +{trainingCompleteEvent.totalXpGain} XP
                  </Text>
                </View>
                <View style={styles.trainingXpTrack}>
                  <Animated.View
                    style={[
                      styles.trainingXpFill,
                      { width: trainingXpProgressWidth },
                    ]}
                  />
                  <View style={styles.trainingXpShine} />
                </View>
                <View style={styles.trainingXpMetaRow}>
                  <Text style={styles.trainingXpSource}>
                    TRAINING +{trainingCompleteEvent.xpGain}
                  </Text>
                  <Text style={styles.trainingXpMeta}>
                    {trainingCompleteEvent.xpProgressAfter} /{' '}
                    {trainingCompleteEvent.xpTargetAfter}
                  </Text>
                </View>
              </View>
              {trainingCompleteEvent.returnBonusXp > 0 ? (
                <View style={styles.trainingBonusBanner}>
                  <Text style={styles.trainingReturnBonus}>
                    THE RETURN · +{trainingCompleteEvent.returnBonusXp} XP
                  </Text>
                </View>
              ) : null}
              {trainingCompleteEvent.nextLevel >
              trainingCompleteEvent.previousLevel ? (
                <View style={styles.trainingLevelUpBanner}>
                  <Text style={styles.trainingLevelUpLabel}>LEVEL UP</Text>
                  <Text style={styles.trainingLevelUpValue}>
                    {trainingCompleteEvent.previousLevel} →{' '}
                    {trainingCompleteEvent.nextLevel}
                  </Text>
                </View>
              ) : null}
              {trainingCompleteEvent.bodyMilestone ? (
                <View style={styles.bodyAscendedBox}>
                  <Text style={styles.bodyAscendedTitle}>BODY ASCENDED</Text>
                  <Text style={styles.bodyAscendedValue}>
                    {trainingCompleteEvent.bodyMilestone}
                  </Text>
                  <Text style={styles.bodyAscendedFlavor}>
                    Physical discipline has taken root.
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          </Animated.View>
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    position: 'relative',
  },
  appScroll: {
    backgroundColor: theme.colors.background,
  },
  container: {
    backgroundColor: theme.colors.background,
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 20,
  },
  compactContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pageTransition: {
    flex: 1,
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
  },
  homeHeroScene: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderBottomColor: theme.colors.goldDeep,
    borderBottomWidth: 1,
    borderTopColor: theme.colors.violetDeep,
    borderTopWidth: 1,
    marginBottom: 14,
    minHeight: 520,
    overflow: 'hidden',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    position: 'relative',
  },
  homeHeroSceneCompact: {
    minHeight: 455,
    paddingTop: 10,
  },
  homeHeroAtmosphere: {
    backgroundColor: theme.colors.violet,
    borderRadius: 999,
    height: 290,
    opacity: 0.06,
    position: 'absolute',
    top: 76,
    width: 290,
  },
  homeHeroTopline: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  homeLevelSeal: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWarm,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    minWidth: 60,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  homeLevelSealLabel: {
    color: theme.colors.gold,
    fontSize: 8,
    fontWeight: '900',
  },
  homeLevelSealValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 27,
  },
  homeHeroEyebrow: {
    color: theme.colors.violetBright,
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 5,
  },
  homeHeroStage: {
    alignItems: 'center',
    height: 210,
    justifyContent: 'center',
    marginTop: -10,
    position: 'relative',
    width: '100%',
  },
  homeHeroAuraOuter: {
    borderColor: theme.colors.violetDeep,
    borderRadius: 999,
    borderWidth: 1,
    height: 190,
    position: 'absolute',
    width: 190,
  },
  homeHeroAuraInner: {
    backgroundColor: 'rgba(150, 103, 232, 0.08)',
    borderColor: 'rgba(217, 177, 95, 0.28)',
    borderRadius: 999,
    borderWidth: 1,
    height: 150,
    position: 'absolute',
    width: 150,
  },
  homeHeroGround: {
    backgroundColor: theme.colors.goldDeep,
    bottom: 17,
    height: 2,
    opacity: 0.7,
    position: 'absolute',
    width: 128,
  },
  homeXpBlock: {
    alignSelf: 'stretch',
    marginTop: -2,
  },
  homeXpHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  homeXpLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
  },
  homeXpGainTarget: {
    color: theme.colors.gold,
    fontSize: 9,
    fontWeight: '900',
  },
  homeXpMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  homeAttributeStrip: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingVertical: 9,
  },
  homeAttributeItem: {
    alignItems: 'center',
    flex: 1,
  },
  homeAttributeGlyph: {
    color: theme.colors.violetBright,
    fontSize: 10,
    fontWeight: '900',
  },
  homeAttributeValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 1,
  },
  homeAttributeLabel: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    marginTop: 1,
  },
  homeAttributeDivider: {
    backgroundColor: theme.colors.border,
    height: 28,
    width: 1,
  },
  progressHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    height: 2,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  worldActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  worldAction: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    flex: 1,
    minHeight: 104,
    padding: 12,
  },
  kingdomAction: {
    borderTopColor: theme.colors.kingdom,
    borderTopWidth: 2,
  },
  empressAction: {
    borderTopColor: theme.colors.violet,
    borderTopWidth: 2,
  },
  worldActionGlyph: {
    color: theme.colors.gold,
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 8,
  },
  worldActionLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
  },
  worldActionValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  modalTitle: {
    color: '#F4F1DE',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16,
  },
  homeDateBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  homeDateBlockCompact: {
    marginBottom: 8,
  },
  homeDateWeekday: {
    color: theme.colors.gold,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  homeDateFull: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  heroTitleBlock: {
    alignItems: 'center',
    backgroundColor: '#202535',
    borderColor: '#4B5471',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  heroTitleBlockCompact: {
    marginBottom: 8,
    paddingTop: 10,
    paddingBottom: 10,
  },
  heroHeaderDivider: {
    backgroundColor: '#A970FF',
    borderRadius: 999,
    height: 2,
    marginBottom: 10,
    opacity: 0.85,
    width: 108,
  },
  heroHeaderDividerMuted: {
    backgroundColor: '#7A5A2A',
    borderRadius: 999,
    height: 1,
    marginTop: -2,
    opacity: 0.9,
    width: 164,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroTitleCompact: {
    fontSize: 23,
    marginBottom: 4,
  },
  heroPath: {
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  heroPathCompact: {
    marginBottom: 8,
  },
  homeHeroPathCompact: {
    marginBottom: 6,
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
  heroSpriteCardCompact: {
    marginBottom: 12,
    minHeight: 330,
    padding: 14,
  },
  heroDetailSpriteCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderBottomColor: theme.colors.goldDeep,
    borderBottomWidth: 1,
    borderTopColor: theme.colors.violetDeep,
    borderTopWidth: 1,
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 300,
    overflow: 'hidden',
    padding: 22,
    position: 'relative',
    shadowColor: '#A970FF',
    shadowOpacity: 0.32,
    shadowRadius: 20,
  },
  heroDetailSpriteCardCompact: {
    marginBottom: 10,
    minHeight: 188,
    padding: 8,
  },
  heroSpriteAura: {
    backgroundColor: theme.colors.violet,
    borderRadius: 90,
    height: 180,
    opacity: 0.14,
    position: 'absolute',
    width: 180,
    zIndex: 0,
  },
  heroSpritePedestal: {
    backgroundColor: theme.colors.goldDeep,
    borderRadius: 999,
    bottom: 16,
    height: 4,
    opacity: 0.75,
    position: 'absolute',
    width: 116,
    zIndex: 0,
  },
  heroSpriteHint: {
    color: theme.colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 7,
    textTransform: 'uppercase',
  },
  heroSpriteHintCompact: {
    marginTop: 6,
  },
  returnQuestCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWarm,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: theme.colors.gold,
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  returnQuestCardCompact: {
    marginBottom: 12,
    paddingVertical: 12,
  },
  returnQuestEmber: {
    backgroundColor: theme.colors.gold,
    borderRadius: 999,
    height: 3,
    marginBottom: 9,
    width: 80,
  },
  returnQuestEyebrow: {
    color: theme.colors.goldBright,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 7,
    textAlign: 'center',
  },
  returnQuestText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  returnQuestDivider: {
    backgroundColor: theme.colors.goldDeep,
    borderRadius: 999,
    height: 1,
    marginVertical: 10,
    width: 132,
  },
  returnQuestTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },
  returnQuestObjective: {
    color: theme.colors.gold,
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
  homeHeroLevelCompact: {
    fontSize: 19,
    marginBottom: 2,
  },
  homeHeroTotalXp: {
    color: theme.colors.textDim,
    fontSize: 9,
    fontWeight: '900',
  },
  homeHeroTotalXpCompact: {
    marginBottom: 8,
  },
  heroXpTrack: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.shadow,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 16,
    marginBottom: 5,
    overflow: 'hidden',
  },
  heroXpFill: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.small,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  homeHeroXpMeta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  chroniclesEntryButton: {
    alignItems: 'center',
    backgroundColor: '#1B1726',
    borderBottomColor: '#4E3477',
    borderBottomWidth: 4,
    borderColor: '#A970FF',
    borderLeftColor: '#4B5471',
    borderRadius: 12,
    borderRightColor: '#4B5471',
    borderTopColor: '#C8A3FF',
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chroniclesEntryText: {
    color: '#F4F1DE',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  chroniclesEntrySubtext: {
    color: '#D9C08A',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  chroniclesHeader: {
    alignItems: 'center',
    backgroundColor: '#17151F',
    borderColor: '#6B5873',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
  },
  chroniclesHeaderDivider: {
    backgroundColor: '#D9C08A',
    borderRadius: 999,
    height: 2,
    marginBottom: 10,
    width: 92,
  },
  chroniclesTitle: {
    color: '#F4F1DE',
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 5,
    textAlign: 'center',
  },
  chroniclesSubtitle: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  chroniclesCardList: {
    gap: 10,
  },
  chronicleNavCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chronicleHeroCard: {
    borderLeftColor: theme.colors.gold,
    borderLeftWidth: 3,
  },
  chronicleQuestCard: {
    borderLeftColor: theme.colors.green,
    borderLeftWidth: 3,
  },
  chronicleEmpressCard: {
    borderLeftColor: theme.colors.crimson,
    borderLeftWidth: 3,
  },
  chronicleKingdomCard: {
    borderLeftColor: theme.colors.kingdom,
    borderLeftWidth: 3,
  },
  chronicleGlyph: {
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
    width: 32,
  },
  chronicleHeroGlyph: {
    color: theme.colors.gold,
  },
  chronicleQuestGlyph: {
    color: theme.colors.green,
  },
  chronicleEmpressGlyph: {
    color: theme.colors.crimson,
  },
  chronicleKingdomGlyph: {
    color: theme.colors.kingdom,
  },
  chronicleNavTextBlock: {
    flex: 1,
  },
  chronicleNavTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  chronicleNavFlavor: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  chronicleDetailCard: {
    alignItems: 'stretch',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 15,
  },
  chronicleHeroDetail: {
    backgroundColor: theme.colors.surfaceWarm,
    borderColor: theme.colors.goldDeep,
    borderTopColor: theme.colors.gold,
    borderTopWidth: 3,
  },
  chronicleQuestDetail: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderTopColor: theme.colors.green,
    borderTopWidth: 3,
  },
  chronicleEmpressDetail: {
    backgroundColor: '#160F1A',
    borderColor: theme.colors.crimsonDeep,
    borderTopColor: theme.colors.crimson,
    borderTopWidth: 3,
  },
  chronicleKingdomDetail: {
    backgroundColor: '#101812',
    borderColor: '#34472F',
    borderTopColor: theme.colors.kingdom,
    borderTopWidth: 3,
  },
  chronicleDetailEyebrow: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  chronicleDetailTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  chronicleDetailFlavor: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 9,
    textAlign: 'center',
  },
  chronicleDetailDivider: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 2,
    marginBottom: 12,
    width: 96,
  },
  chronicleHeroDivider: {
    backgroundColor: '#F6C453',
  },
  chronicleQuestDivider: {
    backgroundColor: '#D9A24C',
  },
  chronicleEmpressDivider: {
    backgroundColor: '#B26C8B',
  },
  chronicleKingdomDivider: {
    backgroundColor: '#C8D58D',
  },
  chronicleStatGrid: {
    gap: 8,
  },
  chronicleStatCard: {
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderTopWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  chronicleStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 11,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  chronicleStatValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 19,
  },
  questChroniclePrimaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  questChronicleStatTile: {
    backgroundColor: 'rgba(217, 162, 76, 0.09)',
    borderColor: 'rgba(217, 162, 76, 0.24)',
    borderRadius: 8,
    borderTopWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  questChronicleSecondaryGrid: {
    gap: 8,
    marginBottom: 10,
  },
  questArchiveStatCard: {
    backgroundColor: 'rgba(217, 162, 76, 0.055)',
    borderColor: 'rgba(217, 162, 76, 0.16)',
  },
  questTrailPanel: {
    backgroundColor: 'rgba(23, 26, 22, 0.78)',
    borderColor: 'rgba(217, 162, 76, 0.18)',
    borderRadius: 9,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  questTrailTitle: {
    backgroundColor: 'rgba(217, 162, 76, 0.08)',
    borderBottomColor: 'rgba(217, 162, 76, 0.18)',
    borderBottomWidth: 1,
    color: '#D9C08A',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  questTrailList: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  questTrailDay: {
    alignItems: 'center',
    borderBottomColor: 'rgba(217, 162, 76, 0.1)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  questTrailMarker: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  questTrailMissed: {
    backgroundColor: '#2C3040',
    borderColor: '#4B5471',
    borderWidth: 1,
  },
  questTrailVictory: {
    backgroundColor: '#214734',
    borderColor: '#55D187',
    borderWidth: 1,
  },
  questTrailStrong: {
    backgroundColor: '#41371F',
    borderColor: '#F6C453',
    borderWidth: 1,
  },
  questTrailLegendary: {
    backgroundColor: '#2A1F40',
    borderColor: '#A970FF',
    borderWidth: 1,
  },
  questTrailMarkerText: {
    color: '#F4F1DE',
    fontSize: 12,
    fontWeight: '900',
  },
  questTrailDate: {
    color: '#F4F1DE',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  questTrailStatus: {
    color: '#A8B0C7',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 62,
    textAlign: 'right',
  },
  questTrailProgress: {
    color: '#D9C08A',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'right',
  },
  empressChroniclePrimaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  empressChronicleStatTile: {
    backgroundColor: 'rgba(178, 108, 139, 0.1)',
    borderColor: 'rgba(178, 108, 139, 0.24)',
    borderRadius: 8,
    borderTopWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  empressChronicleSecondaryGrid: {
    gap: 8,
    marginBottom: 10,
  },
  empressArchiveStatCard: {
    backgroundColor: 'rgba(178, 108, 139, 0.055)',
    borderColor: 'rgba(178, 108, 139, 0.16)',
  },
  empressJudgmentList: {
    gap: 9,
  },
  empressJudgmentListTitle: {
    color: '#D888A2',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 1,
  },
  empressJudgmentCard: {
    backgroundColor: '#120D17',
    borderColor: theme.colors.crimsonDeep,
    borderRadius: theme.radius.medium,
    borderTopWidth: 1,
    overflow: 'hidden',
    padding: 10,
  },
  empressJudgmentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 9,
  },
  empressJudgmentGlyph: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  empressJudgmentGlyphText: {
    color: '#F4F1DE',
    fontSize: 14,
    fontWeight: '900',
  },
  empressJudgmentHeaderText: {
    flex: 1,
  },
  empressJudgmentWeek: {
    color: '#F4F1DE',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  empressJudgmentFlavor: {
    color: '#A8B0C7',
    fontSize: 11,
    fontWeight: '700',
  },
  empressJudgmentResult: {
    borderRadius: 999,
    color: '#F4F1DE',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  empressJudgmentVictory: {
    backgroundColor: '#41371F',
    borderColor: '#F6C453',
    borderWidth: 1,
  },
  empressJudgmentDraw: {
    backgroundColor: '#2A2436',
    borderColor: '#A970FF',
    borderWidth: 1,
  },
  empressJudgmentDefeat: {
    backgroundColor: '#2C2330',
    borderColor: '#7C4C68',
    borderWidth: 1,
  },
  empressJudgmentMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  empressJudgmentMetric: {
    backgroundColor: 'rgba(244, 241, 222, 0.035)',
    borderColor: 'rgba(178, 108, 139, 0.14)',
    borderRadius: 7,
    borderTopWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  empressJudgmentMetricLabel: {
    color: '#A8B0C7',
    fontSize: 8,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 10,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  empressJudgmentMetricValue: {
    color: '#F4F1DE',
    fontSize: 12,
    fontWeight: '900',
  },
  empressChronicleEmptyFlavor: {
    color: '#7F879D',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  kingdomChroniclePrimaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  kingdomChronicleStatTile: {
    backgroundColor: 'rgba(200, 213, 141, 0.08)',
    borderColor: 'rgba(200, 213, 141, 0.22)',
    borderRadius: 8,
    borderTopWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  kingdomChronicleSecondaryGrid: {
    gap: 8,
    marginBottom: 10,
  },
  kingdomArchiveStatCard: {
    backgroundColor: 'rgba(200, 213, 141, 0.045)',
    borderColor: 'rgba(200, 213, 141, 0.14)',
  },
  kingdomRecordList: {
    gap: 9,
  },
  kingdomRecordListTitle: {
    color: '#C8D58D',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 1,
  },
  kingdomRecordCard: {
    backgroundColor: '#0F1711',
    borderColor: '#34472F',
    borderRadius: theme.radius.medium,
    borderTopWidth: 1,
    padding: 10,
  },
  kingdomRecordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 8,
  },
  kingdomRecordGlyph: {
    alignItems: 'center',
    backgroundColor: '#263725',
    borderColor: '#D9C08A',
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  kingdomRecordGlyphText: {
    color: '#F6C453',
    fontSize: 14,
    fontWeight: '900',
  },
  kingdomRecordHeaderText: {
    flex: 1,
  },
  kingdomRecordDate: {
    color: '#F4F1DE',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  kingdomRecordFlavor: {
    color: '#A8B0C7',
    fontSize: 11,
    fontWeight: '700',
  },
  kingdomRecordType: {
    backgroundColor: '#2A2B1F',
    borderColor: '#D9C08A',
    borderRadius: 999,
    borderWidth: 1,
    color: '#F4F1DE',
    fontSize: 9,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  kingdomRecordTask: {
    color: '#F4F1DE',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    marginBottom: 8,
  },
  kingdomRecordMetricGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  kingdomRecordMetric: {
    backgroundColor: 'rgba(244, 241, 222, 0.035)',
    borderColor: 'rgba(200, 213, 141, 0.14)',
    borderRadius: 7,
    borderTopWidth: 1,
    flex: 1,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  kingdomRecordMetricLabel: {
    color: '#A8B0C7',
    fontSize: 8,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 10,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  kingdomRecordMetricValue: {
    color: '#D9C08A',
    fontSize: 12,
    fontWeight: '900',
  },
  kingdomChronicleEmptyFlavor: {
    color: '#7F879D',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  heroChronicleSummary: {
    alignItems: 'center',
    backgroundColor: 'rgba(246, 196, 83, 0.08)',
    borderColor: 'rgba(246, 196, 83, 0.22)',
    borderRadius: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  heroChronicleSummaryLabel: {
    color: '#A8B0C7',
    fontSize: 9,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 11,
    textTransform: 'uppercase',
  },
  heroChronicleSummaryValue: {
    color: '#F6C453',
    fontSize: 16,
    fontWeight: '900',
  },
  heroChronicleDayList: {
    gap: 10,
  },
  heroChronicleDayPanel: {
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.medium,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  heroChronicleDate: {
    backgroundColor: 'rgba(246, 196, 83, 0.055)',
    borderBottomColor: 'rgba(246, 196, 83, 0.14)',
    borderBottomWidth: 1,
    color: '#D9C08A',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 11,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  heroChronicleDeedList: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroChronicleDeedRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(246, 196, 83, 0.1)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 5,
  },
  heroChronicleBullet: {
    color: '#F6C453',
    fontSize: 13,
    fontWeight: '900',
    width: 10,
  },
  heroChronicleDeedTitle: {
    color: '#F4F1DE',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  heroChronicleDeedTextBlock: {
    flex: 1,
  },
  heroChronicleDeedFlavor: {
    color: '#D9C08A',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },
  heroChronicleDeedTag: {
    backgroundColor: '#2A2436',
    borderColor: '#5A4B72',
    borderRadius: 999,
    borderWidth: 1,
    color: '#D9C08A',
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  heroChronicleEmptyState: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: 'rgba(217, 192, 138, 0.18)',
    borderRadius: 8,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  heroChronicleEmptyText: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  homeActions: {
    gap: 10,
    marginBottom: 16,
  },
  homeActionsCompact: {
    gap: 8,
    marginBottom: 12,
  },
  homeActionPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  gameButton: {
    alignItems: 'center',
    borderRadius: theme.radius.medium,
    borderTopWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 14,
  },
  primaryButton: {
    backgroundColor: theme.colors.gold,
    borderBottomColor: theme.colors.goldDeep,
    borderBottomWidth: 3,
    borderColor: theme.colors.goldBright,
    borderWidth: 1,
  },
  homeButtonCompact: {
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  primaryButtonEyebrow: {
    color: theme.colors.goldDeep,
    fontSize: 8,
    fontWeight: '900',
    marginBottom: 2,
  },
  secondaryButton: {
    backgroundColor: '#2D3244',
    borderBottomWidth: 4,
    borderColor: '#A970FF',
    borderTopColor: '#C8A3FF',
    borderLeftColor: '#3E4661',
    borderRightColor: '#3E4661',
    borderBottomColor: '#59627F',
    borderWidth: 2,
  },
  secondaryButtonText: {
    color: '#F4F1DE',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  shadowActionButton: {
    backgroundColor: '#261F38',
    borderBottomWidth: 4,
    borderColor: '#A970FF',
    borderTopColor: '#C8A3FF',
    borderLeftColor: '#6F42C1',
    borderRightColor: '#6F42C1',
    borderBottomColor: '#4E3477',
    borderWidth: 2,
  },
  shadowActionButtonText: {
    color: '#A970FF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroProgressCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  heroProgressCardCompact: {
    marginBottom: 10,
    padding: 12,
  },
  heroProgressTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroPanelAccent: {
    backgroundColor: '#7A5A2A',
    borderRadius: 999,
    height: 2,
    marginBottom: 10,
    opacity: 0.9,
    width: 76,
  },
  heroModalTitleCompact: {
    fontSize: 22,
    marginBottom: 8,
  },
  heroProgressValue: {
    color: theme.colors.goldBright,
    fontSize: 38,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroProgressEyebrow: {
    color: theme.colors.violetBright,
    fontSize: 8,
    fontWeight: '900',
    marginBottom: 3,
  },
  heroProgressHeadingRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroXpCountdown: {
    alignItems: 'flex-end',
  },
  heroXpCountdownValue: {
    color: theme.colors.gold,
    fontSize: 22,
    fontWeight: '900',
  },
  heroXpCountdownLabel: {
    color: theme.colors.textDim,
    fontSize: 8,
    fontWeight: '900',
  },
  heroProgressMeta: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  heroProgressMetaRight: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  heroXpMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statRow: {
    alignItems: 'center',
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  statRowCompact: {
    paddingVertical: 7,
  },
  statTextBlock: {
    flex: 1,
  },
  statSigil: {
    alignItems: 'center',
    backgroundColor: theme.colors.violetDeep,
    borderColor: theme.colors.violet,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  statSigilText: {
    color: theme.colors.violetBright,
    fontSize: 15,
    fontWeight: '900',
  },
  statLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  statValue: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  statMilestoneHint: {
    color: theme.colors.gold,
    fontSize: 8,
    fontWeight: '900',
    marginTop: 3,
  },
  statProgressBlock: {
    alignItems: 'flex-end',
    width: 128,
  },
  statValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    marginBottom: 5,
  },
  statPowerValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  statBarTrack: {
    backgroundColor: theme.colors.shadow,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
    width: 128,
  },
  statBarFill: {
    backgroundColor: theme.colors.violet,
    borderRadius: theme.radius.small,
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
  questSectionTitle: {
    marginBottom: 6,
    textAlign: 'center',
  },
  sectionDate: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 14,
  },
  questSectionDate: {
    marginBottom: 16,
    textAlign: 'center',
  },
  debugDateLabel: {
    color: '#F6C453',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  questHeaderText: {
    textAlign: 'center',
  },
  kingdomSubtitle: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  kingdomHeaderBanner: {
    alignItems: 'center',
    backgroundColor: '#202535',
    borderColor: '#4B5471',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  kingdomHeaderDate: {
    color: '#F6C453',
    marginBottom: 0,
    textAlign: 'center',
  },
  kingdomHeaderDivider: {
    backgroundColor: '#7A5A2A',
    borderRadius: 999,
    height: 2,
    marginBottom: 10,
    opacity: 0.9,
    width: 88,
  },
  kingdomHeaderTitle: {
    color: '#F4F1DE',
    marginBottom: 6,
    textAlign: 'center',
  },
  kingdomCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  kingdomCastleImage: {
    alignSelf: 'stretch',
    height: 220,
    width: '100%',
  },
  kingdomImageShade: {
    backgroundColor: 'rgba(9, 11, 18, 0.46)',
    height: 220,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  kingdomIdentity: {
    left: 16,
    position: 'absolute',
    top: 154,
  },
  kingdomMetricsPanel: {
    padding: 14,
  },
  kingdomCardTitle: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 4,
  },
  kingdomStateLabel: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  kingdomMetricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kingdomMetricLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  kingdomMetricValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  kingdomProsperityTrack: {
    backgroundColor: theme.colors.shadow,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  kingdomProsperityFill: {
    backgroundColor: theme.colors.kingdom,
    borderRadius: theme.radius.small,
    height: '100%',
  },
  kingdomLegacyTrack: {
    backgroundColor: theme.colors.shadow,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 14,
    overflow: 'hidden',
  },
  kingdomLegacyFill: {
    backgroundColor: theme.colors.violet,
    borderRadius: theme.radius.small,
    height: '100%',
  },
  kingdomDecreesPanel: {
    backgroundColor: theme.colors.surfaceWarm,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    paddingHorizontal: KINGDOM_DECREE_PANEL_HORIZONTAL_PADDING,
    paddingTop: 11,
    paddingBottom: 10,
    shadowColor: '#A970FF',
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  kingdomDecreesSeal: {
    alignSelf: 'center',
    backgroundColor: theme.colors.gold,
    borderRadius: 999,
    height: 2,
    marginBottom: 8,
    opacity: 0.9,
    width: 70,
  },
  kingdomDecreesTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 3,
    textAlign: 'center',
  },
  kingdomDecreesSubtitle: {
    color: '#D7C7A3',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  kingdomDecreeList: {
    gap: KINGDOM_DECREE_CARD_GAP,
    paddingHorizontal: KINGDOM_DECREE_LIST_HORIZONTAL_PADDING,
  },
  kingdomDecreeCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.medium,
    borderWidth: 1.25,
    minHeight: 138,
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  kingdomDecreeCardCompleted: {
    borderColor: theme.colors.green,
    backgroundColor: '#101B18',
  },
  kingdomDecreeCardDisabled: {
    opacity: 0.42,
  },
  kingdomDecreeGlyph: {
    color: theme.colors.gold,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 3,
    textAlign: 'center',
  },
  kingdomDecreeType: {
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  kingdomDecreeTask: {
    color: '#C8C0B2',
    fontSize: 8,
    fontWeight: '600',
    lineHeight: 11,
    marginBottom: 6,
    minHeight: 22,
    textAlign: 'center',
  },
  kingdomDecreeReward: {
    color: '#DDB875',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
    marginBottom: 7,
    minHeight: 24,
    textAlign: 'center',
  },
  kingdomDecreeStatePill: {
    alignItems: 'center',
    backgroundColor: '#2C3040',
    borderColor: '#4B5471',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 'auto',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  kingdomDecreeStatePillCompleted: {
    backgroundColor: '#214734',
    borderColor: '#55D187',
  },
  kingdomDecreeStatePillDisabled: {
    backgroundColor: '#20232E',
    borderColor: '#3B4052',
  },
  kingdomDecreeState: {
    color: '#A8B0C7',
    fontSize: 8,
    fontWeight: '900',
  },
  kingdomDecreeStateCompleted: {
    color: '#CFF4DC',
  },
  kingdomDecreesFootnote: {
    color: '#A8B0C7',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 10,
    textAlign: 'center',
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
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderLeftColor: theme.colors.green,
    borderLeftWidth: 3,
    marginBottom: 14,
    padding: 14,
  },
  dailyProgressCardCompact: {
    marginBottom: 8,
    padding: 12,
  },
  dailyProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dailyProgressTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  dailyProgressEyebrow: {
    color: theme.colors.green,
    fontSize: 8,
    fontWeight: '900',
    marginBottom: 2,
  },
  dailyProgressValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  dailyProgressTarget: {
    color: theme.colors.textDim,
    fontSize: 12,
  },
  dailyProgressTrack: {
    backgroundColor: theme.colors.shadow,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 14,
    overflow: 'hidden',
  },
  dailyProgressFill: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.small,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  dailyProgressMessage: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },
  xpToast: {
    alignSelf: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    bottom: 26,
    paddingHorizontal: 20,
    paddingVertical: 11,
    position: 'absolute',
    shadowColor: theme.colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  xpToastText: {
    color: theme.colors.goldBright,
    fontSize: 18,
    fontWeight: '900',
  },
  trainingCompleteOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 10, 17, 0.84)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  trainingCompleteCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    maxWidth: 390,
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: theme.colors.gold,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 30,
    width: '100%',
  },
  trainingImpactFlash: {
    backgroundColor: theme.colors.gold,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  trainingCompleteHeaderGlow: {
    backgroundColor: theme.colors.gold,
    height: 2,
    marginBottom: 8,
    opacity: 0.9,
    width: 150,
  },
  trainingCompleteEyebrow: {
    color: theme.colors.violetBright,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
  },
  trainingHeroStage: {
    alignItems: 'center',
    height: 126,
    justifyContent: 'center',
    marginBottom: 2,
    position: 'relative',
    width: 190,
  },
  trainingAuraOuter: {
    backgroundColor: 'rgba(169, 112, 255, 0.07)',
    borderColor: 'rgba(169, 112, 255, 0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 118,
    position: 'absolute',
    width: 164,
  },
  trainingAuraInner: {
    backgroundColor: 'rgba(246, 196, 83, 0.06)',
    borderColor: 'rgba(246, 196, 83, 0.5)',
    borderRadius: 999,
    borderWidth: 1,
    height: 92,
    position: 'absolute',
    width: 128,
  },
  trainingCompleteSprite: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  trainingCompleteTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  trainingCompleteSubhead: {
    color: '#D9C08A',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  trainingRewardSequence: {
    alignSelf: 'stretch',
    gap: 8,
  },
  trainingPrimaryReward: {
    alignItems: 'center',
    borderBottomColor: '#3E4661',
    borderBottomWidth: 1,
    borderTopColor: '#3E4661',
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  trainingRewardLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  trainingStatTransition: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 1,
  },
  trainingStatPrevious: {
    color: '#6F778E',
    fontSize: 19,
    fontWeight: '900',
  },
  trainingStatArrow: {
    color: theme.colors.violetBright,
    fontSize: 18,
    fontWeight: '900',
  },
  trainingStatCurrent: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  trainingBodyReward: {
    color: theme.colors.green,
    fontSize: 14,
    fontWeight: '900',
  },
  trainingXpPanel: {
    alignSelf: 'stretch',
    paddingHorizontal: 2,
  },
  trainingXpHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  trainingXpReward: {
    color: theme.colors.goldBright,
    fontSize: 18,
    fontWeight: '900',
  },
  trainingXpTrack: {
    backgroundColor: '#0E1018',
    borderColor: '#7D6840',
    borderRadius: 4,
    borderWidth: 1,
    height: 17,
    overflow: 'hidden',
    position: 'relative',
  },
  trainingXpFill: {
    backgroundColor: theme.colors.gold,
    height: '100%',
  },
  trainingXpShine: {
    backgroundColor: 'rgba(244, 241, 222, 0.34)',
    height: 2,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  trainingXpMeta: {
    color: '#A8B0C7',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  trainingXpMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  trainingXpSource: {
    color: '#D9C08A',
    fontSize: 10,
    fontWeight: '900',
  },
  trainingBonusBanner: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(169, 112, 255, 0.1)',
    borderLeftColor: '#A970FF',
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  trainingReturnBonus: {
    color: '#C8A3FF',
    fontSize: 12,
    fontWeight: '900',
  },
  trainingLevelUpBanner: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(246, 196, 83, 0.09)',
    borderColor: '#F6C453',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  trainingLevelUpLabel: {
    color: '#F6C453',
    fontSize: 13,
    fontWeight: '900',
  },
  trainingLevelUpValue: {
    color: '#F4F1DE',
    fontSize: 18,
    fontWeight: '900',
  },
  bodyAscendedBox: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(85, 209, 135, 0.08)',
    borderColor: 'rgba(85, 209, 135, 0.32)',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bodyAscendedTitle: {
    color: '#55D187',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  bodyAscendedValue: {
    color: '#F4F1DE',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  bodyAscendedFlavor: {
    color: '#A8B0C7',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'center',
  },
  levelUpOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 3, 8, 0.88)',
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
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.violet,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 26,
    shadowColor: theme.colors.violet,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    width: '100%',
  },
  levelUpTitle: {
    color: theme.colors.goldBright,
    fontSize: 31,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
  },
  levelUpLevelText: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  levelUpArrow: {
    color: theme.colors.violetBright,
    fontSize: 24,
    fontWeight: '900',
    marginVertical: 8,
  },
  levelUpNewLevelText: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'center',
  },
  levelUpTitleMeta: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  levelUpNewTitleMeta: {
    color: theme.colors.gold,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  levelUpStatsBox: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
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
    gap: 22,
  },
  bonusEffortCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  bonusEffortTitle: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 10,
  },
  bonusEffortButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.violetDeep,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    paddingVertical: 12,
  },
  bonusEffortButtonText: {
    color: theme.colors.text,
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
    backgroundColor: 'transparent',
  },
  questGroupTitle: {
    alignSelf: 'stretch',
    borderBottomColor: theme.colors.goldDeep,
    borderBottomWidth: 1,
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 9,
    paddingBottom: 7,
    textAlign: 'left',
  },
  questGroupList: {
    gap: 8,
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
