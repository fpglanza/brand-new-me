import { StyleSheet, Text, View } from 'react-native';

import type { FinalizedBattleResult } from '../types/game';

type FinalizedBattleCardProps = {
  finalizedBattle: FinalizedBattleResult;
};

export function FinalizedBattleCard({
  finalizedBattle,
}: FinalizedBattleCardProps) {
  const completionPercent = Math.round(finalizedBattle.completionRate * 100);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>FINALIZED BATTLE</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Result</Text>
        <Text style={styles.result}>{finalizedBattle.result}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Completion</Text>
        <Text style={styles.value}>{completionPercent}%</Text>
      </View>
      <Text style={styles.flavor}>Message: {finalizedBattle.flavorText}</Text>
    </View>
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
