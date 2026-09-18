import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../theme';

type FloatingBackButtonProps = {
  onPress: () => void;
};

export function FloatingBackButton({ onPress }: FloatingBackButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
    >
      <Text style={styles.icon}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.goldDeep,
    borderRadius: 6,
    borderWidth: 1,
    bottom: 24,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: theme.colors.violet,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 56,
    zIndex: 20,
  },
  icon: {
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: -3,
  },
});
