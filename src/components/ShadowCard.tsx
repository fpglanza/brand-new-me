import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { Shadow } from '../types/game';

type ShadowCardProps = {
  shadow: Shadow;
};

export function ShadowCard({ shadow }: ShadowCardProps) {
  const floatValue = useRef(new Animated.Value(0)).current;
  const powerPercent =
    shadow.maxPower > 0
      ? `${(shadow.currentPower / shadow.maxPower) * 100}%`
      : '0%';

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [floatValue]);

  const translateY = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -9],
  });

  return (
    <View style={styles.shadowCard}>
      <View style={styles.shadowTopRow}>
        <View style={styles.shadowInfo}>
          <Text style={styles.shadowName}>{shadow.name.toUpperCase()}</Text>
          <Text style={styles.shadowWeek}>Week of {shadow.weekStart}</Text>
          <View style={styles.shadowMetaRow}>
            <Text style={styles.shadowMetaLabel}>Class</Text>
            <Text style={styles.shadowMetaValue}>{shadow.class}</Text>
          </View>
          <Text style={styles.shadowDescription}>{shadow.description}</Text>
        </View>

        <View style={styles.bossStage}>
          <View style={styles.bossGlowOuter} />
          <View style={styles.bossGlowInner} />
          <Animated.View
            style={[
              styles.bossSilhouette,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.bossHornLeft} />
            <View style={styles.bossHornRight} />
            <View style={styles.bossHead}>
              <View style={styles.bossEyeLeft} />
              <View style={styles.bossEyeRight} />
            </View>
            <View style={styles.bossBody} />
            <View style={styles.bossShoulderLeft} />
            <View style={styles.bossShoulderRight} />
            <View style={styles.bossBase} />
          </Animated.View>
        </View>
      </View>

      <View style={styles.powerMeter}>
        <View style={styles.powerMeterHeader}>
          <Text style={styles.powerMeterLabel}>Shadow Power</Text>
          <Text style={styles.powerMeterValue}>
            {shadow.currentPower} / {shadow.maxPower}
          </Text>
        </View>
        <View style={styles.powerTrack}>
          <View
            style={[
              styles.powerFill,
              { width: powerPercent as `${number}%` },
            ]}
          >
            <View style={styles.powerFillHighlight} />
            <View style={styles.powerFillCore} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowCard: {
    backgroundColor: '#242938',
    borderColor: '#A970FF',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 30,
    minHeight: 246,
    overflow: 'hidden',
    padding: 18,
  },
  shadowTopRow: {
    flexDirection: 'row',
    minHeight: 154,
  },
  shadowInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 12,
  },
  shadowName: {
    color: '#F4F1DE',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  shadowWeek: {
    color: '#A8B0C7',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  shadowMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  shadowMetaLabel: {
    color: '#A8B0C7',
    fontSize: 13,
    fontWeight: '800',
  },
  shadowMetaValue: {
    backgroundColor: '#31254A',
    borderColor: '#6F42C1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F4F1DE',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  shadowDescription: {
    color: '#A8B0C7',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginTop: 14,
  },
  bossStage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 154,
    position: 'relative',
    width: 124,
  },
  bossGlowOuter: {
    backgroundColor: '#A970FF',
    borderRadius: 62,
    height: 124,
    opacity: 0.14,
    position: 'absolute',
    width: 124,
  },
  bossGlowInner: {
    backgroundColor: '#A970FF',
    borderRadius: 43,
    height: 86,
    opacity: 0.2,
    position: 'absolute',
    width: 86,
  },
  bossSilhouette: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'flex-end',
    position: 'relative',
    width: 112,
  },
  bossHornLeft: {
    backgroundColor: '#6F42C1',
    borderRadius: 10,
    height: 42,
    left: 25,
    position: 'absolute',
    top: 4,
    transform: [{ rotate: '-32deg' }],
    width: 16,
  },
  bossHornRight: {
    backgroundColor: '#6F42C1',
    borderRadius: 10,
    height: 42,
    position: 'absolute',
    right: 25,
    top: 4,
    transform: [{ rotate: '32deg' }],
    width: 16,
  },
  bossHead: {
    alignItems: 'center',
    backgroundColor: '#171923',
    borderColor: '#A970FF',
    borderRadius: 34,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 18,
    height: 68,
    justifyContent: 'center',
    position: 'absolute',
    top: 26,
    width: 68,
  },
  bossEyeLeft: {
    backgroundColor: '#F4F1DE',
    borderRadius: 4,
    height: 8,
    opacity: 0.9,
    width: 8,
  },
  bossEyeRight: {
    backgroundColor: '#F4F1DE',
    borderRadius: 4,
    height: 8,
    opacity: 0.9,
    width: 8,
  },
  bossBody: {
    backgroundColor: '#171923',
    borderColor: '#6F42C1',
    borderRadius: 34,
    borderWidth: 2,
    height: 72,
    position: 'absolute',
    top: 70,
    width: 58,
  },
  bossShoulderLeft: {
    backgroundColor: '#171923',
    borderColor: '#6F42C1',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    left: 10,
    position: 'absolute',
    top: 76,
    transform: [{ rotate: '-16deg' }],
    width: 48,
  },
  bossShoulderRight: {
    backgroundColor: '#171923',
    borderColor: '#6F42C1',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    position: 'absolute',
    right: 10,
    top: 76,
    transform: [{ rotate: '16deg' }],
    width: 48,
  },
  bossBase: {
    backgroundColor: '#6F42C1',
    borderRadius: 18,
    bottom: 0,
    height: 18,
    opacity: 0.42,
    position: 'absolute',
    width: 86,
  },
  powerMeter: {
    marginTop: 16,
  },
  powerMeterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  powerMeterLabel: {
    color: '#F4F1DE',
    fontSize: 16,
    fontWeight: '900',
  },
  powerMeterValue: {
    color: '#A970FF',
    fontSize: 20,
    fontWeight: '900',
  },
  powerTrack: {
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    overflow: 'hidden',
  },
  powerFill: {
    backgroundColor: '#6F42C1',
    borderRadius: 12,
    height: '100%',
    overflow: 'hidden',
  },
  powerFillHighlight: {
    backgroundColor: '#A970FF',
    height: '42%',
    opacity: 0.88,
  },
  powerFillCore: {
    backgroundColor: '#6F42C1',
    flex: 1,
  },
});
