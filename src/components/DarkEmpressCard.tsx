import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import type { WeeklyResult } from '../types/game';

type DarkEmpressCardProps = {
  currentPower: number;
  maxPower: number;
  result?: WeeklyResult | null;
};

const PORTRAIT = require('../assets/dark-empress/dark-empress-portrait.png');
const ORNAMENT_FRAME = require('../assets/dark-empress/dark-empress-ornament-frame.png');
const DEMAND_REVEAL_ANIMATION_MS = 1000;

function getMood(result?: WeeklyResult | null) {
  switch (result) {
    case 'Victory':
      return 'Content';
    case 'Draw':
      return 'Watching';
    case 'Defeat':
      return 'Displeased';
    default:
      return 'Watching';
  }
}

export function DarkEmpressCard({
  currentPower,
  maxPower,
  result,
}: DarkEmpressCardProps) {
  const mood = getMood(result);
  const demandAnim = useRef(new Animated.Value(maxPower)).current;
  const safeMaxPower = Math.max(maxPower, 1);
  const safeCurrentPower = Math.max(0, Math.min(currentPower, safeMaxPower));
  const demandWidth = demandAnim.interpolate({
    inputRange: [0, safeMaxPower],
    outputRange: ['0%', '100%'],
  });

  useEffect(() => {
    demandAnim.stopAnimation();
    demandAnim.setValue(safeMaxPower);
    Animated.timing(demandAnim, {
      duration: DEMAND_REVEAL_ANIMATION_MS,
      toValue: safeCurrentPower,
      useNativeDriver: false,
    }).start();
  }, [demandAnim, safeCurrentPower, safeMaxPower]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>THE DARK EMPRESS</Text>
      <View style={styles.moodRow}>
        <Text style={styles.moodLabel}>Current Mood:</Text>
        <Text style={styles.moodValue}>{mood}</Text>
      </View>

      <View style={styles.portraitStage}>
        <View style={styles.portraitGlow} />
        <Image
          resizeMode="cover"
          source={PORTRAIT}
          style={styles.portrait}
        />
        <Image
          resizeMode="contain"
          source={ORNAMENT_FRAME}
          style={styles.ornamentFrame}
        />
      </View>

      <View style={styles.demandMeter}>
        <View style={styles.demandHeader}>
          <Text style={styles.demandLabel}>Demand</Text>
          <Text style={styles.demandValue}>
            {currentPower} / {maxPower}
          </Text>
        </View>
        <View style={styles.demandTrack}>
          <Animated.View
            style={[
              styles.demandFill,
              { width: demandWidth },
            ]}
          >
            <View style={styles.demandFillHighlight} />
            <View style={styles.demandFillCore} />
          </Animated.View>
        </View>
        <Text style={styles.demandSubtitle}>The Empress expects much.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#242938',
    borderColor: '#A970FF',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    shadowColor: '#A970FF',
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  moodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  moodLabel: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
  },
  moodValue: {
    color: '#F6C453',
    fontSize: 14,
    fontWeight: '900',
  },
  portraitStage: {
    alignItems: 'center',
    height: 286,
    justifyContent: 'flex-start',
    position: 'relative',
    width: 286,
  },
  portraitGlow: {
    backgroundColor: '#A970FF',
    borderRadius: 136,
    height: 272,
    opacity: 0.18,
    position: 'absolute',
    top: 6,
    width: 272,
  },
  portrait: {
    borderColor: '#6F42C1',
    borderRadius: 126,
    borderWidth: 2,
    height: 252,
    width: 252,
  },
  ornamentFrame: {
    bottom: -4,
    height: 132,
    position: 'absolute',
    width: 272,
  },
  demandMeter: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
  demandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  demandLabel: {
    color: '#F4F1DE',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  demandValue: {
    color: '#A970FF',
    fontSize: 16,
    fontWeight: '900',
  },
  demandTrack: {
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 12,
    borderWidth: 1,
    height: 18,
    overflow: 'hidden',
  },
  demandFill: {
    backgroundColor: '#6F42C1',
    borderRadius: 12,
    height: '100%',
    minWidth: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  demandFillHighlight: {
    backgroundColor: '#A970FF',
    height: '45%',
    opacity: 0.8,
    width: '100%',
  },
  demandFillCore: {
    backgroundColor: '#6F42C1',
    bottom: 0,
    height: '55%',
    position: 'absolute',
    width: '100%',
  },
  demandSubtitle: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
});
