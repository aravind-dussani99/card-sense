import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../lib/api';
import { Button, Card, Input, ScreenContainer } from '../components/ui';
import { colors, spacing } from '../theme';

type CardItem = {
  id: string;
  name: string;
  bank?: string | null;
  last4?: string | null;
  balance?: number;
  limit?: number;
};

type BankAccount = {
  id: string;
  name?: string | null;
  type?: string | null;
  mask?: string | null;
  currency?: string | null;
  balance?: number | null;
  availableBalance?: number | null;
};

export default function CardsAccountsScreen() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [cardForm, setCardForm] = useState({
    name: '',
    bank: '',
    last4: '',
    limit: '',
    balance: '',
  });
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: '',
    bankName: '',
    mask: '',
    currency: '',
    balance: '',
    availableBalance: '',
    limit: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cardsData, accountsData] = await Promise.all([
        apiGet<CardItem[] | { data?: CardItem[] }>('/api/cards'),
        apiGet<BankAccount[] | { data?: BankAccount[] }>(
          '/api/bank/accounts'
        ),
      ]);
      const cardsList = Array.isArray(cardsData)
        ? cardsData
        : Array.isArray(cardsData?.data)
          ? cardsData.data
          : [];
      const accountsList = Array.isArray(accountsData)
        ? accountsData
        : Array.isArray(accountsData?.data)
          ? accountsData.data
          : [];
      setCards(cardsList);
      setAccounts(accountsList);
    } catch {
      setCards([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <ScreenContainer title="Cards & Accounts">
      <View style={styles.actionRow}>
        <Button label="Add Card" onPress={() => setShowCardModal(true)} />
        <Button
          label="Add Account"
          variant="outline"
          onPress={() => setShowAccountModal(true)}
        />
      </View>
      <FlatList
        data={[{ key: 'cards' }, { key: 'accounts' }]}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        renderItem={({ item }) =>
          item.key === 'cards' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cards</Text>
              {cards.length === 0 ? (
                <Text style={styles.empty}>No cards yet.</Text>
              ) : (
                cards.map((card) => (
                  <Card key={card.id} style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.name}>{card.name}</Text>
                      <Text style={styles.badge}>
                        ••{card.last4 || '----'}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {card.bank || 'Bank'} · Balance {card.balance ?? 0} / Limit{' '}
                      {card.limit ?? 0}
                    </Text>
                  </Card>
                ))
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bank Accounts</Text>
              {accounts.length === 0 ? (
                <Text style={styles.empty}>No accounts yet.</Text>
              ) : (
                accounts.map((account) => (
                  <Card key={account.id} style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.name}>
                        {account.name || account.type || 'Account'}
                      </Text>
                      <Text style={styles.badge}>
                        ••{account.mask || '----'}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {account.currency || 'GBP'} · Balance{' '}
                      {account.balance ?? account.availableBalance ?? 0}
                    </Text>
                  </Card>
                ))
              )}
            </View>
          )
        }
      />

      <Modal visible={showCardModal} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Card</Text>
          <Input
            value={cardForm.name}
            onChangeText={(value) => setCardForm((prev) => ({ ...prev, name: value }))}
            placeholder="Card name"
          />
          <Input
            value={cardForm.bank}
            onChangeText={(value) => setCardForm((prev) => ({ ...prev, bank: value }))}
            placeholder="Bank name"
          />
          <Input
            value={cardForm.last4}
            onChangeText={(value) => setCardForm((prev) => ({ ...prev, last4: value }))}
            placeholder="Last 4 digits"
          />
          <Input
            value={cardForm.limit}
            onChangeText={(value) => setCardForm((prev) => ({ ...prev, limit: value }))}
            placeholder="Limit"
          />
          <Input
            value={cardForm.balance}
            onChangeText={(value) => setCardForm((prev) => ({ ...prev, balance: value }))}
            placeholder="Balance"
          />
          <View style={styles.modalActions}>
            <Button
              label="Save Card"
              onPress={async () => {
                await apiPost('/api/cards', {
                  ...cardForm,
                  limit: Number(cardForm.limit || 0),
                  balance: Number(cardForm.balance || 0),
                });
                setShowCardModal(false);
                setCardForm({ name: '', bank: '', last4: '', limit: '', balance: '' });
                void loadData();
              }}
            />
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setShowCardModal(false)}
            />
          </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAccountModal} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Account</Text>
          <Input
            value={accountForm.name}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, name: value }))}
            placeholder="Account name"
          />
          <Input
            value={accountForm.type}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, type: value }))}
            placeholder="Account type"
          />
          <Input
            value={accountForm.bankName}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, bankName: value }))}
            placeholder="Bank name"
          />
          <Input
            value={accountForm.mask}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, mask: value }))}
            placeholder="Account number (masked)"
          />
          <Input
            value={accountForm.currency}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, currency: value }))}
            placeholder="Currency (GBP)"
          />
          <Input
            value={accountForm.balance}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, balance: value }))}
            placeholder="Balance"
          />
          <Input
            value={accountForm.availableBalance}
            onChangeText={(value) =>
              setAccountForm((prev) => ({ ...prev, availableBalance: value }))
            }
            placeholder="Available balance"
          />
          <Input
            value={accountForm.limit}
            onChangeText={(value) => setAccountForm((prev) => ({ ...prev, limit: value }))}
            placeholder="Limit"
          />
          <View style={styles.modalActions}>
            <Button
              label="Save Account"
              onPress={async () => {
                await apiPost('/api/bank/accounts', {
                  ...accountForm,
                  balance: Number(accountForm.balance || 0),
                  availableBalance: Number(accountForm.availableBalance || 0),
                  limit: Number(accountForm.limit || 0),
                });
                setShowAccountModal(false);
                setAccountForm({
                  name: '',
                  type: '',
                  bankName: '',
                  mask: '',
                  currency: '',
                  balance: '',
                  availableBalance: '',
                  limit: '',
                });
                void loadData();
              }}
            />
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setShowAccountModal(false)}
            />
          </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    fontSize: 12,
    color: colors.muted,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.muted,
  },
  empty: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
