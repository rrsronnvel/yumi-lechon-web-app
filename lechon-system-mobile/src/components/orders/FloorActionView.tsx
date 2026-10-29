import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  useDefrostRosterQuery,
  usePendingConfirmationsQuery,
  usePendingOwnerConfirmationsQuery,
  PendingConfirmationItemDto,
} from '../../hooks/useFloorAction';
import { useConfirmOwnerOrderMutation } from '../../hooks/useOrders';
import { useAuth } from '../../context/AuthContext';
import {
  generateDownpaymentReminder,
  generateDefrostRosterMessage,
} from '../../utils/messengerTemplates';
import { sanitizeFreebiesSummary } from '../../utils/freebiesHelper';
import WalkInBadge from './WalkInBadge';

interface FloorActionViewProps {
  onSelectOrderForDeposit: (orderId: number) => void;
  onRefresh?: () => Promise<unknown> | void;
  isRefreshing?: boolean;
  alertsActive: boolean;
  usesInAppFallback: boolean;
  sendTestNotification: () => Promise<void>;
}

const formatSchedule = (dateStr: string | Date): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return (
    d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) +
    ' • ' +
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
};

const formatTimeOnly = (dateStr: string | Date): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const computeDaysUntil = (targetDateStr: string | Date): number => {
  const target = new Date(targetDateStr);
  const now = new Date();
  const targetMidnight = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const nowMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  return Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));
};

export default function FloorActionView({
  onSelectOrderForDeposit,
  onRefresh,
  isRefreshing = false,
  alertsActive,
  usesInAppFallback,
  sendTestNotification,
}: FloorActionViewProps) {
  const { isOwner } = useAuth();
  const confirmOwnerMutation = useConfirmOwnerOrderMutation();
  const {
    data: confirmations = [],
    isLoading: isConfirmationsLoading,
    isError: isConfirmationsError,
    refetch: refetchConfirmations,
  } = usePendingConfirmationsQuery();

  const {
    data: rawDefrostRoster = [],
    isLoading: isRosterLoading,
    isError: isRosterError,
    refetch: refetchRoster,
  } = useDefrostRosterQuery();

  const defrostRoster = rawDefrostRoster.filter((item) => {
    const categoryName = `${item.categoryName || ''} ${
      item.weightCategory || ''
    }`.toLowerCase();
    const hasNonPositiveWeight =
      item.minimumWeightKg !== undefined && item.minimumWeightKg <= 0;
    const isKnownAddOn =
      /sarsa|sauce|dinuguan|pancit|pansit|palabok|spaghetti|puto|coke/i.test(
        categoryName
      );
    return !hasNonPositiveWeight && !isKnownAddOn;
  });

  const {
    data: ownerConfirmations = [],
    isLoading: isOwnerConfirmationsLoading,
    isError: isOwnerConfirmationsError,
    refetch: refetchOwnerConfirmations,
  } = usePendingOwnerConfirmationsQuery();

  const isLoading =
    isConfirmationsLoading || isRosterLoading || isOwnerConfirmationsLoading;
  const isError =
    isConfirmationsError || isRosterError || isOwnerConfirmationsError;

  const handlePullRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
    }
    await Promise.all([
      refetchConfirmations(),
      refetchRoster(),
      refetchOwnerConfirmations(),
    ]);
  };

  const handleTestNotification = () => {
    void sendTestNotification();
  };

  const handleConfirmOwnerOrder = (orderId: number, reference: string) => {
    Alert.alert(
      'Confirm Order',
      `Verify and confirm order ${reference || `#${orderId}`}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Order',
          onPress: () => {
            confirmOwnerMutation.mutate(orderId, {
              onSuccess: () => Alert.alert('Confirmed', 'Owner review is complete.'),
              onError: () =>
                Alert.alert('Could Not Confirm', 'Please retry the owner confirmation.'),
            });
          },
        },
      ]
    );
  };

  const handleCopyReminder = async (item: PendingConfirmationItemDto) => {
    const message = generateDownpaymentReminder({
      customerName: item.customerName,
      targetDeliveryTime: item.targetDeliveryTime,
      itemsSummary: item.itemsSummary,
      grandTotal: item.grandTotal ?? item.totalAmount ?? 0,
      balanceDue: item.balanceDue ?? item.grandTotal ?? 0,
    });
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied!', 'Copied payment reminder for Messenger!');
  };

  const handleCopyDefrostList = async () => {
    if (!defrostRoster || defrostRoster.length === 0) return;
    const message = generateDefrostRosterMessage(defrostRoster);
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied!', 'Defrost list copied for Messenger!');
  };

  const dialCustomerNumber = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone) {
      Alert.alert('No Phone Number', 'No contact number is on file for this customer.');
      return;
    }
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Dialer Error', `Could not launch phone dialer for ${cleanPhone}.`);
    });
  };

  const handleCallCustomer = (contactNumber: string) => {
    const phones = (contactNumber || '')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);

    if (phones.length === 0) {
      Alert.alert('No Phone Number', 'No contact number is on file for this customer.');
      return;
    }

    if (phones.length > 1) {
      Alert.alert('Select Number to Dial', 'Choose the customer contact number.', [
        {
          text: `📞 CP #1 (${phones[0]})`,
          onPress: () => dialCustomerNumber(phones[0]),
        },
        {
          text: `📞 CP #2 (${phones[1]})`,
          onPress: () => dialCustomerNumber(phones[1]),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    dialCustomerNumber(phones[0]);
  };

  const totalHeads = defrostRoster.reduce((sum, item) => sum + (item.quantity || 1), 0);

  if (isLoading && confirmations.length === 0 && defrostRoster.length === 0) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#C81E1E" />
        <Text style={styles.loadingHint}>Loading floor action tasks...</Text>
      </View>
    );
  }

  if (isError && confirmations.length === 0 && defrostRoster.length === 0) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorTitle}>⚠️ Could not load floor tasks</Text>
        <Text style={styles.errorSub}>Please check your connection and retry.</Text>
        <Pressable style={styles.retryButton} onPress={handlePullRefresh}>
          <Text style={styles.retryButtonText}>Retry Sync</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullRefresh}
          tintColor="#C81E1E"
          colors={['#C81E1E']}
        />
      }
    >
      <View style={styles.notificationBar}>
        <Text style={styles.notificationStatus}>
          {alertsActive
            ? '🔔 Alerts Active'
            : usesInAppFallback
              ? '🔔 In-App Alert Preview'
              : '🔕 Alerts Permission Needed'}
        </Text>
        <Pressable style={styles.testAlertButton} onPress={handleTestNotification}>
          <Text style={styles.testAlertButtonText}>🔔 Test Alert</Text>
        </Pressable>
      </View>

      {ownerConfirmations.length > 0 && (
        <View style={styles.ownerSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.ownerSectionTitle}>
              👑 Needs Owner Confirmation
            </Text>
            <View style={styles.ownerCountBadge}>
              <Text style={styles.ownerCountText}>{ownerConfirmations.length}</Text>
            </View>
          </View>
          {ownerConfirmations.map((item) => (
            <View key={item.orderId} style={styles.ownerCard}>
              <Text style={styles.ownerOrderReference}>{item.orderReference}</Text>
              <Text style={styles.ownerCustomer}>{item.customerName}</Text>
              <WalkInBadge {...item} />
              <Text style={styles.ownerMeta} numberOfLines={2}>
                {item.itemsSummary} • encoded by {item.createdBy}
              </Text>
              {sanitizeFreebiesSummary(item.freebiesSummary) ? (
                <Text style={styles.ownerFreebies}>{sanitizeFreebiesSummary(item.freebiesSummary)}</Text>
              ) : null}
              <View style={styles.ownerCardFooter}>
                <Text style={styles.ownerAmount}>
                  ₱{item.grandTotal.toLocaleString()} • DP ₱
                  {item.downpayment.toLocaleString()} {item.downpaymentMethod}
                </Text>
                {isOwner && (
                  <Pressable
                    style={styles.confirmOwnerButton}
                    disabled={confirmOwnerMutation.isPending}
                    onPress={() =>
                      handleConfirmOwnerOrder(item.orderId, item.orderReference)
                    }
                  >
                    <Text style={styles.confirmOwnerButtonText}>✅ Confirm Order</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ========================================================= */}
      {/* SECTION A: ACTION REQUIRED - DOWNPAYMENT RADAR            */}
      {/* ========================================================= */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              Action Required: Pending Downpayments
            </Text>
            <View
              style={[
                styles.countBadge,
                confirmations.length > 0
                  ? styles.countBadgeUrgent
                  : styles.countBadgeMuted,
              ]}
            >
              <Text
                style={[
                  styles.countBadgeText,
                  confirmations.length > 0
                    ? styles.countBadgeTextUrgent
                    : styles.countBadgeTextMuted,
                ]}
              >
                {confirmations.length}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Follow up via Messenger to secure kitchen slots and commit freezer stock.
          </Text>
        </View>

        {confirmations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardEmoji}>🎉</Text>
            <Text style={styles.emptyCardText}>
              All upcoming reservations within 4 days have verified deposits or VIP status.
            </Text>
          </View>
        ) : (
          confirmations.map((item) => {
            const daysUntil = computeDaysUntil(item.targetDeliveryTime);
            const isUrgent = daysUntil <= 1;

            return (
              <View key={item.orderId || item.id} style={styles.confirmationCard}>
                {/* Header Row: Countdown Tag + Total Due */}
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.dueTag,
                      isUrgent ? styles.dueTagUrgent : styles.dueTagAmber,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dueTagText,
                        isUrgent ? styles.dueTagTextUrgent : styles.dueTagTextAmber,
                      ]}
                    >
                      {isUrgent
                        ? '🚨 Due Tomorrow / Today'
                        : `⚠️ Due in ${daysUntil} days`}
                    </Text>
                  </View>

                  <Text style={styles.balanceDueText}>
                    ₱{(item.balanceDue ?? item.grandTotal ?? 0).toLocaleString()} Total
                  </Text>
                </View>

                {/* Customer Info */}
                <View style={styles.customerRow}>
                  <Text style={styles.customerNameText}>{item.customerName}</Text>
                  <WalkInBadge {...item} />
                  {Boolean(item.facebookName) && (
                    <Text style={styles.facebookNameText}>
                      💬 {item.facebookName}
                    </Text>
                  )}
                </View>

                {/* Schedule & Items Summary */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>📅 Target Time:</Text>
                  <Text style={styles.metaValue}>
                    {formatSchedule(item.targetDeliveryTime)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>🐷 Reserved:</Text>
                  <Text style={styles.metaValue} numberOfLines={2}>
                    {item.itemsSummary || 'Lechon Reservation'}
                  </Text>
                </View>

                {/* 3 Action Buttons in Footer */}
                <View style={styles.radarActionFooter}>
                  <Pressable
                    style={styles.actionBtnOutline}
                    onPress={() => handleCopyReminder(item)}
                  >
                    <Text style={styles.actionBtnOutlineText}>💬 Copy</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionBtnOutline}
                    onPress={() => handleCallCustomer(item.contactNumber || item.phoneNumber || '')}
                  >
                    <Text style={styles.actionBtnOutlineText}>📞 Call</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionBtnPrimary}
                    onPress={() => onSelectOrderForDeposit(item.orderId || item.id)}
                  >
                    <Text style={styles.actionBtnPrimaryText}>💵 Record Deposit</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ========================================================= */}
      {/* SECTION B: TONIGHT'S DEFROST & KITCHEN PREP ROSTER        */}
      {/* ========================================================= */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              Tonight&apos;s Defrost &amp; Prep Roster
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.countBadge, styles.countBadgeRoster]}>
                <Text style={styles.countBadgeTextRoster}>
                  {totalHeads} Heads
                </Text>
              </View>
              <Pressable
                style={[
                  styles.copyDefrostBtn,
                  (!defrostRoster || defrostRoster.length === 0) &&
                    styles.copyDefrostBtnDisabled,
                ]}
                disabled={!defrostRoster || defrostRoster.length === 0}
                onPress={handleCopyDefrostList}
              >
                <Text style={styles.copyDefrostBtnText}>
                  📋 Copy Defrost List
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Chest freezer carcasses scheduled for tomorrow&apos;s roasting batches.
          </Text>
        </View>

        {defrostRoster.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardEmoji}>🧊</Text>
            <Text style={styles.emptyCardText}>
              No carcasses scheduled for tomorrow&apos;s defrost roster yet.
            </Text>
          </View>
        ) : (
          defrostRoster.map((item) => {
            const isStorePickup = item.fulfillment === 0;

            return (
              <Pressable
                key={`${item.orderId}-${item.id}`}
                style={({ pressed }) => [
                  styles.rosterCard,
                  pressed && styles.rosterCardPressed,
                ]}
                onPress={() => onSelectOrderForDeposit(item.orderId || item.id)}
              >
                {/* Top Row: Weight Category Badge + Rush Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {item.quantity}x {item.weightCategory || item.categoryName || 'Lechon'}
                    </Text>
                  </View>

                  {item.isRushDefrost && (
                    <View style={styles.rushDefrostBadge}>
                      <Text style={styles.rushDefrostBadgeText}>
                        🚨 RUSH / LATE DEFROST
                      </Text>
                    </View>
                  )}
                </View>

                {/* Middle Row: Customer + VIP + Destination */}
                <View style={styles.rosterMiddleRow}>
                  <View style={styles.rosterCustomerLine}>
                    <Text style={styles.rosterCustomerName}>{item.customerName}</Text>
                    <WalkInBadge {...item} />
                    {item.isTrustedCustomer && (
                      <View style={styles.vipBadge}>
                        <Text style={styles.vipBadgeText}>👑 VIP</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.rosterDestinationText} numberOfLines={1}>
                    {isStorePickup
                      ? '🏪 Store Pickup'
                      : `📍 ${item.deliveryAddress || 'Address on record'}`}
                  </Text>

                  <Text style={styles.rosterDeliveryTime}>
                    Target Handover: {formatTimeOnly(item.targetDeliveryTime)}
                  </Text>
                </View>

                {/* Bottom Highlight Bar: Bold Tabular Monospace Prep Deadline */}
                <View style={styles.prepDeadlineBar}>
                  <Text style={styles.prepDeadlineText}>
                    🔪 Prep / Tahi Deadline: {formatTimeOnly(item.tahiStartTime)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 40,
  },
  notificationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  notificationStatus: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
  testAlertButton: {
    backgroundColor: '#047857',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  testAlertButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ownerSection: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  ownerSectionTitle: {
    color: '#9A3412',
    fontSize: 15,
    fontWeight: '900',
  },
  ownerCountBadge: {
    backgroundColor: '#EA580C',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownerCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  ownerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 11,
    marginTop: 9,
  },
  ownerOrderReference: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '900',
  },
  ownerCustomer: {
    color: '#1C1917',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  ownerMeta: {
    color: '#57534E',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  ownerFreebies: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  ownerCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 9,
  },
  ownerAmount: {
    flex: 1,
    color: '#44403C',
    fontSize: 11,
    fontWeight: '700',
  },
  confirmOwnerButton: {
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  confirmOwnerButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAF6F4',
  },
  loadingHint: {
    marginTop: 10,
    fontSize: 14,
    color: '#78716C',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 4,
  },
  errorSub: {
    fontSize: 13,
    color: '#78716C',
    textAlign: 'center',
    marginBottom: 14,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#C81E1E',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeUrgent: {
    backgroundColor: '#FEE2E2',
  },
  countBadgeMuted: {
    backgroundColor: '#E7E5E4',
  },
  countBadgeRoster: {
    backgroundColor: '#FEF3C7',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countBadgeTextUrgent: {
    color: '#B91C1C',
  },
  countBadgeTextMuted: {
    color: '#57534E',
  },
  countBadgeTextRoster: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  copyDefrostBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  copyDefrostBtnDisabled: {
    opacity: 0.45,
  },
  copyDefrostBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  emptyCardText: {
    fontSize: 13,
    color: '#78716C',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  confirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dueTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dueTagUrgent: {
    backgroundColor: '#FEE2E2',
  },
  dueTagAmber: {
    backgroundColor: '#FEF3C7',
  },
  dueTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueTagTextUrgent: {
    color: '#B91C1C',
  },
  dueTagTextAmber: {
    color: '#B45309',
  },
  balanceDueText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B91C1C',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
  },
  facebookNameText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716C',
    width: 82,
  },
  metaValue: {
    flex: 1,
    fontSize: 12,
    color: '#292524',
    fontWeight: '500',
  },
  radarActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
  },
  actionBtnOutline: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    backgroundColor: '#FAFAF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#44403C',
  },
  actionBtnPrimary: {
    flex: 1.5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#C81E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rosterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  rosterCardPressed: {
    backgroundColor: '#F5F5F4',
    opacity: 0.95,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1917',
  },
  rushDefrostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  rushDefrostBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  rosterMiddleRow: {
    marginTop: 6,
    marginBottom: 10,
  },
  rosterCustomerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  rosterCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
  },
  vipBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  rosterDestinationText: {
    fontSize: 12,
    color: '#57534E',
    marginTop: 2,
  },
  rosterDeliveryTime: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
    fontWeight: '500',
  },
  prepDeadlineBar: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  prepDeadlineText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#991B1B',
  },
});
