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
        WEEKLY JUDGMENT
      </Text>
      <View style={styles.judgmentGrid}>
        <View style={styles.judgmentTile}>
          <Text style={styles.label}>Victory Days</Text>
          <Text style={styles.value}>{weeklyBattle.victoryDays} / 7</Text>
        </View>
        <View style={styles.judgmentTile}>
          <Text style={styles.label}>Kingdom Favor</Text>
          <Text style={styles.value}>
            +{weeklyBattle.kingdomFavorCounted} / +2
          </Text>
        </View>
        <View style={styles.judgmentTile}>
          <Text style={styles.label}>Empress Score</Text>
          <Text style={styles.value}>{weeklyBattle.empressScore}</Text>
        </View>
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
      <View style={[styles.resultRow, compact ? styles.rowCompact : null]}>
        <Text style={styles.label}>Projected</Text>
        <Text style={styles.result}>{weeklyBattle.result}</Text>
      </View>
      <View style={[styles.secondaryRow, compact ? styles.rowCompact : null]}>
        <Text style={styles.secondaryLabel}>Strong</Text>
        <Text style={styles.secondaryValue}>{weeklyBattle.strongDays}</Text>
        <Text style={styles.secondaryLabel}>Legendary</Text>
        <Text style={styles.secondaryValue}>{weeklyBattle.legendaryDays}</Text>
      </View>
      <Text style={styles.favorNote}>
        The Empress favors a ruler who keeps his realm intact.
      </Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#171923',
    borderColor: '#5A4B72',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 28,
    padding: 14,
  },
  cardCompact: {
    marginBottom: 14,
    padding: 12,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  titleCompact: {
    marginBottom: 8,
  },
  resultRow: {
    alignItems: 'center',
    backgroundColor: '#1F1B2B',
    borderColor: '#4E3477',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowCompact: {
    marginBottom: 5,
  },
  judgmentGrid: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
  },
  judgmentTile: {
    alignItems: 'center',
    backgroundColor: '#202535',
    borderColor: '#3E4661',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 5,
    paddingVertical: 8,
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
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  value: {
    color: '#F6C453',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  result: {
    color: '#A970FF',
    fontSize: 16,
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
    marginTop: 1,
    textAlign: 'center',
  },
});
