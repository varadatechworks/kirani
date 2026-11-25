import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
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
  const [dashboard, setDashboard] = useState(null);
  const [farmerProfile, setFarmerProfile] = useState(null);
  const [farmerOrders, setFarmerOrders] = useState([]);
  const [processingJobs, setProcessingJobs] = useState([]);
  const [activeProcessingJob, setActiveProcessingJob] = useState(null);
  const [processingStages, setProcessingStages] = useState([]);
  const [stageDraft, setStageDraft] = useState({ stageName: '', inputQuantity: '', outputName: '', batchCode: '', outputQuantity: '', wasteQuantity: '0', lossQuantity: '0', remainingQuantity: '0', adjustmentQuantity: '0', qcStatus: 'PASS', qcNote: '' });
  const [deliveryAssignments, setDeliveryAssignments] = useState([]);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [podDraft, setPodDraft] = useState({ receivedBy: '', reason: '', cashCollected: '0', items: {} });
  const [farmDraft, setFarmDraft] = useState({ farmName: '', farmType: 'INDIVIDUAL', village: '', taluk: '', district: '', state: 'Karnataka', postalCode: '', farmArea: '', farmAreaUnit: 'ACRE' });
  const [farmerBusy, setFarmerBusy] = useState(false);
  const [catalogue, setCatalogue] = useState([]);
  const [basket, setBasket] = useState({});
  const [catalogueBusy, setCatalogueBusy] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOrders = useCallback(async activeToken => {
    setRefreshing(true); setError('');
    try {
      const identity = await apiRequest('/session/me', { token: activeToken });
      setPrincipal(identity);
      if (identity.roles?.includes('customer')) {
        const result = await apiRequest('/customers/me/orders', { token: activeToken });
        setOrders(Array.isArray(result) ? result : (result?.items || []));
        setDashboard(null);
      } else if (identity.roles?.includes('admin')) {
        const result = await apiRequest('/admin/dashboard', { token: activeToken });
        setDashboard(result); setOrders([]); setFarmerOrders([]);
      } else if (identity.roles?.includes('delivery_operator')) {
        const assignments = await apiRequest('/delivery/assignments', { token: activeToken });
        setDeliveryAssignments(Array.isArray(assignments) ? assignments : []);
        setActiveDelivery(null); setProcessingJobs([]); setFarmerOrders([]); setDashboard(null); setOrders([]); setError('');
      } else if (identity.roles?.includes('mill_operator')) {
        const jobs = await apiRequest('/mill/processing/jobs', { token: activeToken });
        setProcessingJobs(Array.isArray(jobs) ? jobs : []);
        setFarmerOrders([]); setFarmerProfile(null); setDashboard(null); setOrders([]); setError('');
      } else if (identity.roles?.includes('farmer')) {
        const [profile, purchaseOrders] = await Promise.all([
          apiRequest('/farmers/me/profile', { token: activeToken }),
          apiRequest('/farmers/me/procurement-orders', { token: activeToken })
        ]);
        setFarmerProfile(profile || null);
        if (profile) setFarmDraft({ farmName: profile.farmName || '', farmType: profile.farmType || 'INDIVIDUAL', village: profile.village || '', taluk: profile.taluk || '', district: profile.district || '', state: profile.state || 'Karnataka', postalCode: profile.postalCode || '', farmArea: profile.farmArea || '', farmAreaUnit: profile.farmAreaUnit || 'ACRE' });
        setFarmerOrders(Array.isArray(purchaseOrders) ? purchaseOrders : []);
        setDashboard(null); setOrders([]); setError('');
      } else {
        setDashboard(null); setOrders([]); setFarmerOrders([]);
        setError('This account role does not yet have a connected mobile workspace.');
      }
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
  const loadCatalogue = async () => {
    setCatalogueBusy(true); setError(''); setNotice('');
    try {
      const products = await apiRequest('/catalogue/products', { token });
      setCatalogue(Array.isArray(products) ? products : []);
      const saved = await apiRequest('/customers/me/recurring-basket', { token });
      if (saved?.items?.length) setBasket(Object.fromEntries(saved.items.map(item => [item.productId, { productId: item.productId, quantity: Number(item.quantity), unitCode: item.unitCode }])));
    } catch (e) { setError(e.message); }
    finally { setCatalogueBusy(false); }
  };
  const changeQuantity = (product, delta) => setBasket(current => {
    const next = { ...current }; const quantity = (next[product.id]?.quantity || 0) + delta;
    if (quantity <= 0) delete next[product.id];
    else next[product.id] = { productId: product.id, quantity, unitCode: product.baseUnit };
    return next;
  });
  const saveRecurringBasket = async () => {
    const items = Object.values(basket);
    if (!items.length) { setError('Add at least one product before saving your basket.'); return; }
    try {
      const cycle = await apiRequest('/monthly-cycles/current', { token });
      if (!cycle?.id) { setError('There is no open monthly cycle at the moment.'); return; }
      await apiRequest('/customers/me/recurring-basket', { token, method: 'PUT', body: { cycleId: cycle.id, items } });
      setError(''); setNotice('Your recurring basket has been saved for the next eligible cycle.');
    } catch (e) { setError(e.message); }
  };
  const saveFarmerProfile = async () => {
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...farmDraft, farmArea: farmDraft.farmArea ? Number(farmDraft.farmArea) : null };
      const saved = await apiRequest('/farmers/me/profile', { token, method: 'PUT', body: payload });
      setFarmerProfile(saved); setNotice('Farm profile submitted. Verification status: ' + (saved.verificationStatus || 'PENDING') + '.');
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const openDelivery = async id => {
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      const detail = await apiRequest('/delivery/assignments/' + id, { token });
      setActiveDelivery(detail);
      setPodDraft({ receivedBy: '', reason: '', cashCollected: '0', items: Object.fromEntries((detail.items || []).map(item => [item.orderItemId, { quantityDelivered: '0', quantityRefused: '0', reason: '' }])) });
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const captureDeliveryLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Location permission is required to record a delivery event. Enable location access in device settings.');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  };
  const startDelivery = async id => {
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      const gps = await captureDeliveryLocation();
      await apiRequest('/delivery/assignments/' + id + '/start', { token, method: 'POST', body: gps });
      await openDelivery(id);
      const assignments = await apiRequest('/delivery/assignments', { token }); setDeliveryAssignments(Array.isArray(assignments) ? assignments : []);
      setNotice('Delivery started. Location captured successfully.');
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const submitDeliveryPod = async () => {
    if (!activeDelivery) return;
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      const gps = await captureDeliveryLocation();
      const items = (activeDelivery.items || []).map(item => ({ orderItemId: item.orderItemId, quantityDelivered: Number(podDraft.items[item.orderItemId]?.quantityDelivered || 0), quantityRefused: Number(podDraft.items[item.orderItemId]?.quantityRefused || 0), reason: podDraft.items[item.orderItemId]?.reason || '' }));
      await apiRequest('/delivery/assignments/' + activeDelivery.id + '/pod', { token, method: 'POST', body: { ...gps, receivedBy: podDraft.receivedBy, reason: podDraft.reason, cashCollected: Number(podDraft.cashCollected || 0), items } });
      const assignments = await apiRequest('/delivery/assignments', { token }); setDeliveryAssignments(Array.isArray(assignments) ? assignments : []);
      setActiveDelivery(null); setNotice('Proof of delivery submitted with GPS coordinates.');
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const openProcessingJob = async job => {
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      const stages = await apiRequest('/mill/processing/jobs/' + job.id + '/stages', { token });
      const list = Array.isArray(stages) ? stages : [];
      const previous = list[list.length - 1];
      const inputQuantity = previous ? String(previous.saleableQuantity) : String(job.inputQuantity);
      const sequence = previous ? previous.sequence + 1 : 1;
      setActiveProcessingJob(job); setProcessingStages(list);
      setStageDraft({ stageName: 'Stage ' + sequence, inputQuantity, outputName: job.productName, batchCode: job.jobNumber + '-S' + sequence, outputQuantity: inputQuantity, wasteQuantity: '0', lossQuantity: '0', remainingQuantity: '0', adjustmentQuantity: '0', qcStatus: 'PASS', qcNote: '' });
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const saveProcessingStage = async () => {
    if (!activeProcessingJob) return;
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      const sequence = processingStages.length ? processingStages[processingStages.length - 1].sequence + 1 : 1;
      const body = { stageName: stageDraft.stageName.trim(), sequence, inputQuantity: Number(stageDraft.inputQuantity), outputs: [{ type: 'SALEABLE', batchCode: stageDraft.batchCode.trim(), name: stageDraft.outputName.trim(), quantity: Number(stageDraft.outputQuantity) }], wasteQuantity: Number(stageDraft.wasteQuantity || 0), lossQuantity: Number(stageDraft.lossQuantity || 0), remainingQuantity: Number(stageDraft.remainingQuantity || 0), adjustmentQuantity: Number(stageDraft.adjustmentQuantity || 0), qcStatus: stageDraft.qcStatus, qcNote: stageDraft.qcNote };
      await apiRequest('/mill/processing/jobs/' + activeProcessingJob.id + '/stages', { token, method: 'POST', body });
      const stages = await apiRequest('/mill/processing/jobs/' + activeProcessingJob.id + '/stages', { token });
      setProcessingStages(Array.isArray(stages) ? stages : []);
      const last = stages[stages.length - 1];
      const nextSequence = last.sequence + 1;
      setStageDraft(current => ({ ...current, stageName: 'Stage ' + nextSequence, inputQuantity: String(last.saleableQuantity), outputName: activeProcessingJob.productName, batchCode: activeProcessingJob.jobNumber + '-S' + nextSequence, outputQuantity: String(last.saleableQuantity), wasteQuantity: '0', lossQuantity: '0', remainingQuantity: '0', adjustmentQuantity: '0', qcStatus: 'PASS', qcNote: '' }));
      setNotice('Processing stage recorded. QC: ' + body.qcStatus + '.');
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const updateProcessingJob = async (id, action) => {
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      await apiRequest('/mill/processing/jobs/' + id + '/' + action, { token, method: 'POST', body: {} });
      const jobs = await apiRequest('/mill/processing/jobs', { token });
      setProcessingJobs(Array.isArray(jobs) ? jobs : []);
      setNotice(action === 'accept' ? 'Processing job accepted.' : 'Physical material receipt confirmed.');
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const respondToPurchaseOrder = async (id, decision) => {
    setFarmerBusy(true); setError(''); setNotice('');
    try {
      await apiRequest('/farmers/me/procurement-orders/' + id + '/response', { token, method: 'POST', body: { decision, reason: decision === 'accept' ? 'Accepted through Kirani mobile app.' : 'Declined through Kirani mobile app.' } });
      const updated = await apiRequest('/farmers/me/procurement-orders', { token });
      setFarmerOrders(Array.isArray(updated) ? updated : []);
      setNotice('Purchase order ' + (decision === 'accept' ? 'accepted' : 'declined') + ' successfully.');
    } catch (e) { setError(e.message); }
    finally { setFarmerBusy(false); }
  };
  const disconnect = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null); setPrincipal(null); setOrders([]); setDashboard(null); setError('');
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
      {principal?.roles?.includes('delivery_operator') && <View style={styles.card}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>My delivery route</Text><Button title="Refresh" secondary onPress={() => loadOrders(token)} disabled={refreshing || farmerBusy} /></View>
        <Text style={styles.body}>Your assigned deliveries are shown here. Starting a delivery and submitting proof requires foreground GPS permission.</Text>
        {!activeDelivery ? (deliveryAssignments.length === 0 ? <Text style={styles.body}>No active delivery assignments.</Text> : deliveryAssignments.map(item => <View key={item.id} style={styles.orderCard}>
          <Text style={styles.orderId}>Order {String(item.orderId).slice(0, 8)}</Text><Text style={styles.body}>{item.slotCode} · {item.date} · {item.startsAt}–{item.endsAt}</Text><Text style={styles.caption}>Status: {item.status}</Text>
          <View style={styles.orderTop}><View style={{ flex: 1 }}><Button title="Open delivery" secondary onPress={() => openDelivery(item.id)} disabled={farmerBusy} /></View>{item.status === 'ASSIGNED' && <View style={{ flex: 1 }}><Button title="Start route" onPress={() => startDelivery(item.id)} disabled={farmerBusy} /></View>}</View>
        </View>)) : <View style={styles.orderCard}>
          <View style={styles.sectionHead}><Text style={styles.orderId}>Order {String(activeDelivery.orderId).slice(0, 8)}</Text><Button title="Back" secondary onPress={() => setActiveDelivery(null)} /></View>
          <Text style={styles.caption}>Record the actual delivered and refused quantities for every order line.</Text>
          {(activeDelivery.items || []).map(item => <View key={item.orderItemId} style={styles.card}>
            <Text style={styles.orderId}>{item.productName}</Text><Text style={styles.caption}>Remaining: {item.remaining} {item.unitCode}</Text>
            <Text style={styles.fieldLabel}>Quantity delivered</Text><TextInput keyboardType="decimal-pad" style={styles.input} value={podDraft.items[item.orderItemId]?.quantityDelivered || '0'} onChangeText={value => setPodDraft(current => ({ ...current, items: { ...current.items, [item.orderItemId]: { ...current.items[item.orderItemId], quantityDelivered: value } } }))} />
            <Text style={styles.fieldLabel}>Quantity refused</Text><TextInput keyboardType="decimal-pad" style={styles.input} value={podDraft.items[item.orderItemId]?.quantityRefused || '0'} onChangeText={value => setPodDraft(current => ({ ...current, items: { ...current.items, [item.orderItemId]: { ...current.items[item.orderItemId], quantityRefused: value } } }))} />
            <Text style={styles.fieldLabel}>Short/refusal reason (if applicable)</Text><TextInput style={styles.input} value={podDraft.items[item.orderItemId]?.reason || ''} onChangeText={value => setPodDraft(current => ({ ...current, items: { ...current.items, [item.orderItemId]: { ...current.items[item.orderItemId], reason: value } } }))} />
          </View>)}
          <Text style={styles.fieldLabel}>Received by</Text><TextInput style={styles.input} value={podDraft.receivedBy} onChangeText={value => setPodDraft(current => ({ ...current, receivedBy: value }))} />
          <Text style={styles.fieldLabel}>Delivery notes / overall reason</Text><TextInput style={styles.input} value={podDraft.reason} onChangeText={value => setPodDraft(current => ({ ...current, reason: value }))} />
          <Text style={styles.fieldLabel}>Cash collected (if any)</Text><TextInput keyboardType="decimal-pad" style={styles.input} value={podDraft.cashCollected} onChangeText={value => setPodDraft(current => ({ ...current, cashCollected: value }))} />
          <Button title={farmerBusy ? 'Submitting…' : 'Capture GPS & submit POD'} onPress={submitDeliveryPod} disabled={farmerBusy} />
        </View>}
      </View>}
      {principal?.roles?.includes('mill_operator') && <View style={styles.card}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Mill processing jobs</Text><Button title="Refresh" secondary onPress={() => loadOrders(token)} disabled={refreshing || farmerBusy} /></View>
        <Text style={styles.body}>Only jobs assigned to your approved facility are shown. Confirm acceptance and physical material receipt before recording processing stages.</Text>
        {!activeProcessingJob ? (processingJobs.length === 0 ? <Text style={styles.body}>No processing jobs are currently assigned to your facility.</Text> : processingJobs.map(job => <View key={job.id} style={styles.orderCard}>
          <Text style={styles.orderId}>{job.jobNumber}</Text><Text style={styles.body}>{job.facilityName} · {job.productName}</Text>
          <Text style={styles.caption}>Source lot {job.sourceLotCode} · {job.inputQuantity} {job.unitCode}</Text>
          <Text style={styles.caption}>Process: {job.processName} · Status: {job.status}</Text>
          {job.status === 'ASSIGNED' && <Button title="Accept job" onPress={() => updateProcessingJob(job.id, 'accept')} disabled={farmerBusy} />}
          {job.status === 'ACCEPTED' && <Button title="Confirm material received" onPress={() => updateProcessingJob(job.id, 'receive')} disabled={farmerBusy} />}
          {['MATERIAL_RECEIVED','IN_PROGRESS','RECONCILIATION_PENDING','QC_PENDING'].includes(job.status) && <Button title="Open stage records" secondary onPress={() => openProcessingJob(job)} disabled={farmerBusy} />}
        </View>)) : <View style={styles.orderCard}>
          <View style={styles.sectionHead}><Text style={styles.orderId}>{activeProcessingJob.jobNumber} · Stage entry</Text><Button title="Back" secondary onPress={() => setActiveProcessingJob(null)} /></View>
          <Text style={styles.caption}>Existing stages</Text>
          {processingStages.map(stage => <View key={stage.id} style={styles.productRow}><View style={styles.productInfo}><Text style={styles.orderId}>{stage.sequence}. {stage.stageName}</Text><Text style={styles.caption}>Input {stage.inputQuantity} · Saleable {stage.saleableQuantity} · QC {stage.qcStatus}</Text></View></View>)}
          <Text style={styles.fieldLabel}>Stage name</Text><TextInput style={styles.input} value={stageDraft.stageName} onChangeText={value => setStageDraft(current => ({ ...current, stageName: value }))} />
          <Text style={styles.fieldLabel}>Input quantity ({activeProcessingJob.unitCode})</Text><TextInput style={styles.input} keyboardType="decimal-pad" editable={false} value={stageDraft.inputQuantity} />
          <Text style={styles.fieldLabel}>Saleable output name</Text><TextInput style={styles.input} value={stageDraft.outputName} onChangeText={value => setStageDraft(current => ({ ...current, outputName: value }))} />
          <Text style={styles.fieldLabel}>Output batch code</Text><TextInput style={styles.input} value={stageDraft.batchCode} onChangeText={value => setStageDraft(current => ({ ...current, batchCode: value }))} />
          <Text style={styles.fieldLabel}>Saleable output quantity</Text><TextInput style={styles.input} keyboardType="decimal-pad" value={stageDraft.outputQuantity} onChangeText={value => setStageDraft(current => ({ ...current, outputQuantity: value }))} />
          {['wasteQuantity','lossQuantity','remainingQuantity','adjustmentQuantity'].map(key => <View key={key}><Text style={styles.fieldLabel}>{key.replace('Quantity',' quantity')}</Text><TextInput style={styles.input} keyboardType="decimal-pad" value={stageDraft[key]} onChangeText={value => setStageDraft(current => ({ ...current, [key]: value }))} /></View>)}
          <Text style={styles.fieldLabel}>Quality result</Text><View style={styles.orderTop}>{['PASS','DEVIATION','FAIL'].map(value => <View key={value} style={{ flex: 1 }}><Button title={value} secondary={stageDraft.qcStatus !== value} onPress={() => setStageDraft(current => ({ ...current, qcStatus: value }))} /></View>)}</View>
          <Text style={styles.fieldLabel}>QC note (required for deviation/fail)</Text><TextInput style={styles.input} value={stageDraft.qcNote} onChangeText={value => setStageDraft(current => ({ ...current, qcNote: value }))} />
          <Button title={farmerBusy ? 'Saving…' : 'Record processing stage'} onPress={saveProcessingStage} disabled={farmerBusy} />
        </View>}
      </View>}
      {principal?.roles?.includes('farmer') && <View style={styles.card}>
        <Text style={styles.eyebrow}>FARMER WORKSPACE</Text><Text style={styles.sectionTitle}>Farm profile</Text>
        <Text style={styles.body}>Keep your farm details current. Submitting changes sends the profile for verification again.</Text>
        {[
          ['Farm name','farmName'],['Village','village'],['Taluk (optional)','taluk'],['District','district'],['State','state'],['6-digit PIN code','postalCode'],['Farm area (optional)','farmArea']
        ].map(([label,key]) => <View key={key}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={String(farmDraft[key] ?? '')} onChangeText={value => setFarmDraft(current => ({ ...current, [key]: value }))} keyboardType={key === 'postalCode' || key === 'farmArea' ? 'numeric' : 'default'} maxLength={key === 'postalCode' ? 6 : 160} style={styles.input} accessibilityLabel={label} /></View>)}
        <Text style={styles.caption}>Profile status: {farmerProfile?.verificationStatus || 'Not submitted'}</Text>
        {!!farmerProfile?.verificationNote && <Message>{farmerProfile.verificationNote}</Message>}
        <Button title={farmerBusy ? 'Saving…' : 'Submit farm profile'} onPress={saveFarmerProfile} disabled={farmerBusy} />
      </View>}
      {principal?.roles?.includes('farmer') && <View style={styles.card}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Purchase orders</Text><Button title="Refresh" secondary onPress={() => loadOrders(token)} disabled={refreshing || farmerBusy} /></View>
        {farmerOrders.length === 0 ? <Text style={styles.body}>No purchase orders have been issued to your farm yet.</Text> : farmerOrders.map(po => <View key={po.id} style={styles.orderCard}>
          <Text style={styles.orderId}>{po.poNumber}</Text><Text style={styles.body}>Status: {po.status} · Expected: {po.expectedDeliveryDate}</Text>
          {(po.items || []).map(item => <Text key={item.id} style={styles.caption}>{item.quantityOrdered} {item.unitCode} · {money(item.lineTotalMinor, 'INR')}</Text>)}
          {po.status === 'ISSUED' && <View style={styles.orderTop}><View style={{ flex: 1 }}><Button title="Accept" onPress={() => respondToPurchaseOrder(po.id, 'accept')} disabled={farmerBusy} /></View><View style={{ flex: 1 }}><Button title="Decline" secondary onPress={() => respondToPurchaseOrder(po.id, 'reject')} disabled={farmerBusy} /></View></View>}
        </View>)}
      </View>}
      {principal?.roles?.includes('customer') && <View style={styles.card}>
        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Shop & recurring basket</Text><Button title={catalogueBusy ? 'Loading…' : 'Load catalogue'} secondary onPress={loadCatalogue} disabled={catalogueBusy} /></View>
        <Text style={styles.body}>Browse available products and save a versioned monthly basket. Final order confirmation remains a separate step.</Text>
        {catalogueBusy && <ActivityIndicator color={colors.forest} />}
        {catalogue.map(product => <View key={product.id} style={styles.productRow}>
          <View style={styles.productInfo}><Text style={styles.orderId}>{product.name}</Text><Text style={styles.caption}>{product.category} · {product.baseUnit} · {money(product.priceMinor,product.currency)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={'Remove one '+product.name} onPress={() => changeQuantity(product,-1)} style={styles.quantityButton}><Text style={styles.quantityText}>−</Text></Pressable>
          <Text style={styles.quantityValue}>{basket[product.id]?.quantity || 0}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={'Add one '+product.name} onPress={() => changeQuantity(product,1)} style={styles.quantityButton}><Text style={styles.quantityText}>＋</Text></Pressable>
        </View>)}
        {catalogue.length > 0 && <Button title={'Save recurring basket ('+Object.keys(basket).length+' products)'} onPress={saveRecurringBasket} />}
      </View>}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACCOUNT</Text><Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.body}>{principal?.displayName || principal?.name || 'Signed-in account'}</Text>
        <View style={styles.roleRow}>{(principal?.roles || []).map(role => <Text key={role} style={styles.role}>{role}</Text>)}</View>
      </View>
      {!!notice && <Message>{notice}</Message>}
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{principal?.roles?.includes('admin') ? 'Operations overview' : 'Your orders'}</Text><Button title={refreshing ? 'Refreshing…' : 'Refresh'} secondary onPress={() => loadOrders(token)} disabled={refreshing} /></View>
      {!!error && <Message error>{error}</Message>}
      {refreshing && orders.length === 0 && !dashboard ? <ActivityIndicator color={colors.forest} /> :
        principal?.roles?.includes('admin') && dashboard ?
          <View style={styles.metricGrid}>
            {[['Orders this month',dashboard.ordersThisMonth],['Active farmers',dashboard.activeFarmers],['Listings to review',dashboard.pendingListings],['Open cycles',dashboard.openCycles],['Order value',money(dashboard.orderValueMinor,'INR')]].map(([label,value]) =>
              <View key={label} style={styles.metricCard}><Text style={styles.caption}>{label}</Text><Text style={styles.metricValue}>{value ?? '—'}</Text></View>)}
          </View> :
          principal?.roles?.includes('customer') ?
            orders.length === 0 ? <View style={styles.card}><Text style={styles.body}>No orders to show yet.</Text></View> :
              orders.map(item => <View key={String(item.id)} style={styles.orderCard}>
                <View style={styles.orderTop}><Text style={styles.orderId}>Order {String(item.id).slice(0, 8)}</Text><Text style={styles.amount}>{money(item.totalMinor, item.currency)}</Text></View>
                <Text style={styles.body}>{item.fulfilmentStatus || 'Status unavailable'} · Payment {item.paymentStatus || '—'}</Text>
                <Text style={styles.caption}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''}</Text>
              </View>) :
            <View style={styles.card}><Text style={styles.body}>Your account is authenticated. Additional role-specific features are being connected.</Text></View>
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
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }, productInfo: { flex: 1, gap: 3 }, quantityButton: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#eaf1df', alignItems: 'center', justifyContent: 'center' }, quantityText: { color: colors.forest, fontSize: 19, fontWeight: '800' }, quantityValue: { minWidth: 22, textAlign: 'center', fontWeight: '800', color: colors.ink }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metricCard: { width: '48%', flexGrow: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 14, gap: 7 }, metricValue: { fontSize: 22, fontWeight: '900', color: colors.forest }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, orderCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 14, marginBottom: 9, gap: 5 }, orderTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, orderId: { fontSize: 12, color: colors.ink, fontWeight: '800' }, amount: { fontSize: 12, color: colors.forest, fontWeight: '900' }, roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, role: { color: colors.forest, backgroundColor: '#eaf1df', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '800' }, footer: { alignItems: 'center', paddingVertical: 15 }, muted: { color: colors.muted, fontSize: 12 }
});
