import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useOrderDetails, type OrderDetailsDto } from '../../hooks/useOrders';
import { useAssignOrderRidersMutation, useRiders, type Rider } from '../../hooks/useRiders';
import { buildRiderAssignment, defaultBackupHeads, wholeLechonHeadCount } from '../../utils/riderAssignment';

interface RiderAssignmentPanelProps {
  orderId: number;
  onSaved: () => void;
}

export default function RiderAssignmentPanel({ orderId, onSaved }: RiderAssignmentPanelProps) {
  const details = useOrderDetails(orderId);
  const riders = useRiders();
  if (details.isLoading || riders.isLoading) return <ActivityIndicator color="#1D4ED8" />;
  if (!details.data || riders.isError) {
    return (
      <Pressable accessibilityRole="button" onPress={() => { void details.refetch(); void riders.refetch(); }}>
        <Text style={styles.error}>Could not load the rider assignment. Tap to retry.</Text>
      </Pressable>
    );
  }

  return <RiderAssignmentForm
    key={orderId}
    order={details.data}
    riders={(riders.data ?? []).filter((rider) => rider.isActive)}
    onSaved={onSaved}
  />;
}

function RiderChoices({ riders, value, onChange }: { riders: Rider[]; value: string; onChange: (name: string) => void }) {
  return (
    <View style={styles.chips}>
      {riders.map((rider) => (
        <Pressable
          key={rider.id}
          accessibilityRole="button"
          accessibilityState={{ selected: value === rider.fullName }}
          style={[styles.chip, value === rider.fullName && styles.chipActive]}
          onPress={() => onChange(rider.fullName)}
        >
          <Text style={styles.chipText}>{rider.fullName}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RiderAssignmentForm({ order, riders, onSaved }: {
  order: OrderDetailsDto;
  riders: Rider[];
  onSaved: () => void;
}) {
  const qty = wholeLechonHeadCount(order.orderItems);
  const canSplit = qty > 2 || Boolean(order.supportRiderName);
  const assignment = useAssignOrderRidersMutation();
  const [leadName, setLeadName] = useState(order.assignedRiderName?.toLowerCase() === 'unassigned' ? '' : order.assignedRiderName || '');
  const [showSplit, setShowSplit] = useState(canSplit);
  const [backupName, setBackupName] = useState(order.supportRiderName || '');
  const [backupHeads, setBackupHeads] = useState(String((order.supportRiderName && order.supportRiderHeads) || defaultBackupHeads(qty)));
  const [backupFee, setBackupFee] = useState(String(order.supportRiderName ? order.supportRiderFee ?? order.deliveryFee : order.deliveryFee));
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    const result = buildRiderAssignment({ leadName, splitEnabled: Boolean(backupName.trim()), backupName, backupHeads, backupFee, wholeLechonQty: qty });
    if (!result.payload) {
      setError(result.error);
      return;
    }

    try {
      await assignment.mutateAsync({ orderId: order.id, ...result.payload });
      onSaved();
    } catch (error) {
      const response = error as { response?: { data?: { message?: string; title?: string } } };
      setError(response.response?.data?.message || response.response?.data?.title || 'Could not save the rider assignment.');
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Lead Rider (Collects Cash)</Text>
      <RiderChoices riders={riders} value={leadName} onChange={setLeadName} />
      <TextInput
        accessibilityLabel="Lead rider name"
        style={styles.input}
        value={leadName}
        onChangeText={setLeadName}
        placeholder="Or enter custom rider name"
        placeholderTextColor="#78716C"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showSplit }}
        style={[styles.splitToggle, canSplit && styles.splitRecommended]}
        onPress={() => setShowSplit((open) => !open)}
      >
        <Text style={styles.chipText}>{showSplit ? '− Split Moto Rider (Backup / Store-Shouldered)' : '+ Split Moto Rider'}</Text>
      </Pressable>
      {showSplit && !canSplit && <Text style={styles.hint}>Split delivery is available for orders with more than two whole lechon heads.</Text>}
      {showSplit && canSplit && (
        <View style={styles.backupFields}>
          <Text style={styles.label}>Backup Moto Rider (Collects ₱0)</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !backupName }}
            style={[styles.splitToggle, !backupName && styles.chipActive]}
            onPress={() => setBackupName('')}>
            <Text style={styles.chipText}>No backup rider</Text>
          </Pressable>
          <RiderChoices
            riders={riders.filter((rider) => rider.fullName.trim().toLowerCase() !== leadName.trim().toLowerCase())}
            value={backupName}
            onChange={setBackupName}
          />
          {backupName ? <Text style={styles.hint}>Selected backup: {backupName}</Text> : null}
          <View style={styles.numbers}>
            <View style={styles.numberField}>
              <Text style={styles.label}>Heads Carried</Text>
              <TextInput accessibilityLabel="Heads carried" style={styles.input} value={backupHeads} onChangeText={setBackupHeads} keyboardType="number-pad" editable={Boolean(backupName)} />
            </View>
            <View style={styles.numberField}>
              <Text style={styles.label}>Store-Shouldered Fee (₱)</Text>
              <TextInput accessibilityLabel="Store-shouldered fee" style={styles.input} value={backupFee} onChangeText={setBackupFee} keyboardType="decimal-pad" editable={Boolean(backupName)} />
            </View>
          </View>
        </View>
      )}

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.save, assignment.isPending && styles.pending]}
        disabled={assignment.isPending}
        onPress={() => void save()}
      >
        <Text style={styles.saveText}>{assignment.isPending ? 'Assigning…' : 'Save Rider Assignment'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 10, padding: 10, gap: 9 },
  label: { color: '#1E3A8A', fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 16, borderColor: '#BFDBFE', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  chipActive: { borderColor: '#2563EB', backgroundColor: '#DBEAFE' },
  chipText: { color: '#1E40AF', fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, color: '#172554' },
  splitToggle: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, padding: 9 },
  splitRecommended: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  hint: { color: '#57534E', fontSize: 12 },
  backupFields: { gap: 7, borderLeftWidth: 2, borderLeftColor: '#60A5FA', paddingLeft: 9 },
  numbers: { flexDirection: 'row', gap: 8 },
  numberField: { flex: 1, gap: 4 },
  error: { color: '#991B1B', fontSize: 13, fontWeight: '700' },
  save: { alignItems: 'center', backgroundColor: '#1D4ED8', borderRadius: 8, padding: 10 },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  pending: { opacity: 0.55 },
});
