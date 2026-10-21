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

type SmartPillKey =
  | 'upcoming'
  | 'today'
  | 'tomorrow'
  | 'balance-due'
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

export default function OrdersScreen() {
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activePill, setActivePill] = useState<SmartPillKey>('upcoming');
  const [selectedOrder, setSelectedOrder] = useState<OrderDirectoryDto | null>(null);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(rawSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

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

  // Apply client-side Today Only / Tomorrow filtering when those pills are active
  const filteredOrders = useMemo(() => {
    if (!rawOrders) return [];
    if (activePill === 'today') {
      const today = new Date();
      return rawOrders.filter((order) => {
        const target = new Date(order.targetDeliveryTime);
        return !isNaN(target.getTime()) && isSameLocalDay(target, today);
      });
    }
    if (activePill === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return rawOrders.filter((order) => {
        const target = new Date(order.targetDeliveryTime);
        return !isNaN(target.getTime()) && isSameLocalDay(target, tomorrow);
      });
    }
    return rawOrders;
  }, [rawOrders, activePill]);

  const formatCardSchedule = (dateStr: string) => {
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) {
      return { formatted: 'Invalid Date', isToday: false, isTomorrow: false };
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
    if (fulfillment === 2) {
      return `📦 Lalamove • ${truncated || 'No address'}`;
    }
    return `🚗 ${truncated || 'No address provided'}`;
  };

  const renderRoutingBadge = (order: OrderDirectoryDto) => {
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

  const renderOrderCard = ({ item }: { item: OrderDirectoryDto }) => {
    const schedule = formatCardSchedule(item.targetDeliveryTime);
    const balanceDue = Number(item.balanceDue || 0);
    const isPaid = balanceDue <= 0;

    return (
      <Pressable
        style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
        onPress={() => setSelectedOrder(item)}
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
            ₱{Number(item.grandTotal || 0).toLocaleString()}
          </Text>
        </View>

        {/* Middle Row: Date & Time + Relative Day Badge | Payment Status */}
        <View style={styles.cardMiddleRow}>
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

          <View>
            {isPaid ? (
              <Text style={styles.paidFullText}>🟢 Paid in Full</Text>
            ) : (
              <Text style={styles.balanceDueText}>
                🔴 ₱{balanceDue.toLocaleString()} Due
              </Text>
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

      {/* Slide-Up Customer Dossier Modal */}
      <OrderDossierModal
        orderId={selectedOrder?.id ?? null}
        fallbackOrder={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F4',
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
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
    flexShrink: 1,
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
