import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import OrdersScreen from '../screens/OrdersScreen';
import PosScreen from '../screens/PosScreen';
import DrawerScreen from '../screens/DrawerScreen';
import {
  useDefrostRosterQuery,
  usePendingOwnerConfirmationsQuery,
} from '../hooks/useFloorAction';
import { useNotifications } from '../hooks/useNotifications';

type ActiveTab = 'orders' | 'pos' | 'drawer';

export default function MainShell() {
  const { user, isOwner, isAuthenticated, apiEnv, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('orders');
  const { data: ownerConfirmations = [] } = usePendingOwnerConfirmationsQuery();
  const { data: defrostRoster = [] } = useDefrostRosterQuery();
  const { alertsActive, sendTestNotification } = useNotifications({
    isAuthenticated,
    isOwner,
    pendingOwnerConfirmations: ownerConfirmations.length,
    rushDefrostIds: defrostRoster
      .filter((item) => item.isRushDefrost)
      .map((item) => `${item.orderId}:${item.itemCategoryId}`),
  });

  const renderTabContent = () => {
    if (activeTab === 'orders') {
      return (
        <OrdersScreen
          alertsActive={alertsActive}
          sendTestNotification={sendTestNotification}
        />
      );
    }

    if (activeTab === 'pos') {
      return <PosScreen onNavigateToOrders={() => setActiveTab('orders')} />;
    }

    return <DrawerScreen />;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Compact HUD Bar */}
      <View style={styles.hudBar}>
        <View style={styles.hudLeft}>
          <Text style={styles.hudLogo}>🐷</Text>
          <View>
            <Text style={styles.hudBrandTitle}>YUMI&apos;S LECHON</Text>
            <Text style={styles.hudBrandSub}>Mobile Operations</Text>
          </View>
        </View>

        <View style={styles.hudRight}>
          <View style={styles.userBadge}>
            <Text style={styles.userFullName} numberOfLines={1}>
              {user?.fullName || user?.username || 'Staff'}
            </Text>

            <View
              style={[
                styles.rolePill,
                isOwner ? styles.rolePillOwner : styles.rolePillCashier,
              ]}
            >
              <Text
                style={[
                  styles.rolePillText,
                  isOwner ? styles.roleTextOwner : styles.roleTextCashier,
                ]}
              >
                {isOwner ? '👑 Owner' : '🧑‍💼 Cashier'}
              </Text>
            </View>

            <View style={styles.apiIndicatorPill}>
              <Text style={styles.apiIndicatorText}>
                {apiEnv === 'cloud' ? '☁️' : '💻'}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
            onPress={logout}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content Viewport */}
      <View style={styles.contentViewport}>{renderTabContent()}</View>

      {/* Bottom Navigation Bar (3 Core Tabs) */}
      <View style={styles.bottomNav}>
        <Pressable
          style={[
            styles.navTab,
            activeTab === 'orders' && styles.navTabActive,
          ]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={styles.navTabIcon}>📋</Text>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'orders' && styles.navTabLabelActive,
            ]}
          >
            Orders
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.navTab,
            activeTab === 'pos' && styles.navTabActive,
          ]}
          onPress={() => setActiveTab('pos')}
        >
          <Text style={styles.navTabIcon}>➕</Text>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'pos' && styles.navTabLabelActive,
            ]}
          >
            New POS
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.navTab,
            activeTab === 'drawer' && styles.navTabActive,
          ]}
          onPress={() => setActiveTab('drawer')}
        >
          <Text style={styles.navTabIcon}>👑</Text>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'drawer' && styles.navTabLabelActive,
            ]}
          >
            Drawer
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#181312',
  },
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181312',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2320',
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudLogo: {
    fontSize: 22,
  },
  hudBrandTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.6,
  },
  hudBrandSub: {
    fontSize: 10,
    color: '#A8A29E',
    fontWeight: '500',
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#241C1A',
    borderWidth: 1,
    borderColor: '#3D302C',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 6,
    maxWidth: 210,
  },
  userFullName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F5F5F4',
    maxWidth: 75,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillOwner: {
    backgroundColor: 'rgba(147, 51, 234, 0.25)',
    borderColor: '#A855F7',
  },
  rolePillCashier: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: '#3B82F6',
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  roleTextOwner: {
    color: '#E9D5FF',
  },
  roleTextCashier: {
    color: '#BFDBFE',
  },
  apiIndicatorPill: {
    backgroundColor: '#15100F',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  apiIndicatorText: {
    fontSize: 11,
  },
  logoutBtn: {
    backgroundColor: '#2E2320',
    borderWidth: 1,
    borderColor: '#44403C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnPressed: {
    backgroundColor: '#C81E1E',
    borderColor: '#C81E1E',
  },
  logoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E7E5E4',
  },
  contentViewport: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#181312',
    borderTopWidth: 1,
    borderTopColor: '#2E2320',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  navTabActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  navTabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
  },
  navTabLabelActive: {
    color: '#FBBF24',
    fontWeight: '800',
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#FAF6F4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 24,
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
  },
  placeholderEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
    marginBottom: 10,
  },
  sprintBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  sprintBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    textAlign: 'center',
  },
  placeholderBody: {
    fontSize: 13,
    color: '#57534E',
    textAlign: 'center',
    lineHeight: 20,
  },
});
