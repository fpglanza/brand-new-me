import { StyleSheet, Text, View } from 'react-native';

import type { FinalizedBattleResult } from '../types/game';
import { theme } from '../theme';

type FinalizedBattleCardProps = {
  finalizedBattle: FinalizedBattleResult;
};

export function FinalizedBattleCard({
  finalizedBattle,
}: FinalizedBattleCardProps) {
  const victoryDays = Math.round(finalizedBattle.completionRate * 7);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>FINAL JUDGMENT</Text>
      <View style={styles.resultRow}>
        <Text style={styles.label}>Final</Text>
        <Text style={styles.result}>{finalizedBattle.result}</Text>
      </View>
      <View style={styles.judgmentGrid}>
        <View style={styles.judgmentTile}>
          <Text style={styles.label}>Victory Days</Text>
          <Text style={styles.value}>{victoryDays} / 7</Text>
        </View>
        <View style={styles.judgmentTile}>
          <Text style={styles.label}>Kingdom Favor</Text>
          <Text style={styles.value}>
            +{finalizedBattle.kingdomFavorCounted} / +2
          </Text>
        </View>
        <View style={styles.judgmentTile}>
          <Text style={styles.label}>Empress Score</Text>
          <Text style={styles.value}>{finalizedBattle.empressScore}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    marginBottom: 28,
    padding: 14,
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  resultRow: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.violetDeep,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  judgmentGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  judgmentTile: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundRaised,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  value: {
    color: theme.colors.gold,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  result: {
    color: theme.colors.violetBright,
    fontSize: 16,
    fontWeight: '900',
  },
});
