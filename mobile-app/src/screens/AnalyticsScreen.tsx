import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { apiGet } from '../lib/api';
import { Card, ScreenContainer } from '../components/ui';
import { colors, spacing } from '../theme';

type SeriesItem = { name: string; value: number };
type MonthlyItem = { month: string; total: number };

export default function AnalyticsScreen() {
  const [byCategory, setByCategory] = useState<SeriesItem[]>([]);
  const [byMerchant, setByMerchant] = useState<SeriesItem[]>([]);
  const [monthly, setMonthly] = useState<MonthlyItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryData, merchantData, monthlyData] = await Promise.all([
        apiGet<SeriesItem[]>('/api/analytics/spending-by-category'),
        apiGet<SeriesItem[]>('/api/analytics/by-merchant'),
        apiGet<MonthlyItem[]>('/api/analytics/monthly'),
      ]);
      setByCategory(categoryData || []);
      setByMerchant(merchantData || []);
      setMonthly(monthlyData || []);
    } catch {
      setByCategory([]);
      setByMerchant([]);
      setMonthly([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <ScreenContainer title="Analytics">
      <Text style={styles.sectionTitle}>Top Categories</Text>
      <FlatList
        data={byCategory}
        keyExtractor={(item, idx) => `${item.name}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.value}>£{item.value.toFixed(2)}</Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No analytics yet.</Text>
        }
      />

      <Text style={styles.sectionTitle}>Top Merchants</Text>
      <FlatList
        data={byMerchant}
        keyExtractor={(item, idx) => `${item.name}-${idx}`}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.value}>£{item.value.toFixed(2)}</Text>
          </Card>
        )}
        ListEmptyComponent={null}
      />

      <Text style={styles.sectionTitle}>Monthly Trend</Text>
      <FlatList
        data={monthly}
        keyExtractor={(item, idx) => `${item.month}-${idx}`}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.month}</Text>
            <Text style={styles.value}>£{item.total.toFixed(2)}</Text>
          </Card>
        )}
        ListEmptyComponent={null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  value: {
    marginTop: spacing.xs,
    color: colors.muted,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
