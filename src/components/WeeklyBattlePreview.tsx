import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { WeeklyBattlePreview as WeeklyBattlePreviewData } from '../types/game';

type WeeklyBattlePreviewProps = {
  compact?: boolean;
  weeklyBattle: WeeklyBattlePreviewData;
  onPress?: () => void;
};

const WEEKLY_PROGRESS_ANIMATION_MS = 900;

export function WeeklyBattlePreview({
  compact = false,
  onPress,
  weeklyBattle,
}: WeeklyBattlePreviewProps) {
  const Container = onPress ? Pressable : View;
  const victoryDaysAnim = useRef(new Animated.Value(0)).current;
  const victoryDaysWidth = victoryDaysAnim.interpolate({
    inputRange: [0, 7],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    victoryDaysAnim.stopAnimation();
    victoryDaysAnim.setValue(0);
    Animated.timing(victoryDaysAnim, {
      duration: WEEKLY_PROGRESS_ANIMATION_MS,
      toValue: Math.max(0, Math.min(weeklyBattle.victoryDays, 7)),
      useNativeDriver: false,
    }).start();
  }, [victoryDaysAnim, weeklyBattle.victoryDays, weeklyBattle.weekStart]);

  return (
    <Container
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={[styles.card, compact ? styles.cardCompact : null]}
    >
      <Text style={[styles.title, compact ? styles.titleCompact : null]}>
        WEEKLY CHALLENGE
      </Text>
      <View style={[styles.row, compact ? styles.rowCompact : null]}>
        <Text style={styles.label}>Victory Days</Text>
        <Text style={styles.value}>{weeklyBattle.victoryDays} / 7</Text>
      </View>
      <View
        style={[
          styles.progressTrack,
          compact ? styles.progressTrackCompact : null,
        ]}
      >
        <Animated.View
          style={[styles.progressFill, { width: victoryDaysWidth }]}
        />
      </View>
      <View style={[styles.row, compact ? styles.rowCompact : null]}>
        <Text style={styles.label}>Kingdom Favor</Text>
        <Text style={styles.value}>
          +{weeklyBattle.kingdomFavorCounted} / +2
        </Text>
      </View>
      <View style={[styles.row, compact ? styles.rowCompact : null]}>
        <Text style={styles.label}>Empress Score</Text>
        <Text style={styles.value}>{weeklyBattle.empressScore}</Text>
      </View>
      <View style={[styles.row, compact ? styles.rowCompact : null]}>
        <Text style={styles.label}>Projected Result</Text>
        <Text style={styles.result}>{weeklyBattle.result}</Text>
      </View>
      <View style={[styles.secondaryRow, compact ? styles.rowCompact : null]}>
        <Text style={styles.secondaryLabel}>Strong Days</Text>
        <Text style={styles.secondaryValue}>{weeklyBattle.strongDays}</Text>
        <Text style={styles.secondaryLabel}>Legendary Days</Text>
        <Text style={styles.secondaryValue}>{weeklyBattle.legendaryDays}</Text>
      </View>
      <Text style={styles.favorNote}>
        The Empress favors a ruler who keeps his realm intact.
      </Text>
      <Text style={[styles.flavor, compact ? styles.flavorCompact : null]}>
        {weeklyBattle.flavorText}
      </Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E2331',
    borderColor: '#3B435C',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 28,
    padding: 16,
  },
  cardCompact: {
    marginBottom: 14,
    padding: 12,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  titleCompact: {
    marginBottom: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowCompact: {
    marginBottom: 5,
  },
  progressTrack: {
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    height: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressTrackCompact: {
    marginBottom: 8,
  },
  progressFill: {
    backgroundColor: '#A970FF',
    borderRadius: 8,
    height: '100%',
  },
  label: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    color: '#F6C453',
    fontSize: 15,
    fontWeight: '900',
  },
  result: {
    color: '#A970FF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  secondaryLabel: {
    color: '#7F879D',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryValue: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 6,
  },
  favorNote: {
    color: '#DDB875',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 6,
  },
  flavor: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4,
  },
  flavorCompact: {
    lineHeight: 18,
    marginTop: 2,
  },
});
