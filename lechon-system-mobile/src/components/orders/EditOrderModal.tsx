import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useCatalogCategories,
  useInventoryBalances,
  useDeliveryPricingQuery,
  useUpdateOrderMutation,
  useCustomerLookupQuery,
  ItemCategory,
} from '../../hooks/usePos';
import { OrderDetailsDto } from '../../hooks/useOrders';
import { useAuth } from '../../context/AuthContext';
import {
  calculateRiderDepartureTime,
  SOURCE_PILLS,
  EVENT_TYPE_PILLS,
  RIDER_DEPARTURE_NUDGE_PILLS,
} from '../../utils/messengerTemplates';
import FreebiesSelector from './FreebiesSelector';
import { evaluateDuplicateOrders, formatCalendarDateLabel } from '../../utils/similarityHelper';
import { normalizeDateInput } from '../../utils/dateNormalizer';
import PaymentChannelPills from './PaymentChannelPills';
import {
  FreebiesConfig,
  createDefaultFreebiesConfig,
  formatFreebiesSummary,
  getPigsWithFreebies,
  parseFreebiesConfig,
  updatePigsWithFreebies,
} from '../../utils/freebiesHelper';

interface EditableCartItem {
  id: number; // Existing OrderItem.id or 0 for newly added
  itemCategoryId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  weightRange?: string;
  isRoast: boolean;
  minimumWeightKg: number;
}

type CategoryFilterType = 'whole' | 'belly' | 'addon';

const TIME_PRESET_CHIPS = [
  { label: '9:00 AM', time: '09:00', period: 'AM' as const },
  { label: '10:30 AM', time: '10:30', period: 'AM' as const },
  { label: '11:30 AM', time: '11:30', period: 'AM' as const },
  { label: '12:00 PM', time: '12:00', period: 'PM' as const },
  { label: '3:00 PM', time: '03:00', period: 'PM' as const },
];

type Meridiem = 'AM' | 'PM';

const to12HourParts = (time24: string): { time: string; period: Meridiem } => {
  const [rawHours = '0', rawMinutes = '00'] = time24.split(':');
  const hours = Number(rawHours) || 0;
  return {
    time: `${String(hours % 12 || 12).padStart(2, '0')}:${rawMinutes.slice(0, 2).padStart(2, '0')}`,
    period: hours >= 12 ? 'PM' : 'AM',
  };
};

const to24HourTime = (time12: string, period: Meridiem): string | null => {
  const match = time12.trim().match(/^(0?[1-9]|1[0-2]):([0-5]\d)$/);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (period === 'PM') hours += 12;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
};

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
  // auth

  visible,
  order,
  onClose,
  onSaved,
}: EditOrderModalProps) {
  const { user } = useAuth();
  const { categories, isLoading: isCatalogLoading } = useCatalogCategories();
  const { data: balances = [] } = useInventoryBalances();
  const { data: deliveryPricing } = useDeliveryPricingQuery();
  const updateOrderMutation = useUpdateOrderMutation();

  const baseFare = deliveryPricing?.baseFare ?? 100;
  const ratePerKm = deliveryPricing?.ratePerKm ?? 15;
  const noFreebiesDiscountPerPig =
    deliveryPricing?.noFreebiesDiscountPerPig ?? 2000;

  const [customerName, setCustomerName] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactNumber2, setContactNumber2] = useState('');
  const [showContactNumber2, setShowContactNumber2] = useState(false);
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [debouncedFbName, setDebouncedFbName] = useState('');
  const [source, setSource] = useState('Business FB Page');
  const [eventType, setEventType] = useState('');
  const [fulfillment, setFulfillment] = useState<number>(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('11:30');
  const [targetPeriod, setTargetPeriod] = useState<Meridiem>('AM');
  const [riderDepartureTimeStr, setRiderDepartureTimeStr] = useState('11:15');
  const [riderDeparturePeriod, setRiderDeparturePeriod] = useState<Meridiem>('AM');
  const [remarks, setRemarks] = useState('');

  const [cartItems, setCartItems] = useState<EditableCartItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<CategoryFilterType | null>(null);

  const [distanceKm, setDistanceKm] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [downpaymentMethod, setDownpaymentMethod] = useState('None');
  const [freebiesConfig, setFreebiesConfig] = useState<FreebiesConfig>(() =>
    createDefaultFreebiesConfig(0)
  );
  const freebiesDiscountApplied = useRef(0);
  const previousWholePigCount = useRef(0);
  const pendingHydratedWholePigCount = useRef<number | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [isTimeTbd, setIsTimeTbd] = useState(false);
  const [isNonLechonMode, setIsNonLechonMode] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPhone(contactNumber.trim());
      setDebouncedFbName(facebookName.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [contactNumber, facebookName]);

  const { data: customerProfile } = useCustomerLookupQuery(
    debouncedPhone,
    debouncedFbName
  );

  const duplicateEvaluation = useMemo(() => {
    const targetTime24 = to24HourTime(targetTime, targetPeriod);
    const isoDate = targetDate && targetTime24 ? `${targetDate.trim()}T${targetTime24}:00` : targetDate;
    return evaluateDuplicateOrders(
      {
        orderId: order?.id,
        orderReference: order?.orderReference,
        customerName,
        facebookName,
        contactNumber,
        contactNumber2,
        deliveryAddress,
        targetDate: isoDate,
      },
      customerProfile?.activeUpcomingOrders,
    );
  }, [
    order?.id,
    order?.orderReference,
    customerName,
    facebookName,
    contactNumber,
    contactNumber2,
    deliveryAddress,
    targetDate,
    targetTime,
    targetPeriod,
    customerProfile?.activeUpcomingOrders,
  ]);

  const activeDuplicateOrders = duplicateEvaluation.duplicates;

  const repeatCustomerBooking = duplicateEvaluation.repeatCustomerMatches[0];

  // Hydrate state from order when modal opens
  useEffect(() => {
    if (!visible || !order) return;

    setValidationError(null);
    setIsDraft(order.isDraft ?? false);
    setIsTimeTbd(order.isTimeTbd ?? false);
    setCustomerName(order.customerName || '');
    setFacebookName(order.facebookName || '');
    const hydratedPhones = (order.contactNumber || '')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
    setContactNumber(hydratedPhones[0] || '');
    setContactNumber2(hydratedPhones[1] || '');
    setShowContactNumber2(Boolean(hydratedPhones[1]));
    setSource(order.source || 'Business FB Page');
    setEventType(order.eventType || '');
    setFulfillment(Number(order.fulfillment ?? 1));
    setDeliveryAddress(order.deliveryAddress || '');
    setLandmark(order.landmark || '');
    setRemarks(order.remarks || '');
    setDeliveryFee(String(Number(order.deliveryFee || 0)));
    setDiscount(String(Number(order.discount || 0)));
    setDownpaymentMethod(
      Number(order.downpayment || 0) > 0
        ? order.downpaymentMethod || 'GCash'
        : 'None'
    );
    setDistanceKm('');
    setItemSearchQuery('');
    setActiveCategoryFilter(null);
    setRiderDepartureTimeStr('11:15');
    setRiderDeparturePeriod('AM');

    if (order.targetDeliveryTime) {
      const parsedTarget = new Date(order.targetDeliveryTime);
      if (!isNaN(parsedTarget.getTime())) {
        setTargetDate(formatLocalYMD(parsedTarget));
        const targetParts = to12HourParts(formatLocalHM(parsedTarget));
        setTargetTime(targetParts.time);
        setTargetPeriod(targetParts.period);
      } else {
        setTargetDate('');
        setTargetTime('11:30');
        setTargetPeriod('AM');
      }
    } else {
      setTargetDate('');
      setTargetTime('11:30');
      setTargetPeriod('AM');
    }

    if (order.riderDepartureTime) {
      const parsedDep = new Date(order.riderDepartureTime);
      if (!isNaN(parsedDep.getTime())) {
        const departureParts = to12HourParts(formatLocalHM(parsedDep));
        setRiderDepartureTimeStr(departureParts.time);
        setRiderDeparturePeriod(departureParts.period);
      } else if (order.targetDeliveryTime) {
        const parsedTarget = new Date(order.targetDeliveryTime);
        if (!isNaN(parsedTarget.getTime())) {
          const departureParts = to12HourParts(formatLocalHM(parsedTarget));
          setRiderDepartureTimeStr(departureParts.time);
          setRiderDeparturePeriod(departureParts.period);
        }
      }
    } else if (order.targetDeliveryTime) {
      const parsedTarget = new Date(order.targetDeliveryTime);
      if (!isNaN(parsedTarget.getTime())) {
        const computedDep = calculateRiderDepartureTime(
          parsedTarget,
          0,
          Number(order.fulfillment ?? 1)
        );
        const departureParts = to12HourParts(formatLocalHM(computedDep));
        setRiderDepartureTimeStr(departureParts.time);
        setRiderDeparturePeriod(departureParts.period);
      }
    }

    const mappedItems: EditableCartItem[] = (order.orderItems || []).flatMap(
      (item) => {
        const itemCategoryId = Number(
          item.itemCategoryId ?? item.itemCategory?.id
        );
        const quantity = Number(item.quantity);
        const cat =
          item.itemCategory ||
          categories.find((c) => c.id === itemCategoryId);

        if (
          !Number.isInteger(itemCategoryId) ||
          itemCategoryId <= 0 ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !cat
        ) {
          return [];
        }

        const minW = cat.minimumWeightKg ?? 0;
        const maxW = cat.maximumWeightKg ?? 0;
        const unitPrice =
          item.price > 0
            ? item.price
            : cat.basePrice ??
              (quantity > 0 ? item.totalPrice / quantity : 0);

        return [
          {
            id: item.id || 0,
            itemCategoryId,
            name: cat.name,
            unitPrice,
            quantity,
            weightRange:
              minW > 0
                ? `${minW.toFixed(1)}–${maxW.toFixed(1)} kg`
                : undefined,
            isRoast: minW > 0,
            minimumWeightKg: minW,
          },
        ];
      }
    );

    const mappedWholePigCount = mappedItems
      .filter((item) => item.minimumWeightKg >= 13)
      .reduce((sum, item) => sum + item.quantity, 0);
    let mappedFreebiesConfig = parseFreebiesConfig(
      order.freebiesConfigJson,
      mappedWholePigCount
    );
    if (
      !order.freebiesConfigJson &&
      String(order.freebiesSummary || '')
        .toLowerCase()
        .includes('no freebies')
    ) {
      mappedFreebiesConfig = updatePigsWithFreebies(
        mappedFreebiesConfig,
        mappedWholePigCount,
        0
      );
    }
    previousWholePigCount.current = mappedWholePigCount;
    pendingHydratedWholePigCount.current = mappedWholePigCount;
    freebiesDiscountApplied.current =
      (mappedWholePigCount -
        getPigsWithFreebies(mappedFreebiesConfig, mappedWholePigCount)) *
      noFreebiesDiscountPerPig;
    setFreebiesConfig(mappedFreebiesConfig);
    setCartItems(mappedItems);
    setIsNonLechonMode(
      mappedItems.length > 0 && mappedItems.every((item) => item.minimumWeightKg === 0)
    );
  }, [visible, order, categories, noFreebiesDiscountPerPig]);

  const handleApplyNudgeOffset = (offsetMinutes: number) => {
    if (fulfillment === 0 || isTimeTbd) return;
    const targetTime24 = to24HourTime(targetTime, targetPeriod);
    if (!targetTime24) return;
    const isoTarget = `${targetDate.trim()}T${targetTime24}:00`;
    const parsedTarget = new Date(isoTarget);
    if (!isNaN(parsedTarget.getTime())) {
      const nudged = new Date(parsedTarget.getTime() + offsetMinutes * 60 * 1000);
      const departureParts = to12HourParts(formatLocalHM(nudged));
      setRiderDepartureTimeStr(departureParts.time);
      setRiderDeparturePeriod(departureParts.period);
    }
  };

  const handleSelectFulfillment = (mode: number) => {
    setFulfillment(mode);
    if (mode === 0 || mode === 2) {
      setDeliveryFee('0');
      setDistanceKm('0');
      if (mode === 0) {
        setRiderDepartureTimeStr(targetTime);
        setRiderDeparturePeriod(targetPeriod);
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

      const targetTime24 = to24HourTime(targetTime, targetPeriod);
      if (!targetTime24) return;
      const isoTarget = `${targetDate.trim()}T${targetTime24}:00`;
      const parsedTarget = new Date(isoTarget);
      if (!isNaN(parsedTarget.getTime())) {
        const dep = calculateRiderDepartureTime(parsedTarget, km, fulfillment);
        const departureParts = to12HourParts(formatLocalHM(dep));
        setRiderDepartureTimeStr(departureParts.time);
        setRiderDeparturePeriod(departureParts.period);
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
    if (isNonLechonMode && category.minimumWeightKg > 0) return;
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
          minimumWeightKg: category.minimumWeightKg,
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
        if (isNonLechonMode && cat.minimumWeightKg > 0) return false;
        return (
          cat.name.toLowerCase().includes(query) ||
          (cat.minimumWeightKg > 0 &&
            `${cat.minimumWeightKg} ${cat.maximumWeightKg} kg`
              .toLowerCase()
              .includes(query))
        );
      })
      .slice(0, 5);
  }, [itemSearchQuery, categories, isNonLechonMode]);

  useEffect(() => {
    if (!isNonLechonMode) return;
    setCartItems((items) => items.filter((item) => item.minimumWeightKg === 0));
    setEventType('');
    setActiveCategoryFilter('addon');
    setFreebiesConfig(createDefaultFreebiesConfig(0));
    previousWholePigCount.current = 0;
    pendingHydratedWholePigCount.current = null;
  }, [isNonLechonMode]);

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

  const wholeLechonCount = useMemo(
    () =>
      cartItems
        .filter((item) => item.minimumWeightKg >= 13)
        .reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  useEffect(() => {
    if (pendingHydratedWholePigCount.current !== null) {
      if (wholeLechonCount === pendingHydratedWholePigCount.current) {
        pendingHydratedWholePigCount.current = null;
      }
      return;
    }

    const wholePigCountChanged =
      previousWholePigCount.current !== wholeLechonCount;

    let nextConfig = freebiesConfig;
    if (wholePigCountChanged) {
      const previousPigsWithFreebies = getPigsWithFreebies(
        freebiesConfig,
        previousWholePigCount.current
      );
      const nextPigsWithFreebies = freebiesConfig.optOut
        ? 0
        : previousPigsWithFreebies +
          (wholeLechonCount - previousWholePigCount.current);
      nextConfig = updatePigsWithFreebies(
        freebiesConfig,
        wholeLechonCount,
        nextPigsWithFreebies
      );
      setFreebiesConfig(nextConfig);
    }

    const pigsWithDiscount = nextConfig.optOut
      ? wholeLechonCount
      : Math.max(
          0,
          wholeLechonCount -
            (nextConfig.pigsWithFreebies ?? wholeLechonCount)
        );
    const nextFreebiesDiscount =
      pigsWithDiscount * (noFreebiesDiscountPerPig || 2000);
    const previousFreebiesDiscount = freebiesDiscountApplied.current;

    if (nextFreebiesDiscount !== previousFreebiesDiscount) {
      setDiscount((currentDiscount) =>
        String(
          Math.max(
            0,
            (parseFloat(currentDiscount) || 0) -
              previousFreebiesDiscount +
              nextFreebiesDiscount
          )
        )
      );
      freebiesDiscountApplied.current = nextFreebiesDiscount;
    }

    previousWholePigCount.current = wholeLechonCount;
  }, [freebiesConfig, wholeLechonCount, noFreebiesDiscountPerPig]);

  const handleFreebiesChange = (nextConfig: FreebiesConfig) => {
    setFreebiesConfig(nextConfig);
  };

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
    const cleanTime = to24HourTime(riderDepartureTimeStr, riderDeparturePeriod);
    if (!cleanTime) return isoTargetTime;
    const candidateIso = `${normalizeDateInput(targetDate)}T${cleanTime}:00`;
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

  const wasDraft = Boolean(order?.isDraft);
  const isEffectiveDraft = isDraft || isTimeTbd;
  const isFinalizing = wasDraft && !isEffectiveDraft;

  const handleSaveChanges = async () => {
    if (!order) return;
    setValidationError(null);

    const validCartItems = cartItems.filter(
      (item) =>
        Number.isInteger(item.itemCategoryId) &&
        item.itemCategoryId > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );

    const trimmedName = customerName.trim();
    const trimmedFbName = facebookName.trim();
    const trimmedPhone = contactNumber.trim();
    const trimmedPhone2 = contactNumber2.trim();
    const combinedContactNumber = trimmedPhone2
      ? `${trimmedPhone},${trimmedPhone2}`
      : trimmedPhone;
    const trimmedAddress = deliveryAddress.trim();

    if (isEffectiveDraft) {
      if (!trimmedName && !trimmedFbName) {
        setValidationError(
          'Customer Name or Facebook Name is required for a draft inquiry.'
        );
        return;
      }
    } else {
      if (trimmedName.length < 2) {
        setValidationError('Customer Name must be at least 2 characters.');
        return;
      }
      if (trimmedPhone.replace(/\D/g, '').length < 10) {
        setValidationError('Mobile Number (CP #1) must be at least 10 digits.');
        return;
      }
      if (trimmedPhone2 && trimmedPhone2.replace(/\D/g, '').length < 10) {
        setValidationError(
          'Secondary Mobile Number (CP #2) must be at least 10 digits.'
        );
        return;
      }
      if ((fulfillment === 1 || fulfillment === 2) && !trimmedAddress) {
        setValidationError('Delivery / drop-off address is required.');
        return;
      }
      if (validCartItems.length === 0) {
        setValidationError('Order must contain at least one item.');
        return;
      }
    }

    let isoTargetTime: string | null = null;
    let isoDepartureTime: string | null = null;

    const targetTime24 = isTimeTbd
      ? '12:00'
      : to24HourTime(targetTime, targetPeriod);
    const normalizedTargetDate = normalizeDateInput(targetDate);
    if (normalizedTargetDate && targetTime24) {
      const candidateIso = `${normalizedTargetDate}T${targetTime24}:00`;
      const parsedTarget = new Date(candidateIso);
      if (!isNaN(parsedTarget.getTime())) {
        isoTargetTime = candidateIso;
        isoDepartureTime = isTimeTbd || isNonLechonMode
          ? null
          : resolveRiderDepartureIso(candidateIso);
      } else if (!isEffectiveDraft) {
        setValidationError('Invalid Date or Time format.');
        return;
      }
    } else if (!isEffectiveDraft || isTimeTbd) {
      setValidationError(
        isTimeTbd
          ? 'Select the event date before saving a Time TBD order.'
          : 'Target Delivery Date and Time are required to finalize/lock this order.'
      );
      return;
    }

    const resolvedAddress =
      trimmedAddress || (fulfillment === 0 ? 'Store Pickup' : '');

    const sameDayDuplicate = activeDuplicateOrders.find((d) => d.isSameDay);

    if (!isEffectiveDraft && sameDayDuplicate) {
      const shouldContinue = await new Promise<boolean>((resolve) => {
        Alert.alert(
          '🚨 Same-Day Duplicate Warning',
          `Order #${sameDayDuplicate.order.orderReference} is already booked for this customer on the same date (${sameDayDuplicate.matchingFactors.join(', ')}). Save these changes anyway?`,
          [
            { text: 'Go Back', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Save Anyway',
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      });
      if (!shouldContinue) return;
    }

    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        isDraft: isEffectiveDraft,
        isTimeTbd,
        customerName: trimmedName || trimmedFbName,
        facebookName: trimmedFbName || undefined,
        contactNumber: combinedContactNumber,
        source: source || 'Business FB Page',
        eventType: isNonLechonMode ? undefined : eventType || undefined,
        deliveryAddress: resolvedAddress || undefined,
        landmark: landmark.trim() || undefined,
        remarks: remarks.trim(),
        targetDeliveryTime: isoTargetTime,
        riderDepartureTime: isoDepartureTime,
        fulfillment,
        price: isNonLechonMode ? cartSubtotal : roastSubtotal > 0 ? roastSubtotal : cartSubtotal,
        addOns: addOnsSummaryText || undefined,
        deliveryFee: effectiveDeliveryFee,
        downpayment: lockedDownpayment,
        downpaymentMethod,
        freebiesSummary: isNonLechonMode
          ? undefined
          : formatFreebiesSummary(
              freebiesConfig,
              wholeLechonCount,
              noFreebiesDiscountPerPig
            ),
        freebiesConfigJson: isNonLechonMode || wholeLechonCount === 0
          ? undefined
          : JSON.stringify(freebiesConfig),
        discount: effectiveDiscount,
        grandTotal,
        items: validCartItems.map((i) => ({
          id: i.id,
          itemCategoryId: i.itemCategoryId,
          quantity: i.quantity,
        })),
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; title?: string } | string };
        message?: string;
      };
      const msg =
        typeof axiosErr.response?.data === 'string'
          ? axiosErr.response.data
          : axiosErr.response?.data?.message ||
            axiosErr.response?.data?.title ||
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

        {activeDuplicateOrders.length > 0 && (
          <View style={styles.duplicateWarningBanner}>
            <Text style={styles.duplicateWarningTitle}>
              🚨 POSSIBLE DUPLICATE ORDER DETECTED!
            </Text>
            {activeDuplicateOrders.slice(0, 3).map((duplicate) => (
              <View key={duplicate.order.orderId} style={{ marginTop: 4 }}>
                <Text style={styles.duplicateWarningText}>
                  {duplicate.order.customerName || customerName || 'This customer'} already
                  has {duplicate.order.orderReference} for{' '}
                  {duplicate.order.targetDeliveryTime
                    ? new Date(duplicate.order.targetDeliveryTime).toLocaleDateString(
                        'en-PH',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )
                    : 'an upcoming date'}{' '}
                  ({duplicate.order.itemsSummary}) encoded by {duplicate.order.createdBy}.
                </Text>
                <Text style={styles.duplicateCriteriaText}>
                  Matched criteria: {duplicate.matchingFactors.join(' • ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Draft Mode Toggle Card */}
          {repeatCustomerBooking && (
            <View style={styles.activeRepeatCustomerPill}>
              <Text style={styles.activeRepeatCustomerPillText}>
                ⭐ Repeat Customer • Active booking on{' '}
                {formatCalendarDateLabel(
                  repeatCustomerBooking.order.targetDeliveryDate ??
                    repeatCustomerBooking.order.targetDeliveryTime,
                )}
              </Text>
            </View>
          )}

          <View style={[styles.draftCard, isEffectiveDraft && styles.draftCardActive]}>
            <View style={styles.draftCardHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.draftCardTitle}>
                  📝 Tentative Draft Inquiry (No Fixed Date/DP)
                </Text>
                <Text style={styles.draftCardSub}>
                  {isFinalizing
                    ? 'Turning OFF draft mode will finalize and lock this order into kitchen production'
                    : 'Pause kitchen clocks & freezer stock locks for tentative inquiries'}
                </Text>
              </View>
              <Switch
                value={isDraft}
                onValueChange={setIsDraft}
                disabled={isTimeTbd}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={isEffectiveDraft ? '#7C3AED' : '#9CA3AF'}
              />
            </View>
            {isDraft && (
              <View style={styles.draftInfoCallout}>
                <Text style={styles.draftInfoCalloutText}>
                  Draft Mode Active: Kitchen schedules and freezer stock locks are paused. Date, venue, and pig size can be left blank until confirmed.
                </Text>
              </View>
            )}

          </View>

          <View style={styles.modeCard}>
            <Text style={styles.fieldLabel}>Order Mode</Text>
            <View style={styles.triModalRow}>
              <Pressable
                style={[styles.triSegment, !isNonLechonMode && styles.triSegmentActive]}
                onPress={() => setIsNonLechonMode(false)}
              >
                <Text style={[styles.triSegmentText, !isNonLechonMode && styles.triSegmentTextActive]}>
                  🐷 Whole / Belly Lechon
                </Text>
              </Pressable>
              <Pressable
                style={[styles.triSegment, isNonLechonMode && styles.triSegmentActive]}
                onPress={() => setIsNonLechonMode(true)}
              >
                <Text style={[styles.triSegmentText, isNonLechonMode && styles.triSegmentTextActive]}>
                  🍲 Non-Lechon / Extras Only
                </Text>
              </Pressable>
            </View>
          </View>

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
              <View style={styles.contactLabelRow}>
                <Text style={styles.fieldLabel}>Mobile Number (CP #1) *</Text>
                {!showContactNumber2 && (
                  <Pressable
                    style={styles.addContactButton}
                    onPress={() => setShowContactNumber2(true)}
                  >
                    <Text style={styles.addContactButtonText}>+ Add CP #2</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.textInput}
                keyboardType="phone-pad"
                value={contactNumber}
                onChangeText={setContactNumber}
                placeholder="09171234567"
                placeholderTextColor="#A8A29E"
              />
              {showContactNumber2 && (
                <View style={styles.secondaryContactWrap}>
                  <View style={styles.contactLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Secondary Mobile Number (CP #2)
                    </Text>
                    <Pressable
                      style={styles.removeContactButton}
                      onPress={() => {
                        setContactNumber2('');
                        setShowContactNumber2(false);
                      }}
                    >
                      <Text style={styles.removeContactButtonText}>✕</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="phone-pad"
                    value={contactNumber2}
                    onChangeText={setContactNumber2}
                    placeholder="09481234567"
                    placeholderTextColor="#A8A29E"
                  />
                </View>
              )}
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
            {!isNonLechonMode && <View style={styles.fieldGroup}>
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
            </View>}

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
            <View style={styles.scheduleHeaderRow}>
              <Text style={styles.fieldLabel}>Target Date &amp; Time</Text>
              <View style={styles.timeTbdToggle}>
                <Text style={styles.timeTbdToggleText}>🕒 Time TBD</Text>
                <Switch
                  value={isTimeTbd}
                  onValueChange={(value) => {
                    setIsTimeTbd(value);
                    if (value) {
                      setIsDraft(true);
                      setRiderDepartureTimeStr('');
                    }
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                  thumbColor={isTimeTbd ? '#FFFBEB' : '#FAFAF9'}
                />
              </View>
            </View>
            <View style={[styles.twoColRow, { alignItems: 'flex-start', gap: 12 }]}>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel} numberOfLines={1}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={targetDate}
                  onChangeText={setTargetDate}
                  onEndEditing={() => setTargetDate(normalizeDateInput(targetDate))}
                  placeholder="2026-10-25"
                  placeholderTextColor="#A8A29E"
                />
              </View>
              <View style={styles.colHalf}>
                <Text style={styles.fieldLabel}>Target Time (hh:mm)</Text>
                <View style={styles.riderTimeRow}>
                  <TextInput
                    style={[styles.textInput, styles.riderTimeInput, isTimeTbd && styles.lockedInput]}
                    editable={!isTimeTbd}
                    value={isTimeTbd ? '' : targetTime}
                    onChangeText={setTargetTime}
                    placeholder={isTimeTbd ? 'TBD' : '11:30'}
                    placeholderTextColor="#A8A29E"
                  />
                  {!isTimeTbd && <View style={styles.meridiemRow}>
                    {(['AM', 'PM'] as Meridiem[]).map((period) => (
                      <Pressable
                        key={period}
                        style={[styles.meridiemButton, targetPeriod === period && styles.meridiemButtonActive]}
                        onPress={() => setTargetPeriod(period)}
                      >
                        <Text style={[styles.meridiemButtonText, targetPeriod === period && styles.meridiemButtonTextActive]}>{period}</Text>
                      </Pressable>
                    ))}
                  </View>}
                </View>
              </View>
            </View>
            {!isTimeTbd && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timePresetRow}>
              {TIME_PRESET_CHIPS.map((slot) => {
                const active = targetTime === slot.time && targetPeriod === slot.period;
                return (
                  <Pressable
                    key={slot.label}
                    style={[styles.timeSlotChip, active && styles.timeSlotChipActive]}
                    onPress={() => {
                      setTargetTime(slot.time);
                      setTargetPeriod(slot.period);
                      if (fulfillment === 1 && targetDate.trim()) {
                        const targetTime24 = to24HourTime(slot.time, slot.period);
                        if (targetTime24) {
                          const parsedTarget = new Date(`${targetDate.trim()}T${targetTime24}:00`);
                          if (!isNaN(parsedTarget.getTime())) {
                            const km = parseFloat(distanceKm) || 0;
                            const dep = calculateRiderDepartureTime(parsedTarget, km, fulfillment);
                            const departureParts = to12HourParts(formatLocalHM(dep));
                            setRiderDepartureTimeStr(departureParts.time);
                            setRiderDeparturePeriod(departureParts.period);
                          }
                        }
                      }
                    }}
                  >
                    <Text style={[styles.timeSlotChipText, active && styles.timeSlotChipTextActive]}>{slot.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>}

            {/* Rider Departure Time & Nudge Pills */}
            {!isNonLechonMode && <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                🛵 Rider Departure Time (Kitchen Anchor){' '}
                {fulfillment === 0 ? '(Pickup Locked)' : ''}
              </Text>
              <View style={styles.riderTimeRow}>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.riderTimeInput,
                    (fulfillment === 0 || isTimeTbd) && styles.lockedInput,
                  ]}
                  editable={fulfillment !== 0 && !isTimeTbd}
                  value={isTimeTbd ? '' : fulfillment === 0 ? targetTime : riderDepartureTimeStr}
                  onChangeText={setRiderDepartureTimeStr}
                  placeholder={isTimeTbd ? 'TBD' : '11:00'}
                  placeholderTextColor="#A8A29E"
                />
                {!isTimeTbd && <View style={styles.meridiemRow}>
                  {(['AM', 'PM'] as Meridiem[]).map((period) => {
                    const activePeriod = fulfillment === 0 ? targetPeriod : riderDeparturePeriod;
                    return (
                      <Pressable
                        key={period}
                        disabled={fulfillment === 0}
                        style={[styles.meridiemButton, activePeriod === period && styles.meridiemButtonActive]}
                        onPress={() => setRiderDeparturePeriod(period)}
                      >
                        <Text style={[styles.meridiemButtonText, activePeriod === period && styles.meridiemButtonTextActive]}>{period}</Text>
                      </Pressable>
                    );
                  })}
                </View>}
              </View>
              {fulfillment !== 0 && !isTimeTbd && (
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
            </View>}

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
              {!isNonLechonMode && <>
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
              </>}
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
            {!isNonLechonMode && <FreebiesSelector
              wholePigCount={wholeLechonCount}
              noFreebiesDiscountPerPig={noFreebiesDiscountPerPig}
              config={freebiesConfig}
              onChange={handleFreebiesChange}
            />}
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
                {lockedDownpayment > 0 && (
                  <PaymentChannelPills
                    value={downpaymentMethod}
                    onChange={setDownpaymentMethod}
                  />
                )}
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
              isEffectiveDraft && styles.saveDraftBtn,
              isFinalizing && styles.saveFinalizeBtn,
              updateOrderMutation.isPending && styles.disabledBtn,
            ]}
            disabled={updateOrderMutation.isPending}
            onPress={handleSaveChanges}
          >
            {updateOrderMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isFinalizing
                  ? '🔒 Finalize & Lock Order'
                  : isEffectiveDraft
                  ? '💾 Save Draft Changes'
                  : '💾 Save Order Changes'}
              </Text>
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
  activeRepeatCustomerPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  activeRepeatCustomerPillText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  duplicateWarningBanner: {
    backgroundColor: '#FFF1F2',
    borderWidth: 2,
    borderColor: '#E11D48',
    padding: 11,
  },
  duplicateWarningTitle: {
    color: '#9F1239',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  duplicateWarningText: {
    color: '#881337',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  duplicateCriteriaText: {
    color: '#9F1239',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
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
  draftCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    gap: 10,
  },
  draftCardActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#EDE9FE',
  },
  draftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  draftCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6D28D9',
  },
  draftCardSub: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
  },
  draftInfoCallout: {
    backgroundColor: '#DDD6FE',
    borderRadius: 8,
    padding: 10,
  },
  draftInfoCalloutText: {
    fontSize: 11,
    color: '#5B21B6',
    fontWeight: '600',
    lineHeight: 16,
  },
  modeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 8,
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
  contactLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addContactButton: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  addContactButtonText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '800',
  },
  secondaryContactWrap: {
    gap: 6,
    marginTop: 4,
  },
  removeContactButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
  },
  removeContactButtonText: {
    color: '#BE123C',
    fontSize: 12,
    fontWeight: '900',
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
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timeTbdToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeTbdToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  riderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riderTimeInput: {
    flex: 1,
  },
  meridiemRow: {
    flexDirection: 'row',
    gap: 3,
  },
  meridiemButton: {
    paddingHorizontal: 7,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    backgroundColor: '#F5F5F4',
  },
  meridiemButtonActive: {
    backgroundColor: '#181312',
    borderColor: '#181312',
  },
  meridiemButtonText: {
    color: '#57534E',
    fontSize: 10,
    fontWeight: '800',
  },
  meridiemButtonTextActive: {
    color: '#FBBF24',
  },
  timePresetRow: {
    gap: 6,
    paddingVertical: 4,
  },
  timeSlotChip: {
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  timeSlotChipActive: {
    backgroundColor: '#C81E1E',
    borderColor: '#C81E1E',
  },
  timeSlotChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  timeSlotChipTextActive: {
    color: '#FFFFFF',
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
  saveDraftBtn: {
    backgroundColor: '#7C3AED',
  },
  saveFinalizeBtn: {
    backgroundColor: '#16A34A',
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
