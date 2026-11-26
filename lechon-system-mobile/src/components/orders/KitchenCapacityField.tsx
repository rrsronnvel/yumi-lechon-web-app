import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { KitchenBatch, useKitchenCapacity } from '../../hooks/useKitchenCapacity';
import { formatBatchAnchor, getCapacityMessage, type CapacitySlot } from '../../utils/kitchenCapacity';

interface KitchenCapacityFieldProps {
  capacity: ReturnType<typeof useKitchenCapacity>;
  isOwner: boolean;
  onPickBatch: (batch: KitchenBatch) => void;
  onPickSuggestion: (slot: CapacitySlot) => void;
}

export default function KitchenCapacityField({ capacity, isOwner, onPickBatch, onPickSuggestion }: KitchenCapacityFieldProps) {
  const { day, projection } = capacity;
  const branches = day?.activeBranches ?? [];
  const batches = day?.mode === 'PeakHoliday' || day?.mode === 'Weekend' ? day.batches : [];
  const selectedBatchCode = capacity.batchCode ?? projection?.batchCode;
  const suggestion = projection?.suggestedNextSlot;
  const state = projection?.status;
  if (!day && !projection && !capacity.isChecking && !capacity.hasError) return null;

  return (
    <View style={styles.field}>
      {branches.length > 1 && (
        <View style={styles.group}>
          <Text style={styles.label}>Roasting branch</Text>
          <View style={styles.chips}>
            {branches.map((branch) => (
              <Pressable
                key={branch.code}
                accessibilityRole="button"
                accessibilityState={{ selected: branch.code === capacity.branchCode }}
                style={[styles.chip, branch.code === capacity.branchCode && styles.chipSelected]}
                onPress={() => capacity.resetSelection(branch.code)}
              >
                <Text style={styles.label}>{branch.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {day?.isHalfDayHoliday && <Text style={styles.warningText}>Dec 25 Half-Day Ops (Cooking until 12:00 NN)</Text>}
      {batches.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.label}>{day?.mode === 'PeakHoliday' ? 'Holiday roasting batches' : 'Weekend roasting slots'}</Text>
          <View style={styles.chips}>
            {batches.map((batch) => (
              <Pressable
                key={batch.batchCode}
                accessibilityRole="button"
                accessibilityState={{ selected: batch.batchCode === selectedBatchCode }}
                accessibilityLabel={`${batch.label}, ${batch.remainingPits} pits left`}
                style={[styles.chip, batch.batchCode === selectedBatchCode && styles.chipSelected]}
                onPress={() => onPickBatch(batch)}
              >
                <Text style={styles.label}>{formatBatchAnchor(batch.anchorTime)}</Text>
                <Text style={styles.chipCaption}>{batch.remainingPits > 0 ? `${batch.remainingPits} left` : 'Full'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {capacity.isChecking && <Text style={styles.chipCaption}>Checking kitchen capacity…</Text>}
      {capacity.hasError && (
        <Pressable accessibilityRole="button" onPress={capacity.refresh}>
          <Text style={styles.actionText}>Live capacity unavailable. Tap to retry.</Text>
        </Pressable>
      )}
      {projection && (
        <View style={[
          styles.meter,
          state === 'LastSlot' && styles.meterWarning,
          (state === 'Full' || state === 'Overbooked') && styles.meterFull,
        ]}>
          <Text accessibilityLiveRegion="polite" style={styles.meterText}>
            {getCapacityMessage(projection, isOwner)}
          </Text>
          {suggestion && (
            <Pressable accessibilityRole="button" onPress={() => onPickSuggestion(suggestion)}>
              <Text style={styles.actionText}>Use Next Open Slot · {suggestion.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {isOwner && projection?.requiresOwnerOverride && (
        <View style={styles.override}>
          <View style={styles.overrideRow}>
            <View style={styles.overrideLabel}>
              <Text style={styles.label}>
                👑 Owner Override: {projection.canFitWithOwnerSqueeze
                  ? `Allow Squeeze (up to ${day?.branch.maxSqueezeBelliesPerPit ?? 4} Bellies/Pit)`
                  : 'Force-Book'}
              </Text>
              {projection.canFitWithOwnerSqueeze && (
                <Text style={styles.chipCaption}>{projection.squeezedProjectedPits}/{projection.maxPits} pits with squeeze</Text>
              )}
            </View>
            <Switch
              accessibilityLabel="Approve kitchen capacity override"
              value={capacity.approved}
              onValueChange={capacity.setApproved}
              trackColor={{ false: '#D1D5DB', true: '#7C3AED' }}
            />
          </View>
          {capacity.approved && (
            <TextInput
              accessibilityLabel="Capacity override note"
              style={styles.note}
              placeholder="Optional override note"
              placeholderTextColor="#6B7280"
              value={capacity.reason}
              onChangeText={capacity.setReason}
              maxLength={250}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8, marginBottom: 14 },
  group: { gap: 6 },
  label: { color: '#292524', fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { alignItems: 'center', backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#E7E5E4', borderRadius: 9, minHeight: 42, minWidth: 52, justifyContent: 'center', paddingHorizontal: 8 },
  chipSelected: { backgroundColor: '#FFEDD5', borderColor: '#EA580C' },
  chipCaption: { color: '#57534E', fontSize: 12 },
  meter: { backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 9, gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  meterWarning: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  meterFull: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  meterText: { color: '#292524', fontSize: 13, fontWeight: '700' },
  warningText: { color: '#92400E', fontSize: 13, fontWeight: '700' },
  actionText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700', paddingVertical: 5 },
  override: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, gap: 6 },
  overrideRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overrideLabel: { flex: 1, gap: 3 },
  note: { backgroundColor: '#FFFFFF', borderColor: '#DDD6FE', borderWidth: 1, borderRadius: 7, color: '#292524', paddingHorizontal: 8, paddingVertical: 7 },
});
