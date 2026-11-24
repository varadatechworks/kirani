import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { apiRequest } from './src/api';
import { API_BASE_URL, DEV_TOKEN_LOGIN } from './src/config';

const TOKEN_KEY = 'kirani.access-token';
const colors = { forest: '#174c3c', forest2: '#23634d', leaf: '#9fc66b', cream: '#f7f6ef', paper: '#fffefa', ink: '#202b25', muted: '#77827a', line: '#e8e9df', red: '#a64d40' };
const money = (minor, currency = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(minor || 0) / 100); }
  catch { return '₹' + (Number(minor || 0) / 100).toFixed(2); }
};
function Button({ title, onPress, secondary, disabled }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
  </Pressable>;
}
function Message({ children, error }) {
  return <View accessibilityLiveRegion="polite" style={[styles.message, error && styles.errorMessage]}><Text style={error ? styles.errorText : styles.messageText}>{children}</Text></View>;
}
export default function App() {
  const [token, setToken] = useState(null);
  const [draftToken, setDraftToken] = useState('');
  const [orders, setOrders] = useState([]);
  const [principal, setPrincipal] = useState(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState('home');

  const loadOrders = useCallback(async activeToken => {
    setRefreshing(true); setError('');
    try {
      const [identity, result] = await Promise.all([
        apiRequest('/session/me', { token: activeToken }),
        apiRequest('/customers/me/orders', { token: activeToken })
      ]);
      setPrincipal(identity);
      setOrders(Array.isArray(result) ? result : (result?.items || []));
    } catch (e) {
      setError(e.message);
      if (e.status === 401) { await SecureStore.deleteItemAsync(TOKEN_KEY); setToken(null); setPrincipal(null); }
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(TOKEN_KEY).then(saved => { if (active) { setToken(saved); setBusy(false); } })
      .catch(() => { if (active) { setError('Secure storage is unavailable on this device.'); setBusy(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (token) loadOrders(token); }, [token, loadOrders]);

  const connect = async () => {
    const value = draftToken.trim();
    if (value.length < 40) { setError('Enter a valid short-lived development token.'); return; }
    setBusy(true); setError('');
    try {
      const me = await apiRequest('/session/me', { token: value });
      await SecureStore.setItemAsync(TOKEN_KEY, value);
      setPrincipal(me); setToken(value); setDraftToken('');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null); setPrincipal(null); setOrders([]); setPage('home'); setError('');
  };

  if (busy) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.forest} /><Text style={styles.muted}>Preparing Kirani…</Text></SafeAreaView>;

  if (!token) return <SafeAreaView style={styles.screen}>
    <ExpoStatusBar style="dark" />
    <View style={styles.loginHeader}><View style={styles.logo}><Text style={styles.logoText}>क</Text></View><Text style={styles.brand}>kirani</Text><Text style={styles.tagline}>Thoughtful groceries, traceable from source to doorstep.</Text></View>
    <View style={styles.card}>
      <Text style={styles.eyebrow}>SECURE CONNECTION</Text><Text style={styles.heading}>Connect to Kirani</Text>
      <Text style={styles.body}>API: {API_BASE_URL || 'Not configured'}</Text>
      {!DEV_TOKEN_LOGIN ? <Message>Sign-in is not enabled yet. The backend needs its production identity and mobile verification flow before customer accounts can be connected.</Message> :
        <>
          <Text style={styles.fieldLabel}>Short-lived development token</Text>
          <TextInput value={draftToken} onChangeText={setDraftToken} multiline autoCapitalize="none" autoCorrect={false}
            secureTextEntry accessibilityLabel="Development bearer token" placeholder="Paste a development bearer token"
            style={[styles.input, styles.tokenInput]} />
          <Button title="Connect securely" onPress={connect} disabled={!API_BASE_URL} />
          <Text style={styles.caption}>Development only. Never use this token entry in a production build.</Text>
        </>}
      {!!error && <Message error>{error}</Message>}
    </View>
  </SafeAreaView>;

  return <SafeAreaView style={styles.screen}>
    <ExpoStatusBar style="dark" />
    <View style={styles.topbar}><View><Text style={styles.brandSmall}>kirani</Text><Text style={styles.caption}>FROM SOURCE TO SOUL</Text></View><Pressable onPress={disconnect} accessibilityRole="button"><Text style={styles.disconnect}>Disconnect</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.heroEyebrow}>YOUR KIRANI</Text><Text style={styles.heroTitle}>Good food. Clear origins.</Text><Text style={styles.heroBody}>Your monthly groceries, thoughtfully sourced and delivered.</Text></View>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACCOUNT</Text><Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.body}>{principal?.displayName || principal?.name || 'Signed-in account'}</Text>
        <View style={styles.roleRow}>{(principal?.roles || []).map(role => <Text key={role} style={styles.role}>{role}</Text>)}</View>
      </View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Your orders</Text><Button title={refreshing ? 'Refreshing…' : 'Refresh'} secondary onPress={() => loadOrders(token)} disabled={refreshing} /></View>
      {!!error && <Message error>{error}</Message>}
      {refreshing && orders.length === 0 ? <ActivityIndicator color={colors.forest} /> :
        <FlatList data={orders} scrollEnabled={false} keyExtractor={item => String(item.id)}
          ListEmptyComponent={<View style={styles.card}><Text style={styles.body}>No orders to show yet.</Text></View>}
          renderItem={({ item }) => <View style={styles.orderCard}>
            <View style={styles.orderTop}><Text style={styles.orderId}>Order {String(item.id).slice(0, 8)}</Text><Text style={styles.amount}>{money(item.totalMinor, item.currency)}</Text></View>
            <Text style={styles.body}>{item.fulfilmentStatus || 'Status unavailable'} · Payment {item.paymentStatus || '—'}</Text>
            <Text style={styles.caption}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''}</Text>
          </View>} />
      }
      <View style={styles.footer}><Text style={styles.caption}>Kirani · Secure API connection</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.cream },
  loginHeader: { alignItems: 'center', paddingTop: 54, paddingBottom: 28 }, logo: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#d9edb1', alignItems: 'center', justifyContent: 'center' }, logoText: { color: colors.forest, fontSize: 31, fontWeight: '900' },
  brand: { fontSize: 31, fontWeight: '900', color: colors.forest, letterSpacing: -1.4, marginTop: 9 }, brandSmall: { fontSize: 22, fontWeight: '900', color: colors.forest, letterSpacing: -1 },
  tagline: { color: colors.muted, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 25 }, topbar: { height: 66, paddingHorizontal: 20, backgroundColor: colors.paper, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { padding: 18, paddingBottom: 42, gap: 15 }, hero: { backgroundColor: colors.forest, borderRadius: 19, padding: 22 }, heroEyebrow: { color: '#cfe0c8', fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }, heroTitle: { color: 'white', fontSize: 24, fontWeight: '800', marginTop: 8, letterSpacing: -.8 }, heroBody: { color: '#e0eadc', fontSize: 12, marginTop: 7, lineHeight: 18 },
  card: { backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 17, gap: 8 }, eyebrow: { color: '#718b5d', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 }, heading: { fontSize: 19, color: colors.ink, fontWeight: '800' }, body: { color: colors.muted, fontSize: 12, lineHeight: 18 }, fieldLabel: { fontSize: 11, color: colors.ink, fontWeight: '700', marginTop: 10 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 12, fontSize: 12, color: colors.ink }, tokenInput: { minHeight: 100, textAlignVertical: 'top' }, button: { minHeight: 46, backgroundColor: colors.forest, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 7 }, buttonSecondary: { backgroundColor: '#eaf1df', minHeight: 38, marginTop: 0 }, buttonText: { color: 'white', fontWeight: '800', fontSize: 12 }, buttonSecondaryText: { color: colors.forest }, disabled: { opacity: .5 }, pressed: { opacity: .75 }, caption: { color: colors.muted, fontSize: 10 }, disconnect: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  message: { backgroundColor: '#edf3e6', padding: 11, borderRadius: 10, marginTop: 8 }, messageText: { color: colors.forest, fontSize: 11, lineHeight: 16 }, errorMessage: { backgroundColor: '#fff0ec' }, errorText: { color: colors.red, fontSize: 11, lineHeight: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, orderCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 14, marginBottom: 9, gap: 5 }, orderTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, orderId: { fontSize: 12, color: colors.ink, fontWeight: '800' }, amount: { fontSize: 12, color: colors.forest, fontWeight: '900' }, roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, role: { color: colors.forest, backgroundColor: '#eaf1df', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '800' }, footer: { alignItems: 'center', paddingVertical: 15 }, muted: { color: colors.muted, fontSize: 12 }
});
