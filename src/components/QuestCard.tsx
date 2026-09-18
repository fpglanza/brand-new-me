import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Quest } from '../types/game';
import { theme } from '../theme';

type QuestCardProps = {
  quest: Quest;
  onToggle: (quest: Quest) => void;
  showCategoryLabel?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const CARRIED_OVER_TITLE_SUFFIX = ' — Carried Over';

function isCarriedOverQuest(quest: Quest) {
  return (
    quest.source === 'carryover' ||
    quest.title.endsWith(CARRIED_OVER_TITLE_SUFFIX)
  );
}

function getDisplayQuestTitle(quest: Quest) {
  if (!isCarriedOverQuest(quest)) {
    return quest.title;
  }

  return quest.title.replace(CARRIED_OVER_TITLE_SUFFIX, '');
}

function getCategoryGlyph(category: string) {
  switch (category) {
    case 'Body':
      return '◆';
    case 'Mind':
      return '✦';
    case 'Purpose':
      return '▲';
    case 'Appearance':
      return '◇';
    case 'Fuel':
      return '✚';
    case 'Recovery':
      return '☾';
    case 'Stewardship':
      return '♜';
    default:
      return '·';
  }
}

export function QuestCard({
  quest,
  onToggle,
  showCategoryLabel = true,
}: QuestCardProps) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const completionFlashOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(1)).current;
  const previousCompletedRef = useRef(quest.completed);
  const isBonusQuest = quest.source === 'bonus';
  const isCarriedOver = isCarriedOverQuest(quest);
  const isTrainingQuest = quest.templateId.startsWith('workout-');
  const displayTitle = getDisplayQuestTitle(quest);

  useEffect(() => {
    if (!previousCompletedRef.current && quest.completed) {
      pulseScale.stopAnimation();
      completionFlashOpacity.stopAnimation();
      checkScale.stopAnimation();
      pulseScale.setValue(1);
      completionFlashOpacity.setValue(0);
      checkScale.setValue(0.65);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(pulseScale, {
            friction: 5,
            tension: 150,
            toValue: 1.035,
            useNativeDriver: true,
          }),
          Animated.spring(pulseScale, {
            friction: 7,
            tension: 90,
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(completionFlashOpacity, {
            duration: 90,
            toValue: 0.28,
            useNativeDriver: true,
          }),
          Animated.timing(completionFlashOpacity, {
            duration: 420,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(checkScale, {
          friction: 5,
          tension: 180,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }

    previousCompletedRef.current = quest.completed;
  }, [checkScale, completionFlashOpacity, pulseScale, quest.completed]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{
        selected: quest.completed,
      }}
      onPress={() => onToggle(quest)}
      style={[
        styles.questCard,
        isTrainingQuest ? styles.trainingQuest : null,
        quest.completed ? styles.questCompleted : styles.questIncomplete,
        { transform: [{ scale: pulseScale }] },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.completionFlash,
          { opacity: completionFlashOpacity },
        ]}
      />
      <View style={styles.questSigilColumn}>
        <View
          style={[
            styles.questSigil,
            isTrainingQuest ? styles.trainingSigil : null,
            quest.completed ? styles.questSigilCompleted : null,
          ]}
        >
          <Text style={styles.questSigilText}>
            {getCategoryGlyph(quest.category)}
          </Text>
        </View>
        {isTrainingQuest ? (
          <Text style={styles.trainingLabel}>TRAINING</Text>
        ) : null}
      </View>
      <View style={styles.questBody}>
        {showCategoryLabel || isBonusQuest || isCarriedOver ? (
          <View style={styles.questMetaRow}>
            {showCategoryLabel ? (
              <Text style={styles.questCategory}>{quest.category}</Text>
            ) : null}
            {isBonusQuest ? (
              <Text style={styles.questSourceBadge}>BONUS</Text>
            ) : null}
            {isCarriedOver ? (
              <Text style={styles.questCarriedOverBadge}>CARRIED OVER</Text>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.questTitle}>{displayTitle}</Text>
        <Text style={styles.questDescription}>{quest.description}</Text>
        <View style={styles.questRewardRow}>
          <Text style={styles.questRewardLabel}>REWARD</Text>
          <Text style={styles.questReward}>+{quest.xp} XP</Text>
        </View>
      </View>
      <Animated.View
        style={[
          styles.questStatus,
          quest.completed && styles.questStatusCompleted,
          quest.completed ? { transform: [{ scale: checkScale }] } : null,
        ]}
      >
        {quest.completed ? <Text style={styles.questStatusText}>✓</Text> : null}
      </Animated.View>
    </AnimatedPressable>
  );
}

export function QuestLoadingCard() {
  return (
    <View style={styles.questCard}>
      <View style={styles.questSigilColumn} />
      <View style={styles.questBody}>
        <Text style={styles.questTitle}>Loading quests...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  questCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 92,
    overflow: 'hidden',
    paddingRight: 13,
  },
  trainingQuest: {
    backgroundColor: '#151522',
    borderColor: theme.colors.violetDeep,
    borderLeftColor: theme.colors.violet,
    borderLeftWidth: 3,
    minHeight: 108,
  },
  questCompleted: {
    backgroundColor: '#101B18',
    borderColor: theme.colors.greenDeep,
    shadowColor: theme.colors.green,
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  completionFlash: {
    backgroundColor: '#F6C453',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  questIncomplete: {
    borderColor: theme.colors.border,
  },
  questSigilColumn: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginRight: 12,
    minWidth: 58,
    paddingLeft: 8,
  },
  questSigil: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.goldDeep,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  trainingSigil: {
    backgroundColor: theme.colors.violetDeep,
    borderColor: theme.colors.violet,
  },
  questSigilCompleted: {
    backgroundColor: theme.colors.greenDeep,
    borderColor: theme.colors.green,
  },
  questSigilText: {
    color: theme.colors.goldBright,
    fontSize: 17,
    fontWeight: '900',
  },
  trainingLabel: {
    color: theme.colors.violetBright,
    fontSize: 7,
    fontWeight: '900',
    marginTop: 5,
  },
  questBody: {
    flex: 1,
    paddingVertical: 13,
  },
  questCategory: {
    color: theme.colors.violetBright,
    fontSize: 9,
    fontWeight: '900',
  },
  questMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  questSourceBadge: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.small,
    color: theme.colors.background,
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  questCarriedOverBadge: {
    backgroundColor: '#382617',
    borderRadius: theme.radius.small,
    color: '#E4A866',
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  questTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  questDescription: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 5,
  },
  questRewardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 7,
  },
  questRewardLabel: {
    color: theme.colors.textDim,
    fontSize: 8,
    fontWeight: '900',
  },
  questReward: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  questStatus: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  questStatusCompleted: {
    backgroundColor: theme.colors.green,
    borderColor: theme.colors.green,
  },
  questStatusText: {
    color: theme.colors.background,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 21,
  },
});
