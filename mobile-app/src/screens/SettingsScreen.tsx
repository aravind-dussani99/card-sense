import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from '../lib/api';
import { Button, Card, Input, ScreenContainer } from '../components/ui';
import { colors, spacing } from '../theme';

const PASSPHRASE_KEY = 'cardsense.passphrase';

export default function SettingsScreen() {
  const [userId, setUserId] = useState('user-001');
  const [syncing, setSyncing] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passphraseSet, setPassphraseSet] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PASSPHRASE_KEY)
      .then((value) => setPassphraseSet(Boolean(value)))
      .catch(() => setPassphraseSet(false));
  }, []);

  const authUrl = useMemo(() => {
    const clientId = process.env.EXPO_PUBLIC_TRUELAYER_CLIENT_ID || '';
    const redirect =
      process.env.EXPO_PUBLIC_TRUELAYER_REDIRECT_URI ||
      'http://localhost:8081/api/bank/callback';
    if (!clientId) return '';
    const scope = encodeURIComponent(
      'info accounts balance cards transactions direct_debits standing_orders offline_access'
    );
    const providers = encodeURIComponent('uk-ob-all uk-oauth-all');
    return `https://auth.truelayer.com/?response_type=code&client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(
      redirect
    )}&providers=${providers}&state=${encodeURIComponent(userId)}`;
  }, [userId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<{ success: boolean; synced?: number }>(
        '/api/bank/sync',
        { userId }
      );
      if (!res.success) throw new Error('Sync failed');
      Alert.alert('Sync complete', `Synced ${res.synced || 0} connection(s).`);
    } catch (error) {
      Alert.alert('Sync failed', 'Please check your backend connection.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScreenContainer title="Settings">
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Open Banking</Text>
        <Text style={styles.sectionCopy}>
          Connect your bank and sync transactions from TrueLayer.
        </Text>
        <View style={styles.formRow}>
          <Text style={styles.label}>User ID (state)</Text>
          <Input value={userId} onChangeText={setUserId} />
        </View>
        <View style={styles.buttonRow}>
          <Button
            label="Launch Auth Dialog"
            onPress={() => {
              if (!authUrl) {
                Alert.alert(
                  'Missing client ID',
                  'Set EXPO_PUBLIC_TRUELAYER_CLIENT_ID in mobile-app/.env'
                );
                return;
              }
              Linking.openURL(authUrl);
            }}
          />
          <Button
            label="Sync Open Banking"
            variant="outline"
            loading={syncing}
            onPress={handleSync}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Passphrase</Text>
        <Text style={styles.sectionCopy}>
          Set or update the passphrase used to unlock sensitive details on this
          device.
        </Text>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <View style={styles.formRow}>
          <Text style={styles.label}>Passphrase</Text>
          <Input value={passphrase} onChangeText={setPassphrase} placeholder="Enter passphrase" />
        </View>
        <View style={styles.formRow}>
          <Text style={styles.label}>Confirm passphrase</Text>
          <Input value={confirm} onChangeText={setConfirm} placeholder="Confirm passphrase" />
        </View>
        <View style={styles.buttonRow}>
          <Button
            label={passphraseSet ? 'Update Passphrase' : 'Set Passphrase'}
            onPress={async () => {
              if (!passphrase || passphrase !== confirm) {
                setStatus('Passphrases do not match.');
                return;
              }
              await AsyncStorage.setItem(PASSPHRASE_KEY, passphrase);
              setPassphraseSet(true);
              setPassphrase('');
              setConfirm('');
              setStatus('Passphrase saved on this device.');
            }}
          />
          {passphraseSet ? (
            <Button
              label="Clear Passphrase"
              variant="outline"
              onPress={async () => {
                await AsyncStorage.removeItem(PASSPHRASE_KEY);
                setPassphraseSet(false);
                setPassphrase('');
                setConfirm('');
                setStatus('Passphrase cleared on this device.');
              }}
            />
          ) : null}
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionCopy: {
    color: colors.muted,
    marginBottom: spacing.md,
  },
  formRow: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  status: {
    color: colors.muted,
    marginBottom: spacing.sm,
  },
});
