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
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { Button, Card, Input, ScreenContainer } from '../components/ui';
import { colors, spacing } from '../theme';

type BankTransaction = {
  id: string;
  amount: number;
  currency?: string | null;
  date?: string | null;
  merchant?: string | null;
  descriptionVia?: string | null;
  category?: string | null;
  accountId?: string | null;
  providerTransactionId?: string | null;
  runningBalance?: number | null;
  meta?: {
    openingBalance?: number | null;
    closingBalance?: number | null;
    fromEntity?: string | null;
    viaEntity?: string | null;
    toEntity?: string | null;
    headAccount?: string | null;
    subCategory?: string | null;
    remarks?: string | null;
    comments?: string | null;
  } | null;
  account?: { name?: string | null; type?: string | null; mask?: string | null } | null;
};

type DraftResponse = {
  success: boolean;
  data: BankTransaction[];
};

type Account = {
  id: string;
  name?: string | null;
  type?: string | null;
  mask?: string | null;
};

const formatAmount = (amount: number, currency?: string | null) => {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount).toFixed(2);
  return `${sign}${currency || 'GBP'} ${value}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export default function TransactionsScreen() {
  const [items, setItems] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('user-001');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showView, setShowView] = useState<BankTransaction | null>(null);
  const [showEdit, setShowEdit] = useState<BankTransaction | null>(null);
  const [form, setForm] = useState({
    accountId: '',
    merchant: '',
    amount: '',
    category: '',
    subCategory: '',
    headAccount: '',
    fromEntity: '',
    viaEntity: '',
    toEntity: '',
    openingBalance: '',
    closingBalance: '',
    remarks: '',
    comments: '',
    date: '',
  });

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50',
      });
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (search) params.set('search', search);
      const data = await apiGet<DraftResponse>(
        `/api/transactions/drafts?${params.toString()}`
      );
      setItems(data.success ? data.data : []);
      const accountsData = await apiGet<Account[] | { data?: Account[] }>(
        '/api/bank/accounts'
      );
      const list = Array.isArray(accountsData)
        ? accountsData
        : Array.isArray(accountsData?.data)
          ? accountsData.data
          : [];
      setAccounts(list);
    } catch {
      setItems([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, search, toDate]);

  const handleSync = async () => {
    setLoading(true);
    try {
      await apiPost('/api/bank/sync', { userId });
      await loadTransactions();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      accountId: accounts[0]?.id || '',
      merchant: '',
      amount: '',
      category: '',
      subCategory: '',
      headAccount: '',
      fromEntity: '',
      viaEntity: '',
      toEntity: '',
      openingBalance: '',
      closingBalance: '',
      remarks: '',
      comments: '',
      date: '',
    });
  };

  const openEdit = (item: BankTransaction) => {
    setShowEdit(item);
    setForm({
      accountId: item.accountId || '',
      merchant: item.merchant || item.descriptionVia || '',
      amount: String(item.amount ?? ''),
      category: item.category || '',
      subCategory: item.meta?.subCategory || '',
      headAccount: item.meta?.headAccount || '',
      fromEntity: item.meta?.fromEntity || '',
      viaEntity: item.meta?.viaEntity || '',
      toEntity: item.meta?.toEntity || '',
      openingBalance: item.meta?.openingBalance ? String(item.meta.openingBalance) : '',
      closingBalance: item.meta?.closingBalance ? String(item.meta.closingBalance) : '',
      remarks: item.meta?.remarks || '',
      comments: item.meta?.comments || '',
      date: item.date ? item.date.substring(0, 10) : '',
    });
  };

  const submitAdd = async () => {
    if (!form.headAccount.trim()) return;
    await apiPost('/api/transactions/drafts', {
      accountId: form.accountId,
      merchantTo: form.merchant,
      amount: Number(form.amount || 0),
      category: form.category,
      subCategory: form.subCategory,
      headAccount: form.headAccount,
      fromEntity: form.fromEntity,
      viaEntity: form.viaEntity,
      toEntity: form.toEntity,
      openingBalance: form.openingBalance ? Number(form.openingBalance) : null,
      closingBalance: form.closingBalance ? Number(form.closingBalance) : null,
      remarks: form.remarks,
      comments: form.comments,
      date: form.date,
    });
    setShowAdd(false);
    resetForm();
    await loadTransactions();
  };

  const submitEdit = async () => {
    if (!showEdit) return;
    await apiPatch(`/api/transactions/drafts/${showEdit.id}`, {
      merchantTo: form.merchant,
      amount: Number(form.amount || 0),
      category: form.category,
      subCategory: form.subCategory,
      headAccount: form.headAccount,
      fromEntity: form.fromEntity,
      viaEntity: form.viaEntity,
      toEntity: form.toEntity,
      openingBalance: form.openingBalance ? Number(form.openingBalance) : null,
      closingBalance: form.closingBalance ? Number(form.closingBalance) : null,
      remarks: form.remarks,
      comments: form.comments,
    });
    setShowEdit(null);
    await loadTransactions();
  };

  const deleteItem = async (item: BankTransaction) => {
    if (!item.providerTransactionId?.startsWith('manual-')) return;
    await apiDelete(`/api/transactions/drafts/${item.id}`);
    await loadTransactions();
  };

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  return (
    <ScreenContainer title="Transactions">
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Sync Open Banking</Text>
        <Text style={styles.sectionCopy}>Pull the latest transactions from your connected accounts.</Text>
        <Input value={userId} onChangeText={setUserId} placeholder="User ID (state)" />
        <View style={styles.buttonRow}>
          <Button label="Sync Open Banking" onPress={handleSync} loading={loading} />
          <Button
            label="Clear Filters"
            variant="outline"
            onPress={() => {
              setFromDate('');
              setToDate('');
              setSearch('');
            }}
          />
        </View>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Filters</Text>
        <Text style={styles.sectionCopy}>Use date range or keyword search.</Text>
        <Input value={fromDate} onChangeText={setFromDate} placeholder="From date (YYYY-MM-DD)" />
        <Input value={toDate} onChangeText={setToDate} placeholder="To date (YYYY-MM-DD)" />
        <Input value={search} onChangeText={setSearch} placeholder="Search keyword" />
        <View style={styles.buttonRow}>
          <Button label="Filter" variant="outline" onPress={loadTransactions} />
          <Button label="Add Cash Transaction" onPress={() => {
            resetForm();
            setShowAdd(true);
          }} />
        </View>
      </Card>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadTransactions} />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
              <Text style={styles.amount}>{formatAmount(item.amount, item.currency)}</Text>
            </View>
            <Text style={styles.merchant}>
              {item.merchant || item.descriptionVia || 'Unknown'}
            </Text>
            <Text style={styles.meta}>
              {item.category || 'Uncategorized'} ·{' '}
              {item.account?.name || item.account?.type || 'Account'}
              {item.account?.mask ? ` (••${item.account.mask})` : ''}
            </Text>
            <View style={styles.actionRow}>
              <Button label="View" variant="outline" onPress={() => setShowView(item)} />
              <Button label="Edit" variant="outline" onPress={() => openEdit(item)} />
              {item.providerTransactionId?.startsWith('manual-') ? (
                <Button
                  label="Delete"
                  variant="danger"
                  onPress={() => deleteItem(item)}
                />
              ) : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions yet.</Text>
        }
      />

      <Modal visible={Boolean(showView)} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Transaction Details</Text>
          {showView ? (
            <>
              <Text style={styles.modalText}>Merchant: {showView.merchant || showView.descriptionVia || '—'}</Text>
              <Text style={styles.modalText}>Amount: {formatAmount(showView.amount, showView.currency)}</Text>
              <Text style={styles.modalText}>Category: {showView.category || '—'}</Text>
              <Text style={styles.modalText}>Head Account: {showView.meta?.headAccount || '—'}</Text>
              <Text style={styles.modalText}>From: {showView.meta?.fromEntity || '—'}</Text>
              <Text style={styles.modalText}>To: {showView.meta?.toEntity || '—'}</Text>
              <Text style={styles.modalText}>Remarks: {showView.meta?.remarks || '—'}</Text>
              <Text style={styles.modalText}>Comments: {showView.meta?.comments || '—'}</Text>
            </>
          ) : null}
          <Button label="Close" variant="outline" onPress={() => setShowView(null)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showAdd} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Cash Transaction</Text>
          <Input value={form.accountId} onChangeText={(value) => setForm((prev) => ({ ...prev, accountId: value }))} placeholder="Account ID" />
          <Input value={form.merchant} onChangeText={(value) => setForm((prev) => ({ ...prev, merchant: value }))} placeholder="Merchant" />
          <Input value={form.amount} onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))} placeholder="Amount" />
          <Input value={form.headAccount} onChangeText={(value) => setForm((prev) => ({ ...prev, headAccount: value }))} placeholder="Head Account (required)" />
          <Input value={form.category} onChangeText={(value) => setForm((prev) => ({ ...prev, category: value }))} placeholder="Category" />
          <Input value={form.subCategory} onChangeText={(value) => setForm((prev) => ({ ...prev, subCategory: value }))} placeholder="Sub-category" />
          <Input value={form.fromEntity} onChangeText={(value) => setForm((prev) => ({ ...prev, fromEntity: value }))} placeholder="From" />
          <Input value={form.viaEntity} onChangeText={(value) => setForm((prev) => ({ ...prev, viaEntity: value }))} placeholder="Via" />
          <Input value={form.toEntity} onChangeText={(value) => setForm((prev) => ({ ...prev, toEntity: value }))} placeholder="To" />
          <Input value={form.openingBalance} onChangeText={(value) => setForm((prev) => ({ ...prev, openingBalance: value }))} placeholder="Opening Balance" />
          <Input value={form.closingBalance} onChangeText={(value) => setForm((prev) => ({ ...prev, closingBalance: value }))} placeholder="Closing Balance" />
          <Input value={form.remarks} onChangeText={(value) => setForm((prev) => ({ ...prev, remarks: value }))} placeholder="Remarks" />
          <Input value={form.comments} onChangeText={(value) => setForm((prev) => ({ ...prev, comments: value }))} placeholder="Comments" />
          <Input value={form.date} onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))} placeholder="Date (YYYY-MM-DD)" />
          <View style={styles.modalActions}>
            <Button label="Save" onPress={submitAdd} />
            <Button label="Cancel" variant="outline" onPress={() => setShowAdd(false)} />
          </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(showEdit)} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Transaction</Text>
          <Input value={form.merchant} onChangeText={(value) => setForm((prev) => ({ ...prev, merchant: value }))} placeholder="Merchant" />
          <Input value={form.amount} onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))} placeholder="Amount" />
          <Input value={form.headAccount} onChangeText={(value) => setForm((prev) => ({ ...prev, headAccount: value }))} placeholder="Head Account (required)" />
          <Input value={form.category} onChangeText={(value) => setForm((prev) => ({ ...prev, category: value }))} placeholder="Category" />
          <Input value={form.subCategory} onChangeText={(value) => setForm((prev) => ({ ...prev, subCategory: value }))} placeholder="Sub-category" />
          <Input value={form.fromEntity} onChangeText={(value) => setForm((prev) => ({ ...prev, fromEntity: value }))} placeholder="From" />
          <Input value={form.viaEntity} onChangeText={(value) => setForm((prev) => ({ ...prev, viaEntity: value }))} placeholder="Via" />
          <Input value={form.toEntity} onChangeText={(value) => setForm((prev) => ({ ...prev, toEntity: value }))} placeholder="To" />
          <Input value={form.openingBalance} onChangeText={(value) => setForm((prev) => ({ ...prev, openingBalance: value }))} placeholder="Opening Balance" />
          <Input value={form.closingBalance} onChangeText={(value) => setForm((prev) => ({ ...prev, closingBalance: value }))} placeholder="Closing Balance" />
          <Input value={form.remarks} onChangeText={(value) => setForm((prev) => ({ ...prev, remarks: value }))} placeholder="Remarks" />
          <Input value={form.comments} onChangeText={(value) => setForm((prev) => ({ ...prev, comments: value }))} placeholder="Comments" />
          <View style={styles.modalActions}>
            <Button label="Save Changes" onPress={submitEdit} />
            <Button label="Cancel" variant="outline" onPress={() => setShowEdit(null)} />
          </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionCopy: {
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  date: {
    color: colors.muted,
    fontSize: 12,
  },
  amount: {
    fontWeight: '600',
    color: colors.text,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  modalText: {
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
