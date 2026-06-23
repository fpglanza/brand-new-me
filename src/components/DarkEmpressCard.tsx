import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import type { WeeklyResult } from '../types/game';

type DarkEmpressCardProps = {
  compact?: boolean;
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
  compact = false,
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
    <View style={[styles.card, compact ? styles.cardCompact : null]}>
      <View style={styles.titleDivider} />
      <Text style={[styles.title, compact ? styles.titleCompact : null]}>
        THE DARK EMPRESS
      </Text>
      <View style={styles.titleDividerMuted} />
      <View style={[styles.moodRow, compact ? styles.moodRowCompact : null]}>
        <Text style={styles.moodLabel}>Mood</Text>
        <Text style={styles.moodValue}>{mood}</Text>
      </View>

      <View
        style={[
          styles.portraitStage,
          compact ? styles.portraitStageCompact : null,
        ]}
      >
        <View
          style={[
            styles.portraitGlow,
            compact ? styles.portraitGlowCompact : null,
          ]}
        />
        <Image
          resizeMode="cover"
          source={PORTRAIT}
          style={[styles.portrait, compact ? styles.portraitCompact : null]}
        />
        <Image
          resizeMode="contain"
          source={ORNAMENT_FRAME}
          style={[
            styles.ornamentFrame,
            compact ? styles.ornamentFrameCompact : null,
          ]}
        />
      </View>

      <View style={[styles.demandMeter, compact ? styles.demandMeterCompact : null]}>
        <View
          style={[
            styles.demandHeader,
            compact ? styles.demandHeaderCompact : null,
          ]}
        >
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
        <Text
          style={[
            styles.demandSubtitle,
            compact ? styles.demandSubtitleCompact : null,
          ]}
        >
          The throne watches.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#1B1726',
    borderColor: '#B681FF',
    borderRadius: 18,
    borderWidth: 2,
    marginBottom: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#A970FF',
    shadowOpacity: 0.36,
    shadowRadius: 24,
  },
  cardCompact: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 16,
  },
  title: {
    color: '#F4F1DE',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 18,
    marginBottom: 4,
  },
  titleDivider: {
    backgroundColor: '#A970FF',
    borderRadius: 999,
    height: 2,
    marginBottom: 10,
    opacity: 0.85,
    width: 118,
  },
  titleDividerMuted: {
    backgroundColor: '#5A4B38',
    borderRadius: 999,
    height: 1,
    marginBottom: 10,
    opacity: 0.9,
    width: 180,
  },
  moodRow: {
    alignItems: 'center',
    backgroundColor: '#171923',
    borderColor: '#4E3477',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 13,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  moodRowCompact: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    height: 338,
    justifyContent: 'flex-start',
    position: 'relative',
    width: 338,
  },
  portraitStageCompact: {
    height: 246,
    width: 246,
  },
  portraitGlow: {
    backgroundColor: '#A970FF',
    borderRadius: 158,
    height: 316,
    opacity: 0.24,
    position: 'absolute',
    top: 7,
    width: 316,
  },
  portraitGlowCompact: {
    borderRadius: 116,
    height: 232,
    top: 5,
    width: 232,
  },
  portrait: {
    borderColor: '#A970FF',
    borderRadius: 146,
    borderWidth: 3,
    height: 292,
    width: 292,
  },
  portraitCompact: {
    borderRadius: 106,
    height: 212,
    width: 212,
  },
  ornamentFrame: {
    bottom: -2,
    height: 146,
    position: 'absolute',
    width: 304,
  },
  ornamentFrameCompact: {
    bottom: -3,
    height: 108,
    width: 230,
  },
  demandMeter: {
    alignSelf: 'stretch',
    backgroundColor: '#171923',
    borderColor: '#4E3477',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  demandMeterCompact: {
    marginTop: 8,
    padding: 10,
  },
  demandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  demandHeaderCompact: {
    marginBottom: 6,
  },
  demandLabel: {
    color: '#F4F1DE',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  demandValue: {
    color: '#D2A6FF',
    fontSize: 16,
    fontWeight: '900',
  },
  demandTrack: {
    backgroundColor: '#0F1118',
    borderColor: '#7A5A2A',
    borderRadius: 12,
    borderWidth: 1,
    height: 20,
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
  demandSubtitleCompact: {
    marginTop: 6,
  },
});
