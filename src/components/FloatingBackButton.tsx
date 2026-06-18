import { Pressable, StyleSheet, Text } from 'react-native';

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
    backgroundColor: '#171923',
    borderColor: '#3E4661',
    borderRadius: 28,
    borderWidth: 1,
    bottom: 24,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#A970FF',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 56,
    zIndex: 20,
  },
  icon: {
    color: '#F4F1DE',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: -3,
  },
});
