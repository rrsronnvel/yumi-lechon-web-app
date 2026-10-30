import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  FREEBIE_ITEMS,
  FreebiesConfig,
  formatFreebiesSummary,
  getPigsWithFreebies,
  getFreebiesAllowedQuota,
  normalizeFreebiesConfig,
  updatePigsWithFreebies,
} from '../../utils/freebiesHelper';

interface FreebiesSelectorProps {
  wholePigCount: number;
  noFreebiesDiscountPerPig?: number;
  config: FreebiesConfig;
  onChange: (config: FreebiesConfig) => void;
}

export default function FreebiesSelector({
  wholePigCount,
  noFreebiesDiscountPerPig = 2000,
  config,
  onChange,
}: FreebiesSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalized = normalizeFreebiesConfig(config, wholePigCount);
  const currentSum = Object.values(normalized.counts).reduce(
    (sum, quantity) => sum + quantity,
    0
  );
  const allowedQuota = getFreebiesAllowedQuota(normalized, wholePigCount);
  const pigsWithFreebies = getPigsWithFreebies(normalized, wholePigCount);
  const summary = formatFreebiesSummary(
    normalized,
    wholePigCount,
    noFreebiesDiscountPerPig
  );
  const isCustomized = Boolean(normalized.customizationNote) || FREEBIE_ITEMS.some(
    (item) =>
      normalized.counts[item] !==
      (normalized.rawInnards && item === 'Dinuguan' ? 0 : pigsWithFreebies)
  );

  useEffect(() => {
    if (isCustomized) setIsExpanded(true);
  }, [isCustomized]);

  if (wholePigCount <= 0) return null;

  const selectStandard = () => {
    onChange({
      optOut: false,
      pigsWithFreebies: wholePigCount,
      rawInnards: false,
      counts: Object.fromEntries(
        FREEBIE_ITEMS.map((item) => [item, wholePigCount])
      ),
      customizationNote: '',
    });
  };

  const selectOptOut = () => {
    onChange({
      optOut: true,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: '',
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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>🎁 Whole Lechon Freebies</Text>
      {wholePigCount === 1 ? (
        <View style={styles.primaryRow}>
          <Pressable
            style={[styles.primaryPill, !normalized.optOut && styles.standardActive]}
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
            style={[styles.primaryPill, normalized.optOut && styles.optOutActive]}
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
          <Text style={styles.pigDistributionLabel}>Pigs with 7 Freebies:</Text>
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
            <Text style={styles.quotaText}>(Quota: {pigsWithFreebies * 7})</Text>
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
                    <Text style={[styles.itemName, isLocked && styles.lockedText]}>
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
});
