import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useOrdersDirectory, OrderDirectoryDto } from '../hooks/useOrders';
import OrderDossierModal from '../components/orders/OrderDossierModal';
import {
  useDefrostRosterQuery,
  usePendingConfirmationsQuery,
  usePendingOwnerConfirmationsQuery,
} from '../hooks/useFloorAction';
import FloorActionView from '../components/orders/FloorActionView';

type SmartPillKey =
  | 'upcoming'
  | 'today'
  | 'tomorrow'
  | 'balance-due'
  | 'drafts'
  | 'recent'
  | 'past-30'
  | 'cancelled'
  | 'all';

interface FilterPillConfig {
  key: SmartPillKey;
  label: string;
  serverTab: string;
}

const FILTER_PILLS: FilterPillConfig[] = [
  { key: 'upcoming', label: '📅 Upcoming', serverTab: 'upcoming' },
  { key: 'today', label: '🔥 Today Only', serverTab: 'upcoming' },
  { key: 'tomorrow', label: '☀️ Tomorrow', serverTab: 'upcoming' },
  { key: 'balance-due', label: '💵 Balance Due', serverTab: 'balance-due' },
  { key: 'drafts', label: '📝 Drafts', serverTab: 'drafts' },
  { key: 'recent', label: '✏️ Recent Edits', serverTab: 'recent' },
  { key: 'past-30', label: '⏳ Past 30d', serverTab: 'past-30' },
  { key: 'cancelled', label: '🚫 Cancelled', serverTab: 'cancelled' },
  { key: 'all', label: '📚 All Time', serverTab: 'all' },
];

const isSameLocalDay = (dateA: Date, dateB: Date): boolean => {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

interface OrdersScreenProps {
  alertsActive: boolean;
  usesInAppFallback: boolean;
  sendTestNotification: () => Promise<void>;
}

export default function OrdersScreen({
  alertsActive,
  usesInAppFallback,
  sendTestNotification,
}: OrdersScreenProps) {
  const [activeView, setActiveView] = useState<'directory' | 'floor-action'>('directory');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activePill, setActivePill] = useState<SmartPillKey>('upcoming');
  const [balanceSubFilter, setBalanceSubFilter] = useState<'all' | 'rider' | 'drawer' | 'future'>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderDirectoryDto | null>(null);

  const { data: defrostRoster } = useDefrostRosterQuery();
  const { data: pendingConfirmations } = usePendingConfirmationsQuery();
  const { data: pendingOwnerConfirmations } = usePendingOwnerConfirmationsQuery();

  const floorActionCount =
    (pendingConfirmations?.length ?? 0) +
    (pendingOwnerConfirmations?.length ?? 0) +
    (defrostRoster?.length ?? 0);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  // Reset balanceSubFilter when activePill is not balance-due
  useEffect(() => {
    if (activePill !== 'balance-due') {
      setBalanceSubFilter('all');
    }
  }, [activePill]);

  const currentServerTab = useMemo(() => {
    const found = FILTER_PILLS.find((p) => p.key === activePill);
    return found ? found.serverTab : 'upcoming';
  }, [activePill]);

  const {
    data: rawOrders,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useOrdersDirectory(debouncedSearch, currentServerTab);

  // Dynamic custody counts for balance-due sub-pills
  const custodyCounts = useMemo(() => {
    if (!rawOrders) return { all: 0, rider: 0, drawer: 0, future: 0 };
    const unpaid = rawOrders.filter(
      (o) => Number(o.balanceDue || 0) > 0 && !o.isCancelled
    );
    const todayMidnight = new Date().setHours(0, 0, 0, 0);

    let rider = 0;
    let drawer = 0;
    let future = 0;

    unpaid.forEach((o) => {
      const isDrawer =
        o.settlementCustodyStatus === 'InStaffDrawer' && !o.isRemittedToOwner;
      const isRider =
        Number(o.fulfillment) === 1 &&
        (o.routingStatus === 'Assigned' || o.routingStatus === 'OutForDelivery') &&
        o.settlementCustodyStatus !== 'InStaffDrawer' &&
        !o.isRemittedToOwner;
      const targetMidnight = o.targetDeliveryTime
        ? new Date(o.targetDeliveryTime).setHours(0, 0, 0, 0)
        : 0;
      const isFuture =
        targetMidnight > todayMidnight &&
        (o.settlementCustodyStatus === 'Uncollected' || !o.settlementCustodyStatus);

      if (isDrawer) drawer++;
      if (isRider) rider++;
      if (isFuture) future++;
    });

    return { all: unpaid.length, rider, drawer, future };
  }, [rawOrders]);

  // Apply client-side Today Only / Tomorrow and Balance Due Sub-filtering
  const filteredOrders = useMemo(() => {
    if (!rawOrders) return [];
    if (activePill === 'today') {
      const today = new Date();
      return rawOrders.filter((order) => {
        if (!order.targetDeliveryTime) return false;
        const target = new Date(order.targetDeliveryTime);
        return !isNaN(target.getTime()) && isSameLocalDay(target, today);
      });
    }
    if (activePill === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return rawOrders.filter((order) => {
        if (!order.targetDeliveryTime) return false;
        const target = new Date(order.targetDeliveryTime);
        return !isNaN(target.getTime()) && isSameLocalDay(target, tomorrow);
      });
    }
    if (activePill === 'balance-due') {
      const unpaid = rawOrders.filter(
        (o) => Number(o.balanceDue || 0) > 0 && !o.isCancelled
      );
      if (balanceSubFilter === 'all') return unpaid;

      const todayMidnight = new Date().setHours(0, 0, 0, 0);

      return unpaid.filter((o) => {
        if (balanceSubFilter === 'rider') {
          return (
            Number(o.fulfillment) === 1 &&
            (o.routingStatus === 'Assigned' || o.routingStatus === 'OutForDelivery') &&
            o.settlementCustodyStatus !== 'InStaffDrawer' &&
            !o.isRemittedToOwner
          );
        }
        if (balanceSubFilter === 'drawer') {
          return (
            o.settlementCustodyStatus === 'InStaffDrawer' && !o.isRemittedToOwner
          );
        }
        if (balanceSubFilter === 'future') {
          const targetMidnight = o.targetDeliveryTime
            ? new Date(o.targetDeliveryTime).setHours(0, 0, 0, 0)
            : 0;
          return (
            targetMidnight > todayMidnight &&
            (o.settlementCustodyStatus === 'Uncollected' ||
              !o.settlementCustodyStatus)
          );
        }
        return true;
      });
    }
    return rawOrders;
  }, [rawOrders, activePill, balanceSubFilter]);

  const formatCardSchedule = (dateStr?: string | null) => {
    if (!dateStr) {
      return { formatted: '📅 Date Pending', isToday: false, isTomorrow: false, isPending: true };
    }
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) {
      return { formatted: '📅 Date Pending', isToday: false, isTomorrow: false, isPending: true };
    }
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const datePart = target.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const timePart = target.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      formatted: `${datePart} • ${timePart}`,
      isToday: isSameLocalDay(target, now),
      isTomorrow: isSameLocalDay(target, tomorrow),
      isPending: false,
    };
  };

  const renderFulfillmentLocation = (order: OrderDirectoryDto) => {
    const fulfillment = Number(order.fulfillment);
    const rawAddress = (order.deliveryAddress || '').trim();
    const truncated =
      rawAddress.length > 28 ? `${rawAddress.substring(0, 28)}...` : rawAddress;

    if (fulfillment === 0) {
      return '🏪 Store Pickup';
    }
    if (!rawAddress) {
      return '📍 Venue TBD / Unset';
    }
    if (fulfillment === 2) {
      return `📦 Lalamove • ${truncated}`;
    }
    return `🚗 ${truncated}`;
  };

  const renderRoutingBadge = (order: OrderDirectoryDto) => {
    if (order.isDraft) {
      return (
        <View style={[styles.routingBadge, styles.routingDraft]}>
          <Text style={styles.routingDraftText}>📝 Incomplete Draft</Text>
        </View>
      );
    }
    if (order.isCancelled) {
      return (
        <View style={[styles.routingBadge, styles.routingCancelled]}>
          <Text style={styles.routingCancelledText}>🛑 Cancelled</Text>
        </View>
      );
    }
    const status = (order.routingStatus || '').trim();
    if (status === 'Delivered') {
      return (
        <View style={[styles.routingBadge, styles.routingDelivered]}>
          <Text style={styles.routingDeliveredText}>🟢 Delivered</Text>
        </View>
      );
    }
    if (status === 'Assigned') {
      return (
        <View style={[styles.routingBadge, styles.routingAssigned]}>
          <Text style={styles.routingAssignedText}>🛵 Assigned</Text>
        </View>
      );
    }
    return (
      <View style={[styles.routingBadge, styles.routingUnassigned]}>
        <Text style={styles.routingUnassignedText}>⚪ Unassigned</Text>
      </View>
    );
  };

  const renderCustodyPill = (order: OrderDirectoryDto) => {
    if (order.isDraft) {
      return null;
    }
    if (order.settlementCustodyStatus === 'InStaffDrawer') {
      return (
        <View style={[styles.custodyPill, styles.custodyPillDrawer]}>
          <Text style={styles.custodyPillDrawerText}>🟡 In Drawer</Text>
        </View>
      );
    }
    if (
      Number(order.fulfillment) === 1 &&
      (order.routingStatus === 'Assigned' || order.routingStatus === 'OutForDelivery')
    ) {
      return (
        <View style={[styles.custodyPill, styles.custodyPillRider]}>
          <Text style={styles.custodyPillRiderText}>🛵 Road Cash</Text>
        </View>
      );
    }
    const targetMidnight = order.targetDeliveryTime
      ? new Date(order.targetDeliveryTime).setHours(0, 0, 0, 0)
      : 0;
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    if (targetMidnight > todayMidnight) {
      return (
        <View style={[styles.custodyPill, styles.custodyPillFuture]}>
          <Text style={styles.custodyPillFutureText}>📅 Advance</Text>
        </View>
      );
    }
    if (Number(order.fulfillment) === 0) {
      return (
        <View style={[styles.custodyPill, styles.custodyPillPickup]}>
          <Text style={styles.custodyPillPickupText}>🏪 Store Pickup</Text>
        </View>
      );
    }
    return null;
  };

  const renderOrderCard = ({ item }: { item: OrderDirectoryDto }) => {
    const schedule = formatCardSchedule(item.targetDeliveryTime);
    const balanceDue = Number(item.balanceDue || 0);
    const isPaid = balanceDue <= 0;
    const isDraft = Boolean(item.isDraft);
    const phones = (item.contactNumber || '')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);

    return (
      <Pressable
        style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
        onPress={() => {
          setSelectedOrder(item);
          setSelectedOrderId(item.id);
        }}
      >
        {/* Top Row: #ID + Edited Pill + Customer Name + VIP Badge | Grand Total */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.monoOrderId}>#{item.orderReference || item.id}</Text>
            {item.hasRecentEdits && (
              <View style={styles.editedPill}>
                <Text style={styles.editedPillText}>✏️ Edited</Text>
              </View>
            )}
            {!isDraft && !item.isOwnerConfirmed && (
              <View style={styles.ownerReviewPill}>
                <Text style={styles.ownerReviewPillText}>⏳ Owner Review</Text>
              </View>
            )}
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customerName}
            </Text>
            {item.isTrustedCustomer && (
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>👑 VIP</Text>
              </View>
            )}
          </View>

          <Text style={styles.grandTotalText}>
            {isDraft
              ? `Est. ₱${Number(item.grandTotal || 0).toLocaleString()}`
              : `₱${Number(item.grandTotal || 0).toLocaleString()}`}
          </Text>
        </View>

        {phones.length > 0 && (
          <View style={styles.contactNumbersStack}>
            {phones.map((phone, index) => (
              <Text key={`${phone}-${index}`} style={styles.contactNumberLine}>
                📞 {phone}
              </Text>
            ))}
          </View>
        )}

        {/* Middle Row: Date & Time + Relative Day Badge | Payment Status */}
        <View style={styles.cardMiddleRow}>
          <View>
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleText}>{schedule.formatted}</Text>
              {schedule.isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Today</Text>
                </View>
              )}
              {schedule.isTomorrow && (
                <View style={styles.tomorrowBadge}>
                  <Text style={styles.tomorrowBadgeText}>Tomorrow</Text>
                </View>
              )}
            </View>
            {schedule.isPending && item.remarks ? (
              <Text style={styles.schedulePendingRemarks} numberOfLines={1}>
                {item.remarks}
              </Text>
            ) : null}
          </View>

          <View>
            {isDraft ? (
              <Text style={styles.draftDpText}>
                ₱{Number(item.downpayment || 0).toLocaleString()} DP
              </Text>
            ) : isPaid ? (
              <Text style={styles.paidFullText}>🟢 Paid in Full</Text>
            ) : (
              <View style={styles.balanceWithPillRow}>
                <Text style={styles.balanceDueText}>
                  🔴 ₱{balanceDue.toLocaleString()} Due
                </Text>
                {renderCustodyPill(item)}
              </View>
            )}
          </View>
        </View>

        {/* Bottom Row: Fulfillment & Location | Semantic Routing Status Badge */}
        <View style={styles.cardBottomRow}>
          <Text style={styles.locationText} numberOfLines={1}>
            {renderFulfillmentLocation(item)}
          </Text>
          {renderRoutingBadge(item)}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Segmented Switcher */}
      <View style={styles.topSegmentedBar}>
        <Pressable
          style={[
            styles.segmentButton,
            activeView === 'directory' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveView('directory')}
        >
          <Text
            style={[
              styles.segmentButtonText,
              activeView === 'directory' && styles.segmentButtonTextActive,
            ]}
          >
            📋 Orders Directory
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentButton,
            activeView === 'floor-action' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveView('floor-action')}
        >
          <Text
            style={[
              styles.segmentButtonText,
              activeView === 'floor-action' && styles.segmentButtonTextActive,
            ]}
          >
            ⚡ Floor Action {floorActionCount > 0 ? `(${floorActionCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {activeView === 'floor-action' ? (
        <FloorActionView
          alertsActive={alertsActive}
          usesInAppFallback={usesInAppFallback}
          sendTestNotification={sendTestNotification}
          onSelectOrderForDeposit={(orderId) => {
            const match = rawOrders?.find((o) => o.id === orderId) ?? null;
            setSelectedOrder(match);
            setSelectedOrderId(orderId);
          }}
          onRefresh={async () => {
            await refetch();
          }}
          isRefreshing={isRefetching}
        />
      ) : (
        <>
          {/* Top Debounced Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search customer, 0917..., or #ID..."
                placeholderTextColor="#78716C"
                value={rawSearch}
                onChangeText={setRawSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {rawSearch.length > 0 && (
                <Pressable
                  style={styles.clearBtn}
                  onPress={() => setRawSearch('')}
                  hitSlop={8}
                >
                  <Text style={styles.clearBtnText}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Horizontal Scrollable Filter Pills */}
          <View style={styles.pillsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsContent}
            >
              {FILTER_PILLS.map((pill) => {
                const isActive = activePill === pill.key;
                return (
                  <Pressable
                    key={pill.key}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => setActivePill(pill.key)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && styles.filterPillTextActive,
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Secondary Horizontal Scrollable Sub-Pills for Balance Due */}
          {activePill === 'balance-due' && (
            <View style={styles.subPillsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subPillsContent}
              >
                <Pressable
                  style={[
                    styles.subFilterPill,
                    balanceSubFilter === 'all' && styles.subFilterPillActive,
                  ]}
                  onPress={() => setBalanceSubFilter('all')}
                >
                  <Text
                    style={[
                      styles.subFilterPillText,
                      balanceSubFilter === 'all' && styles.subFilterPillTextActive,
                    ]}
                  >
                    📋 All Unpaid ({custodyCounts.all})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.subFilterPill,
                    balanceSubFilter === 'rider' && styles.subFilterPillActive,
                  ]}
                  onPress={() => setBalanceSubFilter('rider')}
                >
                  <Text
                    style={[
                      styles.subFilterPillText,
                      balanceSubFilter === 'rider' && styles.subFilterPillTextActive,
                    ]}
                  >
                    🛵 Road Cash ({custodyCounts.rider})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.subFilterPill,
                    balanceSubFilter === 'drawer' && styles.subFilterPillActive,
                  ]}
                  onPress={() => setBalanceSubFilter('drawer')}
                >
                  <Text
                    style={[
                      styles.subFilterPillText,
                      balanceSubFilter === 'drawer' && styles.subFilterPillTextActive,
                    ]}
                  >
                    🟡 In Drawer ({custodyCounts.drawer})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.subFilterPill,
                    balanceSubFilter === 'future' && styles.subFilterPillActive,
                  ]}
                  onPress={() => setBalanceSubFilter('future')}
                >
                  <Text
                    style={[
                      styles.subFilterPillText,
                      balanceSubFilter === 'future' && styles.subFilterPillTextActive,
                    ]}
                  >
                    📅 Advance ({custodyCounts.future})
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          )}

          {/* Result Counter Bar */}
          <View style={styles.counterBar}>
            <Text style={styles.counterText}>
              Showing <Text style={styles.counterStrong}>{filteredOrders.length}</Text>{' '}
              {filteredOrders.length === 1 ? 'order' : 'orders'}
            </Text>
            <Pressable onPress={() => refetch()}>
              <Text style={styles.refreshActionText}>
                {isRefetching ? 'Syncing...' : '↻ Refresh'}
              </Text>
            </Pressable>
          </View>

          {/* Directory List */}
          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#C81E1E" />
              <Text style={styles.loadingHint}>Loading order directory...</Text>
            </View>
          ) : isError ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorTitle}>⚠️ Could not fetch orders</Text>
              <Text style={styles.errorSub}>
                Verify your internet connection or API target environment.
              </Text>
              <Pressable style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryButtonText}>Retry Now</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderOrderCard}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={() => {
                    void refetch();
                  }}
                  tintColor="#C81E1E"
                  colors={['#C81E1E']}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>📭</Text>
                  <Text style={styles.emptyTitle}>No matching orders found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try adjusting your search keywords or selecting a different filter pill above.
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Slide-Up Customer Dossier Modal */}
      <OrderDossierModal
        orderId={selectedOrderId ?? selectedOrder?.id ?? null}
        fallbackOrder={selectedOrder}
        onClose={() => {
          setSelectedOrder(null);
          setSelectedOrderId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  topSegmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#E7E5E4',
    padding: 4,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 10,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
  },
  segmentButtonTextActive: {
    color: '#1C1917',
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1C1917',
    paddingVertical: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E7E5E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#44403C',
  },
  pillsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
    paddingBottom: 10,
  },
  pillsContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  subPillsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
    paddingBottom: 8,
    paddingTop: 2,
  },
  subPillsContent: {
    paddingHorizontal: 14,
    gap: 6,
  },
  subFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  subFilterPillActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  subFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#44403C',
  },
  subFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  filterPillActive: {
    backgroundColor: '#181312',
    borderColor: '#181312',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#44403C',
  },
  filterPillTextActive: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  counterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F4',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
  },
  counterText: {
    fontSize: 12,
    color: '#57534E',
    fontWeight: '500',
  },
  counterStrong: {
    color: '#1C1917',
    fontWeight: '800',
  },
  refreshActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C81E1E',
  },
  listContent: {
    padding: 12,
    paddingBottom: 28,
    gap: 10,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 8,
  },
  orderCardPressed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  monoOrderId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editedPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  editedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  ownerReviewPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  ownerReviewPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
    flexShrink: 1,
  },
  contactNumbersStack: {
    gap: 1,
    marginTop: -3,
  },
  contactNumberLine: {
    color: '#57534E',
    fontSize: 11,
    fontWeight: '600',
  },
  vipBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  grandTotalText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#44403C',
  },
  todayBadge: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  tomorrowBadge: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tomorrowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
  },
  paidFullText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  balanceDueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  balanceWithPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  custodyPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  custodyPillDrawer: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  custodyPillDrawerText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  custodyPillRider: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  custodyPillRiderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  custodyPillFuture: {
    backgroundColor: '#F5F5F4',
    borderColor: '#E7E5E4',
  },
  custodyPillFutureText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  custodyPillPickup: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  custodyPillPickupText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
  },
  locationText: {
    fontSize: 12,
    color: '#57534E',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  routingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  routingUnassigned: {
    backgroundColor: '#F5F5F4',
    borderColor: '#D6D3D1',
  },
  routingUnassignedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#44403C',
  },
  routingAssigned: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  routingAssignedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  routingDelivered: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  routingDeliveredText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  routingCancelled: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  routingCancelledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#BE123C',
  },
  routingDraft: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  routingDraftText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
  },
  draftDpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  schedulePendingRemarks: {
    fontSize: 10,
    color: '#8B5CF6',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingHint: {
    marginTop: 10,
    fontSize: 13,
    color: '#57534E',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#BE123C',
    marginBottom: 4,
  },
  errorSub: {
    fontSize: 12,
    color: '#57534E',
    textAlign: 'center',
    marginBottom: 14,
  },
  retryButton: {
    backgroundColor: '#C81E1E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 38,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#292524',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 18,
  },
});
