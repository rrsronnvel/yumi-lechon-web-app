import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  usePendingRiderSettlements,
  usePendingPickupSettlements,
  usePendingLalamoveSettlements,
  useQrSessionStatus,
  useCreateQrSessionMutation,
  useStaffValidateQrMutation,
  useRejectRiderSignatureMutation,
  useOwnerApproveQrMutation,
  useRevertCustodyMutation,
  useCounterCollectPickupMutation,
  useDirectGcashSettlementMutation,
  useReleaseLalamoveMutation,
  useSettleManualPaymentMutation,
  PendingSettlementDrop,
  PendingPickupSettlement,
  PendingLalamoveSettlement,
} from '../hooks/useManifest';

type DrawerTabKey = 'hop2' | 'riders' | 'pickups' | 'lalamove';

interface ActiveModalState {
  workflow: 'hop2_owner' | 'hop1_rider' | 'pickup_collect' | 'lalamove_pay';
  orderId: number;
  customerName: string;
  expectedAmount: number;
  riderName?: string;
  riderSignedBy?: string | null;
  heldByStaffName?: string | null;
  heldPaymentMethod?: string | null;
  isTrustedCustomer?: boolean;
}

export default function DrawerScreen() {
  const { user, isOwner } = useAuth();

  const [activeTab, setActiveTab] = useState<DrawerTabKey>(
    isOwner ? 'hop2' : 'riders'
  );

  const {
    data: riderDrops = [],
    isLoading: isLoadingRiders,
    isRefetching: isRefetchingRiders,
    refetch: refetchRiders,
  } = usePendingRiderSettlements();

  const {
    data: pickupDrops = [],
    isLoading: isLoadingPickups,
    isRefetching: isRefetchingPickups,
    refetch: refetchPickups,
  } = usePendingPickupSettlements();

  const {
    data: lalamoveDrops = [],
    isLoading: isLoadingLalamove,
    isRefetching: isRefetchingLalamove,
    refetch: refetchLalamove,
  } = usePendingLalamoveSettlements();

  const createQrMutation = useCreateQrSessionMutation();
  const staffValidateMutation = useStaffValidateQrMutation();
  const rejectRiderMutation = useRejectRiderSignatureMutation();
  const ownerApproveMutation = useOwnerApproveQrMutation();
  const revertCustodyMutation = useRevertCustodyMutation();
  const counterCollectMutation = useCounterCollectPickupMutation();
  const directGcashMutation = useDirectGcashSettlementMutation();
  const releaseLalamoveMutation = useReleaseLalamoveMutation();
  const manualPaymentMutation = useSettleManualPaymentMutation();

  // Modal State
  const [modalState, setModalState] = useState<ActiveModalState | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Workflow A (Hop 2 Owner Envelope Speed Bump) State
  const [countedAmount, setCountedAmount] = useState('');
  const [ownerUsernameInput, setOwnerUsernameInput] = useState('owner');
  const [ownerPinOrPassword, setOwnerPinOrPassword] = useState('');

  // Workflow B (Hop 1 Rider-to-Staff) State
  const [riderPayMethod, setRiderPayMethod] = useState<
    'Cash' | 'ManualGCash' | 'GCash'
  >('Cash');
  const [directGcashRef, setDirectGcashRef] = useState('');
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [overrideRiderName, setOverrideRiderName] = useState('');
  const [overrideAmount, setOverrideAmount] = useState('');

  // Workflow C & D (Pickup Counter & Lalamove Gate) State
  const [counterMethod, setCounterMethod] = useState<'Cash' | 'GCash'>('Cash');
  const [counterRef, setCounterRef] = useState('');

  // Poll QR Session Status when Hop 1 or Hop 2 QR token is active
  const shouldPollQr =
    Boolean(modalState) &&
    Boolean(sessionToken) &&
    (modalState?.workflow === 'hop1_rider' || modalState?.workflow === 'hop2_owner');

  const { data: qrStatus } = useQrSessionStatus(sessionToken, shouldPollQr);

  // Compute Top Custody Summary Metrics & Hop 2 Combined List
  const {
    inStaffDrawerTotal,
    inStaffDrawerCount,
    uncollectedTotal,
    uncollectedCount,
    hop2CombinedItems,
  } = useMemo(() => {
    let drawerSum = 0;
    let drawerCnt = 0;
    let uncollSum = 0;
    let uncollCnt = 0;

    const combined: Array<{
      key: string;
      sourceType: 'Rider Delivery' | 'Walk-in Pickup';
      orderId: number;
      customerName: string;
      isTrustedCustomer: boolean;
      amount: number;
      riderName: string;
      riderSignedBy?: string | null;
      heldByStaffName: string;
      heldPaymentMethod?: string | null;
    }> = [];

    for (const r of riderDrops) {
      const amt = Number(r.netRemittance || 0);
      if (r.custodyStatus === 'InStaffDrawer') {
        drawerSum += amt;
        drawerCnt += 1;
        combined.push({
          key: `rider-${r.orderId || r.id}`,
          sourceType: 'Rider Delivery',
          orderId: r.orderId || r.id,
          customerName: r.customerName,
          isTrustedCustomer: r.isTrustedCustomer,
          amount: amt,
          riderName: r.riderName || 'Freelance Rider',
          riderSignedBy: r.riderSignedBy,
          heldByStaffName: r.heldByStaffName || 'Cashier',
          heldPaymentMethod: r.heldPaymentMethod,
        });
      } else {
        uncollSum += amt;
        uncollCnt += 1;
      }
    }

    for (const p of pickupDrops) {
      const amt = Number(p.balanceDue || 0);
      if (p.custodyStatus === 'InStaffDrawer') {
        drawerSum += amt;
        drawerCnt += 1;
        combined.push({
          key: `pickup-${p.orderId}`,
          sourceType: 'Walk-in Pickup',
          orderId: p.orderId,
          customerName: p.customerName,
          isTrustedCustomer: p.isTrustedCustomer,
          amount: amt,
          riderName: 'Walk-in Store Pickup',
          riderSignedBy: p.riderSignedBy || 'Walk-in Customer',
          heldByStaffName: p.heldByStaffName || 'Cashier',
          heldPaymentMethod: p.heldPaymentMethod,
        });
      } else {
        uncollSum += amt;
        uncollCnt += 1;
      }
    }

    return {
      inStaffDrawerTotal: drawerSum,
      inStaffDrawerCount: drawerCnt,
      uncollectedTotal: uncollSum,
      uncollectedCount: uncollCnt,
      hop2CombinedItems: combined,
    };
  }, [riderDrops, pickupDrops]);

  // Mint or Resume QR Session when Hop 1 or Hop 2 modal opens
  useEffect(() => {
    if (!modalState) {
      setSessionToken(null);
      return;
    }

    if (modalState.workflow === 'hop2_owner') {
      createQrMutation.mutate(
        {
          orderId: modalState.orderId,
          hopStage: 'StaffToOwner',
          paymentMethod: modalState.heldPaymentMethod || 'Cash',
          expectedAmount: modalState.expectedAmount,
        },
        {
          onSuccess: (data) => {
            setSessionToken(data.token);
          },
          onError: (err: unknown) => {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setModalError(
              axiosErr.response?.data?.message ||
                'Could not initialize Owner Verification session.'
            );
          },
        }
      );
    } else if (modalState.workflow === 'hop1_rider') {
      if (riderPayMethod === 'GCash') {
        setSessionToken(null);
        return;
      }
      createQrMutation.mutate(
        {
          orderId: modalState.orderId,
          hopStage: 'RiderToStaff',
          paymentMethod: riderPayMethod,
          expectedAmount: modalState.expectedAmount,
        },
        {
          onSuccess: (data) => {
            setSessionToken(data.token);
            setOverrideRiderName(
              data.assignedRiderName || modalState.riderName || 'Freelance Rider'
            );
            setOverrideAmount(String(data.expectedAmount || modalState.expectedAmount));
          },
          onError: (err: unknown) => {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setModalError(
              axiosErr.response?.data?.message ||
                'Could not initialize Rider Handover QR session.'
            );
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalState?.orderId, modalState?.workflow, riderPayMethod]);

  const closeActiveModal = () => {
    setModalState(null);
    setSessionToken(null);
    setModalError(null);
    setCountedAmount('');
    setOwnerPinOrPassword('');
    setDirectGcashRef('');
    setShowManualOverride(false);
    setCounterRef('');
  };

  const showSuccessFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 4000);
  };

  const canUserRevertCustody = (heldBy?: string | null): boolean => {
    if (isOwner) return true;
    if (!user?.username || !heldBy) return false;
    return user.username.toLowerCase() === heldBy.toLowerCase();
  };

  // Safeguard 3: Revert Custody to Uncollected
  const handleConfirmRevertCustody = (orderId: number, heldBy?: string | null) => {
    if (!canUserRevertCustody(heldBy)) {
      Alert.alert(
        'Unauthorized',
        'Only the holding staff member or Store Owner can revert drawer custody.'
      );
      return;
    }

    Alert.alert(
      `Revert Order #${orderId} Custody?`,
      'This will roll back the order status from InStaffDrawer to Uncollected and record an entry in the Black Box audit log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert to Uncollected',
          style: 'destructive',
          onPress: async () => {
            try {
              await revertCustodyMutation.mutateAsync(orderId);
              closeActiveModal();
              showSuccessFeedback(
                `↩️ Custody for Order #${orderId} reverted to Uncollected.`
              );
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { message?: string } } };
              Alert.alert(
                'Revert Failed',
                axiosErr.response?.data?.message || 'Could not revert custody.'
              );
            }
          },
        },
      ]
    );
  };

  // Workflow A: Hop 2 Owner Envelope Verification ("The Speed Bump")
  const handleOwnerConfirmClose = async () => {
    if (!modalState || !sessionToken) return;
    setModalError(null);

    const expected = qrStatus?.expectedAmount ?? modalState.expectedAmount;
    const countedVal = parseFloat(countedAmount);

    if (countedAmount.trim() === '' || isNaN(countedVal) || countedVal !== expected) {
      setModalError(
        `Counted bills (₱${(countedVal || 0).toLocaleString()}) do not match expected remittance (₱${expected.toLocaleString()}). Recount envelope before closing.`
      );
      return;
    }

    if (!isOwner && !ownerPinOrPassword.trim()) {
      setModalError(
        'Owner Password / PIN is required when approving from a Cashier session.'
      );
      return;
    }

    try {
      await ownerApproveMutation.mutateAsync({
        token: sessionToken,
        countedAmount: countedVal,
        ownerUsername: isOwner ? user?.username : ownerUsernameInput.trim() || 'owner',
        ownerPinOrPassword: isOwner ? undefined : ownerPinOrPassword,
      });
      const closedId = modalState.orderId;
      closeActiveModal();
      showSuccessFeedback(
        `👑 Order #${closedId} verified (₱${countedVal.toLocaleString()}) & officially settled!`
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setModalError(
        axiosErr.response?.data?.message ||
          'Owner approval failed. Verify counted amount and credentials.'
      );
    }
  };

  // Workflow B: Hop 1 Staff Validate (QR or Manual Counter Override)
  const handleHop1StaffValidate = async (useOverride: boolean) => {
    if (!modalState || !sessionToken) return;
    setModalError(null);

    if (useOverride) {
      const amt = parseFloat(overrideAmount);
      if (!overrideRiderName.trim() || isNaN(amt) || amt < 0) {
        setModalError('Please enter valid Rider Name and Counted Peso Amount.');
        return;
      }
    }

    try {
      await staffValidateMutation.mutateAsync({
        token: sessionToken,
        manualOverrideRiderName: useOverride ? overrideRiderName.trim() : undefined,
        manualOverrideAmount: useOverride ? parseFloat(overrideAmount) : undefined,
      });
      const id = modalState.orderId;
      closeActiveModal();
      showSuccessFeedback(
        `🟡 Order #${id} cash validated and placed into Staff Drawer custody!`
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setModalError(
        axiosErr.response?.data?.message || 'Failed to validate cash into drawer.'
      );
    }
  };

  // Workflow B: Safeguard 1 — Reject Rider Discrepancy
  const handleRejectRiderDiscrepancy = async () => {
    if (!sessionToken) return;
    setModalError(null);
    try {
      await rejectRiderMutation.mutateAsync(sessionToken);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setModalError(
        axiosErr.response?.data?.message || 'Could not reject rider signature.'
      );
    }
  };

  // Workflow B: Direct Store GCash Bypass
  const handleHop1DirectGcash = async () => {
    if (!modalState) return;
    if (!directGcashRef.trim()) {
      setModalError('Please enter the GCash Reference Number.');
      return;
    }
    setModalError(null);
    try {
      await directGcashMutation.mutateAsync({
        orderId: modalState.orderId,
        amount: modalState.expectedAmount,
        referenceNumber: directGcashRef.trim(),
      });
      const id = modalState.orderId;
      closeActiveModal();
      showSuccessFeedback(
        `📱 Order #${id} settled directly via Store GCash (Ref: ${directGcashRef.trim()})!`
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setModalError(
        axiosErr.response?.data?.message || 'Failed to record Direct Store GCash.'
      );
    }
  };

  // Workflow C: Walk-in Store Pickup Collection
  const handlePickupCounterCollect = async () => {
    if (!modalState) return;
    setModalError(null);
    try {
      await counterCollectMutation.mutateAsync({
        orderId: modalState.orderId,
        amount: modalState.expectedAmount,
        paymentMethod: counterMethod,
        referenceNumber: counterRef.trim() || undefined,
      });
      const id = modalState.orderId;
      closeActiveModal();
      showSuccessFeedback(
        `🏪 Pickup Order #${id} collected (₱${modalState.expectedAmount.toLocaleString()}) into Staff Drawer!`
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setModalError(
        axiosErr.response?.data?.message || 'Failed to record counter pickup collection.'
      );
    }
  };

  // Workflow D: Lalamove Payment & Release
  const handleLalamovePaymentSubmit = async () => {
    if (!modalState) return;
    setModalError(null);
    try {
      await manualPaymentMutation.mutateAsync({
        orderId: modalState.orderId,
        amount: modalState.expectedAmount,
        paymentMethod: counterMethod,
        referenceNumber: counterRef.trim() || undefined,
      });
      const id = modalState.orderId;
      closeActiveModal();
      showSuccessFeedback(
        `✅ Payment logged for Lalamove Order #${id}! Order is now CLEAR TO RELEASE.`
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setModalError(
        axiosErr.response?.data?.message || 'Failed to log payment for Lalamove order.'
      );
    }
  };

  const handleReleaseLalamoveCourier = (item: PendingLalamoveSettlement) => {
    const targetId = item.id ?? item.orderId;
    Alert.alert(
      `Release Order #${item.orderId} to Lalamove?`,
      `Confirm that ${item.customerName}'s order is 100% paid and packed for handover to the Lalamove driver.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Release',
          onPress: async () => {
            try {
              await releaseLalamoveMutation.mutateAsync(targetId);
              showSuccessFeedback(
                `📦 Order #${item.orderId} officially released to Lalamove courier!`
              );
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { message?: string } } };
              Alert.alert(
                'Release Failed',
                axiosErr.response?.data?.message || 'Could not release Lalamove order.'
              );
            }
          },
        },
      ]
    );
  };

  const isRefreshingAny =
    isRefetchingRiders || isRefetchingPickups || isRefetchingLalamove;

  const handleRefreshAll = () => {
    void refetchRiders();
    void refetchPickups();
    void refetchLalamove();
  };

  // Hop 2 Speed Bump Validation Math
  const expectedHop2Amount =
    qrStatus?.expectedAmount ?? modalState?.expectedAmount ?? 0;
  const parsedCounted = parseFloat(countedAmount);
  const isCountedEntered = countedAmount.trim() !== '';
  const isCountedExactMatch =
    isCountedEntered && !isNaN(parsedCounted) && parsedCounted === expectedHop2Amount;

  // Hop 1 Rider Signature Discrepancy Math
  const isSignedByRider = qrStatus?.status === 'SignedByRider';
  const riderDeclaredAmount = qrStatus?.riderRemittedAmount ?? 0;
  const expectedHop1Amount =
    qrStatus?.expectedAmount ?? modalState?.expectedAmount ?? 0;
  const riderDiff = Math.abs(expectedHop1Amount - riderDeclaredAmount);
  const isRiderExact = riderDeclaredAmount === expectedHop1Amount;
  const isRiderShort = riderDeclaredAmount < expectedHop1Amount;

  return (
    <View style={styles.container}>
      {/* 1. Top Custody Summary Banner */}
      <View style={styles.summaryBanner}>
        <Pressable
          style={[
            styles.summaryCard,
            styles.summaryCardDrawer,
            activeTab === 'hop2' && styles.summaryCardActiveBorder,
          ]}
          onPress={() => setActiveTab('hop2')}
        >
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryBadgeDrawer}>🟡 In Staff Drawer</Text>
            <Text style={styles.summaryCountText}>{inStaffDrawerCount} items</Text>
          </View>
          <Text style={styles.summaryAmountDrawer}>
            ₱{inStaffDrawerTotal.toLocaleString()}
          </Text>
          <Text style={styles.summaryCaption}>Awaiting Owner Turnover (Hop 2)</Text>
        </Pressable>

        <Pressable
          style={[
            styles.summaryCard,
            styles.summaryCardUncollected,
            activeTab === 'riders' && styles.summaryCardActiveBorder,
          ]}
          onPress={() => setActiveTab('riders')}
        >
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryBadgeUncollected}>⚪ Uncollected</Text>
            <Text style={styles.summaryCountText}>{uncollectedCount} items</Text>
          </View>
          <Text style={styles.summaryAmountUncollected}>
            ₱{uncollectedTotal.toLocaleString()}
          </Text>
          <Text style={styles.summaryCaption}>Road Riders &amp; Counter Pickups</Text>
        </Pressable>
      </View>

      {/* 2. 4-Mode Segmented Filter Bar */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          <Pressable
            style={[styles.tabPill, activeTab === 'hop2' && styles.tabPillActive]}
            onPress={() => setActiveTab('hop2')}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'hop2' && styles.tabPillTextActive,
              ]}
            >
              👑 Drawer Handover ({hop2CombinedItems.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabPill, activeTab === 'riders' && styles.tabPillActive]}
            onPress={() => setActiveTab('riders')}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'riders' && styles.tabPillTextActive,
              ]}
            >
              🛵 Riders ({riderDrops.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabPill, activeTab === 'pickups' && styles.tabPillActive]}
            onPress={() => setActiveTab('pickups')}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'pickups' && styles.tabPillTextActive,
              ]}
            >
              🏪 Store Pickups ({pickupDrops.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabPill, activeTab === 'lalamove' && styles.tabPillActive]}
            onPress={() => setActiveTab('lalamove')}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'lalamove' && styles.tabPillTextActive,
              ]}
            >
              📦 Lalamove Gate ({lalamoveDrops.length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackBannerText}>{feedbackBanner}</Text>
        </View>
      )}

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAny}
            onRefresh={handleRefreshAll}
            tintColor="#C81E1E"
            colors={['#C81E1E']}
          />
        }
      >
        {/* ============================================================ */}
        {/* TAB 1: 👑 DRAWER HANDOVER (HOP 2)                            */}
        {/* ============================================================ */}
        {activeTab === 'hop2' && (
          <>
            <View style={styles.sectionBannerBox}>
              <Text style={styles.sectionBannerTitle}>
                👑 Hop 2: Staff Drawer to Owner Remittance
              </Text>
              <Text style={styles.sectionBannerSub}>
                Count physical bills inside each order&apos;s cash envelope before closing the ledger.
              </Text>
            </View>

            {isLoadingRiders || isLoadingPickups ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#C81E1E" />
                <Text style={styles.loadingText}>Loading drawer custody items...</Text>
              </View>
            ) : hop2CombinedItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>✨</Text>
                <Text style={styles.emptyTitle}>Staff Drawer is Clear!</Text>
                <Text style={styles.emptySub}>
                  No cash envelopes are currently waiting in staff drawer custody.
                </Text>
              </View>
            ) : (
              hop2CombinedItems.map((item) => (
                <View key={item.key} style={styles.itemCardDrawer}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.rowCenterWrap}>
                      <Text style={styles.monoOrderId}>#{item.orderId}</Text>
                      {item.isTrustedCustomer && (
                        <View style={styles.vipBadge}>
                          <Text style={styles.vipBadgeText}>👑 VIP</Text>
                        </View>
                      )}
                      <View style={styles.sourceTag}>
                        <Text style={styles.sourceTagText}>{item.sourceType}</Text>
                      </View>
                    </View>
                    <Text style={styles.drawerAmountBig}>
                      ₱{item.amount.toLocaleString()}
                    </Text>
                  </View>

                  <Text style={styles.customerNameText}>{item.customerName}</Text>

                  <View style={styles.custodyMetaBox}>
                    <Text style={styles.custodyMetaLine}>
                      🟡 Held in Drawer by:{' '}
                      <Text style={styles.custodyMetaStrong}>
                        {item.heldByStaffName}
                      </Text>
                    </Text>
                    <Text style={styles.custodyMetaLine}>
                      🛵 Origin:{' '}
                      <Text style={styles.custodyMetaStrong}>
                        {item.riderSignedBy || item.riderName}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.cardActionRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.remitOwnerBtn,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => {
                        setCountedAmount('');
                        setOwnerPinOrPassword('');
                        setModalError(null);
                        setModalState({
                          workflow: 'hop2_owner',
                          orderId: item.orderId,
                          customerName: item.customerName,
                          expectedAmount: item.amount,
                          riderName: item.riderName,
                          riderSignedBy: item.riderSignedBy,
                          heldByStaffName: item.heldByStaffName,
                          heldPaymentMethod: item.heldPaymentMethod,
                        });
                      }}
                    >
                      <Text style={styles.remitOwnerBtnText}>
                        👑 Remit / Approve to Owner
                      </Text>
                    </Pressable>

                    {canUserRevertCustody(item.heldByStaffName) && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.undoIconBtn,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={() =>
                          handleConfirmRevertCustody(
                            item.orderId,
                            item.heldByStaffName
                          )
                        }
                      >
                        <Text style={styles.undoIconBtnText}>↩️ Undo</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 2: 🛵 RIDERS (HOP 1)                                     */}
        {/* ============================================================ */}
        {activeTab === 'riders' && (
          <>
            <View style={styles.sectionBannerBox}>
              <Text style={styles.sectionBannerTitle}>
                🛵 Freelance Rider Collections (Hop 1)
              </Text>
              <Text style={styles.sectionBannerSub}>
                Receive net meat remittances from returning riders into Staff Drawer custody.
              </Text>
            </View>

            {isLoadingRiders ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#C81E1E" />
                <Text style={styles.loadingText}>Loading rider drops...</Text>
              </View>
            ) : riderDrops.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyTitle}>All Rider Trips Settled!</Text>
                <Text style={styles.emptySub}>
                  No pending freelance rider remittances at the moment.
                </Text>
              </View>
            ) : (
              riderDrops.map((drop) => {
                const isInDrawer = drop.custodyStatus === 'InStaffDrawer';
                const targetOrderId = drop.orderId || drop.id;

                return (
                  <View
                    key={drop.id}
                    style={[
                      styles.itemCard,
                      isInDrawer && styles.itemCardDrawerHighlight,
                    ]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.rowCenterWrap}>
                        <Text style={styles.monoOrderId}>#{targetOrderId}</Text>
                        {drop.isTrustedCustomer && (
                          <View style={styles.vipBadge}>
                            <Text style={styles.vipBadgeText}>👑 VIP</Text>
                          </View>
                        )}
                        <Text style={styles.riderBadgeText}>
                          🛵 {drop.riderName}
                        </Text>
                      </View>

                      {isInDrawer ? (
                        <View style={styles.custodyPillDrawer}>
                          <Text style={styles.custodyPillDrawerText}>
                            🟡 Held by {drop.heldByStaffName || 'Cashier'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.custodyPillUncollected}>
                          <Text style={styles.custodyPillUncollectedText}>
                            ⚪ Uncollected
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.customerNameText}>{drop.customerName}</Text>
                    <Text style={styles.addressSubText} numberOfLines={1}>
                      📍 {drop.deliveryAddress || 'Store Delivery'}
                    </Text>

                    {/* 3-Column Financial Split Box */}
                    <View style={styles.splitGrid}>
                      <View style={styles.splitCell}>
                        <Text style={styles.splitCellLabel}>Total Collected</Text>
                        <Text style={styles.splitCellVal}>
                          ₱{drop.totalCollected.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.splitCell}>
                        <Text style={styles.splitCellLabel}>Rider Cut</Text>
                        <Text style={styles.splitCellFee}>
                          -₱{drop.riderDeliveryFee.toLocaleString()}
                        </Text>
                      </View>
                      <View style={[styles.splitCell, styles.splitCellNet]}>
                        <Text style={styles.splitCellNetLabel}>Net Remittance</Text>
                        <Text style={styles.splitCellNetVal}>
                          ₱{drop.netRemittance.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {/* Action Row */}
                    <View style={styles.cardActionRow}>
                      {isInDrawer ? (
                        <>
                          <Pressable
                            style={({ pressed }) => [
                              styles.remitOwnerBtn,
                              pressed && styles.btnPressed,
                            ]}
                            onPress={() => {
                              setCountedAmount('');
                              setOwnerPinOrPassword('');
                              setModalError(null);
                              setModalState({
                                workflow: 'hop2_owner',
                                orderId: targetOrderId,
                                customerName: drop.customerName,
                                expectedAmount: drop.netRemittance,
                                riderName: drop.riderName,
                                riderSignedBy: drop.riderSignedBy,
                                heldByStaffName: drop.heldByStaffName,
                                heldPaymentMethod: drop.heldPaymentMethod,
                              });
                            }}
                          >
                            <Text style={styles.remitOwnerBtnText}>
                              👑 Remit to Owner
                            </Text>
                          </Pressable>

                          {canUserRevertCustody(drop.heldByStaffName) && (
                            <Pressable
                              style={({ pressed }) => [
                                styles.undoIconBtn,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() =>
                                handleConfirmRevertCustody(
                                  targetOrderId,
                                  drop.heldByStaffName
                                )
                              }
                            >
                              <Text style={styles.undoIconBtnText}>↩️ Undo</Text>
                            </Pressable>
                          )}
                        </>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.settleGreenBtn,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => {
                            setRiderPayMethod('Cash');
                            setDirectGcashRef('');
                            setShowManualOverride(false);
                            setOverrideRiderName(drop.riderName || '');
                            setOverrideAmount(String(drop.netRemittance));
                            setModalError(null);
                            setModalState({
                              workflow: 'hop1_rider',
                              orderId: targetOrderId,
                              customerName: drop.customerName,
                              expectedAmount: drop.netRemittance,
                              riderName: drop.riderName,
                            });
                          }}
                        >
                          <Text style={styles.settleGreenBtnText}>
                            Settle Payment (Hop 1)
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 3: 🏪 STORE PICKUPS                                      */}
        {/* ============================================================ */}
        {activeTab === 'pickups' && (
          <>
            <View style={styles.sectionBannerBox}>
              <Text style={styles.sectionBannerTitle}>
                🏪 Walk-in Store Pickup Handovers
              </Text>
              <Text style={styles.sectionBannerSub}>
                The &quot;Notebook Rule&quot;: Unsettled counter pickups remain visible until reconciled with the Owner.
              </Text>
            </View>

            {isLoadingPickups ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#C81E1E" />
                <Text style={styles.loadingText}>Loading store pickups...</Text>
              </View>
            ) : pickupDrops.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyTitle}>No Pending Pickup Balances!</Text>
                <Text style={styles.emptySub}>
                  All walk-in store pickup orders have been settled.
                </Text>
              </View>
            ) : (
              pickupDrops.map((pickup) => {
                const isInDrawer = pickup.custodyStatus === 'InStaffDrawer';

                return (
                  <View
                    key={pickup.orderId}
                    style={[
                      styles.itemCard,
                      isInDrawer && styles.itemCardDrawerHighlight,
                    ]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.rowCenterWrap}>
                        <Text style={styles.monoOrderId}>#{pickup.orderId}</Text>
                        {pickup.isTrustedCustomer && (
                          <View style={styles.vipBadge}>
                            <Text style={styles.vipBadgeText}>👑 VIP</Text>
                          </View>
                        )}
                      </View>

                      {isInDrawer ? (
                        <View style={styles.custodyPillDrawer}>
                          <Text style={styles.custodyPillDrawerText}>
                            🟡 Held by {pickup.heldByStaffName || 'Cashier'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.custodyPillUncollected}>
                          <Text style={styles.custodyPillUncollectedText}>
                            ⚪ Uncollected
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.customerNameText}>
                      {pickup.customerName}
                    </Text>
                    <Text style={styles.addressSubText}>
                      📞 {pickup.contactNumber || 'N/A'} • 🏪{' '}
                      {pickup.address || pickup.remarks || 'Counter Pickup'}
                    </Text>

                    <View style={styles.splitGrid}>
                      <View style={styles.splitCell}>
                        <Text style={styles.splitCellLabel}>Grand Total</Text>
                        <Text style={styles.splitCellVal}>
                          ₱{pickup.grandTotal.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.splitCell}>
                        <Text style={styles.splitCellLabel}>Downpayment</Text>
                        <Text style={styles.splitCellVal}>
                          ₱{pickup.downpayment.toLocaleString()}
                        </Text>
                      </View>
                      <View style={[styles.splitCell, styles.splitCellNet]}>
                        <Text style={styles.splitCellNetLabel}>Balance Due</Text>
                        <Text style={styles.splitCellNetVal}>
                          ₱{pickup.balanceDue.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardActionRow}>
                      {isInDrawer ? (
                        <>
                          <Pressable
                            style={({ pressed }) => [
                              styles.remitOwnerBtn,
                              pressed && styles.btnPressed,
                            ]}
                            onPress={() => {
                              setCountedAmount('');
                              setOwnerPinOrPassword('');
                              setModalError(null);
                              setModalState({
                                workflow: 'hop2_owner',
                                orderId: pickup.orderId,
                                customerName: pickup.customerName,
                                expectedAmount: pickup.balanceDue,
                                riderName: 'Walk-in Store Pickup',
                                riderSignedBy: 'Walk-in Customer',
                                heldByStaffName: pickup.heldByStaffName,
                                heldPaymentMethod: pickup.heldPaymentMethod,
                              });
                            }}
                          >
                            <Text style={styles.remitOwnerBtnText}>
                              👑 Remit to Owner
                            </Text>
                          </Pressable>

                          {canUserRevertCustody(pickup.heldByStaffName) && (
                            <Pressable
                              style={({ pressed }) => [
                                styles.undoIconBtn,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() =>
                                handleConfirmRevertCustody(
                                  pickup.orderId,
                                  pickup.heldByStaffName
                                )
                              }
                            >
                              <Text style={styles.undoIconBtnText}>↩️ Undo</Text>
                            </Pressable>
                          )}
                        </>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.settleGreenBtn,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => {
                            setCounterMethod('Cash');
                            setCounterRef('');
                            setModalError(null);
                            setModalState({
                              workflow: 'pickup_collect',
                              orderId: pickup.orderId,
                              customerName: pickup.customerName,
                              expectedAmount: pickup.balanceDue,
                              isTrustedCustomer: pickup.isTrustedCustomer,
                            });
                          }}
                        >
                          <Text style={styles.settleGreenBtnText}>
                            Collect at Counter
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 4: 📦 LALAMOVE GATE                                      */}
        {/* ============================================================ */}
        {activeTab === 'lalamove' && (
          <>
            <View style={styles.sectionBannerBox}>
              <Text style={styles.sectionBannerTitle}>
                📦 Lalamove Pre-Release Anti-Loss Gate
              </Text>
              <Text style={styles.sectionBannerSub}>
                Third-party app drivers do not collect lechon payments. Release only when 100% paid.
              </Text>
            </View>

            {isLoadingLalamove ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#C81E1E" />
                <Text style={styles.loadingText}>Loading Lalamove gate...</Text>
              </View>
            ) : lalamoveDrops.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyTitle}>No Pending Lalamove Releases!</Text>
                <Text style={styles.emptySub}>
                  All customer-booked courier orders have been released.
                </Text>
              </View>
            ) : (
              lalamoveDrops.map((item) => {
                const isCleared = item.isClearedForRelease || item.balanceDue <= 0;

                return (
                  <View key={item.orderId} style={styles.itemCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.monoOrderId}>#{item.orderId}</Text>
                      {isCleared ? (
                        <View style={styles.gateBadgeClear}>
                          <Text style={styles.gateBadgeClearText}>
                            🟢 CLEAR TO RELEASE
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.gateBadgeHold}>
                          <Text style={styles.gateBadgeHoldText}>
                            🛑 HOLD: UNPAID BALANCE
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.customerNameText}>{item.customerName}</Text>
                    <Text style={styles.addressSubText}>
                      📍 {item.deliveryAddress || 'Customer-booked pin'}
                    </Text>

                    <View style={styles.lalamoveBalanceBar}>
                      <Text style={styles.lalamoveBalanceLabel}>Balance Due:</Text>
                      <Text
                        style={[
                          styles.lalamoveBalanceVal,
                          isCleared ? styles.textEmerald : styles.textRose,
                        ]}
                      >
                        ₱{Number(item.balanceDue || 0).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.cardActionRow}>
                      {isCleared ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.settleGreenBtn,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => handleReleaseLalamoveCourier(item)}
                        >
                          <Text style={styles.settleGreenBtnText}>
                            ✅ Release to Courier
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [
                            styles.verifyPayBtn,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => {
                            setCounterMethod('GCash');
                            setCounterRef('');
                            setModalError(null);
                            setModalState({
                              workflow: 'lalamove_pay',
                              orderId: item.orderId,
                              customerName: item.customerName,
                              expectedAmount: item.balanceDue,
                            });
                          }}
                        >
                          <Text style={styles.verifyPayBtnText}>
                            🛑 Log Payment to Unlock Release
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* ============================================================== */}
      {/* INTERACTIVE SETTLEMENT & SAFEGUARD WORKFLOWS MODAL             */}
      {/* ============================================================== */}
      <Modal
        visible={Boolean(modalState)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeActiveModal}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.modalHeaderBadge}>
                {modalState?.workflow === 'hop2_owner'
                  ? '👑 HOP 2: OWNER ENVELOPE VERIFICATION'
                  : modalState?.workflow === 'hop1_rider'
                  ? '🛵 HOP 1: RIDER-TO-STAFF HANDOVER'
                  : modalState?.workflow === 'pickup_collect'
                  ? '🏪 COUNTER PICKUP COLLECTION'
                  : '📦 LALAMOVE PRE-RELEASE PAYMENT'}
              </Text>
              <Text style={styles.modalHeaderTitle}>
                Order #{modalState?.orderId} • {modalState?.customerName}
              </Text>
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={closeActiveModal}>
              <Text style={styles.modalCloseBtnText}>✕ Close</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {modalError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>⚠️ {modalError}</Text>
              </View>
            )}

            {/* ---------------------------------------------------------- */}
            {/* WORKFLOW A: HOP 2 OWNER ENVELOPE VERIFICATION (SPEED BUMP) */}
            {/* ---------------------------------------------------------- */}
            {modalState?.workflow === 'hop2_owner' && (
              <View style={styles.workflowContainer}>
                <View style={styles.custodyChainCard}>
                  <Text style={styles.chainSectionTitle}>
                     CUSTODY CHAIN AUDIT
                  </Text>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Order Reference:</Text>
                    <Text style={styles.chainValMono}>#{modalState.orderId}</Text>
                  </View>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Customer:</Text>
                    <Text style={styles.chainVal}>{modalState.customerName}</Text>
                  </View>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Rider / Origin:</Text>
                    <Text style={styles.chainVal}>
                      {modalState.riderSignedBy ||
                        modalState.riderName ||
                        'Walk-in Store Pickup'}
                    </Text>
                  </View>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Held in Drawer by:</Text>
                    <Text style={styles.chainValStaff}>
                      🟡 {modalState.heldByStaffName || 'Cashier'}
                    </Text>
                  </View>
                  <View style={[styles.chainRow, styles.chainDivider]}>
                    <Text style={styles.chainExpectedLabel}>
                      Expected Turnover Amount:
                    </Text>
                    <Text style={styles.chainExpectedVal}>
                      ₱{expectedHop2Amount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Safeguard 4: Mandatory Counted Bills Speed Bump */}
                <View style={styles.speedBumpCard}>
                  <View style={styles.speedBumpHeader}>
                    <Text style={styles.speedBumpTitle}>
                      💵 Physical Bills Counted in Envelope (₱) *
                    </Text>
                    <Pressable
                      style={styles.matchExactChip}
                      onPress={() => setCountedAmount(String(expectedHop2Amount))}
                    >
                      <Text style={styles.matchExactChipText}>
                        Match ₱{expectedHop2Amount.toLocaleString()}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={styles.speedBumpInput}
                    placeholder={`Count physical envelope bills (Expect ₱${expectedHop2Amount.toLocaleString()})`}
                    placeholderTextColor="#A8A29E"
                    keyboardType="numeric"
                    value={countedAmount}
                    onChangeText={setCountedAmount}
                  />

                  {isCountedEntered && !isCountedExactMatch && (
                    <View style={styles.mismatchAlertBox}>
                      <Text style={styles.mismatchAlertText}>
                        ⚠️ Counted bills (₱
                        {(isNaN(parsedCounted) ? 0 : parsedCounted).toLocaleString()}
                        ) do not match expected remittance (₱
                        {expectedHop2Amount.toLocaleString()}). Recount envelope before closing.
                      </Text>
                    </View>
                  )}

                  {!isOwner && (
                    <View style={styles.ownerAuthBox}>
                      <Text style={styles.ownerAuthTitle}>
                        🔐 Owner Authorization Required (Logged in as Cashier)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Owner Username (e.g. owner)"
                        placeholderTextColor="#A8A29E"
                        autoCapitalize="none"
                        value={ownerUsernameInput}
                        onChangeText={setOwnerUsernameInput}
                      />
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Owner Password / Master PIN *"
                        placeholderTextColor="#A8A29E"
                        secureTextEntry
                        autoCapitalize="none"
                        value={ownerPinOrPassword}
                        onChangeText={setOwnerPinOrPassword}
                      />
                    </View>
                  )}

                  <Pressable
                    style={({ pressed }) => [
                      styles.ownerApproveBtn,
                      (!isCountedExactMatch ||
                        ownerApproveMutation.isPending ||
                        !sessionToken) &&
                        styles.disabledBtn,
                      pressed && styles.btnPressed,
                    ]}
                    disabled={
                      !isCountedExactMatch ||
                      ownerApproveMutation.isPending ||
                      !sessionToken
                    }
                    onPress={handleOwnerConfirmClose}
                  >
                    {ownerApproveMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.ownerApproveBtnText}>
                        👑 Confirm &amp; Close Order #{modalState.orderId}
                      </Text>
                    )}
                  </Pressable>
                </View>

                {/* Safeguard 3: Staff Custody Undo */}
                {canUserRevertCustody(modalState.heldByStaffName) && (
                  <View style={styles.revertFooterBox}>
                    <Text style={styles.revertFooterHint}>
                      Envelope mistake or recount discrepancy?
                    </Text>
                    <Pressable
                      style={styles.revertFullBtn}
                      onPress={() =>
                        handleConfirmRevertCustody(
                          modalState.orderId,
                          modalState.heldByStaffName
                        )
                      }
                    >
                      <Text style={styles.revertFullBtnText}>
                        ↩️ Revert Custody to Uncollected
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* ---------------------------------------------------------- */}
            {/* WORKFLOW B: HOP 1 RIDER-TO-STAFF SETTLEMENT                */}
            {/* ---------------------------------------------------------- */}
            {modalState?.workflow === 'hop1_rider' && (
              <View style={styles.workflowContainer}>
                <View style={styles.custodyChainCard}>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Assigned Rider:</Text>
                    <Text style={styles.chainVal}>
                      🛵 {modalState.riderName || 'Freelance Rider'}
                    </Text>
                  </View>
                  <View style={[styles.chainRow, styles.chainDivider]}>
                    <Text style={styles.chainExpectedLabel}>
                      Net Store Remittance:
                    </Text>
                    <Text style={styles.chainExpectedVal}>
                      ₱{expectedHop1Amount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Payment Method Selector */}
                <Text style={styles.fieldLabel}>Select Remittance Channel</Text>
                <View style={styles.methodSegmentRow}>
                  {(
                    [
                      { label: '💵 Cash', value: 'Cash' },
                      { label: '📲 Rider GCash', value: 'ManualGCash' },
                      { label: '📱 Direct GCash', value: 'GCash' },
                    ] as const
                  ).map((m) => {
                    const active = riderPayMethod === m.value;
                    return (
                      <Pressable
                        key={m.value}
                        style={[
                          styles.methodSegBtn,
                          active && styles.methodSegBtnActive,
                        ]}
                        onPress={() => setRiderPayMethod(m.value)}
                      >
                        <Text
                          style={[
                            styles.methodSegBtnText,
                            active && styles.methodSegBtnTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {riderPayMethod === 'GCash' ? (
                  /* 1-Hop Direct Store GCash Bypass */
                  <View style={styles.directGcashBox}>
                    <Text style={styles.directGcashInfo}>
                      📱 Customer sent money directly to the Store&apos;s GCash QR. Rider holds ₱0 of store funds. Enter the GCash Reference Number to settle immediately:
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="GCash Reference # (e.g., 9012384912)"
                      placeholderTextColor="#A8A29E"
                      value={directGcashRef}
                      onChangeText={setDirectGcashRef}
                    />
                    <Pressable
                      style={[
                        styles.settleGreenBtn,
                        directGcashMutation.isPending && styles.disabledBtn,
                      ]}
                      disabled={directGcashMutation.isPending}
                      onPress={handleHop1DirectGcash}
                    >
                      {directGcashMutation.isPending ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.settleGreenBtnText}>
                          📱 Confirm Direct Store GCash Settlement
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  /* QR Polling + Safeguard 1 Discrepancy + Manual Counter Override */
                  <View style={styles.hop1QrSection}>
                    <View style={styles.qrTokenBox}>
                      <Text style={styles.qrTokenLabel}>
                        ACTIVE 10-MINUTE HANDSHAKE TOKEN
                      </Text>
                      <Text style={styles.qrTokenCode}>
                        {sessionToken || 'Generating token...'}
                      </Text>
                      <Text style={styles.qrPollStatusText}>
                        {isSignedByRider
                          ? `✍️ Signed by ${qrStatus?.riderSignedBy || modalState.riderName}`
                          : '⏳ Polling every 2s for Rider QR signature...'}
                      </Text>
                    </View>

                    {/* Safeguard 1: Discrepancy Alert */}
                    {isSignedByRider && (
                      <View
                        style={[
                          styles.signatureAlertCard,
                          isRiderExact
                            ? styles.signatureExactCard
                            : styles.signatureDiscrepancyCard,
                        ]}
                      >
                        <Text style={styles.signatureAlertHeader}>
                          {isRiderExact
                            ? `✅ Rider Declared Exact Amount: ₱${riderDeclaredAmount.toLocaleString()}`
                            : `⚠️ ${
                                isRiderShort
                                  ? `SHORT BY ₱${riderDiff.toLocaleString()}`
                                  : `OVER BY ₱${riderDiff.toLocaleString()}`
                              }`}
                        </Text>
                        {!isRiderExact && (
                          <Text style={styles.signatureAlertSub}>
                            Expected ₱{expectedHop1Amount.toLocaleString()} • Rider Declared ₱
                            {riderDeclaredAmount.toLocaleString()}
                          </Text>
                        )}

                        <View style={styles.hop1ActionButtonsRow}>
                          <Pressable
                            style={[
                              styles.validateDrawerBtn,
                              staffValidateMutation.isPending && styles.disabledBtn,
                            ]}
                            disabled={staffValidateMutation.isPending}
                            onPress={() => handleHop1StaffValidate(false)}
                          >
                            <Text style={styles.validateDrawerBtnText}>
                              ✅ Validate &amp; Receive into Drawer
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.rejectSigBtn,
                              rejectRiderMutation.isPending && styles.disabledBtn,
                            ]}
                            disabled={rejectRiderMutation.isPending}
                            onPress={handleRejectRiderDiscrepancy}
                          >
                            <Text style={styles.rejectSigBtnText}>
                              🔄 Ask Rider to Re-enter
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* Manual Counter Override */}
                    <View style={styles.overrideCard}>
                      <Pressable
                        style={styles.overrideToggleHeader}
                        onPress={() => setShowManualOverride((prev) => !prev)}
                      >
                        <Text style={styles.overrideToggleTitle}>
                          ⚡ Manual Counter Override (Direct Entry / Phone Dead)
                        </Text>
                        <Text style={styles.overrideToggleArrow}>
                          {showManualOverride ? '▲ Hide' : '▼ Expand'}
                        </Text>
                      </Pressable>

                      {showManualOverride && (
                        <View style={styles.overrideBody}>
                          <Text style={styles.fieldLabel}>Rider Name</Text>
                          <TextInput
                            style={styles.modalInput}
                            placeholder="e.g., Kuya Jun"
                            placeholderTextColor="#A8A29E"
                            value={overrideRiderName}
                            onChangeText={setOverrideRiderName}
                          />

                          <Text style={styles.fieldLabel}>
                            Counted Peso Amount Received (₱)
                          </Text>
                          <TextInput
                            style={styles.modalInput}
                            keyboardType="numeric"
                            value={overrideAmount}
                            onChangeText={setOverrideAmount}
                          />

                          <Pressable
                            style={[
                              styles.validateDrawerBtn,
                              (!sessionToken || staffValidateMutation.isPending) &&
                                styles.disabledBtn,
                            ]}
                            disabled={!sessionToken || staffValidateMutation.isPending}
                            onPress={() => handleHop1StaffValidate(true)}
                          >
                            {staffValidateMutation.isPending ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <Text style={styles.validateDrawerBtnText}>
                                ✅ Validate &amp; Receive into Drawer
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ---------------------------------------------------------- */}
            {/* WORKFLOW C & D: PICKUP COLLECTION / LALAMOVE GATE PAYMENT  */}
            {/* ---------------------------------------------------------- */}
            {(modalState?.workflow === 'pickup_collect' ||
              modalState?.workflow === 'lalamove_pay') && (
              <View style={styles.workflowContainer}>
                <View style={styles.custodyChainCard}>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Customer:</Text>
                    <Text style={styles.chainVal}>{modalState.customerName}</Text>
                  </View>
                  <View style={styles.chainRow}>
                    <Text style={styles.chainLabel}>Delivery Fee:</Text>
                    <Text style={styles.chainValMono}>₱0.00</Text>
                  </View>
                  <View style={[styles.chainRow, styles.chainDivider]}>
                    <Text style={styles.chainExpectedLabel}>
                      Balance to Collect:
                    </Text>
                    <Text style={styles.chainExpectedVal}>
                      ₱{modalState.expectedAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Payment Method *</Text>
                <View style={styles.methodSegmentRow}>
                  <Pressable
                    style={[
                      styles.methodSegBtn,
                      counterMethod === 'Cash' && styles.methodSegBtnActive,
                    ]}
                    onPress={() => setCounterMethod('Cash')}
                  >
                    <Text
                      style={[
                        styles.methodSegBtnText,
                        counterMethod === 'Cash' && styles.methodSegBtnTextActive,
                      ]}
                    >
                      💵 Physical Cash (Drawer)
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.methodSegBtn,
                      counterMethod === 'GCash' && styles.methodSegBtnActive,
                    ]}
                    onPress={() => setCounterMethod('GCash')}
                  >
                    <Text
                      style={[
                        styles.methodSegBtnText,
                        counterMethod === 'GCash' && styles.methodSegBtnTextActive,
                      ]}
                    >
                      📱 Store GCash QR
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>
                  Reference / Receipt Number (Optional)
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., GCash Ref # or Counter Receipt #"
                  placeholderTextColor="#A8A29E"
                  value={counterRef}
                  onChangeText={setCounterRef}
                />

                <Pressable
                  style={[
                    styles.settleGreenBtn,
                    (counterCollectMutation.isPending ||
                      manualPaymentMutation.isPending) &&
                      styles.disabledBtn,
                  ]}
                  disabled={
                    counterCollectMutation.isPending ||
                    manualPaymentMutation.isPending
                  }
                  onPress={
                    modalState.workflow === 'pickup_collect'
                      ? handlePickupCounterCollect
                      : handleLalamovePaymentSubmit
                  }
                >
                  {counterCollectMutation.isPending ||
                  manualPaymentMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.settleGreenBtnText}>
                      {modalState.workflow === 'pickup_collect'
                        ? '✅ Confirm & Receive into Drawer'
                        : '✅ Record Payment & Unlock Lalamove Release'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  summaryBanner: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#181312',
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
  },
  summaryCardDrawer: {
    backgroundColor: '#291D1A',
    borderColor: '#78350F',
  },
  summaryCardUncollected: {
    backgroundColor: '#221A18',
    borderColor: '#3D302C',
  },
  summaryCardActiveBorder: {
    borderColor: '#FBBF24',
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryBadgeDrawer: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FBBF24',
  },
  summaryBadgeUncollected: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E7E5E4',
  },
  summaryCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A8A29E',
  },
  summaryAmountDrawer: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FDE68A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summaryAmountUncollected: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summaryCaption: {
    fontSize: 10,
    color: '#A8A29E',
    marginTop: 2,
  },
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
    paddingVertical: 10,
  },
  tabsScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  tabPillActive: {
    backgroundColor: '#181312',
    borderColor: '#181312',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#57534E',
  },
  tabPillTextActive: {
    color: '#FBBF24',
  },
  feedbackBanner: {
    backgroundColor: '#065F46',
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  feedbackBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
    gap: 12,
  },
  sectionBannerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  sectionBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
  },
  sectionBannerSub: {
    fontSize: 11,
    color: '#57534E',
    marginTop: 2,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 8,
  },
  itemCardDrawer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    gap: 8,
  },
  itemCardDrawerHighlight: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowCenterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  monoOrderId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  sourceTag: {
    backgroundColor: '#181312',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
  },
  drawerAmountBig: {
    fontSize: 17,
    fontWeight: '900',
    color: '#047857',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
  },
  addressSubText: {
    fontSize: 12,
    color: '#57534E',
  },
  custodyMetaBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 3,
  },
  custodyMetaLine: {
    fontSize: 12,
    color: '#57534E',
  },
  custodyMetaStrong: {
    fontWeight: '800',
    color: '#1C1917',
  },
  riderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
  },
  custodyPillDrawer: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  custodyPillDrawerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  custodyPillUncollected: {
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  custodyPillUncollectedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#57534E',
  },
  splitGrid: {
    flexDirection: 'row',
    backgroundColor: '#FAFAF9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    overflow: 'hidden',
  },
  splitCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  splitCellNet: {
    backgroundColor: '#ECFDF5',
  },
  splitCellLabel: {
    fontSize: 10,
    color: '#78716C',
    fontWeight: '600',
  },
  splitCellVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1917',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  splitCellFee: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11D48',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  splitCellNetLabel: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '800',
  },
  splitCellNetVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#047857',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  remitOwnerBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remitOwnerBtnText: {
    color: '#181312',
    fontSize: 13,
    fontWeight: '900',
  },
  undoIconBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoIconBtnText: {
    color: '#BE123C',
    fontSize: 12,
    fontWeight: '800',
  },
  settleGreenBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleGreenBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  gateBadgeClear: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gateBadgeClearText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  gateBadgeHold: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gateBadgeHoldText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9F1239',
  },
  lalamoveBalanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAF9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  lalamoveBalanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
  },
  lalamoveBalanceVal: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textEmerald: {
    color: '#047857',
  },
  textRose: {
    color: '#DC2626',
  },
  verifyPayBtn: {
    flex: 1,
    backgroundColor: '#BE123C',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },
  verifyPayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  centerBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#57534E',
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
  },
  emptySub: {
    fontSize: 12,
    color: '#78716C',
    textAlign: 'center',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#181312',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalHeaderBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: '#2E2320',
    borderWidth: 1,
    borderColor: '#44403C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalCloseBtnText: {
    color: '#E7E5E4',
    fontSize: 12,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  modalErrorBox: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 10,
    padding: 12,
  },
  modalErrorText: {
    color: '#9F1239',
    fontSize: 12,
    fontWeight: '700',
  },
  workflowContainer: {
    gap: 14,
  },
  custodyChainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 8,
  },
  chainSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  chainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chainDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E7E5E4',
    paddingTop: 10,
    marginTop: 4,
  },
  chainLabel: {
    fontSize: 13,
    color: '#57534E',
    fontWeight: '600',
  },
  chainVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1917',
  },
  chainValMono: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chainValStaff: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  chainExpectedLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
  },
  chainExpectedVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#047857',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  speedBumpCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  speedBumpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  speedBumpTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
  },
  matchExactChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  matchExactChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  speedBumpInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mismatchAlertBox: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#F43F5E',
    borderRadius: 10,
    padding: 10,
  },
  mismatchAlertText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9F1239',
    lineHeight: 17,
  },
  ownerAuthBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 8,
  },
  ownerAuthTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78350F',
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1917',
  },
  ownerApproveBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerApproveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  revertFooterBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECDD3',
    gap: 8,
  },
  revertFooterHint: {
    fontSize: 12,
    color: '#57534E',
    fontWeight: '600',
  },
  revertFullBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },
  revertFullBtnText: {
    color: '#BE123C',
    fontSize: 13,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
  },
  methodSegmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodSegBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  methodSegBtnActive: {
    backgroundColor: '#181312',
    borderColor: '#181312',
  },
  methodSegBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
    textAlign: 'center',
  },
  methodSegBtnTextActive: {
    color: '#FBBF24',
  },
  directGcashBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  directGcashInfo: {
    fontSize: 12,
    color: '#0C4A6E',
    lineHeight: 18,
    fontWeight: '600',
  },
  hop1QrSection: {
    gap: 12,
  },
  qrTokenBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  qrTokenLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.6,
  },
  qrTokenCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrPollStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  signatureAlertCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  signatureExactCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  signatureDiscrepancyCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F43F5E',
  },
  signatureAlertHeader: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C1917',
  },
  signatureAlertSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9F1239',
  },
  hop1ActionButtonsRow: {
    gap: 8,
  },
  validateDrawerBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateDrawerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  rejectSigBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F43F5E',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectSigBtnText: {
    color: '#BE123C',
    fontSize: 13,
    fontWeight: '800',
  },
  overrideCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    overflow: 'hidden',
  },
  overrideToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
    backgroundColor: '#F5F5F4',
  },
  overrideToggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#292524',
    flex: 1,
  },
  overrideToggleArrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716C',
  },
  overrideBody: {
    padding: 14,
    gap: 10,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  btnPressed: {
    opacity: 0.75,
  },
});
