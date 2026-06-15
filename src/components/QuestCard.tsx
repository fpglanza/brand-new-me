import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Quest } from '../types/game';

type QuestCardProps = {
  quest: Quest;
  onToggle: (quest: Quest) => void;
};

export function QuestCard({ quest, onToggle }: QuestCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected: quest.completed,
      }}
      onPress={() => onToggle(quest)}
      style={[
        styles.questCard,
        quest.completed ? styles.questCompleted : styles.questIncomplete,
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
        <Text style={styles.questCategory}>{quest.category}</Text>
        <Text style={styles.questTitle}>{quest.title}</Text>
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
    </Pressable>
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
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 74,
    overflow: 'hidden',
    paddingRight: 16,
  },
  questCompleted: {
    borderColor: '#55D187',
  },
  questIncomplete: {
    borderColor: '#3E4661',
  },
  questAccent: {
    alignSelf: 'stretch',
    marginRight: 16,
    width: 5,
  },
  questAccentCompleted: {
    backgroundColor: '#55D187',
  },
  questAccentIncomplete: {
    backgroundColor: '#3E4661',
  },
  questBody: {
    flex: 1,
    paddingVertical: 16,
  },
  questCategory: {
    color: '#A970FF',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
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
