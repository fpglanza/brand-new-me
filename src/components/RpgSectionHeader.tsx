import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type RpgSectionHeaderProps = {
  eyebrow: string;
  meta?: string;
  subtitle?: string;
  title: string;
};

export function RpgSectionHeader({
  eyebrow,
  meta,
  subtitle,
  title,
}: RpgSectionHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.eyebrowRow}>
        <View style={styles.rule} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <View style={styles.rule} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  eyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: 7,
  },
  rule: {
    backgroundColor: theme.colors.goldDeep,
    height: 1,
    width: 34,
  },
  eyebrow: {
    color: theme.colors.gold,
    fontSize: 9,
    fontWeight: '900',
  },
  title: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 330,
    textAlign: 'center',
  },
  meta: {
    color: theme.colors.violetBright,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 8,
  },
});
