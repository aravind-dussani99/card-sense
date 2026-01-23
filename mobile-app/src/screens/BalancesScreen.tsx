import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { apiGet } from '../lib/api';
import { Card, ScreenContainer } from '../components/ui';
import { colors, spacing } from '../theme';

type Account = {
  id: string;
  name?: string | null;
  type?: string | null;
  mask?: string | null;
  currency?: string | null;
  balance?: number | null;
  availableBalance?: number | null;
  limit?: number | null;
};

export default function BalancesScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Account[] | { data?: Account[] }>(
        '/api/bank/accounts'
      );
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setAccounts(list);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <ScreenContainer title="Balances">
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>
              {item.name || item.type || 'Account'}
            </Text>
            <Text style={styles.meta}>
              {item.mask ? `••${item.mask}` : '—'} ·{' '}
              {item.currency || 'GBP'}
            </Text>
            <Text style={styles.balance}>
              Balance: {item.balance ?? item.availableBalance ?? 0}
            </Text>
            {item.limit ? (
              <Text style={styles.meta}>Limit: {item.limit}</Text>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No accounts yet.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    color: colors.muted,
  },
  balance: {
    marginTop: spacing.xs,
    fontWeight: '600',
    color: colors.text,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
