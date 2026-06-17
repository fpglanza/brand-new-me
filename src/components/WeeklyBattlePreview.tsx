import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { WeeklyBattlePreview as WeeklyBattlePreviewData } from '../types/game';

type WeeklyBattlePreviewProps = {
  weeklyBattle: WeeklyBattlePreviewData;
  onPress?: () => void;
};

const WEEKLY_PROGRESS_ANIMATION_MS = 900;

export function WeeklyBattlePreview({
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
      style={styles.card}
    >
      <Text style={styles.title}>WEEKLY CHALLENGE</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Victory Days</Text>
        <Text style={styles.value}>{weeklyBattle.victoryDays} / 7</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: victoryDaysWidth }]}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Strong Days</Text>
        <Text style={styles.value}>{weeklyBattle.strongDays}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Legendary Days</Text>
        <Text style={styles.value}>{weeklyBattle.legendaryDays}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Projected Result</Text>
        <Text style={styles.result}>{weeklyBattle.result}</Text>
      </View>
      <Text style={styles.flavor}>{weeklyBattle.flavorText}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 28,
    padding: 16,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  flavor: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4,
  },
});
