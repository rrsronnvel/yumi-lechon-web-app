import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { parsePromoItems, PromoPackageDto } from '../../hooks/usePromos';
import {
  PROMO_KITCHEN_ITEMS,
  createPromoPackageCounts,
  getPromoSlotsUsed,
  normalizePromoKitchenCounts,
} from '../../utils/freebiesHelper';

interface PromoPackageSelectorProps {
  date: string;
  wholePigCount: number;
  promos: PromoPackageDto[];
  selectedCode: string | null;
  isLoading?: boolean;
  rawInnards?: boolean;
  onSelect: (promo: PromoPackageDto) => void;
  onToggleRawInnards?: () => void;
  allowLegacyUnselected?: boolean;
  promoCounts?: Record<string, number>;
  promoCustomized?: boolean;
  onPromoCountsChange?: (counts: Record<string, number>) => void;
}

const isDecemberDate = (date: string): boolean => /^\d{4}-12-\d{2}$/.test(date);

export default function PromoPackageSelector({
  date,
  wholePigCount,
  promos,
  selectedCode,
  isLoading = false,
  rawInnards = false,
  onSelect,
  onToggleRawInnards,
  allowLegacyUnselected = false,
  promoCounts,
  promoCustomized = false,
  onPromoCountsChange,
}: PromoPackageSelectorProps) {
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const day = Number(date.slice(8, 10));
  const isPeak = isDecemberDate(date) && (day === 24 || day === 31);
  const selectedPromo = promos.find((promo) => promo.code === selectedCode) ?? null;
  const groupedPromos = useMemo(() => {
    const groups = new Map<string, PromoPackageDto[]>();
    promos.forEach((promo) => {
      const group = groups.get(promo.groupName) ?? [];
      group.push(promo);
      groups.set(promo.groupName, group);
    });
    return Array.from(groups.entries());
  }, [promos]);

  const selectedItems = useMemo(() => parsePromoItems(selectedPromo), [selectedPromo]);
  const selectedDiscount = Number(selectedPromo?.discountAmount ?? 0) * wholePigCount;
  const defaultCounts = useMemo(
    () => createPromoPackageCounts(selectedItems, wholePigCount),
    [selectedItems, wholePigCount],
  );
  const activeCounts = useMemo(
    () => normalizePromoKitchenCounts(promoCounts ?? defaultCounts),
    [defaultCounts, promoCounts],
  );
  const allowedSlots = Object.values(defaultCounts).reduce((sum, quantity) => sum + quantity, 0);
  const usedSlots = getPromoSlotsUsed(activeCounts, rawInnards ? wholePigCount : 0);
  const canCustomize = Boolean(
    selectedPromo &&
    Number(selectedPromo.discountAmount) === 0 &&
    allowedSlots > 1 &&
    onPromoCountsChange,
  );

  useEffect(() => {
    setIsCustomExpanded(Boolean(promoCustomized));
  }, [selectedCode, promoCustomized]);

  if (!isDecemberDate(date) || wholePigCount <= 0) return null;

  const updatePromoCount = (item: string, delta: number) => {
    if (!onPromoCountsChange || (rawInnards && item === 'Dinuguan')) return;
    const current = activeCounts[item] ?? 0;
    if (delta > 0 && usedSlots >= allowedSlots) return;
    onPromoCountsChange({
      ...activeCounts,
      [item]: Math.max(0, current + delta),
    });
  };

  return (
    <View style={[styles.container, isPeak && styles.peakContainer]}>
      <Text style={[styles.title, isPeak && styles.peakTitle]}>
        {isPeak
          ? '🎄 Peak Holiday Freebies (Dec 24 & 31)'
          : '🎄 Selected December Promo'}
      </Text>
      <Text style={styles.subtitle}>
        {isPeak
          ? 'Choose Dinuguan or Bopis. The cash-discount option appears only when enabled by the Owner.'
          : 'Choose Cristel\'s Option 1, Option 2, or Option 3 package.'}
      </Text>

      {isLoading ? (
        <ActivityIndicator color="#B45309" style={styles.loader} />
      ) : promos.length === 0 ? (
        <Text style={styles.emptyText}>No active promo packages are available for this date.</Text>
      ) : (
        groupedPromos.map(([groupName, groupPromos]) => (
          <View key={groupName} style={styles.group}>
            <Text style={styles.groupTitle}>{groupName.toUpperCase()}</Text>
            {groupPromos.map((promo) => {
              const selected = promo.code === selectedCode;
              return (
                <Pressable
                  key={promo.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => onSelect(promo)}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionName, selected && styles.optionNameSelected]}>
                      {selected ? '✓ ' : ''}{promo.name}
                    </Text>
                    {promo.description ? (
                      <Text style={styles.optionDescription}>{promo.description}</Text>
                    ) : null}
                  </View>
                  {Number(promo.discountAmount) > 0 ? (
                    <Text style={styles.discountBadge}>−₱{Number(promo.discountAmount).toLocaleString()}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))
      )}

      {selectedPromo ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>PACKAGE PREVIEW</Text>
          <View style={styles.pills}>
            {Object.entries(selectedItems).map(([item, quantity]) => (
              <Text key={item} style={styles.itemPill}>
                {quantity * wholePigCount}x{' '}
                {item === 'Puto' && isPeak
                  ? 'Puto (40 pcs)'
                  : item === 'Sarsa' && (selectedDiscount > 0 || isPeak)
                    ? selectedDiscount > 0
                      ? 'Liver Sauce Only'
                      : 'Liver Sauce'
                    : item}
              </Text>
            ))}
            {selectedDiscount > 0 ? (
              <Text style={styles.discountPill}>+ ₱{selectedDiscount.toLocaleString()} Discount</Text>
            ) : null}
          </View>
          {onToggleRawInnards && Number(selectedItems.Dinuguan ?? 0) > 0 ? (
            <Pressable
              style={[styles.rawInnardsButton, rawInnards && styles.rawInnardsButtonActive]}
              onPress={onToggleRawInnards}
            >
              <Text style={styles.rawInnardsText}>
                {rawInnards ? '✓ ' : ''}🥩 Raw Innards / Walang Dinuguan
              </Text>
            </Pressable>
          ) : null}

          {canCustomize ? (
            <View style={styles.customizer}>
              <View style={styles.modeRow}>
                <Pressable
                  style={[styles.modeButton, !isCustomExpanded && styles.standardModeActive]}
                  onPress={() => {
                    setIsCustomExpanded(false);
                    onPromoCountsChange?.(defaultCounts);
                  }}
                >
                  <Text style={[styles.modeText, !isCustomExpanded && styles.standardModeTextActive]}>
                    🎁 Standard Package Items
                  </Text>
                  {!isCustomExpanded ? <Text style={styles.activeBadge}>ACTIVE</Text> : null}
                </Pressable>
                <Pressable
                  style={[styles.modeButton, isCustomExpanded && styles.customModeActive]}
                  onPress={() => setIsCustomExpanded(true)}
                >
                  <Text style={[styles.modeText, isCustomExpanded && styles.customModeTextActive]}>
                    ⚙️ Customize / Swap ({usedSlots}/{allowedSlots})
                  </Text>
                  {promoCustomized ? <Text style={styles.customBadge}>CUSTOMIZED</Text> : null}
                </Pressable>
              </View>

              {isCustomExpanded ? (
                <View style={styles.customBody}>
                  {PROMO_KITCHEN_ITEMS.map((item) => {
                    const locked = rawInnards && item === 'Dinuguan';
                    return (
                      <View key={item} style={[styles.stepperRow, locked && styles.stepperRowLocked]}>
                        <Text style={styles.stepperLabel}>{item}</Text>
                        <View style={styles.stepperActions}>
                          <Pressable
                            disabled={locked || (activeCounts[item] ?? 0) <= 0}
                            style={[styles.stepperButton, (locked || (activeCounts[item] ?? 0) <= 0) && styles.stepperDisabled]}
                            onPress={() => updatePromoCount(item, -1)}
                          >
                            <Text style={styles.stepperButtonText}>-</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{activeCounts[item] ?? 0}</Text>
                          <Pressable
                            disabled={locked || usedSlots >= allowedSlots}
                            style={[styles.stepperButton, styles.stepperPlus, (locked || usedSlots >= allowedSlots) && styles.stepperDisabled]}
                            onPress={() => updatePromoCount(item, 1)}
                          >
                            <Text style={styles.stepperPlusText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                  <Text style={[styles.slotSummary, usedSlots !== allowedSlots && styles.slotSummaryWarning]}>
                    Slots Used: {usedSlots}/{allowedSlots}
                    {usedSlots !== allowedSlots ? ' • Complete the swap before saving' : ''}
                  </Text>
                  <View style={styles.pills}>
                    {PROMO_KITCHEN_ITEMS.filter((item) => (activeCounts[item] ?? 0) > 0).map((item) => (
                      <Text key={`custom-${item}`} style={styles.customSummaryPill}>
                        {activeCounts[item]}x {item}
                      </Text>
                    ))}
                    {rawInnards ? (
                      <Text style={styles.customSummaryPill}>{wholePigCount}x Raw Innards</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={allowLegacyUnselected ? styles.legacyText : styles.requiredText}>
          {allowLegacyUnselected
            ? 'Legacy December freebies are preserved. Select a package only if you want to upgrade this order.'
            : 'Select a December promo package before submitting.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#4ADE80',
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
  },
  peakContainer: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  title: { color: '#166534', fontSize: 13, fontWeight: '900' },
  peakTitle: { color: '#92400E' },
  subtitle: { color: '#57534E', fontSize: 10, lineHeight: 14, marginTop: 3 },
  loader: { marginVertical: 12 },
  emptyText: { color: '#B91C1C', fontSize: 11, fontWeight: '700', marginTop: 9 },
  group: { marginTop: 10, gap: 6 },
  groupTitle: { color: '#78716C', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  optionSelected: { borderColor: '#16A34A', backgroundColor: '#DCFCE7' },
  optionTextWrap: { flex: 1 },
  optionName: { color: '#44403C', fontSize: 11, fontWeight: '800' },
  optionNameSelected: { color: '#166534' },
  optionDescription: { color: '#78716C', fontSize: 9, lineHeight: 13, marginTop: 2 },
  discountBadge: {
    color: '#9F1239',
    backgroundColor: '#FFE4E6',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: '900',
  },
  preview: { borderTopWidth: 1, borderTopColor: '#D6D3D1', marginTop: 11, paddingTop: 9 },
  previewTitle: { color: '#78716C', fontSize: 9, fontWeight: '900' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  itemPill: {
    color: '#14532D',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: '800',
  },
  discountPill: {
    color: '#9F1239',
    backgroundColor: '#FFE4E6',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: '900',
  },
  rawInnardsButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
  },
  rawInnardsButtonActive: { backgroundColor: '#FEF3C7' },
  rawInnardsText: { color: '#92400E', fontSize: 9, fontWeight: '800' },
  requiredText: { color: '#B91C1C', fontSize: 10, fontWeight: '800', marginTop: 9 },
  legacyText: { color: '#57534E', fontSize: 10, fontWeight: '700', marginTop: 9 },
  customizer: { borderTopWidth: 1, borderTopColor: '#D6D3D1', marginTop: 10, paddingTop: 10 },
  modeRow: { gap: 7 },
  modeButton: {
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  standardModeActive: { borderColor: '#16A34A', backgroundColor: '#DCFCE7' },
  customModeActive: { borderColor: '#9333EA', backgroundColor: '#FAE8FF' },
  modeText: { color: '#57534E', fontSize: 10, fontWeight: '900' },
  standardModeTextActive: { color: '#166534' },
  customModeTextActive: { color: '#6B21A8' },
  activeBadge: { color: '#FFFFFF', backgroundColor: '#16A34A', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, fontSize: 8, fontWeight: '900' },
  customBadge: { color: '#FFFFFF', backgroundColor: '#7E22CE', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, fontSize: 8, fontWeight: '900' },
  customBody: { gap: 6, marginTop: 9 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E9D5FF', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  stepperRowLocked: { opacity: 0.5, backgroundColor: '#F5F5F4' },
  stepperLabel: { color: '#292524', fontSize: 10, fontWeight: '800', flex: 1 },
  stepperActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperButton: { width: 27, height: 27, borderRadius: 7, backgroundColor: '#E7E5E4', alignItems: 'center', justifyContent: 'center' },
  stepperPlus: { backgroundColor: '#581C87' },
  stepperDisabled: { opacity: 0.35 },
  stepperButtonText: { color: '#292524', fontSize: 15, fontWeight: '900' },
  stepperPlusText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  stepperValue: { width: 24, textAlign: 'center', color: '#1C1917', fontSize: 12, fontWeight: '900' },
  slotSummary: { color: '#166534', fontSize: 10, fontWeight: '900', marginTop: 3 },
  slotSummaryWarning: { color: '#B45309' },
  customSummaryPill: { color: '#6B21A8', backgroundColor: '#FAE8FF', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '800' },
});
