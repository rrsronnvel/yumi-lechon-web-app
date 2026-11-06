import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BellyFreebieSource,
  calculateBellySlotsUsed,
  canIncrementBellyFreebie,
  createDefaultBellyCokeSwap,
  createDefaultBellyCounts,
  FREEBIE_ITEMS,
  FreebiesConfig,
  formatFreebiesSummary,
  getBellyDefaultLabel,
  getBellySignature,
  getPigsWithFreebies,
  getFreebiesAllowedQuota,
  normalizeFreebiesConfig,
  updatePigsWithFreebies,
} from '../../utils/freebiesHelper';

interface FreebiesSelectorProps {
  wholePigCount: number;
  noFreebiesDiscountPerPig?: number;
  config: FreebiesConfig;
  bellyItems?: BellyFreebieSource[];
  onChange: (config: FreebiesConfig) => void;
}

export default function FreebiesSelector({
  wholePigCount,
  noFreebiesDiscountPerPig = 2000,
  config,
  bellyItems = [],
  onChange,
}: FreebiesSelectorProps) {
  // 1. ALL HOOKS UNCONDITIONALLY AT THE VERY TOP
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBellyExpanded, setIsBellyExpanded] = useState(false);

  const normalized = useMemo(
    () => normalizeFreebiesConfig(config, wholePigCount, bellyItems),
    [config, wholePigCount, bellyItems]
  );

  const defaultBellyCounts = useMemo(
    () => createDefaultBellyCounts(bellyItems),
    [bellyItems]
  );

  const currentSum = Object.values(normalized.counts).reduce(
    (sum, quantity) => sum + quantity,
    0
  );
  const allowedQuota = getFreebiesAllowedQuota(normalized, wholePigCount);
  const pigsWithFreebies = getPigsWithFreebies(normalized, wholePigCount);
  const summary = formatFreebiesSummary(
    normalized,
    wholePigCount,
    noFreebiesDiscountPerPig,
    bellyItems
  );
  const isCustomized =
    Boolean(normalized.customizationNote) ||
    FREEBIE_ITEMS.some(
      (item) =>
        normalized.counts[item] !==
        (normalized.rawInnards && item === 'Dinuguan' ? 0 : pigsWithFreebies)
    );

  const isBellyCustomized = FREEBIE_ITEMS.some(
    (item) =>
      (normalized.bellyCounts?.[item] ?? 0) !== (defaultBellyCounts[item] ?? 0)
  );

  useEffect(() => {
    if (isCustomized) setIsExpanded(true);
  }, [isCustomized]);

  useEffect(() => {
    if (isBellyCustomized) setIsBellyExpanded(true);
  }, [isBellyCustomized]);

  useEffect(() => {
    if (config.bellySignature !== getBellySignature(bellyItems)) {
      onChange(normalized);
    }
  }, [bellyItems, config.bellySignature, normalized, onChange]);

  // 2. EARLY RETURN STRICTLY AFTER ALL HOOKS
  if (wholePigCount <= 0 && bellyItems.length === 0) return null;

  // 3. COMPUTATIONS FOR BELLY SLOTS
  const {
    slotsUsed: bellySlotsUsed,
    totalSlotsAllowed: bellySlotQuota,
    belly5kgCount,
  } = calculateBellySlotsUsed(normalized.bellyCounts ?? {}, bellyItems);

  const bellySummaryText =
    FREEBIE_ITEMS.filter((item) => (normalized.bellyCounts?.[item] ?? 0) > 0)
      .map((item) => `${normalized.bellyCounts?.[item]}x ${item}`)
      .join(', ') || 'No items';

  // 4. WHOLE LECHON ACTIONS
  const selectStandard = () => {
    onChange({
      optOut: false,
      pigsWithFreebies: wholePigCount,
      rawInnards: false,
      counts: Object.fromEntries(
        FREEBIE_ITEMS.map((item) => [item, wholePigCount])
      ),
      customizationNote: '',
      bellyCounts: normalized.bellyCounts,
      bellyCustomizationNote: normalized.bellyCustomizationNote,
      bellySignature: normalized.bellySignature,
    });
  };

  const selectOptOut = () => {
    onChange({
      optOut: true,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: '',
      bellyCounts: normalized.bellyCounts,
      bellyCustomizationNote: normalized.bellyCustomizationNote,
      bellySignature: normalized.bellySignature,
    });
    setIsExpanded(false);
  };

  const setPigsWithFreebies = (nextCount: number) => {
    const nextConfig = updatePigsWithFreebies(
      normalized,
      wholePigCount,
      nextCount
    );
    onChange(nextConfig);
    if (nextConfig.optOut) setIsExpanded(false);
  };

  const toggleRawInnards = () => {
    const rawInnards = !normalized.rawInnards;
    onChange({
      ...normalized,
      rawInnards,
      counts: {
        ...normalized.counts,
        Dinuguan: rawInnards ? 0 : pigsWithFreebies,
      },
    });
  };

  const updateCount = (item: string, delta: number) => {
    if (item === 'Dinuguan' && normalized.rawInnards) return;
    const current = normalized.counts[item] || 0;
    const next = Math.max(0, current + delta);
    if (delta > 0 && currentSum >= allowedQuota) return;
    onChange({
      ...normalized,
      counts: { ...normalized.counts, [item]: next },
    });
  };

  // 5. BELLY ACTIONS
  const selectStandardBelly = () => {
    onChange({
      ...normalized,
      bellyCounts: createDefaultBellyCounts(bellyItems),
      bellyCustomizationNote: '',
    });
    setIsBellyExpanded(false);
  };

  const handleSwapBilaoToCoke = () => {
    const nextCounts = createDefaultBellyCokeSwap(bellyItems);
    onChange({
      ...normalized,
      bellyCounts: nextCounts,
      bellyCustomizationNote: '',
    });
  };

  const updateBellyCount = (item: string, delta: number) => {
    const current = normalized.bellyCounts?.[item] ?? 0;
    if (
      delta > 0 &&
      !canIncrementBellyFreebie(item, normalized.bellyCounts ?? {}, bellyItems)
    ) {
      return;
    }
    onChange({
      ...normalized,
      bellyCounts: {
        ...normalized.bellyCounts,
        [item]: Math.max(0, current + delta),
      },
    });
  };

  return (
    <>
      {wholePigCount > 0 && (
        <View style={styles.container}>
          <Text style={styles.heading}>🎁 Whole Lechon Freebies</Text>
          {wholePigCount === 1 ? (
            <View style={styles.primaryRow}>
              <Pressable
                style={[
                  styles.primaryPill,
                  !normalized.optOut && styles.standardActive,
                ]}
                onPress={selectStandard}
              >
                <Text
                  style={[
                    styles.primaryPillText,
                    !normalized.optOut && styles.standardActiveText,
                  ]}
                >
                  🎁 Standard 7 Freebies
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryPill,
                  normalized.optOut && styles.optOutActive,
                ]}
                onPress={selectOptOut}
              >
                <Text
                  style={[
                    styles.primaryPillText,
                    normalized.optOut && styles.optOutActiveText,
                  ]}
                >
                  🚫 No Freebies (-₱{noFreebiesDiscountPerPig.toLocaleString()})
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pigDistributionRow}>
              <Text style={styles.pigDistributionLabel}>
                Pigs with 7 Freebies:
              </Text>
              <View style={styles.pigDistributionControls}>
                <Pressable
                  accessibilityLabel="Remove one pig with freebies"
                  style={[
                    styles.distributionButton,
                    pigsWithFreebies <= 0 && styles.disabledButton,
                  ]}
                  disabled={pigsWithFreebies <= 0}
                  onPress={() => setPigsWithFreebies(pigsWithFreebies - 1)}
                >
                  <Text style={styles.distributionButtonText}>−</Text>
                </Pressable>
                <Text style={styles.pigCountText}>{pigsWithFreebies}</Text>
                <Pressable
                  accessibilityLabel="Add one pig with freebies"
                  style={[
                    styles.distributionButton,
                    styles.distributionAddButton,
                    pigsWithFreebies >= wholePigCount && styles.disabledButton,
                  ]}
                  disabled={pigsWithFreebies >= wholePigCount}
                  onPress={() => setPigsWithFreebies(pigsWithFreebies + 1)}
                >
                  <Text style={styles.distributionAddButtonText}>+</Text>
                </Pressable>
                <Text style={styles.quotaText}>
                  (Quota: {pigsWithFreebies * 7})
                </Text>
              </View>
            </View>
          )}

          {!normalized.optOut && (
            <>
              <View style={styles.secondaryRow}>
                <Pressable
                  style={[
                    styles.secondaryPill,
                    normalized.rawInnards && styles.secondaryPillActive,
                  ]}
                  onPress={toggleRawInnards}
                >
                  <Text style={styles.secondaryPillText}>
                    🥩 Raw Innards (Walang Dinuguan)
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryPill}
                  onPress={() => setIsExpanded((value) => !value)}
                >
                  <Text style={styles.secondaryPillText}>
                    ⚙️ Customize / Swap ({currentSum}/{allowedQuota})
                  </Text>
                </Pressable>
              </View>

              {isExpanded && (
                <View style={styles.stepperGrid}>
                  {FREEBIE_ITEMS.map((item) => {
                    const isLocked = item === 'Dinuguan' && normalized.rawInnards;
                    return (
                      <View key={item} style={styles.stepperRow}>
                        <Text
                          style={[styles.itemName, isLocked && styles.lockedText]}
                        >
                          {item}
                        </Text>
                        <View style={styles.stepperControls}>
                          <Pressable
                            style={styles.stepperButton}
                            disabled={isLocked || normalized.counts[item] <= 0}
                            onPress={() => updateCount(item, -1)}
                          >
                            <Text style={styles.stepperButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.quantityText}>
                            {normalized.counts[item] || 0}
                          </Text>
                          <Pressable
                            style={styles.stepperButton}
                            disabled={isLocked || currentSum >= allowedQuota}
                            onPress={() => updateCount(item, 1)}
                          >
                            <Text style={styles.stepperButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
      )}

      {bellyItems.length > 0 && (
        <View style={styles.bellyContainer}>
          <Text style={styles.bellyHeading}>🎁 Lechon Belly Freebies</Text>

          <View style={styles.bellyDefaultsWrap}>
            {bellyItems.map((item, index) => (
              <Text key={`${item.kg}-${index}`} style={styles.bellyDefaultPill}>
                {item.quantity}x {item.kg}kg Belly: {getBellyDefaultLabel(item.kg)}
              </Text>
            ))}
          </View>

          <View style={styles.primaryRow}>
            <Pressable
              style={[
                styles.primaryPill,
                !isBellyCustomized && styles.standardActive,
              ]}
              onPress={selectStandardBelly}
            >
              <Text
                style={[
                  styles.primaryPillText,
                  !isBellyCustomized && styles.standardActiveText,
                ]}
              >
                🎁 Standard Belly Freebies
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryPill,
                isBellyCustomized && styles.customizeActive,
              ]}
              onPress={() => setIsBellyExpanded((prev) => !prev)}
            >
              <Text
                style={[
                  styles.primaryPillText,
                  isBellyCustomized && styles.customizeActiveText,
                ]}
              >
                ⚙️ Customize / Swap ({bellySlotsUsed}/{bellySlotQuota})
              </Text>
            </Pressable>
          </View>

          {isBellyExpanded && (
            <View>
              {belly5kgCount > 0 && (
                <View style={styles.cokeSwapBanner}>
                  <View style={styles.cokeSwapInfo}>
                    <Text style={styles.cokeSwapTitle}>5kg Belly Special Swap</Text>
                    <Text style={styles.cokeSwapSubtitle}>1 Bilao = 4x 1.5L Coke</Text>
                  </View>
                  <Pressable
                    style={styles.cokeSwapButton}
                    onPress={handleSwapBilaoToCoke}
                  >
                    <Text style={styles.cokeSwapButtonText}>🥤 Swap Bilao → 4x Coke</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.stepperGrid}>
                {FREEBIE_ITEMS.map((item) => {
                  const isPlusDisabled = !canIncrementBellyFreebie(
                    item,
                    normalized.bellyCounts ?? {},
                    bellyItems
                  );
                  return (
                    <View key={`belly-${item}`} style={styles.stepperRow}>
                      <Text style={styles.itemName}>{item}</Text>
                      <View style={styles.stepperControls}>
                        <Pressable
                          style={styles.stepperButton}
                          disabled={(normalized.bellyCounts?.[item] ?? 0) <= 0}
                          onPress={() => updateBellyCount(item, -1)}
                        >
                          <Text style={styles.stepperButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.quantityText}>
                          {normalized.bellyCounts?.[item] ?? 0}
                        </Text>
                        <Pressable
                          style={[
                            styles.stepperButton,
                            isPlusDisabled && styles.disabledButton,
                          ]}
                          disabled={isPlusDisabled}
                          onPress={() => updateBellyCount(item, 1)}
                        >
                          <Text style={styles.stepperButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <Text style={styles.bellyQuota}>
            Slots Used: {bellySlotsUsed}/{bellySlotQuota} ({bellySummaryText}) • 2 slots per belly (5kg Bilao = 4x Coke) • custom swaps stay ₱0
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  heading: { color: '#78350F', fontSize: 13, fontWeight: '900' },
  primaryRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  primaryPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPillText: {
    color: '#57534E',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  standardActive: { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  standardActiveText: { color: '#065F46' },
  optOutActive: { backgroundColor: '#FFF1F2', borderColor: '#FB7185' },
  optOutActiveText: { color: '#9F1239' },
  customizeActive: { backgroundColor: '#FDF4FF', borderColor: '#C026D3' },
  customizeActiveText: { color: '#86198F' },
  pigDistributionRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pigDistributionLabel: { color: '#78350F', fontSize: 11, fontWeight: '900' },
  pigDistributionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distributionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#E7E5E4',
  },
  distributionAddButton: { backgroundColor: '#292524' },
  distributionButtonText: { color: '#292524', fontSize: 16, fontWeight: '900' },
  distributionAddButtonText: { color: '#FCD34D', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.4 },
  pigCountText: {
    width: 20,
    color: '#1C1917',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
  },
  quotaText: { color: '#57534E', fontSize: 10, fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  secondaryPill: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  secondaryPillActive: { backgroundColor: '#FEF3C7' },
  secondaryPillText: { color: '#92400E', fontSize: 10, fontWeight: '800' },
  stepperGrid: { gap: 6, marginTop: 9 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  itemName: { color: '#44403C', fontSize: 11, fontWeight: '700' },
  lockedText: { color: '#A8A29E', textDecorationLine: 'line-through' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F4',
    borderRadius: 7,
  },
  stepperButtonText: { color: '#292524', fontSize: 16, fontWeight: '900' },
  quantityText: {
    width: 22,
    textAlign: 'center',
    color: '#1C1917',
    fontSize: 12,
    fontWeight: '900',
  },
  summary: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    color: '#78350F',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 9,
    fontSize: 10,
    fontWeight: '900',
  },
  bellyContainer: {
    backgroundColor: '#FDF4FF',
    borderWidth: 1,
    borderColor: '#E879F9',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  bellyHeading: { color: '#701A75', fontSize: 13, fontWeight: '900' },
  bellyDefaultsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  bellyDefaultPill: {
    color: '#86198F',
    backgroundColor: '#FFFFFF',
    borderColor: '#F0ABFC',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  cokeSwapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#C084FC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  cokeSwapInfo: { flex: 1, marginRight: 8 },
  cokeSwapTitle: { color: '#581C87', fontSize: 11, fontWeight: '800' },
  cokeSwapSubtitle: { color: '#7E22CE', fontSize: 9, fontWeight: '600' },
  cokeSwapButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A855F7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  cokeSwapButtonText: { color: '#6B21A8', fontSize: 10, fontWeight: '800' },
  bellyQuota: { color: '#86198F', fontSize: 10, fontWeight: '700', marginTop: 8 },
});
