import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  useOrderDetails,
  useOrderAuditLogs,
  useRecordManualPaymentMutation,
  useCancelOrderMutation,
  OrderDirectoryDto,
} from '../../hooks/useOrders';
import { generateBookingConfirmation } from '../../utils/messengerTemplates';
import EditOrderModal from './EditOrderModal';

interface OrderDossierModalProps {
  orderId: number | null;
  fallbackOrder?: OrderDirectoryDto | null;
  onClose: () => void;
}

const PRESET_CANCEL_REASONS = [
  'Customer Change of Mind',
  'Event Postponed',
  'Weather / Flooded Access',
];

const PAYMENT_METHODS: Array<{ label: string; value: 'GCash' | 'Cash' | 'BankTransfer' }> = [
  { label: '📱 GCash', value: 'GCash' },
  { label: '💵 Cash', value: 'Cash' },
  { label: '🏦 BankTransfer', value: 'BankTransfer' },
];

export default function OrderDossierModal({
  orderId,
  fallbackOrder,
  onClose,
}: OrderDossierModalProps) {
  const {
    data: orderDetails,
    isLoading: isDetailsLoading,
    isError: isDetailsError,
    refetch: refetchDetails,
  } = useOrderDetails(orderId);

  const { data: auditLogs, isLoading: isAuditLoading } = useOrderAuditLogs(orderId);

  const paymentMutation = useRecordManualPaymentMutation();
  const cancelMutation = useCancelOrderMutation();

  // Clipboard banner state
  const [copiedBannerVisible, setCopiedBannerVisible] = useState(false);

  // Edit Order Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Payment logger form state
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'GCash' | 'Cash' | 'BankTransfer'>('GCash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Cancellation gate state
  const [isCancelExpanded, setIsCancelExpanded] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    setCopiedBannerVisible(false);
    setIsEditModalOpen(false);
    setIsPaymentExpanded(false);
    setPaymentAmount('');
    setPaymentMethod('GCash');
    setReferenceNumber('');
    setPaymentFeedback(null);
    setIsCancelExpanded(false);
    setCancelReason('');
    setCancelError(null);
  }, [orderId]);

  const activeOrder = orderDetails || fallbackOrder;
  const isVisible = orderId !== null;

  const displayOrderRef =
    orderDetails?.orderReference ||
    fallbackOrder?.orderReference ||
    activeOrder?.id ||
    orderId;

  const computedBalanceDue = orderDetails
    ? Number(
        orderDetails.balanceDue ??
          Math.max(0, Number(orderDetails.grandTotal || 0) - Number(orderDetails.downpayment || 0))
      )
    : Number(fallbackOrder?.balanceDue || 0);

  const isCancelled = Boolean(orderDetails?.isCancelled ?? fallbackOrder?.isCancelled);
  const routingStatus = (
    orderDetails?.routingStatus ||
    fallbackOrder?.routingStatus ||
    'Unassigned'
  ).trim();

  const handleCallNumber = async (phone?: string | null) => {
    const cleanPhone = (phone || '').trim();
    if (!cleanPhone) {
      Alert.alert('No Phone Number', 'No contact number is on file for this record.');
      return;
    }
    const url = `tel:${cleanPhone}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Dialer Error', `Could not launch phone dialer for ${cleanPhone}.`);
    }
  };

  const handleCopyReceipt = async () => {
    if (!orderDetails && !fallbackOrder) return;

    const target = orderDetails;
    const text = generateBookingConfirmation({
      orderNumber: displayOrderRef ?? undefined,
      customerName: target?.customerName || fallbackOrder?.customerName || 'Customer',
      targetDeliveryTime:
        target?.targetDeliveryTime || fallbackOrder?.targetDeliveryTime || new Date().toISOString(),
      fulfillment: Number(target?.fulfillment ?? fallbackOrder?.fulfillment ?? 1),
      deliveryAddress: target?.deliveryAddress ?? fallbackOrder?.deliveryAddress ?? '',
      landmark: target?.landmark ?? fallbackOrder?.landmark ?? null,
      items: (target?.orderItems || []).map((item) => ({
        categoryName: item.itemCategory?.name || 'Lechon Size',
        quantity: item.quantity || 1,
      })),
      subtotal: Number(target?.price ?? fallbackOrder?.grandTotal ?? 0),
      deliveryFee: Number(target?.deliveryFee ?? 0),
      grandTotal: Number(target?.grandTotal ?? fallbackOrder?.grandTotal ?? 0),
      downpayment: Number(target?.downpayment ?? fallbackOrder?.downpayment ?? 0),
      balanceDue: computedBalanceDue,
      remarks: target?.remarks || '',
    });

    await Clipboard.setStringAsync(text);
    setCopiedBannerVisible(true);
    setTimeout(() => {
      setCopiedBannerVisible(false);
    }, 3000);
  };

  const handleSavePayment = async () => {
    if (!orderId) return;
    setPaymentFeedback(null);

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setPaymentFeedback({
        type: 'error',
        message: 'Please enter a valid payment amount greater than ₱0.',
      });
      return;
    }

    try {
      await paymentMutation.mutateAsync({
        orderId,
        amount: parsedAmount,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      setPaymentFeedback({
        type: 'success',
        message: `₱${parsedAmount.toLocaleString()} (${paymentMethod}) logged to ledger!`,
      });
      setPaymentAmount('');
      setReferenceNumber('');
      setIsPaymentExpanded(false);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; error?: string } | string };
      };
      const msg =
        typeof axiosErr.response?.data === 'string'
          ? axiosErr.response.data
          : axiosErr.response?.data?.message ||
            axiosErr.response?.data?.error ||
            'Failed to record payment. Please verify input and try again.';
      setPaymentFeedback({
        type: 'error',
        message: msg,
      });
    }
  };

  const handleConfirmCancel = async () => {
    if (!orderId) return;
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelError('Please select a preset reason or enter custom cancellation notes.');
      return;
    }

    setCancelError(null);
    try {
      await cancelMutation.mutateAsync({
        id: orderId,
        reason: trimmedReason,
      });
      setIsCancelExpanded(false);
      setCancelReason('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } | string } };
      const msg =
        typeof axiosErr.response?.data === 'string'
          ? axiosErr.response.data
          : axiosErr.response?.data?.message || 'Failed to cancel order.';
      setCancelError(msg);
    }
  };

  const renderStatusBadge = () => {
    if (isCancelled) {
      return (
        <View style={[styles.statusBadge, styles.statusCancelled]}>
          <Text style={styles.statusCancelledText}>🛑 Cancelled</Text>
        </View>
      );
    }
    if (routingStatus === 'Delivered') {
      return (
        <View style={[styles.statusBadge, styles.statusDelivered]}>
          <Text style={styles.statusDeliveredText}>🟢 Delivered</Text>
        </View>
      );
    }
    if (routingStatus === 'Assigned') {
      return (
        <View style={[styles.statusBadge, styles.statusAssigned]}>
          <Text style={styles.statusAssignedText}>🛵 Assigned</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusUnassigned]}>
        <Text style={styles.statusUnassignedText}>⚪ Unassigned</Text>
      </View>
    );
  };

  const formatFullSchedule = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const fulfillmentCode = Number(orderDetails?.fulfillment ?? fallbackOrder?.fulfillment ?? 1);
  const fulfillmentLabel =
    fulfillmentCode === 0
      ? '🏪 Walk-in Store Pickup'
      : fulfillmentCode === 2
      ? '📦 Lalamove Courier'
      : '🚗 Freelance Delivery';

  const calculatedAddOnsAmount = orderDetails
    ? Math.max(
        0,
        Number(orderDetails.grandTotal || 0) -
          Number(orderDetails.price || 0) -
          Number(orderDetails.deliveryFee || 0) +
          Number(orderDetails.discount || 0)
      )
    : 0;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Sticky Dossier Header */}
        <View style={styles.stickyHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTopRow}>
              <Text style={styles.orderIdText}>#{displayOrderRef}</Text>
              {(orderDetails?.isTrustedCustomer || fallbackOrder?.isTrustedCustomer) && (
                <View style={styles.vipBadge}>
                  <Text style={styles.vipBadgeText}>👑 VIP</Text>
                </View>
              )}
              {renderStatusBadge()}
            </View>
            <Text style={styles.customerNameTitle} numberOfLines={1}>
              {activeOrder?.customerName || 'Customer Dossier'}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕ Close</Text>
          </Pressable>
        </View>

        {/* Quick-Action Bar (3-Second Customer Service Actions) */}
        <View style={styles.quickActionBar}>
          <Pressable
            style={({ pressed }) => [
              styles.quickActionBtn,
              styles.callCustomerBtn,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              handleCallNumber(orderDetails?.contactNumber || fallbackOrder?.contactNumber)
            }
          >
            <Text style={styles.callCustomerBtnText}>
              📞 Call ({activeOrder?.contactNumber || 'N/A'})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.quickActionBtn,
              styles.copyReceiptBtn,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleCopyReceipt}
          >
            <Text style={styles.copyReceiptBtnText}>📋 Copy Receipt</Text>
          </Pressable>

          {!isCancelled && routingStatus !== 'Delivered' && orderDetails && (
            <Pressable
              style={({ pressed }) => [
                styles.quickActionBtn,
                styles.editOrderBtn,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setIsEditModalOpen(true)}
            >
              <Text style={styles.editOrderBtnText}>✏️ Edit Order</Text>
            </Pressable>
          )}
        </View>

        {/* Copied Confirmation Banner */}
        {copiedBannerVisible && (
          <View style={styles.copiedBanner}>
            <Text style={styles.copiedBannerText}>
              ✅ Copied to clipboard! Ready to paste into Facebook Messenger.
            </Text>
          </View>
        )}

        {/* Payment Feedback Banner */}
        {paymentFeedback && (
          <View
            style={[
              styles.feedbackBanner,
              paymentFeedback.type === 'success'
                ? styles.feedbackSuccess
                : styles.feedbackError,
            ]}
          >
            <Text
              style={
                paymentFeedback.type === 'success'
                  ? styles.feedbackSuccessText
                  : styles.feedbackErrorText
              }
            >
              {paymentFeedback.type === 'success' ? '✅ ' : '⚠️ '}
              {paymentFeedback.message}
            </Text>
          </View>
        )}

        {isDetailsLoading && !orderDetails ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C81E1E" />
            <Text style={styles.loadingText}>Pulling customer dossier from vault...</Text>
          </View>
        ) : isDetailsError && !orderDetails ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Failed to load full order details.</Text>
            <Pressable style={styles.retryBtn} onPress={() => refetchDetails()}>
              <Text style={styles.retryBtnText}>Retry Fetch</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cancelled Notice if applicable */}
            {isCancelled && (
              <View style={styles.cancelledAlertBox}>
                <Text style={styles.cancelledAlertTitle}>🛑 BOOKING VOIDED / CANCELLED</Text>
                <Text style={styles.cancelledAlertReason}>
                  Reason:{' '}
                  {orderDetails?.cancellationReason ||
                    fallbackOrder?.cancellationReason ||
                    'No cancellation reason recorded.'}
                </Text>
              </View>
            )}

            {/* Card 1: Logistics & Courier Attribution Card */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>🚚 Logistics &amp; Courier Attribution</Text>

              <View style={styles.infoGrid}>
                {(orderDetails?.facebookName || fallbackOrder?.facebookName) && (
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>FB / Messenger Name</Text>
                    <Text style={styles.infoValue}>
                      💬 {orderDetails?.facebookName || fallbackOrder?.facebookName}
                    </Text>
                  </View>
                )}

                <View style={styles.metaBadgeRow}>
                  {Boolean(orderDetails?.source || fallbackOrder?.source) && (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>
                        📌 Source: {orderDetails?.source || fallbackOrder?.source}
                      </Text>
                    </View>
                  )}
                  {Boolean(orderDetails?.eventType || fallbackOrder?.eventType) && (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>
                        🎉 Event: {orderDetails?.eventType || fallbackOrder?.eventType}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Target Delivery Date &amp; Time</Text>
                  <Text style={styles.infoValueHighlight}>
                    {formatFullSchedule(
                      orderDetails?.targetDeliveryTime || fallbackOrder?.targetDeliveryTime
                    )}
                  </Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>🛵 Rider Departure Time (Kitchen Anchor)</Text>
                  <Text style={styles.infoValue}>
                    {formatFullSchedule(
                      orderDetails?.riderDepartureTime ||
                        fallbackOrder?.riderDepartureTime ||
                        orderDetails?.targetDeliveryTime ||
                        fallbackOrder?.targetDeliveryTime
                    )}
                  </Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Fulfillment Mode</Text>
                  <Text style={styles.infoValue}>{fulfillmentLabel}</Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Full Delivery Address</Text>
                  <Text style={styles.infoValue}>
                    {(orderDetails?.deliveryAddress || fallbackOrder?.deliveryAddress || '').trim() ||
                      'None Provided (Store Counter Handover)'}
                  </Text>
                </View>

                {Boolean(orderDetails?.landmark || fallbackOrder?.landmark) && (
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>🧭 Landmark / Rider Guide</Text>
                    <Text style={styles.infoValueHighlight}>
                      {orderDetails?.landmark || fallbackOrder?.landmark}
                    </Text>
                  </View>
                )}

                {Boolean(orderDetails?.remarks) && (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>📝 KITCHEN &amp; PREP INSTRUCTIONS</Text>
                    <Text style={styles.remarksText}>{orderDetails?.remarks}</Text>
                  </View>
                )}
              </View>

              {/* Dynamic Courier Attribution Box */}
              <View style={styles.courierSection}>
                <Text style={styles.courierHeading}>COURIER / HANDOVER STATUS</Text>

                {fulfillmentCode === 1 ? (
                  <View style={styles.courierBoxDelivery}>
                    <View style={styles.courierBoxMain}>
                      <Text style={styles.courierPrimaryText}>
                        {orderDetails?.assignedRiderName
                          ? `🛵 ${orderDetails.assignedRiderName}`
                          : '⚪ Pending Rider Assignment'}
                      </Text>
                      <Text style={styles.courierSecondaryText}>
                        {orderDetails?.assignedRiderPhone
                          ? `Phone: ${orderDetails.assignedRiderPhone}`
                          : 'Freelance Motorcycle Delivery Fleet'}
                      </Text>
                    </View>

                    {orderDetails?.assignedRiderPhone ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.callRiderBtn,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => handleCallNumber(orderDetails.assignedRiderPhone)}
                      >
                        <Text style={styles.callRiderBtnText}>📞 Call Rider</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.courierPillNeutral}>
                        <Text style={styles.courierPillNeutralText}>
                          {orderDetails?.assignedRiderName ? routingStatus : 'Unassigned'}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : fulfillmentCode === 2 ? (
                  <View style={styles.courierBoxLalamove}>
                    <View style={styles.courierBoxMain}>
                      <Text style={styles.courierPrimaryText}>
                        📦 Customer-Booked Lalamove
                      </Text>
                      <Text style={styles.courierSecondaryText}>
                        Third-Party App Handover Gate
                      </Text>
                    </View>
                    {computedBalanceDue <= 0 ? (
                      <View style={styles.clearanceBadgeCleared}>
                        <Text style={styles.clearanceTextCleared}>🟢 Cleared for Release</Text>
                      </View>
                    ) : (
                      <View style={styles.clearanceBadgeHold}>
                        <Text style={styles.clearanceTextHold}>🛑 Hold - Unpaid Balance</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.courierBoxPickup}>
                    <View style={styles.courierBoxMain}>
                      <Text style={styles.courierPrimaryText}>🏪 Walk-in Store Pickup</Text>
                      <Text style={styles.courierSecondaryText}>
                        Direct Counter Collection
                      </Text>
                    </View>
                    <View style={styles.clearanceBadgeCleared}>
                      <Text style={styles.clearanceTextCleared}>Ready at Counter</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Card 2: Order Items & Financial Breakdown Card */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>🧾 Order Items &amp; Financial Breakdown</Text>

              {/* Itemized List */}
              <View style={styles.itemsList}>
                {orderDetails?.orderItems && orderDetails.orderItems.length > 0 ? (
                  orderDetails.orderItems.map((item, idx) => {
                    const lineTotal =
                      item.totalPrice > 0
                        ? item.totalPrice
                        : orderDetails.orderItems.length === 1
                        ? Number(orderDetails.price || 0)
                        : item.price * item.quantity;

                    return (
                      <View key={item.id || idx} style={styles.itemRow}>
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemQtyBadge}>{item.quantity}x</Text>
                          <Text style={styles.itemName}>
                            {item.itemCategory?.name || 'Lechon Roast'}
                          </Text>
                        </View>
                        <Text style={styles.itemTotal}>
                          {lineTotal > 0 ? `₱${lineTotal.toLocaleString()}` : 'Included'}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.itemRow}>
                    <Text style={styles.itemName}>Lechon Reservation Items</Text>
                    <Text style={styles.itemTotal}>
                      ₱{Number(orderDetails?.price ?? fallbackOrder?.grandTotal ?? 0).toLocaleString()}
                    </Text>
                  </View>
                )}

                {Boolean(orderDetails?.addOns) && (
                  <View style={styles.addOnsBox}>
                    <Text style={styles.addOnsLabel}>ADD-ONS / EXTRAS</Text>
                    <Text style={styles.addOnsValue}>{orderDetails?.addOns}</Text>
                  </View>
                )}
              </View>

              {/* Financial Ledger Summary */}
              <View style={styles.ledgerContainer}>
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerLabel}>Subtotal (Lechon)</Text>
                  <Text style={styles.ledgerValue}>
                    ₱{Number(orderDetails?.price ?? fallbackOrder?.grandTotal ?? 0).toLocaleString()}
                  </Text>
                </View>

                {calculatedAddOnsAmount > 0 && (
                  <View style={styles.ledgerRow}>
                    <Text style={styles.ledgerLabel}>Add-Ons Total</Text>
                    <Text style={styles.ledgerValue}>
                      ₱{calculatedAddOnsAmount.toLocaleString()}
                    </Text>
                  </View>
                )}

                {Number(orderDetails?.discount || 0) > 0 && (
                  <View style={styles.ledgerRow}>
                    <Text style={styles.ledgerDiscountLabel}>Courtesy Discount</Text>
                    <Text style={styles.ledgerDiscountValue}>
                      - ₱{Number(orderDetails?.discount || 0).toLocaleString()}
                    </Text>
                  </View>
                )}

                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerLabel}>Delivery Fee</Text>
                  <Text style={styles.ledgerValue}>
                    ₱{Number(orderDetails?.deliveryFee || 0).toLocaleString()}
                  </Text>
                </View>

                <View style={[styles.ledgerRow, styles.ledgerDivider]}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>
                    ₱
                    {Number(
                      orderDetails?.grandTotal ?? fallbackOrder?.grandTotal ?? 0
                    ).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.ledgerRow}>
                  <Text style={styles.downpaymentLabel}>Downpayment / Total Paid</Text>
                  <Text style={styles.downpaymentValue}>
                    - ₱
                    {Number(
                      orderDetails?.downpayment ?? fallbackOrder?.downpayment ?? 0
                    ).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.balanceHighlightBox}>
                  <Text style={styles.balanceHighlightLabel}>Remaining Balance Due</Text>
                  <Text
                    style={[
                      styles.balanceHighlightValue,
                      computedBalanceDue <= 0
                        ? styles.balanceZeroText
                        : styles.balancePositiveText,
                    ]}
                  >
                    {computedBalanceDue <= 0
                      ? '🟢 ₱0 (Paid in Full)'
                      : `🔴 ₱${computedBalanceDue.toLocaleString()}`}
                  </Text>
                </View>
              </View>

              {/* In-Dossier Quick Payment Logger */}
              {computedBalanceDue > 0 && !isCancelled && (
                <View style={styles.paymentLoggerSection}>
                  {!isPaymentExpanded ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.expandPaymentBtn,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        setPaymentFeedback(null);
                        setIsPaymentExpanded(true);
                      }}
                    >
                      <Text style={styles.expandPaymentBtnText}>💵 + Record Payment</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.paymentFormBox}>
                      <View style={styles.paymentFormHeader}>
                        <Text style={styles.paymentFormTitle}>Log Customer Payment</Text>
                        <Pressable onPress={() => setIsPaymentExpanded(false)}>
                          <Text style={styles.paymentFormCancelLink}>Cancel</Text>
                        </Pressable>
                      </View>

                      {/* Amount Input + 1-Tap Full Balance Chip */}
                      <View style={styles.paymentFieldGroup}>
                        <View style={styles.amountHeaderRow}>
                          <Text style={styles.fieldLabel}>Amount Received (₱)</Text>
                          <Pressable
                            style={styles.fullBalanceChip}
                            onPress={() => setPaymentAmount(String(computedBalanceDue))}
                          >
                            <Text style={styles.fullBalanceChipText}>
                              Full Balance: ₱{computedBalanceDue.toLocaleString()}
                            </Text>
                          </Pressable>
                        </View>
                        <TextInput
                          style={styles.formTextInput}
                          placeholder="Enter amount (e.g. 3500)"
                          placeholderTextColor="#A8A29E"
                          keyboardType="numeric"
                          value={paymentAmount}
                          onChangeText={setPaymentAmount}
                        />
                      </View>

                      {/* Payment Method Segmented Selector */}
                      <View style={styles.paymentFieldGroup}>
                        <Text style={styles.fieldLabel}>Payment Method</Text>
                        <View style={styles.segmentedRow}>
                          {PAYMENT_METHODS.map((m) => {
                            const active = paymentMethod === m.value;
                            return (
                              <Pressable
                                key={m.value}
                                style={[
                                  styles.segmentBtn,
                                  active && styles.segmentBtnActive,
                                ]}
                                onPress={() => setPaymentMethod(m.value)}
                              >
                                <Text
                                  style={[
                                    styles.segmentBtnText,
                                    active && styles.segmentBtnTextActive,
                                  ]}
                                >
                                  {m.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* Reference Number / Notes Input */}
                      <View style={styles.paymentFieldGroup}>
                        <Text style={styles.fieldLabel}>Reference Number / Notes</Text>
                        <TextInput
                          style={styles.formTextInput}
                          placeholder="GCash Ref # or receipt note (optional)"
                          placeholderTextColor="#A8A29E"
                          value={referenceNumber}
                          onChangeText={setReferenceNumber}
                        />
                      </View>

                      <Pressable
                        style={({ pressed }) => [
                          styles.savePaymentBtn,
                          paymentMutation.isPending && styles.disabledBtn,
                          pressed && styles.buttonPressed,
                        ]}
                        disabled={paymentMutation.isPending}
                        onPress={handleSavePayment}
                      >
                        {paymentMutation.isPending ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.savePaymentBtnText}>✅ Save Payment</Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Card 3: Immutable Activity History (Black Box Audit Log) */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>
                🛡️ Activity History (Black Box Audit Log)
              </Text>

              {isAuditLoading ? (
                <View style={styles.auditLoadingBox}>
                  <ActivityIndicator size="small" color="#78716C" />
                  <Text style={styles.auditEmptyText}>Loading audit timeline...</Text>
                </View>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <Text style={styles.auditEmptyText}>
                  No manual modifications logged. Order is in its original state.
                </Text>
              ) : (
                <View style={styles.auditList}>
                  {auditLogs.map((log) => (
                    <View key={log.id} style={styles.auditItem}>
                      <View style={styles.auditItemHeader}>
                        <View style={styles.auditUserBadge}>
                          <Text style={styles.auditUserBadgeText}>
                            👤 {log.changedBy || 'Staff'}
                          </Text>
                        </View>
                        <Text style={styles.auditTimestamp}>
                          {formatFullSchedule(log.timestamp)}
                        </Text>
                      </View>
                      <Text style={styles.auditDescription}>
                        {log.changeDescription || log.changes || log.actionType}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Card 4: Protected Order Cancellation Gate */}
            {!isCancelled && routingStatus !== 'Delivered' && (
              <View style={styles.cancelSection}>
                {!isCancelExpanded ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.triggerCancelBtn,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      setCancelError(null);
                      setIsCancelExpanded(true);
                    }}
                  >
                    <Text style={styles.triggerCancelBtnText}>🚫 Cancel Order</Text>
                  </Pressable>
                ) : (
                  <View style={styles.cancelConfirmBox}>
                    <View style={styles.cancelConfirmHeader}>
                      <Text style={styles.cancelConfirmTitle}>
                        🚫 Void &amp; Cancel Order #{displayOrderRef}?
                      </Text>
                      <Pressable onPress={() => setIsCancelExpanded(false)}>
                        <Text style={styles.cancelKeepText}>Keep Order</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.cancelWarningSubtext}>
                      Cancelling immediately releases reserved carcass stock back into sellable inventory and records your username in the Black Box audit log.
                    </Text>

                    {cancelError && (
                      <View style={styles.cancelErrorBox}>
                        <Text style={styles.cancelErrorText}>⚠️ {cancelError}</Text>
                      </View>
                    )}

                    <Text style={styles.presetChipHeading}>SELECT PRESET REASON:</Text>
                    <View style={styles.presetChipsWrap}>
                      {PRESET_CANCEL_REASONS.map((preset) => {
                        const selected = cancelReason === preset;
                        return (
                          <Pressable
                            key={preset}
                            style={[
                              styles.reasonChip,
                              selected && styles.reasonChipSelected,
                            ]}
                            onPress={() => setCancelReason(preset)}
                          >
                            <Text
                              style={[
                                styles.reasonChipText,
                                selected && styles.reasonChipTextSelected,
                              ]}
                            >
                              {preset}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>Cancellation Reason / Remarks *</Text>
                    <TextInput
                      style={[styles.formTextInput, styles.cancelTextInput]}
                      placeholder="Enter or customize mandatory cancellation reason..."
                      placeholderTextColor="#A8A29E"
                      multiline
                      numberOfLines={3}
                      value={cancelReason}
                      onChangeText={setCancelReason}
                    />

                    <Pressable
                      style={({ pressed }) => [
                        styles.confirmCancelBtn,
                        (cancelMutation.isPending || !cancelReason.trim()) &&
                          styles.disabledBtn,
                        pressed && styles.buttonPressed,
                      ]}
                      disabled={cancelMutation.isPending || !cancelReason.trim()}
                      onPress={handleConfirmCancel}
                    >
                      {cancelMutation.isPending ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.confirmCancelBtnText}>
                          Confirm Cancellation
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Edit Order Modal */}
        <EditOrderModal
          visible={isEditModalOpen}
          order={orderDetails || null}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={() => {
            void refetchDetails();
            setPaymentFeedback({
              type: 'success',
              message: 'Order updated and kitchen schedule synchronized!',
            });
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181312',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2320',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FBBF24',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  vipBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusUnassigned: {
    backgroundColor: '#F5F5F4',
    borderColor: '#D6D3D1',
  },
  statusUnassignedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#44403C',
  },
  statusAssigned: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  statusAssignedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  statusDelivered: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  statusDeliveredText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  statusCancelled: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FDA4AF',
  },
  statusCancelledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#BE123C',
  },
  customerNameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: '#2E2320',
    borderWidth: 1,
    borderColor: '#44403C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#E7E5E4',
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  callCustomerBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  callCustomerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  copyReceiptBtn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  copyReceiptBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  editOrderBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  editOrderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  copiedBanner: {
    backgroundColor: '#065F46',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  copiedBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: '#D1FAE5',
    borderBottomColor: '#6EE7B7',
  },
  feedbackError: {
    backgroundColor: '#FFE4E6',
    borderBottomColor: '#FDA4AF',
  },
  feedbackSuccessText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackErrorText: {
    color: '#9F1239',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#57534E',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#BE123C',
    fontWeight: '600',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#C81E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  cancelledAlertBox: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    padding: 14,
  },
  cancelledAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9F1239',
    marginBottom: 4,
  },
  cancelledAlertReason: {
    fontSize: 13,
    fontWeight: '600',
    color: '#881337',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F4',
  },
  infoGrid: {
    gap: 10,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  infoBlock: {
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78716C',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1917',
  },
  infoValueHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  remarksBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  remarksLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 3,
  },
  remarksText: {
    fontSize: 13,
    color: '#292524',
    fontWeight: '500',
  },
  courierSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
  },
  courierHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  courierBoxDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 12,
  },
  courierBoxLalamove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  courierBoxPickup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 12,
  },
  courierBoxMain: {
    flex: 1,
    marginRight: 8,
  },
  courierPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1917',
  },
  courierSecondaryText: {
    fontSize: 11,
    color: '#57534E',
    marginTop: 2,
  },
  callRiderBtn: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  callRiderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  courierPillNeutral: {
    backgroundColor: '#E7E5E4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courierPillNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  clearanceBadgeCleared: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearanceTextCleared: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  clearanceBadgeHold: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearanceTextHold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9F1239',
  },
  itemsList: {
    gap: 8,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#F5F5F4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemQtyBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C81E1E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1917',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addOnsBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  addOnsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  addOnsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#451A03',
  },
  ledgerContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E7E5E4',
    paddingTop: 12,
    gap: 6,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
    paddingTop: 8,
    marginTop: 4,
  },
  ledgerLabel: {
    fontSize: 13,
    color: '#57534E',
  },
  ledgerValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#292524',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ledgerDiscountLabel: {
    fontSize: 13,
    color: '#E11D48',
  },
  ledgerDiscountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11D48',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  downpaymentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  downpaymentValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  balanceHighlightLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
  },
  balanceHighlightValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  balanceZeroText: {
    color: '#047857',
  },
  balancePositiveText: {
    color: '#DC2626',
  },
  paymentLoggerSection: {
    marginTop: 14,
  },
  expandPaymentBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandPaymentBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  paymentFormBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  paymentFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentFormTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  paymentFormCancelLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#57534E',
  },
  paymentFieldGroup: {
    gap: 6,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#292524',
  },
  fullBalanceChip: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#34D399',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fullBalanceChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  formTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1917',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  savePaymentBtn: {
    backgroundColor: '#059669',
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  savePaymentBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  auditLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  auditEmptyText: {
    fontSize: 13,
    color: '#78716C',
    fontStyle: 'italic',
  },
  auditList: {
    gap: 10,
  },
  auditItem: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 10,
  },
  auditItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  auditUserBadge: {
    backgroundColor: '#E7E5E4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  auditUserBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#292524',
  },
  auditTimestamp: {
    fontSize: 11,
    color: '#78716C',
  },
  auditDescription: {
    fontSize: 13,
    color: '#1C1917',
    fontWeight: '500',
    lineHeight: 18,
  },
  cancelSection: {
    marginTop: 4,
  },
  triggerCancelBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  triggerCancelBtnText: {
    color: '#BE123C',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelConfirmBox: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cancelConfirmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelConfirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9F1239',
  },
  cancelKeepText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#57534E',
  },
  cancelWarningSubtext: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 17,
  },
  cancelErrorBox: {
    backgroundColor: '#FFE4E6',
    borderRadius: 8,
    padding: 8,
  },
  cancelErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9F1239',
  },
  presetChipHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9F1239',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  presetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reasonChipSelected: {
    backgroundColor: '#BE123C',
    borderColor: '#BE123C',
  },
  reasonChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#881337',
  },
  reasonChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelTextInput: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  confirmCancelBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmCancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
