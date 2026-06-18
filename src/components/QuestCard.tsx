import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Quest } from '../types/game';

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

export function QuestCard({
  quest,
  onToggle,
  showCategoryLabel = true,
}: QuestCardProps) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const previousCompletedRef = useRef(quest.completed);
  const isBonusQuest = quest.source === 'bonus';
  const isCarriedOver = isCarriedOverQuest(quest);
  const displayTitle = getDisplayQuestTitle(quest);

  useEffect(() => {
    if (!previousCompletedRef.current && quest.completed) {
      pulseScale.stopAnimation();
      pulseScale.setValue(1);
      Animated.sequence([
        Animated.timing(pulseScale, {
          duration: 120,
          toValue: 1.025,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          duration: 150,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }

    previousCompletedRef.current = quest.completed;
  }, [pulseScale, quest.completed]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{
        selected: quest.completed,
      }}
      onPress={() => onToggle(quest)}
      style={[
        styles.questCard,
        quest.completed ? styles.questCompleted : styles.questIncomplete,
        { transform: [{ scale: pulseScale }] },
      ]}
    >
      <View
        style={[
          styles.questAccent,
          quest.completed
            ? styles.questAccentCompleted
            : styles.questAccentIncomplete,
        ]}
      />
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
        <Text style={styles.questReward}>+{quest.xp} XP</Text>
      </View>
      <View
        style={[
          styles.questStatus,
          quest.completed && styles.questStatusCompleted,
        ]}
      >
        {quest.completed ? <Text style={styles.questStatusText}>✓</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

export function QuestLoadingCard() {
  return (
    <View style={styles.questCard}>
      <View style={[styles.questAccent, styles.questAccentIncomplete]} />
      <View style={styles.questBody}>
        <Text style={styles.questTitle}>Loading quests...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  questCard: {
    alignItems: 'center',
    backgroundColor: '#1C2130',
    borderColor: '#4B5471',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    minHeight: 74,
    overflow: 'hidden',
    paddingRight: 16,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
  },
  questCompleted: {
    borderColor: '#55D187',
  },
  questIncomplete: {
    borderColor: '#4B5471',
  },
  questAccent: {
    alignSelf: 'stretch',
    marginRight: 14,
    width: 7,
  },
  questAccentCompleted: {
    backgroundColor: '#55D187',
  },
  questAccentIncomplete: {
    backgroundColor: '#7A5A2A',
  },
  questBody: {
    flex: 1,
    paddingVertical: 16,
  },
  questCategory: {
    color: '#A970FF',
    fontSize: 11,
    fontWeight: '900',
  },
  questMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  questSourceBadge: {
    backgroundColor: '#F6C453',
    borderRadius: 6,
    color: '#171923',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  questCarriedOverBadge: {
    backgroundColor: '#4A2B17',
    borderRadius: 6,
    color: '#F2A65A',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  questTitle: {
    color: '#F4F1DE',
    fontSize: 16,
    fontWeight: '800',
  },
  questDescription: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 5,
  },
  questReward: {
    color: '#F6C453',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 5,
  },
  questStatus: {
    alignItems: 'center',
    borderColor: '#3E4661',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  questStatusCompleted: {
    backgroundColor: '#55D187',
    borderColor: '#55D187',
  },
  questStatusText: {
    color: '#171923',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 21,
  },
});
