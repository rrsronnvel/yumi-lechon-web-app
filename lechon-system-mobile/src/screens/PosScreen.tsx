import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import {
  useCatalogCategories,
  useInventoryBalances,
  useParseScreenshotMutation,
  useCreateOrderMutation,
  useDeliveryPricingQuery,
  useCustomerLookupQuery,
  ItemCategory,
  ParsedOrderDraftDto,
} from '../hooks/usePos';
import { parseChatText } from '../utils/chatParser';
import {
  generateBookingConfirmation,
  calculateRiderDepartureTime,
  SOURCE_PILLS,
  EVENT_TYPE_PILLS,
  RIDER_DEPARTURE_NUDGE_PILLS,
  TemplateOrderData,
} from '../utils/messengerTemplates';
import FreebiesSelector from '../components/orders/FreebiesSelector';
import { evaluateDuplicateOrders, formatCalendarDateLabel, isPlaceholderPhone } from '../utils/similarityHelper';
import { normalizeDateInput } from '../utils/dateNormalizer';
import PaymentChannelPills from '../components/orders/PaymentChannelPills';
import { useAuth } from '../context/AuthContext';
import {
  FreebiesConfig,
  createDefaultFreebiesConfig,
  formatFreebiesSummary,
  getPigsWithFreebies,
  updatePigsWithFreebies,
} from '../utils/freebiesHelper';

export interface CartItem {
  itemCategoryId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  weightRange?: string;
  isRoast: boolean;
  minimumWeightKg: number;
}

type CategoryFilterType = 'whole' | 'belly' | 'addon';

interface PosScreenProps {
  onNavigateToOrders?: () => void;
}

const TIME_PRESET_CHIPS = [
  { label: '9:00 AM', time: '09:00', period: 'AM' as const, value: '09:00' },
  { label: '10:30 AM', time: '10:30', period: 'AM' as const, value: '10:30' },
  { label: '11:30 AM', time: '11:30', period: 'AM' as const, value: '11:30' },
  { label: '12:00 PM', time: '12:00', period: 'PM' as const, value: '12:00' },
  { label: '3:00 PM', time: '03:00', period: 'PM' as const, value: '15:00' },
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

const formatLocalYMD = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatLocalHM = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function PosScreen({ onNavigateToOrders }: PosScreenProps) {
  const { user } = useAuth();
  const { categories, isLoading: isCatalogLoading } = useCatalogCategories();
  const { data: balances = [] } = useInventoryBalances();
  const { data: deliveryPricing } = useDeliveryPricingQuery();
  const parseScreenshotMutation = useParseScreenshotMutation();
  const createOrderMutation = useCreateOrderMutation();

  const baseFare = deliveryPricing?.baseFare ?? 100;
  const ratePerKm = deliveryPricing?.ratePerKm ?? 15;
  const noFreebiesDiscountPerPig =
    deliveryPricing?.noFreebiesDiscountPerPig ?? 2000;

  // Default date = Tomorrow at 11:30
  const getInitialDateStr = () => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    return formatLocalYMD(tmr);
  };

  // Form State
  const [isDraft, setIsDraft] = useState(false);
  const [isTimeTbd, setIsTimeTbd] = useState(false);
  const [isNonLechonMode, setIsNonLechonMode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactNumber2, setContactNumber2] = useState('');
  const [showContactNumber2, setShowContactNumber2] = useState(false);
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [debouncedFbName, setDebouncedFbName] = useState('');
  const [source, setSource] = useState<string>('Business FB Page');
  const [eventType, setEventType] = useState<string>('');
  const [fulfillment, setFulfillment] = useState<number>(1); // 1 = Delivery, 0 = Pickup, 2 = Lalamove
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [targetDate, setTargetDate] = useState(getInitialDateStr);
  const [targetTime, setTargetTime] = useState('11:30');
  const [targetPeriod, setTargetPeriod] = useState<Meridiem>('AM');
  const [riderDepartureTimeStr, setRiderDepartureTimeStr] = useState('11:15');
  const [riderDeparturePeriod, setRiderDeparturePeriod] = useState<Meridiem>('AM');
  const [remarks, setRemarks] = useState('');

  // Active Cart State (separated from background catalog)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<CategoryFilterType | null>(null);

  // Financials
  const [distanceKm, setDistanceKm] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [downpayment, setDownpayment] = useState('0');
  const [downpaymentMethod, setDownpaymentMethod] = useState('None');
  const [isTrustedCustomer, setIsTrustedCustomer] = useState(false);
  const [freebiesConfig, setFreebiesConfig] = useState<FreebiesConfig>(() =>
    createDefaultFreebiesConfig(0)
  );
  const freebiesDiscountApplied = useRef(0);
  const previousWholePigCount = useRef(0);

  // Feedback & Modals
  const [hydrationBanner, setHydrationBanner] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sourceChoiceModalVisible, setSourceChoiceModalVisible] =
    useState(false);
  const [createdReceiptOrder, setCreatedReceiptOrder] =
    useState<TemplateOrderData | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);

  // Auto-compute riderDepartureTime whenever targetDate, targetTime, distanceKm, or fulfillment changes
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

  useEffect(() => {
    if (isTimeTbd || isNonLechonMode) return;
    const targetTime24 = to24HourTime(targetTime, targetPeriod);
    if (!targetTime24) return;
    const isoTarget = `${targetDate.trim()}T${targetTime24}:00`;
    const parsedTarget = new Date(isoTarget);
    if (!isNaN(parsedTarget.getTime())) {
      const km = parseFloat(distanceKm) || 0;
      const computed = calculateRiderDepartureTime(parsedTarget, km, fulfillment);
      const parts = to12HourParts(formatLocalHM(computed));
      setRiderDepartureTimeStr(parts.time);
      setRiderDeparturePeriod(parts.period);
    }
  }, [targetDate, targetTime, targetPeriod, distanceKm, fulfillment, isTimeTbd, isNonLechonMode]);

  useEffect(() => {
    if (!isNonLechonMode) return;
    setCartItems((items) => items.filter((item) => item.minimumWeightKg === 0));
    setEventType('');
    setActiveCategoryFilter('addon');
    setFreebiesConfig(createDefaultFreebiesConfig(0));
  }, [isNonLechonMode]);

  const handleApplyNudgeOffset = (offsetMinutes: number) => {
    if (fulfillment === 0) return;
    const targetTime24 = to24HourTime(targetTime, targetPeriod);
    if (!targetTime24) return;
    const isoTarget = `${targetDate.trim()}T${targetTime24}:00`;
    const parsedTarget = new Date(isoTarget);
    if (!isNaN(parsedTarget.getTime())) {
      const nudged = new Date(parsedTarget.getTime() + offsetMinutes * 60 * 1000);
      const parts = to12HourParts(formatLocalHM(nudged));
      setRiderDepartureTimeStr(parts.time);
      setRiderDeparturePeriod(parts.period);
    }
  };

  // Map categoryId -> availableStock & healthStatus
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

  // Category Partitioning Helpers
  const isWholeLechon = (cat: ItemCategory) =>
    cat.minimumWeightKg >= 13 && cat.isActive !== false;

  const isLechonBelly = (cat: ItemCategory) =>
    cat.minimumWeightKg > 0 &&
    cat.minimumWeightKg < 13 &&
    cat.isActive !== false;

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

  // Active item count per category for quick pill badges
  const wholeLechonCount = useMemo(() => {
    return cartItems
      .filter((item) => item.minimumWeightKg >= 13)
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  useEffect(() => {
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

  useEffect(() => {
    const amount = Math.max(0, parseFloat(downpayment) || 0);
    if (amount === 0 && downpaymentMethod !== 'None') {
      setDownpaymentMethod('None');
    } else if (amount > 0 && downpaymentMethod === 'None') {
      setDownpaymentMethod('GCash');
    }
  }, [downpayment, downpaymentMethod]);

  const handleFreebiesChange = (nextConfig: FreebiesConfig) => {
    setFreebiesConfig(nextConfig);
  };

  const bellyCount = useMemo(() => {
    return cartItems
      .filter((item) => {
        const cat = categories.find((c) => c.id === item.itemCategoryId);
        return cat ? isLechonBelly(cat) : false;
      })
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems, categories]);

  const addonCount = useMemo(() => {
    return cartItems
      .filter((item) => !item.isRoast)
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Cart Mutators
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
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.itemCategoryId === itemCategoryId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeCartItem = (itemCategoryId: number) => {
    setCartItems((prev) =>
      prev.filter((item) => item.itemCategoryId !== itemCategoryId)
    );
  };

  // Instant Search Suggestions
  const searchSuggestions = useMemo(() => {
    const query = itemSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return categories
      .filter((cat) => {
        if (cat.isActive === false) return false;
        if (isNonLechonMode && cat.minimumWeightKg > 0) return false;
        const nameMatch = cat.name.toLowerCase().includes(query);
        const weightMatch =
          cat.minimumWeightKg > 0
            ? `${cat.minimumWeightKg} ${cat.maximumWeightKg} kg`
                .toLowerCase()
                .includes(query)
            : false;

        let aliasMatch = false;
        if (query === 'm' && cat.name.toLowerCase() === 'm') aliasMatch = true;
        if (
          query === 'large' &&
          (cat.name.toLowerCase() === 'l' || cat.name.toLowerCase() === 'xl')
        )
          aliasMatch = true;
        if (query === 'sauce' && cat.name.toLowerCase().includes('sarsa'))
          aliasMatch = true;

        return nameMatch || weightMatch || aliasMatch;
      })
      .slice(0, 5);
  }, [itemSearchQuery, categories, isNonLechonMode]);

  // Modal Category Data
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
        subtitle: 'Signature Sarsa, Dinuguan, and extras (freezer-exempt)',
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

  // Fulfillment Bouncer
  const handleSelectFulfillment = (mode: number) => {
    setFulfillment(mode);
    if (mode === 0 || mode === 2) {
      setDeliveryFee('0');
      setDistanceKm('0');
    }
  };

  // Distance auto-fee calculator using CMS Delivery Pricing
  const handleDistanceChange = (val: string) => {
    setDistanceKm(val);
    if (fulfillment === 1) {
      if (val.trim() === '') {
        setDeliveryFee('0');
        return;
      }
      const km = Math.max(0, parseFloat(val) || 0);
      const fee = km > 0 ? Math.round(km * ratePerKm + baseFare) : 0;
      setDeliveryFee(String(fee));
    }
  };

  // Reactive Cart & Financial Totals
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

  const effectiveDeliveryFee =
    fulfillment === 0 || fulfillment === 2
      ? 0
      : Math.max(0, parseFloat(deliveryFee) || 0);
  const effectiveDiscount = Math.max(0, parseFloat(discount) || 0);
  const effectiveDownpayment = Math.max(0, parseFloat(downpayment) || 0);

  const grandTotal = Math.max(
    0,
    cartSubtotal + effectiveDeliveryFee - effectiveDiscount
  );
  const balanceDue = grandTotal - effectiveDownpayment;

  // Hydrate Form from ParsedOrderDraftDto
  const applyDraftToForm = (draft: ParsedOrderDraftDto) => {
    setValidationError(null);

    setCustomerName(draft.customerName || '');
    setFacebookName(draft.facebookName || '');
    if (draft.contactNumber) {
      const hydratedPhones = draft.contactNumber
        .split(',')
        .map((phone) => phone.trim())
        .filter(Boolean);
      setContactNumber(hydratedPhones[0] || '');
      const secondaryPhone =
        draft.secondaryContactNumber?.trim() ||
        draft.contactNumber2?.trim() ||
        hydratedPhones[1] ||
        '';
      setContactNumber2(secondaryPhone);
      setShowContactNumber2(Boolean(secondaryPhone));
    } else if (draft.contactNumber2?.trim()) {
      setContactNumber2(draft.contactNumber2.trim());
      setShowContactNumber2(true);
    }
    if (draft.source) {
      setSource(draft.source);
    }
    setEventType(draft.eventType || '');

    const nextFulfillment =
      draft.fulfillment !== undefined && draft.fulfillment !== null
        ? Number(draft.fulfillment)
        : 1;
    setFulfillment(nextFulfillment);

    if (draft.deliveryAddress !== undefined && draft.deliveryAddress !== null) {
      setDeliveryAddress(draft.deliveryAddress || '');
    }
    setLandmark(draft.landmark || '');

    if (draft.targetDeliveryTime) {
      const d = new Date(draft.targetDeliveryTime);
      if (!isNaN(d.getTime())) {
        setTargetDate(formatLocalYMD(d));
        const parts = to12HourParts(formatLocalHM(d));
        setTargetTime(parts.time);
        setTargetPeriod(parts.period);
      }
    }

    if (draft.isTimeTbd) {
      setIsTimeTbd(true);
      setIsDraft(true);
      setRiderDepartureTimeStr('');
    } else if (draft.isTimeTbd === false) {
      setIsTimeTbd(false);
    }

    setRemarks(draft.remarks ?? '');

    if (nextFulfillment === 0 || nextFulfillment === 2) {
      setDeliveryFee('0');
      setDistanceKm('0');
    } else {
      const parsedDistance =
        draft.distanceKm !== undefined && draft.distanceKm !== null
          ? Math.max(0, Number(draft.distanceKm) || 0)
          : null;
      if (parsedDistance !== null) {
        setDistanceKm(String(parsedDistance));
      }
      if (draft.deliveryFee !== undefined && draft.deliveryFee !== null) {
        setDeliveryFee(String(Math.max(0, Number(draft.deliveryFee) || 0)));
      } else if (parsedDistance !== null) {
        const calculatedFee =
          parsedDistance > 0
            ? Math.round(parsedDistance * ratePerKm + baseFare)
            : 0;
        setDeliveryFee(String(calculatedFee));
      }
    }

    if (draft.downpayment !== undefined && draft.downpayment !== null) {
      setDownpayment(String(Number(draft.downpayment) || 0));
    }
    if (draft.downpaymentMethod) {
      setDownpaymentMethod(draft.downpaymentMethod);
    }

    // Direct Active Cart Hydration
    let hydratedCart = cartItems;
    if (draft.items && draft.items.length > 0) {
      const nextCart: CartItem[] = [];
      for (const item of draft.items) {
        if (item.itemCategoryId && item.quantity > 0) {
          const cat = categories.find((c) => c.id === item.itemCategoryId);
          if (cat) {
            nextCart.push({
              itemCategoryId: cat.id,
              name: cat.name,
              unitPrice: cat.basePrice,
              quantity: item.quantity,
              weightRange:
                cat.minimumWeightKg > 0
                  ? `${cat.minimumWeightKg.toFixed(1)}–${cat.maximumWeightKg.toFixed(1)} kg`
                  : undefined,
              isRoast: cat.minimumWeightKg > 0,
              minimumWeightKg: cat.minimumWeightKg,
            });
          }
        }
      }
      setCartItems(nextCart);
      hydratedCart = nextCart;
      setIsNonLechonMode(
        nextCart.length > 0 && nextCart.every((item) => item.minimumWeightKg === 0)
      );
    }

    const hydratedWholePigCount = hydratedCart
      .filter((item) => item.minimumWeightKg >= 13)
      .reduce((sum, item) => sum + item.quantity, 0);
    previousWholePigCount.current = hydratedWholePigCount;

    const hydratedFreebies = createDefaultFreebiesConfig(hydratedWholePigCount);
    if (draft.freebiesOptOut === true) {
      const optOutDiscount =
        noFreebiesDiscountPerPig * hydratedWholePigCount;
      setFreebiesConfig(
        updatePigsWithFreebies(hydratedFreebies, hydratedWholePigCount, 0)
      );
      setDiscount(String(optOutDiscount));
      freebiesDiscountApplied.current = optOutDiscount;
    } else {
      const rawInnards = draft.rawInnards === true;
      const parsedConfig = rawInnards
        ? {
            ...hydratedFreebies,
            rawInnards: true,
            counts: { ...hydratedFreebies.counts, Dinuguan: 0 },
          }
        : hydratedFreebies;
      parsedConfig.counts = {
        ...parsedConfig.counts,
        ...(draft.freebieOverrides || {}),
      };
      parsedConfig.customizationNote = draft.freebiesCustomizationNote || '';
      setFreebiesConfig(parsedConfig);
      freebiesDiscountApplied.current = 0;
      setDiscount(
        String(
          draft.discount !== undefined && draft.discount !== null
            ? Math.max(0, Number(draft.discount) || 0)
            : 0
        )
      );
    }

    setHydrationBanner(
      '✨ Order details extracted! Please verify fields below before submitting.'
    );
  };

  // Clear Form Reset
  const handleClearForm = () => {
    setIsDraft(false);
    setIsTimeTbd(false);
    setIsNonLechonMode(false);
    setCustomerName('');
    setFacebookName('');
    setContactNumber('');
    setContactNumber2('');
    setShowContactNumber2(false);
    setSource('Business FB Page');
    setEventType('');
    setFulfillment(1);
    setDeliveryAddress('');
    setLandmark('');
    setTargetDate(getInitialDateStr());
    setTargetTime('11:30');
    setTargetPeriod('AM');
    setRiderDepartureTimeStr('11:15');
    setRiderDeparturePeriod('AM');
    setRemarks('');
    setCartItems([]);
    setItemSearchQuery('');
    setActiveCategoryFilter(null);
    setDistanceKm('');
    setDeliveryFee('0');
    setDiscount('0');
    setDownpayment('0');
    setDownpaymentMethod('None');
    setFreebiesConfig(createDefaultFreebiesConfig(0));
    freebiesDiscountApplied.current = 0;
    previousWholePigCount.current = 0;
    setIsTrustedCustomer(false);
    setHydrationBanner(null);
    setValidationError(null);
  };

  // Screenshot Intake Handlers
  const handlePickImage = async (imgSource: 'gallery' | 'camera') => {
    setSourceChoiceModalVisible(false);
    setValidationError(null);

    try {
      if (imgSource === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Camera Permission Needed',
            'Please allow camera access to capture booking slips.'
          );
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Gallery Permission Needed',
            'Please allow photo library access to pick Messenger screenshots.'
          );
          return;
        }
      }

      const result =
        imgSource === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const draft = await parseScreenshotMutation.mutateAsync({
        uri: asset.uri,
        fileName: asset.fileName || 'messenger-intake.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
      });

      applyDraftToForm(draft);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          data?: {
            message?: string;
            details?: string;
            Message?: string;
            Details?: string;
          };
        };
        message?: string;
      };
      const msg =
        axiosErr.response?.data?.details ||
        axiosErr.response?.data?.Details ||
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.Message ||
        axiosErr.message ||
        'Failed to parse booking screenshot.';
      setValidationError(`Screenshot Parser: ${msg}`);
    }
  };

  // Clipboard Chat Text Intake Handler
  const handlePasteChatText = async () => {
    setValidationError(null);
    try {
      const clipText = await Clipboard.getStringAsync();
      if (!clipText || !clipText.trim()) {
        Alert.alert(
          'Clipboard Empty',
          'Copy the customer booking message from Facebook Messenger first, then tap Paste Chat Text.'
        );
        return;
      }
      const draft = parseChatText(
        clipText,
        categories,
        deliveryPricing
      );
      applyDraftToForm(draft);
    } catch {
      setValidationError('Could not read text from clipboard.');
    }
  };

  // Quick Date Pills
  const setRelativeDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setTargetDate(formatLocalYMD(d));
  };

  // Resolve full ISO RiderDepartureTime from targetDate + riderDepartureTimeStr
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
      // If departure time wraps into previous day (e.g. target 00:30, departure 23:00), adjust by -1 day
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

  // Submit Order Handler
  const handleSubmitOrder = async () => {
    setValidationError(null);

    const trimmedName = customerName.trim();
    const trimmedFbName = facebookName.trim();
    const trimmedPhone = contactNumber.trim();
    const trimmedPhone2 = contactNumber2.trim();
    const combinedContactNumber = trimmedPhone2
      ? `${trimmedPhone},${trimmedPhone2}`
      : trimmedPhone;
    const trimmedAddress = deliveryAddress.trim();

    const effectiveDraft = isDraft || isTimeTbd;

    if (effectiveDraft) {
      if (!trimmedName && !trimmedFbName) {
        setValidationError(
          'Customer Name or Facebook Name is required for a draft inquiry.'
        );
        return;
      }
    } else {
      if (trimmedName.length < 2) {
        setValidationError('Please enter Customer Name (at least 2 characters).');
        return;
      }
      if (trimmedPhone.replace(/\D/g, '').length < 10) {
        setValidationError(
          'Please enter a valid Mobile Number (CP #1) with at least 10 digits.'
        );
        return;
      }
      if (trimmedPhone2 && trimmedPhone2.replace(/\D/g, '').length < 10) {
        setValidationError(
          'Please enter a valid Secondary Mobile Number (CP #2) with at least 10 digits.'
        );
        return;
      }
      if ((fulfillment === 1 || fulfillment === 2) && !trimmedAddress) {
        setValidationError(
          fulfillment === 2
            ? 'Drop-off address is required for Lalamove orders.'
            : 'Delivery address is required for Freelance Delivery orders.'
        );
        return;
      }
      if (cartItems.length === 0) {
        setValidationError(
          'Your cart is empty. Please search or pick at least one Lechon or Add-On.'
        );
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
      } else if (!effectiveDraft) {
        setValidationError(
          'Invalid Schedule Date/Time. Use YYYY-MM-DD and a 12-hour time such as 03:30 PM.'
        );
        return;
      }
    } else if (!effectiveDraft || isTimeTbd) {
      setValidationError(
        isTimeTbd
          ? 'Select the event date before saving a Time TBD order.'
          : 'Invalid Schedule Date/Time. Use YYYY-MM-DD and a 12-hour time such as 03:30 PM.'
      );
      return;
    }

    const formattedItems = cartItems.map((item) => ({
      itemCategoryId: item.itemCategoryId,
      quantity: item.quantity,
      price: item.unitPrice * item.quantity,
    }));

    const resolvedAddress =
      trimmedAddress || (fulfillment === 0 ? 'Store Pickup' : '');

    const sameDayDuplicate = activeDuplicateOrders.find((d) => d.isSameDay);

    if (!effectiveDraft && sameDayDuplicate) {
      const shouldContinue = await new Promise<boolean>((resolve) => {
        Alert.alert(
          '🚨 Same-Day Duplicate Warning',
          `Order #${sameDayDuplicate.order.orderReference} is already booked for this customer on the same date (${sameDayDuplicate.matchingFactors.join(', ')}). Create another order anyway?`,
          [
            { text: 'Go Back', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Create Anyway',
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
      const savedOrder = await createOrderMutation.mutateAsync({
        isDraft: effectiveDraft,
        isTimeTbd,
        customerName: trimmedName || trimmedFbName,
        facebookName: trimmedFbName || undefined,
        customerPhone: combinedContactNumber,
        contactNumber: combinedContactNumber,
        source: source || 'Business FB Page',
        eventType: isNonLechonMode ? undefined : eventType || undefined,
        targetDeliveryTime: isoTargetTime,
        riderDepartureTime: isoDepartureTime,
        fulfillment,
        address: resolvedAddress || undefined,
        deliveryAddress: resolvedAddress || undefined,
        landmark: landmark.trim() || undefined,
        remarks: remarks.trim(),
        price: roastSubtotal > 0 ? roastSubtotal : cartSubtotal,
        addOns: addOnsSummaryText,
        deliveryFee: effectiveDeliveryFee,
        discount: effectiveDiscount,
        downpayment: effectiveDownpayment,
        downpaymentMethod,
        freebiesSummary: isNonLechonMode
          ? null
          : formatFreebiesSummary(
              freebiesConfig,
              wholeLechonCount,
              noFreebiesDiscountPerPig
            ),
        freebiesConfigJson:
          !isNonLechonMode && wholeLechonCount > 0
            ? JSON.stringify(freebiesConfig)
            : null,
        grandTotal,
        totalAmount: grandTotal,
        isTrustedCustomer,
        items: formattedItems,
      });

      const receiptData: TemplateOrderData = {
        orderNumber:
          savedOrder?.orderReference ||
          savedOrder?.OrderReference ||
          savedOrder?.id ||
          savedOrder?.Id ||
          'NEW',
        customerName: trimmedName || trimmedFbName || 'Draft Customer',
        targetDeliveryTime: isoTargetTime || 'Date Pending',
        fulfillment,
        deliveryAddress: resolvedAddress,
        landmark: landmark.trim() || undefined,
        items: cartItems.map((item) => ({
          categoryName: item.name,
          quantity: item.quantity,
        })),
        subtotal: roastSubtotal > 0 ? roastSubtotal : cartSubtotal,
        deliveryFee: effectiveDeliveryFee,
        grandTotal,
        downpayment: effectiveDownpayment,
        balanceDue: Math.max(0, balanceDue),
        remarks: remarks.trim(),
      };

      setReceiptCopied(false);
      setCreatedReceiptOrder(receiptData);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; Message?: string; title?: string } | string };
        message?: string;
      };
      const msg =
        typeof axiosErr.response?.data === 'string'
          ? axiosErr.response.data
          : axiosErr.response?.data?.message ||
            axiosErr.response?.data?.Message ||
            axiosErr.response?.data?.title ||
            axiosErr.message ||
            'Failed to submit order.';
      setValidationError(msg);
    }
  };

  // Payment Health Pill Helper
  const renderPaymentHealthPill = () => {
    if (grandTotal > 0 && effectiveDownpayment >= grandTotal) {
      return (
        <View style={[styles.healthPill, styles.healthPaidFull]}>
          <Text style={styles.healthPaidFullText}>🟢 PAID IN FULL</Text>
        </View>
      );
    }
    if (effectiveDownpayment === 0 && isTrustedCustomer) {
      return (
        <View style={[styles.healthPill, styles.healthVip]}>
          <Text style={styles.healthVipText}>👑 VIP: UNPAID COMMITTED</Text>
        </View>
      );
    }
    if (effectiveDownpayment > 0 && effectiveDownpayment < grandTotal) {
      return (
        <View style={[styles.healthPill, styles.healthPartial]}>
          <Text style={styles.healthPartialText}>⚪ PARTIAL PAYMENT</Text>
        </View>
      );
    }
    return (
      <View style={[styles.healthPill, styles.healthPending]}>
        <Text style={styles.healthPendingText}>⚠️ PENDING PAYMENT</Text>
      </View>
    );
  };

  const isEffectiveDraft = isDraft || isTimeTbd;

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Draft Mode Toggle Card */}
        <View style={[styles.draftCard, isEffectiveDraft && styles.draftCardActive]}>
          <View style={styles.draftCardHeader}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.draftCardTitle}>
                📝 Tentative Draft Inquiry (No Fixed Date/DP)
              </Text>
              <Text style={styles.draftCardSub}>
                Pause kitchen clocks &amp; freezer stock locks for tentative inquiries
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

        {/* 1. Top AI Intake Action Card */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiCardTitle}>
                ⚡ Messenger Order Intake Bridge
              </Text>
              <Text style={styles.aiCardSub}>
                Instantly auto-fill order fields from copied Messenger chat text
              </Text>
            </View>
            <Pressable style={styles.clearFormBtn} onPress={handleClearForm}>
              <Text style={styles.clearFormBtnText}>🔄 Clear Form</Text>
            </Pressable>
          </View>

          {/* Spotlight Instant Text Intake */}
          <Pressable
            style={({ pressed }) => [
              styles.heroPasteBtn,
              pressed && styles.btnPressed,
            ]}
            onPress={handlePasteChatText}
          >
            <Text style={styles.heroPasteBtnText}>📋 Paste Clipboard (Messenger Text)</Text>
          </Pressable>

          {hydrationBanner && (
            <View style={styles.hydrationBanner}>
              <Text style={styles.hydrationBannerText}>{hydrationBanner}</Text>
            </View>
          )}
        </View>

        {/* Validation Error Banner */}
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

        {/* 2. Customer & Tri-Modal Fulfillment Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            👤 Customer &amp; Fulfillment Routing
          </Text>

          {customerProfile && !isPlaceholderPhone(contactNumber) && (
            <View style={styles.customerIntelWrap}>
              <View style={styles.repeatCustomerRow}>
                <View style={styles.repeatCustomerPill}>
                  <Text style={styles.repeatCustomerPillText}>
                    ⭐ Repeat Customer • {customerProfile.totalOrdersCount} past{' '}
                    {customerProfile.totalOrdersCount === 1 ? 'order' : 'orders'}
                  </Text>
                </View>
                {customerProfile.isVip && (
                  <View style={styles.knownVipBadge}>
                    <Text style={styles.knownVipBadgeText}>👑 KNOWN VIP</Text>
                  </View>
                )}
              </View>

              {Boolean(
                customerProfile.complaintHistory &&
                  customerProfile.complaintHistory.trim().length > 0
              ) && (
                <View style={styles.complaintAlertBanner}>
                  <Text style={styles.complaintAlertText}>
                    ⚠️ Previous Issue Logged: {customerProfile.complaintHistory}
                  </Text>
                </View>
              )}

              {Boolean(
                customerProfile.preferences &&
                  customerProfile.preferences.trim().length > 0
              ) && (
                <View style={styles.preferenceBanner}>
                  <Text style={styles.preferenceBannerText}>
                    💡 Customer Preference: {customerProfile.preferences}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Customer Full Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Maria Santos"
              placeholderTextColor="#A8A29E"
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Facebook / Messenger Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="FB / Messenger Name (for chat lookup)"
              placeholderTextColor="#A8A29E"
              value={facebookName}
              onChangeText={setFacebookName}
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
              placeholder="e.g., 09171234567"
              placeholderTextColor="#A8A29E"
              keyboardType="phone-pad"
              value={contactNumber}
              onChangeText={setContactNumber}
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
                  placeholder="e.g., 09481234567"
                  placeholderTextColor="#A8A29E"
                  keyboardType="phone-pad"
                  value={contactNumber2}
                  onChangeText={setContactNumber2}
                />
              </View>
            )}
          </View>

          {/* Source Quick-Select Pills */}
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

          {/* EventType Quick-Select Pills */}
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

          {/* Tri-Modal Segmented Fulfillment Toggle */}
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

          {/* Address Input (Always Editable per Address Retention Rule) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {fulfillment === 0
                ? 'Customer Address (Optional for Pickup)'
                : fulfillment === 2
                ? 'Lalamove Drop-off Address *'
                : 'Full Delivery Address *'}
            </Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder={
                fulfillment === 0
                  ? 'Optional - Store Pickup address notes'
                  : 'House #, Street, Subdivision, Barangay, City'
              }
              placeholderTextColor="#A8A29E"
              multiline
              numberOfLines={2}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
          </View>

          {/* Est. Distance (KM) & Landmark Row */}
          <View style={[styles.twoColRow, { alignItems: 'flex-start', gap: 12 }]}>
            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>
                Est. Distance (KM) {fulfillment !== 1 ? '(Locked)' : ''}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  fulfillment !== 1 && styles.lockedInput,
                ]}
                editable={fulfillment === 1}
                keyboardType="numeric"
                placeholder={fulfillment === 1 ? 'e.g., 5' : '0'}
                placeholderTextColor="#A8A29E"
                value={fulfillment === 1 ? distanceKm : '0'}
                onChangeText={handleDistanceChange}
              />
              {fulfillment === 1 && (
                <Text style={{ fontSize: 11, color: '#78716C', marginTop: 2, marginLeft: 2 }}>
                  Rate: ₱{baseFare} base + ₱{ratePerKm}/km
                </Text>
              )}
            </View>

            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Landmark / Rider Guide</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Tapat ng Shell, Dilaw na gate"
                placeholderTextColor="#A8A29E"
                value={landmark}
                onChangeText={setLandmark}
              />
            </View>
          </View>

          {/* Schedule Input */}
          <View style={styles.fieldGroup}>
            <View style={styles.scheduleHeaderRow}>
              <Text style={styles.fieldLabel}>Target Date &amp; Time *</Text>
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
              <View style={styles.quickDatePills}>
                <Pressable
                  style={styles.quickDateChip}
                  onPress={() => setRelativeDate(0)}
                >
                  <Text style={styles.quickDateChipText}>Today</Text>
                </Pressable>
                <Pressable
                  style={styles.quickDateChip}
                  onPress={() => setRelativeDate(1)}
                >
                  <Text style={styles.quickDateChipText}>Tomorrow</Text>
                </Pressable>
                <Pressable
                  style={styles.quickDateChip}
                  onPress={() => setRelativeDate(2)}
                >
                  <Text style={styles.quickDateChipText}>+2 Days</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.dateTimeInputsRow}>
              <View style={styles.dateInputWrap}>
                <Text style={styles.subInputCaption}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="2026-10-25"
                  placeholderTextColor="#A8A29E"
                  value={targetDate}
                  onChangeText={setTargetDate}
                  onEndEditing={() => setTargetDate(normalizeDateInput(targetDate))}
                />
              </View>
              <View style={styles.timeInputWrap}>
                <Text style={styles.subInputCaption}>Time (hh:mm)</Text>
                <TextInput
                  style={[styles.textInput, isTimeTbd && styles.lockedInput]}
                  editable={!isTimeTbd}
                  placeholder={isTimeTbd ? 'TBD' : '11:30'}
                  placeholderTextColor="#A8A29E"
                  value={isTimeTbd ? '' : targetTime}
                  onChangeText={setTargetTime}
                />
                {!isTimeTbd && (
                  <View style={styles.meridiemRow}>
                    {(['AM', 'PM'] as Meridiem[]).map((period) => (
                      <Pressable
                        key={period}
                        style={[styles.meridiemButton, targetPeriod === period && styles.meridiemButtonActive]}
                        onPress={() => setTargetPeriod(period)}
                      >
                        <Text style={[styles.meridiemButtonText, targetPeriod === period && styles.meridiemButtonTextActive]}>
                          {period}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {!isTimeTbd && <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timePresetRow}
            >
              {TIME_PRESET_CHIPS.map((slot) => {
                const active = targetTime === slot.time && targetPeriod === slot.period;
                return (
                  <Pressable
                    key={slot.value}
                    style={[
                      styles.timeSlotChip,
                      active && styles.timeSlotChipActive,
                    ]}
                    onPress={() => {
                      setTargetTime(slot.time);
                      setTargetPeriod(slot.period);
                    }}
                  >
                    <Text
                      style={[
                        styles.timeSlotChipText,
                        active && styles.timeSlotChipTextActive,
                      ]}
                    >
                      {slot.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>}
          </View>

          {/* Rider Departure Time & Nudge Pills */}
          {!isNonLechonMode && <View style={styles.fieldGroup}>
            <View style={styles.scheduleHeaderRow}>
              <Text style={styles.fieldLabel}>
                🛵 Rider Departure Time (Kitchen Anchor){' '}
                {fulfillment === 0 ? '(Pickup Locked)' : ''}
              </Text>
            </View>
            <View style={styles.riderTimeRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.riderTimeInput,
                  (fulfillment === 0 || isTimeTbd) && styles.lockedInput,
                ]}
                editable={fulfillment !== 0 && !isTimeTbd}
                placeholder={isTimeTbd ? 'TBD' : '11:00'}
                placeholderTextColor="#A8A29E"
                value={isTimeTbd ? '' : fulfillment === 0 ? targetTime : riderDepartureTimeStr}
                onChangeText={setRiderDepartureTimeStr}
              />
              {!isTimeTbd && (
                <View style={styles.meridiemRow}>
                  {(['AM', 'PM'] as Meridiem[]).map((period) => {
                    const activePeriod = fulfillment === 0 ? targetPeriod : riderDeparturePeriod;
                    return (
                      <Pressable
                        key={period}
                        disabled={fulfillment === 0}
                        style={[styles.meridiemButton, activePeriod === period && styles.meridiemButtonActive]}
                        onPress={() => setRiderDeparturePeriod(period)}
                      >
                        <Text style={[styles.meridiemButtonText, activePeriod === period && styles.meridiemButtonTextActive]}>
                          {period}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
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

          {/* Remarks Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Kitchen &amp; Prep Instructions (e.g., Walang dinuguan, Print shoutout)
            </Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Kitchen & Prep Instructions (e.g., Walang dinuguan, Print shoutout)"
              placeholderTextColor="#A8A29E"
              multiline
              numberOfLines={2}
              value={remarks}
              onChangeText={setRemarks}
            />
          </View>
        </View>

        {/* 3. Active Order Cart Card (Active Items + Search & Quick-Pills) */}
        <View style={styles.card}>
          <View style={styles.cartHeaderRow}>
            <View style={styles.cartTitleWrap}>
              <Text style={styles.sectionTitle}>🛒 Active Order Cart</Text>
              <Text style={styles.cartHeaderSub}>
                {cartItems.length} active item{cartItems.length === 1 ? '' : 's'}
              </Text>
            </View>
            {cartItems.length > 0 && (
              <View style={styles.cartSubtotalBadge}>
                <Text style={styles.cartSubtotalBadgeText}>
                  Subtotal: ₱{cartSubtotal.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.itemSearchInput}
                placeholder="Search size or add-on (e.g. M, Large, 4kg, Sauce)..."
                placeholderTextColor="#A8A29E"
                value={itemSearchQuery}
                onChangeText={setItemSearchQuery}
              />
              {itemSearchQuery.trim().length > 0 && (
                <Pressable
                  style={styles.searchClearBtn}
                  onPress={() => setItemSearchQuery('')}
                >
                  <Text style={styles.searchClearBtnText}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* Instant Search Suggestions Dropdown */}
            {itemSearchQuery.trim().length > 0 && (
              <View style={styles.suggestionsCard}>
                {searchSuggestions.length === 0 ? (
                  <View style={styles.noMatchRow}>
                    <Text style={styles.noMatchText}>
                      No items matching &quot;{itemSearchQuery.trim()}&quot;
                    </Text>
                  </View>
                ) : (
                  searchSuggestions.map((cat) => {
                    const stockInfo = stockByCategoryId[cat.id];
                    const avail = stockInfo?.available ?? 0;
                    const isLowOrDeficit =
                      avail <= (cat.minimumSafetyStock ?? 2);
                    const inCart = cartItems.find(
                      (i) => i.itemCategoryId === cat.id
                    );

                    return (
                      <View key={cat.id} style={styles.suggestionRow}>
                        <View style={styles.suggestionInfo}>
                          <View style={styles.suggestionTitleRow}>
                            <Text style={styles.suggestionName}>{cat.name}</Text>
                            {cat.minimumWeightKg > 0 && (
                              <View style={styles.weightBadge}>
                                <Text style={styles.weightBadgeText}>
                                  {cat.minimumWeightKg.toFixed(1)}–
                                  {cat.maximumWeightKg.toFixed(1)} kg
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.suggestionMetaRow}>
                            <Text style={styles.suggestionPrice}>
                              ₱{cat.basePrice.toLocaleString()}
                            </Text>
                            {stockInfo !== undefined && (
                              <View
                                style={[
                                  styles.stockBadge,
                                  avail < 0
                                    ? styles.stockDeficit
                                    : isLowOrDeficit
                                    ? styles.stockLow
                                    : styles.stockOptimal,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.stockBadgeText,
                                    avail < 0
                                      ? styles.stockDeficitText
                                      : isLowOrDeficit
                                      ? styles.stockLowText
                                      : styles.stockOptimalText,
                                  ]}
                                >
                                  {avail} avail
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <Pressable
                          style={styles.suggestionAddBtn}
                          onPress={() => {
                            addItemToCart(cat);
                            setItemSearchQuery('');
                          }}
                        >
                          <Text style={styles.suggestionAddBtnText}>
                            {inCart ? `+ Add (${inCart.quantity})` : '+ Add'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* Quick Category Filter Pills */}
          <View style={styles.categoryPillsRow}>
            {!isNonLechonMode && <>
            <Pressable
              style={styles.categoryPill}
              onPress={() => setActiveCategoryFilter('whole')}
            >
              <Text style={styles.categoryPillEmoji}>🐖</Text>
              <Text style={styles.categoryPillLabel}>Whole Lechon</Text>
              {wholeLechonCount > 0 && (
                <View style={styles.pillCountBadge}>
                  <Text style={styles.pillCountBadgeText}>
                    {wholeLechonCount}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.categoryPill}
              onPress={() => setActiveCategoryFilter('belly')}
            >
              <Text style={styles.categoryPillEmoji}>🥓</Text>
              <Text style={styles.categoryPillLabel}>Lechon Belly</Text>
              {bellyCount > 0 && (
                <View style={styles.pillCountBadge}>
                  <Text style={styles.pillCountBadgeText}>{bellyCount}</Text>
                </View>
              )}
            </Pressable>
            </>}

            <Pressable
              style={styles.categoryPill}
              onPress={() => setActiveCategoryFilter('addon')}
            >
              <Text style={styles.categoryPillEmoji}>🥫</Text>
              <Text style={styles.categoryPillLabel}>Add-Ons</Text>
              {addonCount > 0 && (
                <View style={styles.pillCountBadge}>
                  <Text style={styles.pillCountBadgeText}>{addonCount}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Catalog Loading State */}
          {isCatalogLoading ? (
            <View style={styles.catalogLoader}>
              <ActivityIndicator size="small" color="#C81E1E" />
              <Text style={styles.catalogLoaderText}>Loading live menu...</Text>
            </View>
          ) : cartItems.length === 0 ? (
            /* Empty Cart View */
            <View style={styles.emptyCartCard}>
              <Text style={styles.emptyCartEmoji}>🛒</Text>
              <Text style={styles.emptyCartTitle}>No items added yet</Text>
              <Text style={styles.emptyCartHint}>
                {isNonLechonMode
                  ? 'Type in the search bar above or tap Add-Ons to build this order.'
                  : 'Type in the search bar above or tap a category pill to add Whole Lechon, Lechon Belly, or Add-Ons.'}
              </Text>
            </View>
          ) : (
            /* Populated Active Cart List */
            <View style={styles.activeCartList}>
              <Text style={styles.cartSectionHeading}>
                SELECTED ITEMS ({cartItems.length})
              </Text>
              {cartItems.map((item) => {
                const lineTotal = item.unitPrice * item.quantity;
                return (
                  <View
                    key={item.itemCategoryId}
                    style={styles.activeCartItemCard}
                  >
                    <View style={styles.activeCartTopRow}>
                      <View style={styles.activeCartNameCol}>
                        <View style={styles.activeCartTitleRow}>
                          <Text style={styles.activeCartItemName}>
                            {item.name}
                          </Text>
                          {item.weightRange && (
                            <View style={styles.weightBadge}>
                              <Text style={styles.weightBadgeText}>
                                {item.weightRange}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.activeCartUnitCaption}>
                          ₱{item.unitPrice.toLocaleString()} each
                        </Text>
                      </View>

                      <Text style={styles.activeCartLineTotal}>
                        ₱{lineTotal.toLocaleString()}
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
                        <Text style={styles.stepperQtyText}>
                          {item.quantity}
                        </Text>
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
                        <Text style={styles.removeCartItemBtnText}>
                          🗑️ Remove
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {!isNonLechonMode && <FreebiesSelector
            wholePigCount={wholeLechonCount}
            noFreebiesDiscountPerPig={noFreebiesDiscountPerPig}
            config={freebiesConfig}
            onChange={handleFreebiesChange}
          />}
        </View>

        {/* 4. Financial Adjustments Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            💰 Financial Adjustments &amp; Deposit
          </Text>

          {/* Delivery Fee */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
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
            {fulfillment === 1 && (
              <Text style={{ fontSize: 11, color: '#78716C', marginTop: 2, marginLeft: 2 }}>
                Rate: ₱{baseFare} base + ₱{ratePerKm}/km
              </Text>
            )}
          </View>

          {/* Discount */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Courtesy Discount (₱)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#A8A29E"
              value={discount}
              onChangeText={setDiscount}
            />
          </View>

          {/* Downpayment Received with Quick Chips */}
          <View style={styles.fieldGroup}>
            <View style={styles.dpHeaderRow}>
              <Text style={styles.fieldLabel}>Downpayment Received (₱)</Text>
              <View style={styles.dpChipsRow}>
                <Pressable
                  style={styles.dpChip}
                  onPress={() => setDownpayment('0')}
                >
                  <Text style={styles.dpChipText}>₱0</Text>
                </Pressable>
                <Pressable
                  style={styles.dpChip}
                  onPress={() =>
                    setDownpayment(
                      String(
                        grandTotal > 0 && grandTotal < 1000 ? grandTotal : 1000
                      )
                    )
                  }
                >
                  <Text style={styles.dpChipText}>₱1,000</Text>
                </Pressable>
                <Pressable
                  style={styles.dpChip}
                  onPress={() => setDownpayment(String(grandTotal))}
                >
                  <Text style={styles.dpChipText}>Full Paid</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#A8A29E"
              value={downpayment}
              onChangeText={setDownpayment}
            />
            {effectiveDownpayment > 0 && (
              <PaymentChannelPills
                value={downpaymentMethod}
                onChange={setDownpaymentMethod}
              />
            )}
          </View>

          {/* VIP Bypass Toggle */}
          <View style={styles.vipToggleBox}>
            <View style={styles.vipToggleLeft}>
              <Text style={styles.vipToggleTitle}>
                👑 Trusted Customer (VIP)
              </Text>
              <Text style={styles.vipToggleSub}>
                Locks physical freezer stock as Committed even with ₱0
                downpayment
              </Text>
            </View>
            <Switch
              value={isTrustedCustomer}
              onValueChange={setIsTrustedCustomer}
              trackColor={{ false: '#D6D3D1', true: '#F59E0B' }}
              thumbColor={isTrustedCustomer ? '#FFFBEB' : '#FAFAF9'}
            />
          </View>
        </View>
      </ScrollView>

      {/* 5. Pinned Sticky Bottom Summary & Submit Bar */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerTopRow}>
          <View style={styles.footerTotalsGroup}>
            <Text style={styles.footerMiniStat}>
              Subtotal: ₱{cartSubtotal.toLocaleString()} • Grand Total:{' '}
              <Text style={styles.footerGrandStrong}>
                ₱{grandTotal.toLocaleString()}
              </Text>
            </Text>
            <View style={styles.footerBalanceRow}>
              <Text style={styles.footerBalanceLabel}>Balance Due:</Text>
              <Text
                style={[
                  styles.footerBalanceValue,
                  balanceDue <= 0
                    ? styles.footerBalanceZero
                    : styles.footerBalanceDue,
                ]}
              >
                ₱{Math.max(0, balanceDue).toLocaleString()}
              </Text>
            </View>
          </View>

          {renderPaymentHealthPill()}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitOrderBtn,
            isEffectiveDraft && styles.submitDraftBtn,
            createOrderMutation.isPending && styles.disabledBtn,
            pressed && styles.btnPressed,
          ]}
          disabled={createOrderMutation.isPending}
          onPress={handleSubmitOrder}
        >
          {createOrderMutation.isPending ? (
            <View style={styles.rowCenter}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.submitOrderBtnText}>
                {isEffectiveDraft ? 'Saving Draft...' : 'Submitting Order...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitOrderBtnText}>
              {isEffectiveDraft ? '💾 Save Draft Inquiry' : '✅ Submit Order'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Category Picker Modal (Slide-up Bottom Sheet) */}
      <Modal
        visible={Boolean(activeCategoryFilter)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveCategoryFilter(null)}
      >
        <View style={styles.sheetModalBackdrop}>
          <View style={styles.sheetModalContainer}>
            {/* Modal Header */}
            <View style={styles.sheetModalHeader}>
              <View style={styles.sheetModalTitleWrap}>
                <Text style={styles.sheetModalTitle}>
                  {modalCategoryData?.title}
                </Text>
                <Text style={styles.sheetModalSubtitle}>
                  {modalCategoryData?.subtitle}
                </Text>
              </View>
              <Pressable
                style={styles.sheetModalCloseBtn}
                onPress={() => setActiveCategoryFilter(null)}
              >
                <Text style={styles.sheetModalCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Modal Items List */}
            <ScrollView
              style={styles.sheetModalList}
              contentContainerStyle={styles.sheetModalListContent}
              keyboardShouldPersistTaps="handled"
            >
              {modalCategoryData?.items.map((cat) => {
                const inCart = cartItems.find(
                  (i) => i.itemCategoryId === cat.id
                );
                const qty = inCart ? inCart.quantity : 0;
                const stockInfo = stockByCategoryId[cat.id];
                const avail = stockInfo?.available ?? 0;
                const isLowOrDeficit = avail <= (cat.minimumSafetyStock ?? 2);

                return (
                  <View
                    key={cat.id}
                    style={[
                      styles.sheetItemCard,
                      qty > 0 && styles.sheetItemCardActive,
                    ]}
                  >
                    <View style={styles.sheetItemInfo}>
                      <View style={styles.sheetItemTitleRow}>
                        <Text style={styles.sheetItemName}>{cat.name}</Text>
                        {cat.minimumWeightKg > 0 && (
                          <View style={styles.weightBadge}>
                            <Text style={styles.weightBadgeText}>
                              {cat.minimumWeightKg.toFixed(1)}–
                              {cat.maximumWeightKg.toFixed(1)} kg
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.sheetItemMetaRow}>
                        <Text style={styles.catalogPrice}>
                          ₱{cat.basePrice.toLocaleString()}
                        </Text>
                        {stockInfo !== undefined && (
                          <View
                            style={[
                              styles.stockBadge,
                              avail < 0
                                ? styles.stockDeficit
                                : isLowOrDeficit
                                ? styles.stockLow
                                : styles.stockOptimal,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stockBadgeText,
                                avail < 0
                                  ? styles.stockDeficitText
                                  : isLowOrDeficit
                                  ? styles.stockLowText
                                  : styles.stockOptimalText,
                              ]}
                            >
                              {avail} avail
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {qty > 0 ? (
                      <View style={styles.modalStepperBox}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => updateCartItemQuantity(cat.id, -1)}
                        >
                          <Text style={styles.stepperBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.modalStepperQty}>{qty}</Text>
                        <Pressable
                          style={[styles.stepperBtn, styles.stepperBtnPlus]}
                          onPress={() => updateCartItemQuantity(cat.id, 1)}
                        >
                          <Text style={styles.stepperBtnPlusText}>+</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.sheetAddBtn}
                        onPress={() => addItemToCart(cat)}
                      >
                        <Text style={styles.sheetAddBtnText}>+ Add</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Modal Sticky Footer */}
            <View style={styles.sheetModalFooter}>
              <Pressable
                style={styles.sheetDoneBtn}
                onPress={() => setActiveCategoryFilter(null)}
              >
                <Text style={styles.sheetDoneBtnText}>Done / Back to Order</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Screenshot Source Picker Modal */}
      <Modal
        visible={sourceChoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSourceChoiceModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.choiceModalCard}>
            <Text style={styles.choiceModalTitle}>
              🖼️ Scan Messenger Screenshot
            </Text>
            <Text style={styles.choiceModalSub}>
              Choose an image source to extract customer and order details via
              Gemini Vision:
            </Text>

            <Pressable
              style={styles.choiceOptionBtn}
              onPress={() => handlePickImage('gallery')}
            >
              <Text style={styles.choiceOptionBtnText}>
                📱 Choose Screenshot from Photo Gallery
              </Text>
            </Pressable>

            <Pressable
              style={styles.choiceOptionBtn}
              onPress={() => handlePickImage('camera')}
            >
              <Text style={styles.choiceOptionBtnText}>
                📷 Take Photo with Camera
              </Text>
            </Pressable>

            <Pressable
              style={styles.choiceCancelBtn}
              onPress={() => setSourceChoiceModalVisible(false)}
            >
              <Text style={styles.choiceCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Post-Submit Confirmation Modal */}
      <Modal
        visible={Boolean(createdReceiptOrder)}
        transparent
        animationType="slide"
        onRequestClose={() => setCreatedReceiptOrder(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successModalCard}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>
              Order #{createdReceiptOrder?.orderNumber} Confirmed!
            </Text>
            <Text style={styles.successSubtitle}>
              Reservation saved and inventory synchronized. Copy the Taglish
              confirmation slip below for Messenger:
            </Text>

            {createdReceiptOrder && (
              <ScrollView style={styles.receiptPreviewBox}>
                <Text style={styles.receiptPreviewText}>
                  {generateBookingConfirmation(createdReceiptOrder)}
                </Text>
              </ScrollView>
            )}

            <Pressable
              style={[
                styles.copyReceiptModalBtn,
                receiptCopied && styles.copyReceiptModalBtnDone,
              ]}
              onPress={async () => {
                if (!createdReceiptOrder) return;
                await Clipboard.setStringAsync(
                  generateBookingConfirmation(createdReceiptOrder)
                );
                setReceiptCopied(true);
              }}
            >
              <Text style={styles.copyReceiptModalBtnText}>
                {receiptCopied
                  ? '✅ Copied to Clipboard!'
                  : '📋 Copy Messenger Receipt'}
              </Text>
            </Pressable>

            <View style={styles.successBottomActions}>
              <Pressable
                style={styles.bookAnotherBtn}
                onPress={() => {
                  setCreatedReceiptOrder(null);
                  handleClearForm();
                }}
              >
                <Text style={styles.bookAnotherBtnText}>+ Book Another</Text>
              </Pressable>

              {onNavigateToOrders && (
                <Pressable
                  style={styles.viewOrdersBtn}
                  onPress={() => {
                    setCreatedReceiptOrder(null);
                    handleClearForm();
                    onNavigateToOrders();
                  }}
                >
                  <Text style={styles.viewOrdersBtnText}>📋 View in Orders</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  duplicateWarningTitle: {
    color: '#9F1239',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  duplicateWarningText: {
    color: '#881337',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  duplicateCriteriaText: {
    color: '#9F1239',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#FAF6F4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 28,
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
  aiCard: {
    backgroundColor: '#181312',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3D302C',
    gap: 12,
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FBBF24',
  },
  aiCardSub: {
    fontSize: 11,
    color: '#A8A29E',
    marginTop: 2,
  },
  clearFormBtn: {
    backgroundColor: '#2E2320',
    borderWidth: 1,
    borderColor: '#44403C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearFormBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E7E5E4',
  },
  aiButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroPasteBtn: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  heroPasteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  aiActionBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scanScreenshotBtn: {
    backgroundColor: '#C81E1E',
    borderColor: '#EF4444',
  },
  scanScreenshotBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pasteTextBtn: {
    backgroundColor: '#291D1A',
    borderColor: '#F59E0B',
  },
  pasteTextBtnText: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '800',
  },
  hydrationBanner: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    padding: 10,
  },
  hydrationBannerText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    color: '#9F1239',
    fontSize: 12,
    fontWeight: '700',
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
    minHeight: 58,
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
    paddingVertical: 10,
    borderRadius: 9,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
  quickDatePills: {
    flexDirection: 'row',
    gap: 6,
  },
  quickDateChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  dateTimeInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateInputWrap: {
    flex: 3,
    gap: 3,
  },
  timeInputWrap: {
    flex: 2,
    gap: 3,
  },
  riderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riderTimeInput: {
    flex: 1,
  },
  meridiemRow: {
    flexDirection: 'row',
    gap: 4,
  },
  meridiemButton: {
    paddingHorizontal: 9,
    paddingVertical: 8,
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
    fontSize: 11,
    fontWeight: '800',
  },
  meridiemButtonTextActive: {
    color: '#FBBF24',
  },
  subInputCaption: {
    fontSize: 10,
    color: '#78716C',
    fontWeight: '600',
  },
  timePresetRow: {
    gap: 6,
    paddingTop: 4,
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
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartTitleWrap: {
    flex: 1,
  },
  cartHeaderSub: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 1,
  },
  cartSubtotalBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cartSubtotalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  searchContainer: {
    gap: 6,
    marginTop: 4,
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
  searchClearBtn: {
    padding: 6,
  },
  searchClearBtnText: {
    fontSize: 13,
    color: '#78716C',
    fontWeight: '800',
  },
  suggestionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FAFAF9',
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 8,
    gap: 2,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1917',
  },
  suggestionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C81E1E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  noMatchRow: {
    padding: 10,
    alignItems: 'center',
  },
  noMatchText: {
    fontSize: 12,
    color: '#78716C',
    fontStyle: 'italic',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 5,
  },
  categoryPillEmoji: {
    fontSize: 14,
  },
  categoryPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  pillCountBadge: {
    backgroundColor: '#C81E1E',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  pillCountBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catalogLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  catalogLoaderText: {
    fontSize: 13,
    color: '#57534E',
  },
  emptyCartCard: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyCartEmoji: {
    fontSize: 32,
  },
  emptyCartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#44403C',
  },
  emptyCartHint: {
    fontSize: 12,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 18,
  },
  activeCartList: {
    gap: 8,
    marginTop: 4,
  },
  cartSectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 0.6,
  },
  activeCartItemCard: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  activeCartTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeCartNameCol: {
    flex: 1,
    marginRight: 8,
    gap: 3,
  },
  activeCartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
  removeCartItemBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  removeCartItemBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  weightBadge: {
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  weightBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#57534E',
  },
  catalogPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C81E1E',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  stockOptimal: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  stockOptimalText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  stockLow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  stockLowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  stockDeficit: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FDA4AF',
  },
  stockDeficitText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9F1239',
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E7E5E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnPlus: {
    backgroundColor: '#181312',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
  },
  stepperBtnPlusText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FBBF24',
  },
  stepperQtyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
    minWidth: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
    gap: 6,
  },
  dpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  dpChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dpChip: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dpChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  vipToggleBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  vipToggleLeft: {
    flex: 1,
    marginRight: 10,
  },
  vipToggleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  vipToggleSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D6D3D1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerTotalsGroup: {
    flex: 1,
    marginRight: 8,
  },
  footerMiniStat: {
    fontSize: 11,
    color: '#57534E',
    fontWeight: '600',
  },
  footerGrandStrong: {
    color: '#1C1917',
    fontWeight: '800',
  },
  footerBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  footerBalanceLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
  },
  footerBalanceValue: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footerBalanceZero: {
    color: '#047857',
  },
  footerBalanceDue: {
    color: '#DC2626',
  },
  healthPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  healthPaidFull: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  healthPaidFullText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  healthVip: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  healthVipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  healthPartial: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  healthPartialText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
  },
  healthPending: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
  },
  healthPendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9F1239',
  },
  submitOrderBtn: {
    backgroundColor: '#C81E1E',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDraftBtn: {
    backgroundColor: '#7C3AED',
  },
  submitOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.55,
  },
  btnPressed: {
    opacity: 0.75,
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
    maxHeight: '80%',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
  },
  sheetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
  },
  sheetModalTitleWrap: {
    flex: 1,
    marginRight: 12,
  },
  sheetModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
  },
  sheetModalSubtitle: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 2,
  },
  sheetModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetModalCloseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#57534E',
  },
  sheetModalList: {
    maxHeight: 380,
    marginVertical: 10,
  },
  sheetModalListContent: {
    gap: 10,
    paddingBottom: 10,
  },
  sheetItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetItemCardActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  sheetItemInfo: {
    flex: 1,
    marginRight: 10,
    gap: 3,
  },
  sheetItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sheetItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
  },
  sheetItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetAddBtn: {
    backgroundColor: '#181312',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sheetAddBtnText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  modalStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalStepperQty: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
    minWidth: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sheetModalFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7E5E4',
  },
  sheetDoneBtn: {
    backgroundColor: '#C81E1E',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 19, 18, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  choiceModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    gap: 10,
  },
  choiceModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1917',
  },
  choiceModalSub: {
    fontSize: 12,
    color: '#57534E',
    marginBottom: 4,
  },
  choiceOptionBtn: {
    backgroundColor: '#181312',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  choiceOptionBtnText: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '800',
  },
  choiceCancelBtn: {
    backgroundColor: '#F5F5F4',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  choiceCancelBtnText: {
    color: '#57534E',
    fontSize: 13,
    fontWeight: '700',
  },
  successModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 10,
  },
  successEmoji: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1C1917',
  },
  successSubtitle: {
    fontSize: 12,
    color: '#57534E',
    textAlign: 'center',
  },
  receiptPreviewBox: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderRadius: 10,
    padding: 12,
  },
  receiptPreviewText: {
    fontSize: 11,
    color: '#292524',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  copyReceiptModalBtn: {
    width: '100%',
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  copyReceiptModalBtnDone: {
    backgroundColor: '#065F46',
  },
  copyReceiptModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  successBottomActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  bookAnotherBtn: {
    flex: 1,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  bookAnotherBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1917',
  },
  viewOrdersBtn: {
    flex: 1,
    backgroundColor: '#181312',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  viewOrdersBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  customerIntelWrap: {
    gap: 8,
  },
  repeatCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatCustomerPill: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  repeatCustomerPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  knownVipBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  knownVipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  complaintAlertBanner: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    borderRadius: 10,
    padding: 10,
  },
  complaintAlertText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9F1239',
    lineHeight: 17,
  },
  preferenceBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 10,
    padding: 10,
  },
  preferenceBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    lineHeight: 17,
  },
});
