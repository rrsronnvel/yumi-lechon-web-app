/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useEditOrder } from "@/hooks/useEditOrder";
import { useDeliveryPricing } from "@/hooks/useCms";
import {
  calculateRiderDepartureTime,
  SOURCE_PILLS,
  EVENT_TYPE_PILLS,
  RIDER_DEPARTURE_NUDGE_PILLS,
} from "@/utils/messengerTemplates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";
import { useCustomerLookup } from "@/hooks/useCustomers";
import FreebiesSelector from "./FreebiesSelector";
import PaymentChannelPills, {
  PaymentChannel,
} from "./PaymentChannelPills";
import {
  createDefaultFreebiesConfig,
  formatFreebiesSummary,
  FreebiesConfig,
  getPigsWithFreebies,
  parseFreebiesConfig,
  updatePigsWithFreebies,
} from "@/utils/freebiesHelper";

interface AddOnItem {
  id?: number;
  itemCategoryId?: number;
  quantity: number;
  name: string;
}

const formatLocalDateTimeInput = (dateStrOrObj: string | Date | undefined | null): string => {
  if (!dateStrOrObj) return "";
  const dt = typeof dateStrOrObj === "string" ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

export default function EditOrderForm({
  order,
  onClose,
}: {
  order: any;
  onClose: () => void;
}) {
  const editMutation = useEditOrder();
  const { data: deliveryPricing } = useDeliveryPricing();

  const baseFare = deliveryPricing?.baseFare ?? 100;
  const ratePerKm = deliveryPricing?.ratePerKm ?? 15;
  const noFreebiesDiscountPerPig =
    deliveryPricing?.noFreebiesDiscountPerPig ?? 2000;
  const [freebiesConfig, setFreebiesConfig] = useState<FreebiesConfig>(() =>
    createDefaultFreebiesConfig(0),
  );
  const appliedFreebiesDiscount = useRef(0);
  const [showSecondaryPhone, setShowSecondaryPhone] = useState(false);
  const previousWholePigCount = useRef(0);
  const pendingHydratedWholePigCount = useRef<number | null>(null);

  // 1. Fetch live CMS categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: async () => {
      const response = await apiClient.get("/inventory/categories");
      return response.data;
    },
  });

  // 2. Filter the live data dynamically & safely MEMORIZE them!
  const lechonOptions = useMemo(
    () =>
      categories.filter(
        (cat: any) => cat.maximumWeightKg > 0 || cat.minimumWeightKg > 0,
      ),
    [categories],
  );

  const liveAddOns = useMemo(
    () =>
      categories.filter(
        (cat: any) => !cat.maximumWeightKg && !cat.minimumWeightKg,
      ),
    [categories],
  );

  const form = useForm<{
    id: number;
    isDraft: boolean;
    customerName: string;
    facebookName: string;
    source: string;
    eventType: string;
    landmark: string;
    targetDeliveryTime: string;
    riderDepartureTime: string;
    contactNumber: string;
    contactNumber2: string;
    deliveryAddress: string;
    remarks: string;
    price: number;
    deliveryFee: number;
    distanceKm: number;
    fulfillment: number;
    downpayment: number;
    downpaymentMethod: PaymentChannel | "None";
    freebiesSummary?: string | null;
    freebiesConfigJson?: string | null;
    discount: number;
    items: any[];
    dynamicAddOns: AddOnItem[];
  }>({
    defaultValues: {
      id: 0,
      isDraft: order?.isDraft ?? false,
      customerName: "",
      facebookName: "",
      source: "Business FB Page",
      eventType: "",
      landmark: "",
      targetDeliveryTime: "",
      riderDepartureTime: "",
      items: [],
      contactNumber: "",
      contactNumber2: "",
      deliveryAddress: "",
      remarks: "",
      price: 0,
      deliveryFee: 0,
      distanceKm: 0,
      fulfillment: 1, // Default to Delivery
      downpayment: 0,
      downpaymentMethod: "None",
      freebiesSummary: null,
      freebiesConfigJson: null,
      discount: 0,
      dynamicAddOns: [],
    },
  });

  const {
    fields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    name: "items" as const,
    control: form.control,
  });

  const {
    fields: addOnFields,
    append: appendAddOn,
    remove: removeAddOn,
  } = useFieldArray({
    name: "dynamicAddOns" as const,
    control: form.control,
  });

  useEffect(() => {
    if (order) {
      const formattedDate = formatLocalDateTimeInput(order.targetDeliveryTime);
      const formattedDeparture = formatLocalDateTimeInput(
        order.riderDepartureTime || order.targetDeliveryTime,
      );

      // 🚀 THE BULLETPROOF TRANSLATOR
      const rawFulfill = String(order.fulfillment).toLowerCase();
      let resolvedFulfillment = 1;
      if (rawFulfill === "0" || rawFulfill === "pickup") {
        resolvedFulfillment = 0;
      } else if (rawFulfill === "2" || rawFulfill === "lalamove") {
        resolvedFulfillment = 2;
      }

      const parsedAddOns: AddOnItem[] = (order.addOns || "")
        .split(",")
        .map((item: string) => {
          const cleanItem = item.trim();
          if (!cleanItem) return null;

          const match = cleanItem.match(/^(\d+)x\s+(.+)$/);
          if (match) {
            const rawName = match[2].replace(/\s*\([^)]+\)$/, "").trim();
            return { quantity: parseInt(match[1], 10), name: rawName };
          }

          const rawFallbackName = cleanItem.replace(/\s*\([^)]+\)$/, "").trim();
          return { quantity: 1, name: rawFallbackName };
        })
        .filter(Boolean) as AddOnItem[];

      const normalizedOrderItems = (order.orderItems || []).flatMap(
        (item: any) => {
          const itemCategoryId = Number(
            item.itemCategoryId ?? item.itemCategory?.id,
          );
          const quantity = Number(item.quantity);
          const category =
            categories.find(
              (candidate: any) => Number(candidate.id) === itemCategoryId,
            ) ?? item.itemCategory;

          if (
            !Number.isInteger(itemCategoryId) ||
            itemCategoryId <= 0 ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !category
          ) {
            return [];
          }

          return [
            {
              id: Number(item.id) || 0,
              itemCategoryId,
              quantity,
              category,
            },
          ];
        },
      );

      const mappedOrderItems = normalizedOrderItems
        .filter(
          (item: any) =>
            Number(item.category.maximumWeightKg) > 0 ||
            Number(item.category.minimumWeightKg) > 0,
        )
        .map(({ id, itemCategoryId, quantity }: any) => ({
          id,
          itemCategoryId,
          quantity,
        }));

      const persistedAddOns: AddOnItem[] = normalizedOrderItems
        .filter(
          (item: any) =>
            !Number(item.category.maximumWeightKg) &&
            !Number(item.category.minimumWeightKg),
        )
        .map((item: any) => ({
          id: item.id,
          itemCategoryId: item.itemCategoryId,
          quantity: item.quantity,
          name: item.category.name,
        }));

      const hydratedAddOns = [
        ...persistedAddOns,
        ...parsedAddOns
          .filter(
            (parsed) =>
              !persistedAddOns.some(
                (persisted) =>
                  persisted.name.trim().toLowerCase() ===
                  parsed.name.trim().toLowerCase(),
              ),
          )
          .map((parsed) => {
            const category = liveAddOns.find(
              (candidate: any) =>
                candidate.name.trim().toLowerCase() ===
                parsed.name.trim().toLowerCase(),
            );
            return {
              ...parsed,
              id: 0,
              itemCategoryId: category?.id,
            };
          }),
      ];

      const hydratedWholePigCount = mappedOrderItems.reduce(
        (total: number, item: any) => {
          const category = categories.find(
            (candidate: any) => candidate.id === Number(item.itemCategoryId),
          );
          return category?.minimumWeightKg >= 13
            ? total + (Number(item.quantity) || 0)
            : total;
        },
        0,
      );
      let hydratedFreebies = parseFreebiesConfig(
        order.freebiesConfigJson,
        hydratedWholePigCount,
      );
      if (
        !order.freebiesConfigJson &&
        String(order.freebiesSummary || "")
          .toLowerCase()
          .includes("no freebies")
      ) {
        hydratedFreebies = updatePigsWithFreebies(
          hydratedFreebies,
          hydratedWholePigCount,
          0,
        );
      }
      appliedFreebiesDiscount.current =
        (hydratedWholePigCount -
          getPigsWithFreebies(hydratedFreebies, hydratedWholePigCount)) *
        noFreebiesDiscountPerPig;
      setFreebiesConfig(hydratedFreebies);
      previousWholePigCount.current = hydratedWholePigCount;
      pendingHydratedWholePigCount.current = hydratedWholePigCount;

      const hydratedPhones = (order.contactNumber || "")
        .split(",")
        .map((phone: string) => phone.trim())
        .filter(Boolean);
      setShowSecondaryPhone(hydratedPhones.length > 1);

      form.reset({
        id: order.id,
        isDraft: order.isDraft ?? false,
        customerName: order.customerName || "",
        facebookName: order.facebookName || "",
        source: order.source || "Business FB Page",
        eventType: order.eventType || "",
        landmark: order.landmark || "",
        targetDeliveryTime: formattedDate,
        riderDepartureTime: formattedDeparture,
        contactNumber: hydratedPhones[0] || "",
        contactNumber2: hydratedPhones.slice(1).join(","),
        deliveryAddress: order.deliveryAddress || "",
        remarks: order.remarks || "",
        price: order.price || 0,
        deliveryFee:
          resolvedFulfillment === 0 || resolvedFulfillment === 2
            ? 0
            : order.deliveryFee || 0,
        distanceKm:
          resolvedFulfillment === 0 || resolvedFulfillment === 2
            ? 0
            : order.distanceKm || 0,
        discount: order.discount || 0,
        downpayment: order.downpayment || 0,
        downpaymentMethod:
          order.downpayment > 0
            ? order.downpaymentMethod || "GCash"
            : "None",
        freebiesSummary: order.freebiesSummary || null,
        freebiesConfigJson: order.freebiesConfigJson || null,
        fulfillment: resolvedFulfillment,
        dynamicAddOns: hydratedAddOns,
        items: mappedOrderItems,
      });
    }
  }, [order, form, categories, liveAddOns, noFreebiesDiscountPerPig]);

  // THE SMART BALANCE & BOUNCER STATE (Deeply Reactive via useWatch)
  const watchedItems = useWatch({
    control: form.control,
    name: "items",
  });

  const watchedAddOns = useWatch({
    control: form.control,
    name: "dynamicAddOns",
  });
  const watchedContactNumber = form.watch("contactNumber");
  const watchedFacebookName = form.watch("facebookName");
  const watchedDownpaymentMethod = form.watch("downpaymentMethod");
  const { data: customerProfile } = useCustomerLookup(
    watchedContactNumber || "",
    watchedFacebookName || "",
  );
  const duplicateOrders = (customerProfile?.activeUpcomingOrders ?? []).filter(
    (candidate) => candidate.orderId !== order?.id,
  );

  const [
    deliveryFee,
    downpayment,
    discount,
    fulfillment,
    targetDeliveryTime,
    watchedSource,
    watchedEventType,
  ] = form.watch([
    "deliveryFee",
    "downpayment",
    "discount",
    "fulfillment",
    "targetDeliveryTime",
    "source",
    "eventType",
  ]);

  // 3. THE FEE BOUNCER: If changed to Pickup (0) or Lalamove (2), force fee & distance to 0!
  useEffect(() => {
    const currentFulfillment = Number(fulfillment);
    if (currentFulfillment === 0 || currentFulfillment === 2) {
      form.setValue("deliveryFee", 0, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue("distanceKm", 0, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    if (currentFulfillment === 0 && targetDeliveryTime) {
      form.setValue("riderDepartureTime", targetDeliveryTime, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [fulfillment, targetDeliveryTime, form]);

  // Quick-offset nudge helper for RiderDepartureTime
  const handleNudgeDeparture = (offsetMinutes: number) => {
    if (!targetDeliveryTime) {
      toast.info("Set Target Delivery Time first before nudging departure.");
      return;
    }
    const targetDate = new Date(targetDeliveryTime);
    if (isNaN(targetDate.getTime())) return;
    const nudged = new Date(targetDate.getTime() + offsetMinutes * 60 * 1000);
    form.setValue("riderDepartureTime", formatLocalDateTimeInput(nudged), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  // 🚀 REACTIVE LECHON SUBTOTAL: Immediately recalculated on add, remove, size or qty change!
  const lechonSubtotal = useMemo(() => {
    if (!watchedItems || watchedItems.length === 0) return 0;
    return watchedItems.reduce((acc: number, item: any) => {
      const cat = categories.find(
        (c: any) => c.id === Number(item?.itemCategoryId),
      );
      const unitPrice = cat?.basePrice ?? cat?.price ?? 0;
      const qty = Number(item?.quantity) || 0;
      return acc + unitPrice * qty;
    }, 0);
  }, [watchedItems, categories]);

  // 🚀 REACTIVE ADD-ONS SUBTOTAL: Pulls live pricing directly from CMS and updates on any selection or quantity edit
  const totalAddOnCost = useMemo(() => {
    return (watchedAddOns || []).reduce((total: number, addon: any) => {
      if (!addon || !addon.name) return total;
      const addonName = String(addon.name).trim().toLowerCase();
      const found = liveAddOns.find(
        (a: any) => a.name.trim().toLowerCase() === addonName,
      );
      const itemPrice = found?.basePrice || found?.price || 0;
      const qty = Number(addon.quantity) || 1;
      return total + itemPrice * qty;
    }, 0);
  }, [watchedAddOns, liveAddOns]);

  const addOnsTotal = totalAddOnCost;
  const wholePigCount = useMemo(
    () =>
      (watchedItems || []).reduce((total: number, item: any) => {
        const category = categories.find(
          (candidate: any) => candidate.id === Number(item?.itemCategoryId),
        );
        return category?.minimumWeightKg >= 13
          ? total + (Number(item?.quantity) || 0)
          : total;
      }, 0),
    [watchedItems, categories],
  );

  useEffect(() => {
    if (pendingHydratedWholePigCount.current !== null) {
      if (pendingHydratedWholePigCount.current === wholePigCount) {
        previousWholePigCount.current = wholePigCount;
        pendingHydratedWholePigCount.current = null;
      }
      return;
    }
    if (previousWholePigCount.current === wholePigCount) return;
    const previousCount = previousWholePigCount.current;
    previousWholePigCount.current = wholePigCount;
    setFreebiesConfig((current) => {
      if (current.optOut) {
        return updatePigsWithFreebies(current, wholePigCount, 0);
      }
      const delta = wholePigCount - previousCount;
      const previousPigsWithFreebies = getPigsWithFreebies(
        current,
        previousCount,
      );
      return updatePigsWithFreebies(
        current,
        wholePigCount,
        previousPigsWithFreebies + delta,
      );
    });
  }, [wholePigCount]);

  const desiredFreebiesDiscount =
    (wholePigCount - getPigsWithFreebies(freebiesConfig, wholePigCount)) *
    noFreebiesDiscountPerPig;

  useEffect(() => {
    const previouslyAppliedDiscount = appliedFreebiesDiscount.current;
    if (desiredFreebiesDiscount === previouslyAppliedDiscount) return;
    const currentDiscount = Number(form.getValues("discount")) || 0;
    form.setValue(
      "discount",
      Math.max(
        0,
        currentDiscount - previouslyAppliedDiscount + desiredFreebiesDiscount,
      ),
      { shouldDirty: true },
    );
    appliedFreebiesDiscount.current = desiredFreebiesDiscount;
  }, [desiredFreebiesDiscount, form]);
  const currentFulfillment = Number(fulfillment);
  const activeDeliveryFee =
    currentFulfillment === 0 || currentFulfillment === 2
      ? 0
      : Number(deliveryFee) || 0;
  const activeDiscount = Number(discount) || 0;
  const downpaymentReceived = Number(downpayment) || 0;

  const dynamicGrandTotal = Math.max(
    0,
    lechonSubtotal + addOnsTotal + activeDeliveryFee - activeDiscount,
  );

  const remainingBalance = dynamicGrandTotal - downpaymentReceived;

  function onSubmit(data: any) {
    const isDraft = Boolean(form.watch("isDraft"));
    const fulfillmentNum = Number(data.fulfillment);
    const validLechonItems = (data.items || []).flatMap((item: any) => {
      const itemCategoryId = Number(item.itemCategoryId);
      const quantity = Number(item.quantity);
      const isKnownLechon = lechonOptions.some(
        (category: any) => Number(category.id) === itemCategoryId,
      );

      if (
        !Number.isInteger(itemCategoryId) ||
        itemCategoryId <= 0 ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !isKnownLechon
      ) {
        return [];
      }

      return [
        {
          id: Number(item.id) || 0,
          itemCategoryId,
          quantity,
        },
      ];
    });
    const validAddOnItems = (data.dynamicAddOns || []).flatMap(
      (addOn: AddOnItem) => {
        const category = liveAddOns.find(
          (candidate: any) =>
            candidate.name.trim().toLowerCase() ===
            addOn.name?.trim().toLowerCase(),
        );
        const quantity = Number(addOn.quantity);
        if (!category || !Number.isFinite(quantity) || quantity <= 0) {
          return [];
        }

        const itemCategoryId = Number(category.id);
        const originalCategoryId = Number(addOn.itemCategoryId);
        return [
          {
            id:
              originalCategoryId === itemCategoryId
                ? Number(addOn.id) || 0
                : 0,
            itemCategoryId,
            quantity,
          },
        ];
      },
    );
    const validOrderItems = [...validLechonItems, ...validAddOnItems];

    if (!isDraft) {
      if (!data.customerName || data.customerName.trim().length < 2) {
        toast.error("Customer Name required", {
          description: "Please enter a valid customer name (at least 2 characters).",
        });
        return;
      }
      if (!data.contactNumber || data.contactNumber.trim().length < 10) {
        toast.error("Contact Number required", {
          description: "Please enter a valid phone number (at least 10 digits).",
        });
        return;
      }
      if (
        data.contactNumber2?.trim() &&
        data.contactNumber2.replace(/\D/g, "").length < 10
      ) {
        toast.error("Secondary Contact Number invalid", {
          description: "Please enter a valid CP #2 (at least 10 digits).",
        });
        return;
      }
      if (!data.targetDeliveryTime || data.targetDeliveryTime.trim() === "") {
        toast.error("Delivery Date/Time required", {
          description: "Target delivery/pickup time is required to finalize order.",
        });
        return;
      }
      if (
        (fulfillmentNum === 1 || fulfillmentNum === 2) &&
        (!data.deliveryAddress || data.deliveryAddress.trim() === "")
      ) {
        toast.error("Delivery Address required", {
          description: "Delivery address is required for delivery/courier orders.",
        });
        return;
      }
      if (validOrderItems.length === 0) {
        toast.error("Cart is empty", {
          description:
            "At least one item is required in the cart to lock into production.",
        });
        return;
      }
    } else {
      const hasName = data.customerName && data.customerName.trim().length > 0;
      const hasFb = data.facebookName && data.facebookName.trim().length > 0;
      if (!hasName && !hasFb) {
        toast.error("Customer Identifier required", {
          description:
            "Customer Name or Facebook Name is required for a draft inquiry.",
        });
        return;
      }
    }

    const targetDate = data.targetDeliveryTime?.slice(0, 10);
    const sameDayDuplicate = duplicateOrders.find(
      (candidate) =>
        Boolean(targetDate) &&
        Boolean(candidate.targetDeliveryTime) &&
        candidate.targetDeliveryTime!.slice(0, 10) === targetDate,
    );
    if (
      sameDayDuplicate &&
      !window.confirm(
        `Possible duplicate: Order #${sameDayDuplicate.orderReference} is already booked for this customer on the same date. Save another order anyway?`,
      )
    ) {
      return;
    }

    const combinedAddOns = (data.dynamicAddOns || [])
      .filter((a: any) => a.name && a.name.trim() !== "")
      .map((a: any) => `${a.quantity || 1}x ${a.name}`)
      .join(", ");

    const finalDeliveryFee =
      fulfillmentNum === 0 || fulfillmentNum === 2
        ? 0
        : Number(data.deliveryFee) || 0;

    const effectiveRiderDeparture =
      fulfillmentNum === 0
        ? data.targetDeliveryTime || null
        : data.riderDepartureTime || data.targetDeliveryTime || null;

    const primaryPhone = (data.contactNumber || "").split(",")[0].trim();
    const secondaryPhone =
      (data.contactNumber2 || "").trim() ||
      (data.contactNumber || "").split(",").slice(1).join(",").trim();

    const payload = {
      ...data,
      contactNumber: secondaryPhone
        ? `${primaryPhone},${secondaryPhone}`
        : primaryPhone,
      isDraft,
      facebookName: data.facebookName?.trim() || null,
      source: data.source?.trim() || "POS Terminal",
      eventType: data.eventType?.trim() || null,
      landmark: data.landmark?.trim() || null,
      targetDeliveryTime: data.targetDeliveryTime ? data.targetDeliveryTime : null,
      riderDepartureTime: effectiveRiderDeparture,
      price: lechonSubtotal,
      fulfillment: fulfillmentNum,
      deliveryAddress:
        data.deliveryAddress?.trim() || (fulfillmentNum === 0 ? "Store Pickup" : null),
      deliveryFee: finalDeliveryFee,
      addOns: combinedAddOns,
      downpaymentMethod:
        Number(data.downpayment) > 0 ? data.downpaymentMethod : "None",
      freebiesSummary: formatFreebiesSummary(
        freebiesConfig,
        wholePigCount,
        noFreebiesDiscountPerPig,
      ),
      freebiesConfigJson: JSON.stringify(freebiesConfig),
      grandTotal: dynamicGrandTotal,
      items: validOrderItems,
    };

    // Strip out the temporary React array so C# doesn't choke on it!
    delete payload.dynamicAddOns;
    delete payload.distanceKm;
    delete payload.contactNumber2;

    editMutation.mutate(payload, {
      onSuccess: () => {
        onClose();
      },
    });
  }

  if (isCategoriesLoading || categories.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 animate-pulse">
        Loading menu configurations...
      </div>
    );
  }

  return (
    <Form {...form}>
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-stone-200/90 shadow-sm mt-2">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {duplicateOrders.length > 0 && (
            <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-3 text-xs text-rose-950 shadow-sm">
              <div className="font-black tracking-wide">
                🚨 POSSIBLE DUPLICATE ORDER DETECTED!
              </div>
              {duplicateOrders.slice(0, 3).map((duplicate) => (
                <div key={duplicate.orderId} className="mt-1 font-medium">
                  {customerProfile?.fullName ||
                    form.getValues("customerName") ||
                    "Customer"}{" "}
                  already
                  has an active booking (#{duplicate.orderReference}) for{" "}
                  {duplicate.targetDeliveryTime
                    ? new Date(duplicate.targetDeliveryTime).toLocaleString()
                    : "date pending"}{" "}
                  ({duplicate.itemsSummary}) encoded by {duplicate.createdBy}.
                </div>
              ))}
            </div>
          )}

          {/* Draft Inquiry Toggle Banner */}
          <div className="bg-purple-50/80 border border-purple-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <div>
                  <div className="text-xs font-bold text-purple-950">
                    Tentative Draft Inquiry
                  </div>
                  <div className="text-[11px] text-purple-700">
                    {order?.isDraft
                      ? "Flip toggle to OFF to finalize and lock this draft inquiry into production."
                      : "Unconfirmed inquiry without physical inventory reservation or kitchen timers."}
                  </div>
                </div>
              </div>
              <Switch
                checked={form.watch("isDraft")}
                onCheckedChange={(checked) => form.setValue("isDraft", checked)}
                className="data-[state=checked]:bg-purple-600 cursor-pointer"
              />
            </div>
            {order?.isDraft && !form.watch("isDraft") ? (
              <div className="mt-2 text-[11px] bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md p-2.5 font-medium leading-relaxed flex items-center gap-2">
                <span>🔒</span>
                <span>Ready to Finalize: Saving will lock freezer inventory, calculate kitchen roasting clocks, and move this inquiry to active production.</span>
              </div>
            ) : form.watch("isDraft") ? (
              <div className="mt-2 text-[11px] bg-purple-100/90 border border-purple-300 text-purple-900 rounded-md p-2.5 font-medium leading-relaxed">
                Draft Mode Active: Kitchen schedules and freezer stock locks are paused. Date, venue, and pig size can be left blank until confirmed.
              </div>
            ) : null}
          </div>

          {/* Customer & Delivery Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Customer Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700 flex items-center justify-between gap-2">
                    <span>Mobile Number (CP #1)</span>
                    {!showSecondaryPhone && (
                      <button
                        type="button"
                        onClick={() => setShowSecondaryPhone(true)}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900"
                      >
                        + Add CP #2
                      </button>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="09XX..."
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {showSecondaryPhone && (
              <FormField
                control={form.control}
                name="contactNumber2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-stone-700 flex items-center justify-between gap-2">
                      <span>Secondary Mobile Number (CP #2)</span>
                      <button
                        type="button"
                        onClick={() => {
                          form.setValue("contactNumber2", "", {
                            shouldDirty: true,
                          });
                          setShowSecondaryPhone(false);
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800"
                        aria-label="Clear secondary mobile number"
                      >
                        ✕
                      </button>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="09XX..."
                        className="h-10 bg-stone-50 border-stone-300"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="facebookName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Facebook / Messenger Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="FB / Messenger Name (for chat lookup)"
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Booking Source
                  </FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {SOURCE_PILLS.map((pill) => {
                      const isSelected = watchedSource === pill;
                      return (
                        <button
                          key={pill}
                          type="button"
                          onClick={() => {
                            field.onChange(isSelected ? "" : pill);
                          }}
                          className={cn(
                            "px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer text-center flex items-center justify-center",
                            isSelected
                              ? "bg-[#C81E1E] text-white border-[#C81E1E]"
                              : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                          )}
                        >
                          {pill}
                        </button>
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Event Type (Optional)
                  </FormLabel>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {EVENT_TYPE_PILLS.map((pill) => {
                      const isSelected = watchedEventType === pill.id;
                      return (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => {
                            field.onChange(isSelected ? "" : pill.id);
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer",
                            isSelected
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                          )}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fulfillment"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-stone-700 font-semibold text-xs">
                    Delivery Method
                  </FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-3 w-full p-1 bg-stone-100 rounded-lg border border-stone-200 gap-1 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(1);
                        }}
                        className={cn(
                          "min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 h-10 px-1 sm:px-2 text-xs font-semibold rounded-md transition-all cursor-pointer overflow-hidden",
                          Number(field.value) === 1
                            ? "bg-white text-[#C81E1E] shadow-xs border border-stone-200"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60",
                        )}
                      >
                        <span className="text-sm shrink-0">🚗</span>
                        <span className="truncate">Freelance Delivery</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(0);
                          form.setValue("deliveryFee", 0, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          form.setValue("distanceKm", 0, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }}
                        className={cn(
                          "min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 h-10 px-1 sm:px-2 text-xs font-semibold rounded-md transition-all cursor-pointer overflow-hidden",
                          Number(field.value) === 0
                            ? "bg-white text-[#C81E1E] shadow-xs border border-stone-200"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60",
                        )}
                      >
                        <span className="text-sm shrink-0">🏪</span>
                        <span className="truncate">Store Pickup</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(2);
                          form.setValue("deliveryFee", 0, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          form.setValue("distanceKm", 0, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }}
                        className={cn(
                          "min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 h-10 px-1 sm:px-2 text-xs font-semibold rounded-md transition-all cursor-pointer overflow-hidden",
                          Number(field.value) === 2
                            ? "bg-white text-[#C81E1E] shadow-xs border border-stone-200"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60",
                        )}
                      >
                        <span className="text-sm shrink-0">📦</span>
                        <span className="truncate">Lalamove</span>
                      </button>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetDeliveryTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Target Delivery / Pickup Time
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val);
                        if (val) {
                          const dt = new Date(val);
                          if (!isNaN(dt.getTime())) {
                            const dep = calculateRiderDepartureTime(
                              dt,
                              Number(form.getValues("distanceKm")) || 0,
                              Number(fulfillment),
                            );
                            form.setValue(
                              "riderDepartureTime",
                              formatLocalDateTimeInput(dep),
                              { shouldValidate: true, shouldDirty: true },
                            );
                          }
                        }
                      }}
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="distanceKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Distance (KM) — Auto-Calc Fee & Departure
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      disabled={
                        Number(fulfillment) === 0 || Number(fulfillment) === 2
                      }
                      placeholder={
                        Number(fulfillment) === 0 || Number(fulfillment) === 2
                          ? "0"
                          : "e.g., 8"
                      }
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        const km = Math.max(
                          0,
                          parseFloat(e.target.value) || 0,
                        );
                        field.onChange(km);
                        if (Number(fulfillment) === 1 && km > 0) {
                          const fee = Math.round(km * ratePerKm + baseFare);
                          form.setValue("deliveryFee", fee, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }
                        if (targetDeliveryTime) {
                          const dt = new Date(targetDeliveryTime);
                          if (!isNaN(dt.getTime())) {
                            const dep = calculateRiderDepartureTime(
                              dt,
                              km,
                              Number(fulfillment),
                            );
                            form.setValue(
                              "riderDepartureTime",
                              formatLocalDateTimeInput(dep),
                              { shouldValidate: true, shouldDirty: true },
                            );
                          }
                        }
                      }}
                      className="h-10 bg-stone-50 border-stone-300 disabled:bg-stone-100"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="riderDepartureTime"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2 bg-amber-50/50 border border-amber-200/80 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel className="text-xs font-bold text-amber-950">
                      🛵 Rider Departure Time (Kitchen Zero-Hour Anchor)
                    </FormLabel>
                    {Number(fulfillment) === 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 bg-stone-100 text-stone-600 border-stone-300"
                      >
                        Locked to Pickup Time
                      </Badge>
                    )}
                  </div>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      disabled={Number(fulfillment) === 0}
                      {...field}
                      className="h-9 text-xs bg-white border-amber-300 font-mono disabled:bg-stone-100"
                    />
                  </FormControl>
                  {Number(fulfillment) !== 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-amber-800 font-semibold mr-1">
                        Quick Nudge from Delivery:
                      </span>
                      {RIDER_DEPARTURE_NUDGE_PILLS.map((pill) => (
                        <button
                          key={pill.label}
                          type="button"
                          onClick={() =>
                            handleNudgeDeparture(pill.minutes)
                          }
                          className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deliveryAddress"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Delivery Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={
                        Number(fulfillment) === 0
                          ? "Customer Address (For records)"
                          : Number(fulfillment) === 2
                            ? "Drop-off Address for Lalamove Courier"
                            : "Full Delivery Address"
                      }
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="landmark"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Landmark / Drop-off Guide (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Tapat ng Shell, Dilaw na gate"
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Kitchen & Prep Instructions (e.g., Walang dinuguan, Print shoutout)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Kitchen & Prep Instructions (e.g., Walang dinuguan, Print shoutout)"
                      {...field}
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* --- LECHON CART BLOCK --- */}
          <div className="pt-5 border-t border-stone-200">
            <div className="flex justify-between items-center mb-3">
              <FormLabel className="text-base font-semibold text-stone-900">
                Lechon Cart
              </FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-dashed border-stone-300 text-stone-700 hover:text-[#C81E1E] hover:border-[#C81E1E]/40 hover:bg-amber-50/50 cursor-pointer"
                onClick={() => {
                  appendItem({
                    id: 0,
                    itemCategoryId: lechonOptions[0]?.id || 1,
                    quantity: 1,
                  });
                }}
              >
                + Add Lechon
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex gap-3 items-center bg-stone-50/70 p-3 rounded-lg border border-stone-200"
                >
                  <Input
                    type="number"
                    min="1"
                    className="w-16 bg-white h-10 text-sm text-center font-medium border-stone-300"
                    {...form.register(`items.${index}.quantity` as const, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const val = parseInt(e.target.value, 10);
                        form.setValue(
                          `items.${index}.quantity`,
                          isNaN(val) || val < 1 ? 1 : val,
                          { shouldValidate: true, shouldDirty: true },
                        );
                      },
                    })}
                  />

                  <select
                    {...form.register(
                      `items.${index}.itemCategoryId` as const,
                      {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const val = parseInt(e.target.value, 10);
                          form.setValue(`items.${index}.itemCategoryId`, val, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        },
                      },
                    )}
                    className="w-full h-10 rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {/* ONLY SHOW LECHONS HERE */}
                    {lechonOptions.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} (₱
                        {(cat.basePrice || cat.price || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-rose-500 hover:text-rose-700 hover:bg-rose-50 shrink-0 cursor-pointer"
                      onClick={() => {
                        removeItem(index);
                      }}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-amber-800 mt-2 font-medium flex items-center gap-1">
              <span className="text-amber-600">ℹ</span> Changing the Departure
              / Delivery Time or Size will recalculate the Kitchen timeline.
            </p>
            <div className="mt-3">
              <FreebiesSelector
                wholePigCount={wholePigCount}
                noFreebiesDiscountPerPig={noFreebiesDiscountPerPig}
                config={freebiesConfig}
                onChange={setFreebiesConfig}
              />
            </div>
          </div>

          {/* --- DYNAMIC ADD-ONS BLOCK --- */}
          <div className="pt-5 border-t border-stone-200">
            <div className="flex justify-between items-center mb-3">
              <FormLabel className="text-base font-semibold text-stone-900">
                Extra Add-Ons
              </FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-dashed border-stone-300 text-stone-700 hover:text-[#C81E1E] hover:bg-amber-50/50 cursor-pointer"
                onClick={() => appendAddOn({ quantity: 1, name: "" })}
              >
                + Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {addOnFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex gap-3 items-center bg-stone-50/70 p-3 rounded-lg border border-stone-200"
                >
                  <Input
                    type="number"
                    min="1"
                    className="w-16 bg-white h-10 text-sm text-center font-medium border-stone-300"
                    {...form.register(
                      `dynamicAddOns.${index}.quantity` as const,
                      {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const val = parseInt(e.target.value, 10);
                          form.setValue(
                            `dynamicAddOns.${index}.quantity`,
                            isNaN(val) || val < 1 ? 1 : val,
                            { shouldValidate: true, shouldDirty: true },
                          );
                        },
                      },
                    )}
                  />
                  <select
                    {...form.register(`dynamicAddOns.${index}.name` as const, {
                      onChange: (e) => {
                        form.setValue(
                          `dynamicAddOns.${index}.name`,
                          e.target.value,
                          {
                            shouldValidate: true,
                            shouldDirty: true,
                          },
                        );
                      },
                    })}
                    className="flex-1 h-10 rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="" className="text-stone-400">
                      -- Select Add-On --
                    </option>
                    {/* ONLY SHOW ADD ONS HERE FROM CMS! */}
                    {liveAddOns.map((a: any) => (
                      <option key={a.id} value={a.name}>
                        {a.name} (+₱{a.basePrice || a.price || 0})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-rose-500 hover:bg-rose-50 shrink-0 cursor-pointer"
                    onClick={() => removeAddOn(index)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {addOnFields.length === 0 && (
                <p className="text-sm text-stone-400 italic py-2">
                  No extra items requested.
                </p>
              )}
            </div>
          </div>

          {/* --- FINANCIAL ADJUSTMENTS BLOCK --- */}
          <div className="pt-6 border-t border-stone-200 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-stone-900">
                Financial Adjustments
              </h3>
              <span className="text-xs text-stone-500 font-medium">
                Flexible Cart • Locked Cash
              </span>
            </div>

            {/* Computed Read-Only Summaries */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Computed Cart Summaries
              </p>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-sm font-mono text-stone-700 flex flex-col justify-between">
                  <span className="text-xs font-sans text-stone-500 font-medium">
                    Lechon Subtotal
                  </span>
                  <span className="text-base font-bold text-stone-900 mt-1">
                    ₱{lechonSubtotal.toLocaleString()}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-sm font-mono text-stone-700 flex flex-col justify-between">
                  <span className="text-xs font-sans text-stone-500 font-medium">
                    Add-Ons Total
                  </span>
                  <span className="text-base font-bold text-amber-800 mt-1">
                    ₱{addOnsTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Editable Adjustments */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Editable Adjustments
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="deliveryFee"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-stone-700 font-semibold text-xs flex items-center justify-between h-5">
                        <span className="truncate">Delivery Fee (₱)</span>
                        {(Number(fulfillment) === 0 ||
                          Number(fulfillment) === 2) && (
                          <span className="text-[10px] text-amber-700 font-normal lowercase shrink-0">
                            (locked ₱0)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          disabled={
                            Number(fulfillment) === 0 ||
                            Number(fulfillment) === 2
                          }
                          value={
                            Number(fulfillment) === 0 ||
                            Number(fulfillment) === 2
                              ? 0
                              : field.value ?? 0
                          }
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          className="h-10 border-stone-300 disabled:bg-stone-100 disabled:text-stone-400 font-mono font-medium"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-rose-600 font-semibold text-xs flex items-center justify-between h-5">
                        <span className="truncate">Courtesy Discount (₱)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          className="border-rose-200 focus-visible:ring-rose-400 text-rose-600 h-10 font-mono font-medium"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Live Handover Preview */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3 shadow-inner">
              <div className="flex justify-between items-center text-sm border-b border-stone-200 pb-2">
                <span className="text-stone-600 font-medium">Grand Total</span>
                <span className="font-mono font-bold text-stone-900 text-base">
                  ₱{dynamicGrandTotal.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500 font-medium flex items-center gap-1">
                  🔒 Historical Downpayment
                </span>
                <span className="font-mono font-medium text-emerald-700">
                  - ₱{downpaymentReceived.toLocaleString()}
                </span>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-2">
                <div className="text-[11px] font-semibold text-stone-600">
                  BIR Downpayment Channel
                </div>
                <PaymentChannelPills
                  value={watchedDownpaymentMethod}
                  disabled={downpaymentReceived <= 0}
                  onChange={(channel) =>
                    form.setValue("downpaymentMethod", channel, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>

              <div className="flex justify-between items-end pt-2 border-t border-stone-200">
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                    Remaining Balance
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {remainingBalance < 0
                      ? "Customer overpaid — send refund"
                      : "Amount to collect on handover"}
                  </p>
                </div>
                <p
                  className={`text-2xl font-black font-mono tracking-tight ${
                    remainingBalance < 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {remainingBalance < 0
                    ? `Refund: ₱${Math.abs(remainingBalance).toLocaleString()}`
                    : `₱${remainingBalance.toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>

          {/* Form Action Footer */}
          <div className="flex items-center gap-3 pt-4 border-t border-stone-200 mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-1/2 h-11 border-stone-300 text-stone-700 hover:bg-stone-100 font-medium"
              onClick={onClose}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={editMutation.isPending}
              className={cn(
                "w-1/2 h-11 text-white font-semibold shadow-sm cursor-pointer",
                order?.isDraft && !form.watch("isDraft")
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : form.watch("isDraft")
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-[#C81E1E] hover:bg-[#A81818]"
              )}
            >
              {editMutation.isPending
                ? "Saving Changes..."
                : order?.isDraft && !form.watch("isDraft")
                  ? "🔒 Finalize & Lock Order"
                  : form.watch("isDraft")
                    ? "💾 Save Draft Inquiry"
                    : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </Form>
  );
}
