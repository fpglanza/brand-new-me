import { useEffect, useState } from 'react';
import { Image, type ImageStyle, StyleSheet, View } from 'react-native';

type HeroWalkSpriteProps = {
  size?: number;
};

const FRAME_1 = require('../assets/sprites/hero-walk/frame1.png');
const FRAME_2 = require('../assets/sprites/hero-walk/frame2.png');
const FRAME_4 = require('../assets/sprites/hero-walk/frame4.png');
const FRAME_6 = require('../assets/sprites/hero-walk/frame6.png');

const WALK_SEQUENCE = [
  FRAME_1,
  FRAME_2,
  FRAME_4,
  FRAME_6,
  FRAME_4,
  FRAME_2,
];

const FRAME_DURATION_MS = 167;
const OLD_HERO_FRAME_ASPECT_RATIO = 88 / 64;
const PIXEL_ART_RENDERING = {
  imageRendering: 'pixelated',
} as unknown as ImageStyle;

export function HeroWalkSprite({ size = 160 }: HeroWalkSpriteProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const height = Math.round(size * OLD_HERO_FRAME_ASPECT_RATIO);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFrameIndex((currentFrameIndex) =>
        (currentFrameIndex + 1) % WALK_SEQUENCE.length,
      );
    }, FRAME_DURATION_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <View style={[styles.frame, { height, width: size }]}>
      <Image
        resizeMode="contain"
        source={WALK_SEQUENCE[frameIndex]}
        style={[
          styles.sprite,
          {
            height,
            width: size,
          },
          PIXEL_ART_RENDERING,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  sprite: {
    backgroundColor: 'transparent',
  },
});
