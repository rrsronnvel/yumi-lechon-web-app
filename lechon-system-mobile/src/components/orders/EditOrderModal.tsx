import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useCatalogCategories,
  useInventoryBalances,
  useDeliveryPricingQuery,
  useUpdateOrderMutation,
  ItemCategory,
} from '../../hooks/usePos';
import { OrderDetailsDto } from '../../hooks/useOrders';
import {
  calculateRiderDepartureTime,
  SOURCE_PILLS,
  EVENT_TYPE_PILLS,
  RIDER_DEPARTURE_NUDGE_PILLS,
} from '../../utils/messengerTemplates';

interface EditableCartItem {
  id: number; // Existing OrderItem.id or 0 for newly added
  itemCategoryId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  weightRange?: string;
  isRoast: boolean;
}

type CategoryFilterType = 'whole' | 'belly' | 'addon';

interface EditOrderModalProps {
  visible: boolean;
  order: OrderDetailsDto | null;
  onClose: () => void;
  onSaved?: () => void;
}

const formatLocalYMD = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatLocalHM = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function EditOrderModal({
  visible,
  order,
  onClose,
  onSaved,
}: EditOrderModalProps) {
  const { categories, isLoading: isCatalogLoading } = useCatalogCategories();
  const { data: balances = [] } = useInventoryBalances();
  const { data: deliveryPricing } = useDeliveryPricingQuery();
  const updateOrderMutation = useUpdateOrderMutation();

  const baseFare = deliveryPricing?.baseFare ?? 100;
  const ratePerKm = deliveryPricing?.ratePerKm ?? 15;

  const [customerName, setCustomerName] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [source, setSource] = useState('Business FB Page');
  const [eventType, setEventType] = useState('');
  const [fulfillment, setFulfillment] = useState<number>(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('11:30');
  const [riderDepartureTimeStr, setRiderDepartureTimeStr] = useState('11:15');
  const [remarks, setRemarks] = useState('');

  const [cartItems, setCartItems] = useState<EditableCartItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<CategoryFilterType | null>(null);

  const [distanceKm, setDistanceKm] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Hydrate state from order when modal opens
  useEffect(() => {
    if (!visible || !order) return;

    setValidationError(null);
    setCustomerName(order.customerName || '');
    setFacebookName(order.facebookName || '');
    setContactNumber(order.contactNumber || '');
    setSource(order.source || 'Business FB Page');
    setEventType(order.eventType || '');
    setFulfillment(Number(order.fulfillment ?? 1));
    setDeliveryAddress(order.deliveryAddress || '');
    setLandmark(order.landmark || '');
    setRemarks(order.remarks || '');
    setDeliveryFee(String(Number(order.deliveryFee || 0)));
    setDiscount(String(Number(order.discount || 0)));
    setDistanceKm('');
    setItemSearchQuery('');
    setActiveCategoryFilter(null);

    const parsedTarget = new Date(order.targetDeliveryTime);
    if (!isNaN(parsedTarget.getTime())) {
      setTargetDate(formatLocalYMD(parsedTarget));
      setTargetTime(formatLocalHM(parsedTarget));
    }

    if (order.riderDepartureTime) {
      const parsedDep = new Date(order.riderDepartureTime);
      if (!isNaN(parsedDep.getTime())) {
        setRiderDepartureTimeStr(formatLocalHM(parsedDep));
      } else if (!isNaN(parsedTarget.getTime())) {
        setRiderDepartureTimeStr(formatLocalHM(parsedTarget));
      }
    } else if (!isNaN(parsedTarget.getTime())) {
      const computedDep = calculateRiderDepartureTime(
        parsedTarget,
        0,
        Number(order.fulfillment ?? 1)
      );
      setRiderDepartureTimeStr(formatLocalHM(computedDep));
    }

    const mappedItems: EditableCartItem[] = (order.orderItems || []).map((item) => {
      const cat =
        item.itemCategory ||
        categories.find((c) => c.id === item.itemCategoryId);
      const minW = cat?.minimumWeightKg ?? 0;
      const maxW = cat?.maximumWeightKg ?? 0;
      const unitPrice =
        item.price > 0
          ? item.price
          : cat?.basePrice ??
            (item.quantity > 0 ? item.totalPrice / item.quantity : 0);

      return {
        id: item.id || 0,
        itemCategoryId: item.itemCategoryId,
        name: cat?.name || 'Lechon Item',
        unitPrice,
        quantity: item.quantity || 1,
        weightRange:
          minW > 0 ? `${minW.toFixed(1)}–${maxW.toFixed(1)} kg` : undefined,
        isRoast: minW > 0,
      };
    });

    setCartItems(mappedItems);
  }, [visible, order, categories]);

  const handleApplyNudgeOffset = (offsetMinutes: number) => {
    if (fulfillment === 0) return;
    const isoTarget = `${targetDate.trim()}T${targetTime.trim()}:00`;
    const parsedTarget = new Date(isoTarget);
    if (!isNaN(parsedTarget.getTime())) {
      const nudged = new Date(parsedTarget.getTime() + offsetMinutes * 60 * 1000);
      setRiderDepartureTimeStr(formatLocalHM(nudged));
    }
  };

  const handleSelectFulfillment = (mode: number) => {
    setFulfillment(mode);
    if (mode === 0 || mode === 2) {
      setDeliveryFee('0');
      setDistanceKm('0');
      if (mode === 0) {
        setRiderDepartureTimeStr(targetTime);
      }
    }
  };

  const handleDistanceChange = (val: string) => {
    setDistanceKm(val);
    if (fulfillment === 1) {
      if (val.trim() === '') {
        return;
      }
      const km = Math.max(0, parseFloat(val) || 0);
      const fee = km > 0 ? Math.round(km * ratePerKm + baseFare) : 0;
      setDeliveryFee(String(fee));

      const isoTarget = `${targetDate.trim()}T${targetTime.trim()}:00`;
      const parsedTarget = new Date(isoTarget);
      if (!isNaN(parsedTarget.getTime())) {
        const dep = calculateRiderDepartureTime(parsedTarget, km, fulfillment);
        setRiderDepartureTimeStr(formatLocalHM(dep));
      }
    }
  };

  // Stock Map
  const stockByCategoryId = useMemo(() => {
    const map: Record<number, { available: number; health: string }> = {};
    for (const b of balances) {
      map[b.categoryId] = {
        available: b.availableStock,
        health: b.healthStatus,
      };
    }
    return map;
  }, [balances]);

  const isWholeLechon = (cat: ItemCategory) =>
    cat.minimumWeightKg >= 13 && cat.isActive !== false;
  const isLechonBelly = (cat: ItemCategory) =>
    cat.minimumWeightKg > 0 && cat.minimumWeightKg < 13 && cat.isActive !== false;
  const isAddOn = (cat: ItemCategory) =>
    cat.minimumWeightKg === 0 && cat.isActive !== false;

  const wholeLechonCategories = useMemo(
    () => categories.filter(isWholeLechon),
    [categories]
  );
  const lechonBellyCategories = useMemo(
    () => categories.filter(isLechonBelly),
    [categories]
  );
  const addOnCategoriesList = useMemo(
    () => categories.filter(isAddOn),
    [categories]
  );

  const addItemToCart = (category: ItemCategory) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.itemCategoryId === category.id
      );
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: copy[existingIndex].quantity + 1,
        };
        return copy;
      }
      return [
        ...prev,
        {
          id: 0,
          itemCategoryId: category.id,
          name: category.name,
          unitPrice: category.basePrice,
          quantity: 1,
          weightRange:
            category.minimumWeightKg > 0
              ? `${category.minimumWeightKg.toFixed(1)}–${category.maximumWeightKg.toFixed(1)} kg`
              : undefined,
          isRoast: category.minimumWeightKg > 0,
        },
      ];
    });
  };

  const updateCartItemQuantity = (itemCategoryId: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.itemCategoryId === itemCategoryId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is EditableCartItem => item !== null)
    );
  };

  const removeCartItem = (itemCategoryId: number) => {
    setCartItems((prev) =>
      prev.filter((item) => item.itemCategoryId !== itemCategoryId)
    );
  };

  const searchSuggestions = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return categories
      .filter((cat) => {
        if (cat.isActive === false) return false;
        return (
          cat.name.toLowerCase().includes(query) ||
          (cat.minimumWeightKg > 0 &&
            `${cat.minimumWeightKg} ${cat.maximumWeightKg} kg`
              .toLowerCase()
              .includes(query))
        );
      })
      .slice(0, 5);
  }, [itemSearchQuery, categories]);

  const modalCategoryData = useMemo(() => {
    if (activeCategoryFilter === 'whole') {
      return {
        title: '🐖 Whole Lechon Sizes',
        subtitle: 'Charcoal-roasted whole carcass with crispy skin',
        items: wholeLechonCategories,
      };
    }
    if (activeCategoryFilter === 'belly') {
      return {
        title: '🥓 Lechon Belly Tiers',
        subtitle: 'Boneless rolled pork belly (kilogram tiers)',
        items: lechonBellyCategories,
      };
    }
    if (activeCategoryFilter === 'addon') {
      return {
        title: '🥫 Add-Ons & Extras',
        subtitle: 'Signature Sarsa, Dinuguan, and extras',
        items: addOnCategoriesList,
      };
    }
    return null;
  }, [
    activeCategoryFilter,
    wholeLechonCategories,
    lechonBellyCategories,
    addOnCategoriesList,
  ]);

  const { cartSubtotal, roastSubtotal, addOnsSummaryText } = useMemo(() => {
    let total = 0;
    let roastOnly = 0;
    const addOnLabels: string[] = [];

    for (const item of cartItems) {
      const lineTotal = item.unitPrice * item.quantity;
      total += lineTotal;
      if (item.isRoast) {
        roastOnly += lineTotal;
      } else {
        addOnLabels.push(`${item.quantity}x ${item.name}`);
      }
    }

    return {
      cartSubtotal: total,
      roastSubtotal: roastOnly,
      addOnsSummaryText: addOnLabels.join(', '),
    };
  }, [cartItems]);

  const lockedDownpayment = Number(order?.downpayment || 0);
  const effectiveDeliveryFee =
    fulfillment === 0 || fulfillment === 2
      ? 0
      : Math.max(0, parseFloat(deliveryFee) || 0);
  const effectiveDiscount = Math.max(0, parseFloat(discount) || 0);
  const grandTotal = Math.max(
    0,
    cartSubtotal + effectiveDeliveryFee - effectiveDiscount
  );
  const smartBalance = grandTotal - lockedDownpayment;

  const resolveRiderDepartureIso = (isoTargetTime: string): string => {
    if (fulfillment === 0) {
      return isoTargetTime;
    }
    const cleanTime = riderDepartureTimeStr.trim();
    const candidateIso = `${targetDate.trim()}T${cleanTime}:00`;
    const parsedCandidate = new Date(candidateIso);
    const parsedTarget = new Date(isoTargetTime);

    if (!isNaN(parsedCandidate.getTime())) {
      if (
        !isNaN(parsedTarget.getTime()) &&
        parsedCandidate.getTime() > parsedTarget.getTime()
      ) {
        const prevDay = new Date(parsedCandidate.getTime() - 24 * 60 * 60 * 1000);
        return `${formatLocalYMD(prevDay)}T${formatLocalHM(prevDay)}:00`;
      }
      return candidateIso;
    }
    return isoTargetTime;
  };

  const handleSaveChanges = async () => {
    if (!order) return;
    setValidationError(null);

    const trimmedName = customerName.trim();
    const trimmedPhone = contactNumber.trim();
    const trimmedAddress = deliveryAddress.trim();

    if (trimmedName.length < 2) {
      setValidationError('Customer Name must be at least 2 characters.');
      return;
    }
    if (trimmedPhone.length < 10) {
      setValidationError('Contact Number must be at least 10 digits.');
      return;
    }
    if ((fulfillment === 1 || fulfillment === 2) && !trimmedAddress) {
      setValidationError('Delivery / drop-off address is required.');
      return;
    }
    if (cartItems.length === 0) {
      setValidationError('Order must contain at least one item.');
      return;
    }

    const isoTargetTime = `${targetDate.trim()}T${targetTime.trim()}:00`;
    const parsedTarget = new Date(isoTargetTime);
    if (isNaN(parsedTarget.getTime())) {
      setValidationError('Invalid Date or Time format.');
      return;
    }

    const isoDepartureTime = resolveRiderDepartureIso(isoTargetTime);

    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        customerName: trimmedName,
        facebookName: facebookName.trim() || undefined,
        contactNumber: trimmedPhone,
        source: source || 'Business FB Page',
        eventType: eventType || undefined,
        deliveryAddress:
          trimmedAddress || (fulfillment === 0 ? 'Store Pickup' : ''),
        landmark: landmark.trim() || undefined,
        remarks: remarks.trim(),
        targetDeliveryTime: isoTargetTime,
        riderDepartureTime: isoDepartureTime,
        fulfillment,
        price: roastSubtotal > 0 ? roastSubtotal : cartSubtotal,
        addOns: addOnsSummaryText || undefined,
        deliveryFee: effectiveDeliveryFee,
        downpayment: lockedDownpayment,
        discount: effectiveDiscount,
        grandTotal,
        items: cartItems.map((i) => ({
          id: i.id,
          itemCategoryId: i.itemCategoryId,
          quantity: i.quantity,
        })),
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } | string };
        message?: string;
      };
      const msg =
        typeof axiosErr.response?.data === 'string'
          ? axiosErr.response.data
          : axiosErr.response?.data?.message ||
            axiosErr.message ||
            'Failed to update order.';
      setValidationError(msg);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Sticky Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerBadge}>
              ✏️ EDIT ORDER #{order?.orderReference || order?.id}
            </Text>
            <Text style={styles.headerSub}>
              Flexible Cart, Locked Cash • Recalculates kitchen clock
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕ Cancel</Text>
          </Pressable>
        </View>

        {validationError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {validationError}</Text>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Customer & Routing Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>👤 Customer &amp; Routing</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Customer Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Customer Full Name"
                placeholderTextColor="#A8A29E"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Facebook / Messenger Name</Text>
              <TextInput
                style={styles.textInput}
                value={facebookName}
                onChangeText={setFacebookName}
                placeholder="FB / Messenger Name (for chat lookup)"
                placeholderTextColor="#A8A29E"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Contact Number *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="phone-pad"
                value={contactNumber}
                onChangeText={setContactNumber}
                placeholder="09171234567"
                placeholderTextColor="#A8A29E"
              />
            </View>

            {/* Source Pills */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Booking Source</Text>
              <View style={styles.pillsWrapRow}>
                {SOURCE_PILLS.map((pill) => {
                  const active = source === pill;
                  return (
                    <Pressable
                      key={pill}
                      style={[
                        styles.metaSelectChip,
                        active && styles.metaSelectChipActive,
                      ]}
                      onPress={() => setSource(pill)}
                    >
                      <Text
                        style={[
                          styles.metaSelectChipText,
                          active && styles.metaSelectChipTextActive,
                        ]}
                      >
                        {pill}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* EventType Pills */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Event Type (Optional)</Text>
              <View style={styles.pillsWrapRow}>
                {EVENT_TYPE_PILLS.map((pill) => {
                  const active = eventType === pill.id;
                  return (
                    <Pressable
                      key={pill.id}
                      style={[
                        styles.metaSelectChip,
                        active && styles.metaSelectChipActive,
                      ]}
                      onPress={() => setEventType(active ? '' : pill.id)}
                    >
                      <Text
                        style={[
                          styles.metaSelectChipText,
                          active && styles.metaSelectChipTextActive,
                        ]}
                      >
                        {pill.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Fulfillment */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Fulfillment Mode</Text>
              <View style={styles.triModalRow}>
                <Pressable
                  style={[
                    styles.triSegment,
                    fulfillment === 1 && styles.triSegmentActive,
                  ]}
                  onPress={() => handleSelectFulfillment(1)}
                >
                  <Text
                    style={[
                      styles.triSegmentText,
                      fulfillment === 1 && styles.triSegmentTextActive,
                    ]}
                  >
                    🚗 Delivery
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.triSegment,
                    fulfillment === 0 && styles.triSegmentActive,
                  ]}
                  onPress={() => handleSelectFulfillment(0)}
                >
                  <Text
                    style={[
                      styles.triSegmentText,
                      fulfillment === 0 && styles.triSegmentTextActive,
                    ]}
                  >
                    🏪 Pickup
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.triSegment,
                    fulfillment === 2 && styles.triSegmentActive,
                  ]}
                  onPress={() => handleSelectFulfillment(2)}
                >
                  <Text
                    style={[
                      styles.triSegmentText,
                      fulfillment === 2 && styles.triSegmentTextActive,
                    ]}
                  >
                    📦 Lalamove
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Delivery Address</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                multiline
                numberOfLines={2}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Full delivery address"
                placeholderTextColor="#A8A29E"
              />
            </View>

            {/* Landmark */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Landmark / Rider Guide</Text>
              <TextInput
                style={styles.textInput}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="e.g., Tapat ng Shell, Dilaw na gate"
                placeholderTextColor="#A8A29E"
              />
            </View>

            {/* Target Date & Time */}
            <View style={[styles.twoColRow, { alignItems: 'flex-end', gap: 12 }]}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel} numberOfLines={1}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="2026-10-25"
                  placeholderTextColor="#A8A29E"
                />
              </View>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Target Time (HH:mm)</Text>
                <TextInput
                  style={styles.textInput}
                  value={targetTime}
                  onChangeText={setTargetTime}
                  placeholder="11:30"
                  placeholderTextColor="#A8A29E"
                />
              </View>
            </View>

            {/* Rider Departure Time & Nudge Pills */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                🛵 Rider Departure Time (Kitchen Anchor){' '}
                {fulfillment === 0 ? '(Pickup Locked)' : ''}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  fulfillment === 0 && styles.lockedInput,
                ]}
                editable={fulfillment !== 0}
                value={fulfillment === 0 ? targetTime : riderDepartureTimeStr}
                onChangeText={setRiderDepartureTimeStr}
                placeholder="11:00"
                placeholderTextColor="#A8A29E"
              />
              {fulfillment !== 0 && (
                <View style={styles.pillsWrapRow}>
                  {RIDER_DEPARTURE_NUDGE_PILLS.map((nudge) => (
                    <Pressable
                      key={nudge.label}
                      style={styles.nudgeChip}
                      onPress={() => handleApplyNudgeOffset(nudge.minutes)}
                    >
                      <Text style={styles.nudgeChipText}>{nudge.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Kitchen & Prep Instructions */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Kitchen &amp; Prep Instructions (e.g., Walang dinuguan, Print shoutout)
              </Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                multiline
                numberOfLines={2}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Kitchen & Prep Instructions (e.g., Walang dinuguan, Print shoutout)"
                placeholderTextColor="#A8A29E"
              />
            </View>
          </View>

          {/* Flexible Cart Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🛒 Flexible Order Cart</Text>

            <View style={styles.searchInputWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.itemSearchInput}
                placeholder="Search size or add-on..."
                placeholderTextColor="#A8A29E"
                value={itemSearchQuery}
                onChangeText={setItemSearchQuery}
              />
              {itemSearchQuery.trim().length > 0 && (
                <Pressable onPress={() => setItemSearchQuery('')}>
                  <Text style={styles.searchClearBtnText}>✕</Text>
                </Pressable>
              )}
            </View>

            {itemSearchQuery.trim().length > 0 && (
              <View style={styles.suggestionsCard}>
                {searchSuggestions.map((cat) => (
                  <View key={cat.id} style={styles.suggestionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionName}>
                        {cat.name} • ₱{cat.basePrice.toLocaleString()}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.suggestionAddBtn}
                      onPress={() => {
                        addItemToCart(cat);
                        setItemSearchQuery('');
                      }}
                    >
                      <Text style={styles.suggestionAddBtnText}>+ Add</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.categoryPillsRow}>
              <Pressable
                style={styles.categoryPill}
                onPress={() => setActiveCategoryFilter('whole')}
              >
                <Text style={styles.categoryPillLabel}>🐖 Whole Lechon</Text>
              </Pressable>
              <Pressable
                style={styles.categoryPill}
                onPress={() => setActiveCategoryFilter('belly')}
              >
                <Text style={styles.categoryPillLabel}>🥓 Lechon Belly</Text>
              </Pressable>
              <Pressable
                style={styles.categoryPill}
                onPress={() => setActiveCategoryFilter('addon')}
              >
                <Text style={styles.categoryPillLabel}>🥫 Add-Ons</Text>
              </Pressable>
            </View>

            {isCatalogLoading ? (
              <ActivityIndicator color="#C81E1E" size="small" />
            ) : (
              <View style={styles.activeCartList}>
                {cartItems.map((item) => (
                  <View key={item.itemCategoryId} style={styles.activeCartItemCard}>
                    <View style={styles.activeCartTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activeCartItemName}>{item.name}</Text>
                        <Text style={styles.activeCartUnitCaption}>
                          ₱{item.unitPrice.toLocaleString()} each
                        </Text>
                      </View>
                      <Text style={styles.activeCartLineTotal}>
                        ₱{(item.unitPrice * item.quantity).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.activeCartBottomRow}>
                      <View style={styles.stepperBox}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() =>
                            updateCartItemQuantity(item.itemCategoryId, -1)
                          }
                        >
                          <Text style={styles.stepperBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepperQtyText}>{item.quantity}</Text>
                        <Pressable
                          style={[styles.stepperBtn, styles.stepperBtnPlus]}
                          onPress={() =>
                            updateCartItemQuantity(item.itemCategoryId, 1)
                          }
                        >
                          <Text style={styles.stepperBtnPlusText}>+</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        style={styles.removeCartItemBtn}
                        onPress={() => removeCartItem(item.itemCategoryId)}
                      >
                        <Text style={styles.removeCartItemBtnText}>🗑️ Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Financials Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              💰 Financials (Locked Cash Rule)
            </Text>

            <View style={[styles.twoColRow, { alignItems: 'flex-end', gap: 12 }]}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  Delivery Fee (₱) {fulfillment !== 1 ? '(Locked)' : ''}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    fulfillment !== 1 && styles.lockedInput,
                  ]}
                  editable={fulfillment === 1}
                  keyboardType="numeric"
                  value={fulfillment === 1 ? deliveryFee : '0'}
                  onChangeText={setDeliveryFee}
                />
              </View>

              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  Est. Distance (KM)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    fulfillment !== 1 && styles.lockedInput,
                  ]}
                  editable={fulfillment === 1}
                  keyboardType="numeric"
                  placeholder="e.g., 5"
                  placeholderTextColor="#A8A29E"
                  value={fulfillment === 1 ? distanceKm : '0'}
                  onChangeText={handleDistanceChange}
                />
              </View>
            </View>

            {fulfillment === 1 && (
              <Text style={{ fontSize: 11, color: '#78716C', marginTop: 4, marginBottom: 4, marginLeft: 2 }}>
                Rate: ₱{baseFare} base + ₱{ratePerKm}/km
              </Text>
            )}

            <View style={[styles.twoColRow, { alignItems: 'flex-end', gap: 12, marginTop: 4 }]}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel} numberOfLines={1}>Courtesy Discount (₱)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#A8A29E"
                  value={discount}
                  onChangeText={setDiscount}
                />
              </View>

              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  🔒 Downpayment (Locked)
                </Text>
                <TextInput
                  style={[styles.textInput, styles.lockedInput]}
                  editable={false}
                  value={`₱${lockedDownpayment.toLocaleString()}`}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Footer */}
        <View style={styles.stickyFooter}>
          <View style={styles.footerTopRow}>
            <Text style={styles.footerStatText}>
              Grand Total: ₱{grandTotal.toLocaleString()}
            </Text>
            <Text
              style={[
                styles.footerBalanceText,
                smartBalance < 0
                  ? styles.refundText
                  : smartBalance === 0
                  ? styles.settledText
                  : styles.dueText,
              ]}
            >
              {smartBalance < 0
                ? `⚠️ Refund Due: ₱${Math.abs(smartBalance).toLocaleString()}`
                : `Balance Due: ₱${smartBalance.toLocaleString()}`}
            </Text>
          </View>

          <Pressable
            style={[
              styles.saveBtn,
              updateOrderMutation.isPending && styles.disabledBtn,
            ]}
            disabled={updateOrderMutation.isPending}
            onPress={handleSaveChanges}
          >
            {updateOrderMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Save Order Changes</Text>
            )}
          </Pressable>
        </View>

        {/* Category Sheet Modal */}
        <Modal
          visible={Boolean(activeCategoryFilter)}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveCategoryFilter(null)}
        >
          <View style={styles.sheetModalBackdrop}>
            <View style={styles.sheetModalContainer}>
              <View style={styles.sheetModalHeader}>
                <Text style={styles.sheetModalTitle}>
                  {modalCategoryData?.title}
                </Text>
                <Pressable onPress={() => setActiveCategoryFilter(null)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 340, marginVertical: 10 }}>
                {modalCategoryData?.items.map((cat) => {
                  const inCart = cartItems.find(
                    (i) => i.itemCategoryId === cat.id
                  );
                  const avail = stockByCategoryId[cat.id]?.available ?? 0;
                  return (
                    <View key={cat.id} style={styles.sheetItemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activeCartItemName}>{cat.name}</Text>
                        <Text style={styles.activeCartUnitCaption}>
                          ₱{cat.basePrice.toLocaleString()} • {avail} avail
                        </Text>
                      </View>
                      <Pressable
                        style={styles.suggestionAddBtn}
                        onPress={() => addItemToCart(cat)}
                      >
                        <Text style={styles.suggestionAddBtnText}>
                          {inCart ? `+ Add (${inCart.quantity})` : '+ Add'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
              <Pressable
                style={styles.saveBtn}
                onPress={() => setActiveCategoryFilter(null)}
              >
                <Text style={styles.saveBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181312',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBadge: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FBBF24',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerSub: {
    fontSize: 11,
    color: '#A8A29E',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#2E2320',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#E7E5E4',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FFE4E6',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDA4AF',
  },
  errorBannerText: {
    color: '#9F1239',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
  },
  textInput: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1917',
  },
  lockedInput: {
    backgroundColor: '#E7E5E4',
    color: '#78716C',
  },
  multilineInput: {
    minHeight: 54,
    textAlignVertical: 'top',
  },
  pillsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaSelectChip: {
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaSelectChipActive: {
    backgroundColor: '#181312',
    borderColor: '#181312',
  },
  metaSelectChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  metaSelectChipTextActive: {
    color: '#FBBF24',
  },
  nudgeChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  nudgeChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  triModalRow: {
    flexDirection: 'row',
    gap: 8,
  },
  triSegment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    alignItems: 'center',
  },
  triSegmentActive: {
    backgroundColor: '#181312',
    borderColor: '#181312',
  },
  triSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#57534E',
  },
  triSegmentTextActive: {
    color: '#FBBF24',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
    gap: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  itemSearchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1C1917',
  },
  searchClearBtnText: {
    fontSize: 13,
    color: '#78716C',
    fontWeight: '800',
    padding: 4,
  },
  suggestionsCard: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 6,
    gap: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1917',
  },
  suggestionAddBtn: {
    backgroundColor: '#181312',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  suggestionAddBtnText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    flex: 1,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  categoryPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  activeCartList: {
    gap: 8,
  },
  activeCartItemCard: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  activeCartTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeCartItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
  },
  activeCartUnitCaption: {
    fontSize: 11,
    color: '#78716C',
  },
  activeCartLineTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C81E1E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activeCartBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E7E5E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnPlus: {
    backgroundColor: '#181312',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
  },
  stepperBtnPlusText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FBBF24',
  },
  stepperQtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
    minWidth: 18,
    textAlign: 'center',
  },
  removeCartItemBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  removeCartItemBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D6D3D1',
    padding: 14,
    gap: 8,
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerStatText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
  },
  footerBalanceText: {
    fontSize: 14,
    fontWeight: '800',
  },
  dueText: {
    color: '#DC2626',
  },
  settledText: {
    color: '#047857',
  },
  refundText: {
    color: '#D97706',
  },
  saveBtn: {
    backgroundColor: '#C81E1E',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  sheetModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 19, 18, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  sheetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
  },
  sheetModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
  },
  sheetItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F4',
  },
});
