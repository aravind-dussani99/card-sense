import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { apiGet } from '../lib/api';
import { Card, ScreenContainer } from '../components/ui';
import { colors, spacing } from '../theme';

type CardItem = {
  id: string;
  name: string;
  balance?: number;
  limit?: number;
};

type BankTransaction = {
  id: string;
  amount: number;
  currency?: string | null;
  date?: string | null;
  merchant?: string | null;
  descriptionVia?: string | null;
  account?: { name?: string | null; mask?: string | null } | null;
};

type DraftResponse = { success: boolean; data: BankTransaction[] };

export default function DashboardScreen() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cardsData, txData] = await Promise.all([
        apiGet<CardItem[]>('/api/cards'),
        apiGet<DraftResponse>('/api/transactions/drafts?page=1&pageSize=10'),
      ]);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setTransactions(txData.success ? txData.data : []);
    } catch {
      setCards([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalBalance = cards.reduce((sum, card) => sum + (card.balance || 0), 0);
  const totalLimit = cards.reduce((sum, card) => sum + (card.limit || 0), 0);
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  return (
    <ScreenContainer title="Dashboard">
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Balance</Text>
          <Text style={styles.kpiValue}>£{totalBalance.toFixed(2)}</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Utilization</Text>
          <Text style={styles.kpiValue}>{utilization.toFixed(1)}%</Text>
        </Card>
      </View>
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        renderItem={({ item }) => (
          <Card style={styles.txCard}>
            <Text style={styles.txMerchant}>
              {item.merchant || item.descriptionVia || 'Unknown'}
            </Text>
            <Text style={styles.txMeta}>
              {item.account?.name || 'Account'}{' '}
              {item.account?.mask ? `••${item.account.mask}` : ''}
            </Text>
            <Text style={styles.txAmount}>
              {item.amount < 0 ? '-' : ''}£{Math.abs(item.amount).toFixed(2)}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions yet.</Text>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: {
    flex: 1,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  txCard: {
    marginBottom: spacing.sm,
  },
  txMerchant: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  txMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  txAmount: {
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
