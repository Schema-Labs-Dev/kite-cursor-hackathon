import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

import { WelcomeScreen } from '@/components/welcome/welcome-screen';
import { useMe } from '@/hooks/use-me';
import { colors } from '@/constants/theme';

export default function Index() {
  const { data: me, isLoading, isFetching, refetch } = useMe();

  // Refetch on first mount so a freshly-set token is picked up without a reload.
  useEffect(() => {
    refetch();
  }, [refetch]);

  if (isLoading || (isFetching && me === undefined)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (me) return <Redirect href="/(tabs)/home" />;
  return <WelcomeScreen />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
