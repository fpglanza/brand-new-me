import { StyleSheet, Text, View } from 'react-native';

import type { FinalizedBattleResult } from '../types/game';

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
    backgroundColor: '#171923',
    borderColor: '#5A4B72',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 28,
    padding: 14,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  resultRow: {
    alignItems: 'center',
    backgroundColor: '#1F1B2B',
    borderColor: '#4E3477',
    borderRadius: 10,
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
    backgroundColor: '#202535',
    borderColor: '#3E4661',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 5,
    paddingVertical: 8,
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
});
