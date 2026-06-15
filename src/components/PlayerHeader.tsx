import { StyleSheet, Text, View } from 'react-native';

type PlayerHeaderProps = {
  level: number;
  currentXp: number;
  totalXp: number;
  xpGoal: number;
};

export function PlayerHeader({
  level,
  currentXp,
  totalXp,
  xpGoal,
}: PlayerHeaderProps) {
  const xpProgress = `${currentXp}%` as `${number}%`;

  return (
    <View style={styles.header}>
      <Text style={styles.level}>HERO XP</Text>
      <Text style={styles.title}>Novice Adventurer</Text>

      <View style={styles.xpRow}>
        <Text style={styles.xpLabel}>Total XP: {totalXp}</Text>
        <Text style={styles.xpValue}>Level {level}</Text>
      </View>

      <Text style={styles.levelProgress}>
        Level progress: {currentXp} / {xpGoal}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: xpProgress }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 22,
  },
  level: {
    color: '#F6C453',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 8,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 22,
  },
  xpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  xpLabel: {
    color: '#A8B0C7',
    fontSize: 14,
    fontWeight: '700',
  },
  xpValue: {
    color: '#F6C453',
    fontSize: 16,
    fontWeight: '900',
  },
  levelProgress: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  progressTrack: {
    backgroundColor: '#242938',
    borderColor: '#3E4661',
    borderRadius: 8,
    borderWidth: 1,
    height: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#F6C453',
    borderRadius: 8,
    height: '100%',
  },
});
