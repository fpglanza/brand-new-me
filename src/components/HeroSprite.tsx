import { Image, StyleSheet, View } from 'react-native';

type HeroSpriteProps = {
  size?: number;
};

const SPRITE_SHEET = require('../assets/sprites/hero-sprite-sheet.png');

const SHEET_WIDTH = 1183;
const SHEET_HEIGHT = 1329;

// Crops the first idle/down-facing frame from the reference sprite sheet.
const FRAME_X = 126;
const FRAME_Y = 805;
const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 88;

export function HeroSprite({ size = 128 }: HeroSpriteProps) {
  const scale = size / FRAME_WIDTH;
  const height = Math.round(FRAME_HEIGHT * scale);

  return (
    <View
      style={[
        styles.frame,
        {
          height,
          width: size,
        },
      ]}
    >
      <Image
        resizeMode="stretch"
        source={SPRITE_SHEET}
        style={[
          styles.sheet,
          {
            height: SHEET_HEIGHT * scale,
            left: -FRAME_X * scale,
            top: -FRAME_Y * scale,
            width: SHEET_WIDTH * scale,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  sheet: {
    position: 'absolute',
  },
});
