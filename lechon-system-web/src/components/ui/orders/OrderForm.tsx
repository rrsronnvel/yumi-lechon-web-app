/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMenuCategories, ItemCategory } from "@/hooks/useCms";
import apiClient from "@/services/apiClient";
import {
  OrderFormData,
  orderFormSchema,
  ParsedOrderDraftDto,
} from "@/schemas/orderSchema";
import {
  generateBookingConfirmation,
  TemplateOrderData,
} from "@/utils/messengerTemplates";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import OrderScreenshotUploader from "./OrderScreenshotUploader";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  ReceiptText,
  Loader2,
  CheckCircle2,
  Trash2,
  Plus,
  Minus,
  Copy,
} from "lucide-react";

export interface OrderFormProps {
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function OrderForm({
  onClose,
  open: _open,
  onOpenChange,
}: OrderFormProps) {
  const queryClient = useQueryClient();
  const [savedOrderForModal, setSavedOrderForModal] =
    useState<TemplateOrderData | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // 1. Fetch live inventory categories using shared CMS hook
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useMenuCategories();

  // Partition categories into Roast Lechon vs Add-Ons
  const roastCategories = useMemo(
    () =>
      categories.filter(
        (c: ItemCategory) => c.minimumWeightKg > 0 && c.isActive !== false,
      ),
    [categories],
  );

  const addOnCategories = useMemo(
    () =>
      categories.filter(
        (c: ItemCategory) => c.minimumWeightKg === 0 && c.isActive !== false,
      ),
    [categories],
  );

  // 2. Form Defaults & Initialization (Cart starts empty)
  const DEFAULT_ORDER_VALUES: OrderFormData = useMemo(
    () => ({
      customerName: "",
      customerPhone: "",
      targetDeliveryTime: "",
      fulfillment: 1, // Default: 🚗 Freelance Delivery
      distanceKm: 0,
      address: "",
      remarks: "",
      price: 0,
      addOns: "",
      deliveryFee: 0,
      downpayment: 0,
      isTrustedCustomer: false,
      discount: 0,
      grandTotal: 0,
      items: [],
    }),
    [],
  );

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema as any),
    defaultValues: DEFAULT_ORDER_VALUES,
  });

  const { fields, append, remove, update, replace } = useFieldArray({
    name: "items",
    control: form.control,
  });

  // Watch items deeply using useWatch for instant reactivity across steppers and calculations
  const watchedItems = useWatch({
    control: form.control,
    name: "items",
    defaultValue: [],
  });

  // Watch key fields for reactive calculations
  const watchedFulfillment = form.watch("fulfillment");
  const watchedDeliveryFee = form.watch("deliveryFee");
  const watchedDiscount = form.watch("discount");
  const watchedDownpayment = form.watch("downpayment");
  const watchedIsTrusted = form.watch("isTrustedCustomer");

  // Reset form to clean empty state when modal opens
  useEffect(() => {
    if (_open) {
      form.reset(DEFAULT_ORDER_VALUES);
    }
  }, [_open, form, DEFAULT_ORDER_VALUES]);

  // 3. Interactive Store Pickup & Lalamove Safeguards
  useEffect(() => {
    if (watchedFulfillment === 0 || watchedFulfillment === 2) {
      form.setValue("deliveryFee", 0, { shouldValidate: true });
      form.setValue("distanceKm", 0, { shouldValidate: true });
    }
  }, [watchedFulfillment, form]);

  // 4. Instant Reactive Math Calculations
  const cartSubtotal = useMemo(() => {
    if (!watchedItems || watchedItems.length === 0) return 0;
    return watchedItems.reduce((acc, item) => {
      if (!item || !item.itemCategoryId) return acc;
      const cat = categories.find((c: any) => c.id === Number(item.itemCategoryId));
      const unitPrice = cat?.basePrice ?? 0;
      const qty = Number(item.quantity) || 0;
      return acc + unitPrice * qty;
    }, 0);
  }, [watchedItems, categories]);

  const roastSubtotal = useMemo(() => {
    if (!watchedItems || watchedItems.length === 0) return 0;
    return watchedItems.reduce((acc, item) => {
      if (!item || !item.itemCategoryId) return acc;
      const cat = categories.find((c: any) => c.id === Number(item.itemCategoryId));
      if (!cat || cat.minimumWeightKg <= 0) return acc;
      const unitPrice = cat.basePrice ?? 0;
      const qty = Number(item.quantity) || 0;
      return acc + unitPrice * qty;
    }, 0);
  }, [watchedItems, categories]);

  const effectiveDeliveryFee =
    watchedFulfillment === 0 || watchedFulfillment === 2
      ? 0
      : Number(watchedDeliveryFee) || 0;
  const effectiveDiscount = Number(watchedDiscount) || 0;
  const effectiveDownpayment = Number(watchedDownpayment) || 0;

  const grandTotal = Math.max(
    0,
    cartSubtotal + effectiveDeliveryFee - effectiveDiscount,
  );
  const balanceDue = grandTotal - effectiveDownpayment;

  // Stepper quantity update helper using useFieldArray.update
  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const currentItem = watchedItems?.[index] || fields[index];
    if (!currentItem) return;
    update(index, {
      ...currentItem,
      quantity: newQty,
    });
  };

  // Quick add item to cart from header selector
  const handleAddItem = (categoryId: number) => {
    const currentItems = watchedItems || [];
    const existingIndex = currentItems.findIndex(
      (i) => i.itemCategoryId === categoryId,
    );
    if (existingIndex >= 0) {
      const currentItem = currentItems[existingIndex] || fields[existingIndex];
      const currentQty = Number(currentItem?.quantity) || 1;
      update(existingIndex, {
        ...currentItem,
        quantity: currentQty + 1,
      });
    } else {
      append({ itemCategoryId: categoryId, quantity: 1 });
    }
  };

  // 5. Submission Mutation with Aggressive Cache Invalidation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiClient.post("/orders", payload);
      return response.data;
    },
    onSuccess: async (savedOrder: any, variables: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", "directory"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", "balances"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);

      const templateItems = (variables.items || []).map((item: any) => {
        const cat = categories.find((c: any) => c.id === item.itemCategoryId);
        return {
          categoryName: cat?.name || `Item #${item.itemCategoryId}`,
          quantity: item.quantity,
        };
      });

      const templateOrder: TemplateOrderData = {
        orderNumber: savedOrder?.id || savedOrder?.Id,
        customerName: variables.customerName,
        targetDeliveryTime: variables.targetDeliveryTime,
        fulfillment: Number(variables.fulfillment),
        deliveryAddress: variables.deliveryAddress || variables.address,
        items: templateItems,
        subtotal: variables.price || cartSubtotal,
        deliveryFee: variables.deliveryFee || 0,
        grandTotal: variables.grandTotal || grandTotal,
        downpayment: variables.downpayment || 0,
        balanceDue:
          (variables.grandTotal || grandTotal) -
          (variables.downpayment || 0),
        remarks: variables.remarks,
      };

      setSavedOrderForModal(templateOrder);
      setIsSuccessModalOpen(true);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.Message ||
        "Could not deliver order request to backend.";
      toast.error("Submission Failed", {
        description: msg,
      });
    },
  });

  function onSubmit(data: OrderFormData) {
    if (!data.items || data.items.length === 0) {
      toast.error("Cart is empty", {
        description: "Please add at least one item to the cart.",
      });
      return;
    }

    let computedCartSubtotal = 0;
    let computedRoastSubtotal = 0;
    const addOnStrings: string[] = [];

    const formattedItems = (data.items || []).map((item) => {
      const cat = categories.find((c: any) => c.id === item.itemCategoryId);
      const unitPrice = cat?.basePrice ?? 0;
      const lineTotal = unitPrice * item.quantity;
      computedCartSubtotal += lineTotal;

      if (cat && cat.minimumWeightKg > 0) {
        computedRoastSubtotal += lineTotal;
      } else if (cat) {
        addOnStrings.push(`${item.quantity}x ${cat.name}`);
      }

      return {
        itemCategoryId: item.itemCategoryId,
        quantity: item.quantity,
        price: lineTotal,
      };
    });

    const delivery =
      data.fulfillment === 0 || data.fulfillment === 2
        ? 0
        : Number(data.deliveryFee) || 0;
    const discount = Number(data.discount) || 0;
    const computedGrandTotal = Math.max(
      0,
      computedCartSubtotal + delivery - discount,
    );

    const payload = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      source: "POS Terminal",
      targetDeliveryTime: data.targetDeliveryTime,
      fulfillment: Number(data.fulfillment),
      address:
        data.address?.trim() ||
        (data.fulfillment === 0 ? "Store Pickup" : ""),
      deliveryAddress:
        data.address?.trim() ||
        (data.fulfillment === 0 ? "Store Pickup" : ""),
      remarks: data.remarks || "",
      price:
        roastSubtotal > 0
          ? roastSubtotal
          : computedCartSubtotal,
      addOns: addOnStrings.join(", "),
      deliveryFee: delivery,
      discount: discount,
      downpayment: Number(data.downpayment) || 0,
      grandTotal: computedGrandTotal,
      totalAmount: computedGrandTotal,
      isTrustedCustomer: Boolean(data.isTrustedCustomer),
      items: formattedItems,
    };

    createOrderMutation.mutate(payload);
  }

  // Multimodal Vision Parser Bridge
  const handleScreenshotParsed = (draft: ParsedOrderDraftDto) => {
    if (draft.customerName) {
      form.setValue("customerName", draft.customerName, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    if (draft.contactNumber) {
      form.setValue("customerPhone", draft.contactNumber, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    if (draft.targetDeliveryTime) {
      const d = new Date(draft.targetDeliveryTime);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        form.setValue("targetDeliveryTime", formatted, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }

    const fulfillmentVal =
      draft.fulfillment !== undefined && draft.fulfillment !== null
        ? Number(draft.fulfillment)
        : 1;
    form.setValue("fulfillment", fulfillmentVal, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (draft.deliveryAddress !== undefined) {
      form.setValue("address", draft.deliveryAddress || "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    if (draft.remarks !== undefined) {
      form.setValue("remarks", draft.remarks || "", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    const parsedFee =
      fulfillmentVal === 0 || fulfillmentVal === 2
        ? 0
        : Number(draft.deliveryFee) || 0;
    form.setValue("deliveryFee", parsedFee, {
      shouldValidate: true,
      shouldDirty: true,
    });

    const parsedDownpayment = Number(draft.downpayment) || 0;
    form.setValue("downpayment", parsedDownpayment, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (draft.items && draft.items.length > 0) {
      const mappedItems = draft.items.map((i) => ({
        itemCategoryId: i.itemCategoryId,
        quantity: i.quantity || 1,
      }));
      replace(mappedItems);
    }

    toast.success("Order details extracted. Please review before saving.", {
      description:
        "Parsed fields populated into the intake terminal. Verify data before saving.",
    });
  };

  const handleScreenshotError = (errorMsg: string) => {
    toast.error("Screenshot Parsing Failed", {
      description:
        errorMsg || "Could not extract booking details from screenshot.",
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-1 lg:grid-cols-12 w-full max-h-[92vh] h-full overflow-hidden bg-white"
      >
        {/* ========================================================= */}
        {/* Left Column: Who & Where Logistics                        */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 p-5 sm:p-6 overflow-y-auto max-h-[92vh] border-b lg:border-b-0 lg:border-r border-stone-200 space-y-4">
          <div className="border-b border-stone-200 pb-3">
            <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <span>🐷</span> Order Entry Terminal
            </h2>
            <p className="text-xs text-stone-500">
              Customer demographics, fulfillment routing & event logistics.
            </p>
          </div>

          {/* 1. Compact Screenshot Uploader */}
          <OrderScreenshotUploader
            onParsed={handleScreenshotParsed}
            onError={handleScreenshotError}
          />

          {/* 2. Customer Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                      placeholder="e.g., Juan Dela Cruz"
                      className="h-10 text-xs border-stone-300"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Mobile Number
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 09171234567"
                      className="h-10 text-xs border-stone-300"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          {/* 3. Segmented Delivery Method Toggle */}
          <FormField
            control={form.control}
            name="fulfillment"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-stone-700">
                  Fulfillment Method
                </FormLabel>
                <FormControl>
                  <Tabs
                    value={String(field.value)}
                    onValueChange={(val) => {
                      const numVal = parseInt(val, 10);
                      field.onChange(numVal);
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-stone-100 border border-stone-200">
                      <TabsTrigger
                        value="1"
                        className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#C81E1E] data-[state=active]:shadow-xs"
                      >
                        🚗 Freelance Delivery
                      </TabsTrigger>
                      <TabsTrigger
                        value="0"
                        className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#C81E1E] data-[state=active]:shadow-xs"
                      >
                        🏪 Store Pickup
                      </TabsTrigger>
                      <TabsTrigger
                        value="2"
                        className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#C81E1E] data-[state=active]:shadow-xs"
                      >
                        📦 Lalamove Courier
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* 4 & 5. Logistics Details: Target Date/Time & Distance (KM) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField
              control={form.control}
              name="targetDeliveryTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    {watchedFulfillment === 0
                      ? "Target Pickup Time"
                      : watchedFulfillment === 2
                      ? "Target Courier Pickup Time"
                      : "Target Delivery Time"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      step={900}
                      className="h-10 text-xs border-stone-300"
                      value={field.value}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (!rawValue) {
                          field.onChange("");
                          return;
                        }
                        const dateObj = new Date(rawValue);
                        const ms = 1000 * 60 * 15;
                        const snappedDate = new Date(
                          Math.round(dateObj.getTime() / ms) * ms,
                        );
                        const year = snappedDate.getFullYear();
                        const month = String(snappedDate.getMonth() + 1).padStart(
                          2,
                          "0",
                        );
                        const day = String(snappedDate.getDate()).padStart(
                          2,
                          "0",
                        );
                        const hours = String(snappedDate.getHours()).padStart(
                          2,
                          "0",
                        );
                        const mins = String(
                          snappedDate.getMinutes(),
                        ).padStart(2, "0");
                        field.onChange(
                          `${year}-${month}-${day}T${hours}:${mins}`,
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="distanceKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Distance (KM)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={
                        watchedFulfillment === 0 || watchedFulfillment === 2
                          ? "0"
                          : "e.g., 5"
                      }
                      disabled={
                        watchedFulfillment === 0 || watchedFulfillment === 2
                      }
                      value={field.value === 0 ? "" : field.value ?? ""}
                      onChange={(e) => {
                        const km = Math.max(0, parseFloat(e.target.value) || 0);
                        field.onChange(km);
                        const calculatedFee = km > 0 ? 50 + 15 * km : 0;
                        form.setValue("deliveryFee", calculatedFee, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                      className="h-10 text-xs border-stone-300 disabled:bg-stone-100 disabled:cursor-not-allowed"
                    />
                  </FormControl>
                  <p className="text-[10px] text-stone-500 leading-tight">
                    {watchedFulfillment === 1
                      ? "Formula: ₱50 + (₱15 x KM). Override if needed."
                      : "N/A for Store Pickup & Lalamove."}
                  </p>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          {/* Delivery Address */}
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-stone-700">
                  {watchedFulfillment === 0
                    ? "Customer Address / Landmark (For records)"
                    : watchedFulfillment === 2
                    ? "Drop-off Address (Lalamove Courier)"
                    : "Delivery Address / Destination"}
                </FormLabel>
                <FormControl>
                  <textarea
                    rows={2}
                    placeholder={
                      watchedFulfillment === 0
                        ? "Customer Address / Landmark (For records)"
                        : "House/Unit, Street, Barangay, City / Landmark"
                    }
                    {...field}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs shadow-2xs placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Remarks / Event Notes */}
          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-stone-700">
                  Remarks / Event Notes (Optional)
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Deliver to blue gate, request spicy vinegar, 50th Birthday"
                    className="h-10 text-xs border-stone-300"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />
        </div>

        {/* ========================================================= */}
        {/* Right Column: What & Money Settlement                     */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 p-5 sm:p-6 overflow-y-auto max-h-[92vh] bg-[#FAF6F4] flex flex-col justify-between space-y-4">
          {/* Top: Unified Order Cart */}
          <div className="border border-stone-200/90 rounded-xl p-4 bg-white shadow-xs space-y-3">
            {/* Category Selector Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-[#C81E1E]" />
                  Unified Order Cart
                </h3>
                <p className="text-[11px] text-stone-500">
                  {(watchedItems?.length ?? 0)} line item
                  {(watchedItems?.length ?? 0) === 1 ? "" : "s"} selected
                </p>
              </div>

              {/* Selector to add Whole Lechon, Belly, or Extras */}
              <div className="flex items-center gap-2">
                <select
                  className="h-9 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-stone-900 px-2.5 py-0 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  defaultValue=""
                  disabled={isCategoriesLoading || categories.length === 0}
                  onChange={(e) => {
                    const catId = Number(e.target.value);
                    if (catId) {
                      handleAddItem(catId);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="" disabled>
                    {isCategoriesLoading
                      ? "Loading menu items..."
                      : "+ Add Item to Order..."}
                  </option>
                  {roastCategories.length > 0 && (
                    <optgroup label="🐷 Whole Lechon & Belly">
                      {roastCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.minimumWeightKg.toFixed(1)}–
                          {c.maximumWeightKg.toFixed(1)} kg) — ₱
                          {c.basePrice?.toLocaleString()}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {addOnCategories.length > 0 && (
                    <optgroup label="🥣 Add-Ons & Extras">
                      {addOnCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — ₱{c.basePrice?.toLocaleString()}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Added Cart Line Items */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {(watchedItems?.length ?? 0) === 0 ? (
                <div className="text-center py-8 border border-dashed border-stone-200 rounded-lg bg-stone-50/70 text-stone-500 space-y-1">
                  <p className="font-semibold text-xs text-stone-700">Cart is empty</p>
                  <p className="text-[11px] text-stone-400">
                    Select a roast or add-on from the dropdown above to begin.
                  </p>
                </div>
              ) : (
                fields.map((fieldItem, index) => {
                  const currentItem = watchedItems?.[index] || fieldItem;
                  const category = categories.find(
                    (c: any) => c.id === currentItem.itemCategoryId,
                  );
                  const unitPrice = category?.basePrice ?? 0;
                  const isRoast = (category?.minimumWeightKg ?? 0) > 0;
                  const currentQty = Number(currentItem.quantity) || 1;
                  const lineTotal = unitPrice * currentQty;

                  return (
                    <div
                      key={fieldItem.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-stone-200/80 bg-stone-50/70 hover:bg-stone-50 transition-colors text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-stone-900 truncate">
                            {category?.name || `Item #${currentItem.itemCategoryId}`}
                          </span>
                          {isRoast && category ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-800 border-amber-200"
                            >
                              {category.minimumWeightKg.toFixed(1)}–
                              {category.maximumWeightKg.toFixed(1)} kg
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 bg-stone-100 text-stone-600 border-stone-200"
                            >
                              Add-on
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5 font-mono">
                          ₱{unitPrice.toLocaleString()} each
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-stone-600 bg-white border-stone-300"
                          disabled={currentQty <= 1}
                          onClick={() => updateQuantity(index, currentQty - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={currentQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updateQuantity(
                              index,
                              isNaN(val) ? 1 : Math.max(1, val),
                            );
                          }}
                          className="w-10 h-7 text-center text-xs font-semibold p-0 bg-white border-stone-300"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-stone-600 bg-white border-stone-300"
                          onClick={() => updateQuantity(index, currentQty + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Computed Line Total */}
                      <div className="w-20 text-right font-bold text-stone-900 font-mono">
                        ₱{lineTotal.toLocaleString()}
                      </div>

                      {/* Delete Action Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Subtotal Footer */}
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-600">
                Cart Subtotal (Items):
              </span>
              <span className="font-bold text-stone-900 text-sm font-mono">
                ₱{cartSubtotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Bottom: Settlement Ledger & Handover Callout */}
          <div className="bg-white border border-stone-200/90 rounded-xl p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-800 pb-2 border-b border-stone-200">
              <span className="flex items-center gap-1.5">
                <ReceiptText className="w-3.5 h-3.5 text-stone-500" />
                Settlement Ledger
              </span>
              <span className="text-[11px] text-stone-500 font-normal">
                Real-time calculations
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Cart Subtotal */}
              <div className="flex items-center justify-between text-stone-600">
                <span>Cart Subtotal</span>
                <span className="font-semibold text-stone-900 font-mono">
                  ₱{cartSubtotal.toLocaleString()}
                </span>
              </div>
              {roastSubtotal > 0 && cartSubtotal > roastSubtotal && (
                <div className="flex items-center justify-between text-[11px] text-stone-500 pl-2 border-l-2 border-amber-400">
                  <span>Lechon: ₱{roastSubtotal.toLocaleString()}</span>
                  <span>Extras: ₱{(cartSubtotal - roastSubtotal).toLocaleString()}</span>
                </div>
              )}

              {/* Delivery Fee */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-600 flex items-center gap-1">
                  Delivery Fee
                  {watchedFulfillment === 0 && (
                    <span className="text-[10px] text-stone-400 italic">
                      (Store Pickup: ₱0)
                    </span>
                  )}
                  {watchedFulfillment === 2 && (
                    <span className="text-[10px] text-stone-400 italic">
                      (Lalamove Courier: ₱0)
                    </span>
                  )}
                </span>
                <div className="w-32">
                  <Input
                    type="number"
                    min={0}
                    disabled={
                      watchedFulfillment === 0 || watchedFulfillment === 2
                    }
                    value={watchedDeliveryFee ?? 0}
                    onChange={(e) => {
                      const fee = Math.max(0, parseFloat(e.target.value) || 0);
                      form.setValue("deliveryFee", fee, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="h-9 text-right text-xs font-mono bg-white border-stone-300 disabled:bg-stone-100"
                  />
                </div>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-600">Discount (₱)</span>
                <div className="w-32">
                  <Input
                    type="number"
                    min={0}
                    value={watchedDiscount ?? 0}
                    onChange={(e) => {
                      const disc = Math.max(0, parseFloat(e.target.value) || 0);
                      form.setValue("discount", disc, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    className="h-9 text-right text-xs font-mono bg-white border-stone-300 text-rose-600 font-medium"
                  />
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-200 font-bold">
                <span className="text-stone-900 text-sm">Grand Total</span>
                <span className="text-base text-emerald-700 font-mono">
                  ₱{grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment & VIP Section */}
            <div className="pt-2 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1.5">
                  Downpayment Received (₱)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={watchedDownpayment ?? 0}
                  onChange={(e) => {
                    const dp = Math.max(0, parseFloat(e.target.value) || 0);
                    form.setValue("downpayment", dp, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  className="h-10 text-xs font-mono bg-white border-stone-300 font-medium"
                  placeholder="0"
                />
              </div>

              <FormField
                control={form.control}
                name="isTrustedCustomer"
                render={({ field }) => (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-300 bg-amber-50/70 h-10">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1 truncate">
                        👑 VIP Trusted
                      </span>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>

            {/* Prominent "Balance Due at Handover" Callout */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-emerald-950 block">
                  {balanceDue < 0
                    ? "Refund Due at Handover"
                    : "Balance Due at Handover"}
                </span>
                <div>
                  {effectiveDownpayment >= grandTotal && grandTotal > 0 ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] px-2 py-0">
                      PAID IN FULL
                    </Badge>
                  ) : effectiveDownpayment === 0 && watchedIsTrusted ? (
                    <Badge className="bg-amber-500 text-stone-950 hover:bg-amber-600 font-bold text-[10px] px-2 py-0">
                      VIP: PAY ON DELIVERY ALLOWED
                    </Badge>
                  ) : effectiveDownpayment === 0 && !watchedIsTrusted ? (
                    <Badge
                      variant="outline"
                      className="bg-stone-100 text-stone-600 border-stone-300 text-[10px] px-2 py-0"
                    >
                      PENDING PAYMENT
                    </Badge>
                  ) : balanceDue < 0 ? (
                    <Badge className="bg-rose-600 text-white hover:bg-rose-700 text-[10px] px-2 py-0">
                      OVERPAID / REFUND DUE
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500 text-stone-950 font-semibold text-[10px] px-2 py-0">
                      PARTIAL DOWNPAYMENT
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-xl font-black font-mono tracking-tight ${
                    balanceDue < 0 ? "text-rose-600" : "text-emerald-800"
                  }`}
                >
                  ₱{Math.abs(balanceDue).toLocaleString()}
                </span>
                {balanceDue < 0 && (
                  <span className="text-[10px] text-rose-600 font-medium block">
                    Send refund with rider
                  </span>
                )}
              </div>
            </div>

            {/* Ergonomic Submission Button */}
            <Button
              type="submit"
              disabled={
                createOrderMutation.isPending || (watchedItems?.length ?? 0) === 0
              }
              className="w-full bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium h-11 shadow-sm transition-colors text-sm flex items-center justify-center gap-2 mt-2"
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating & Ingesting Order...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Order Ticket
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Post-Submission Confirmation Modal */}
      <Dialog
        open={isSuccessModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSuccessModalOpen(false);
            setSavedOrderForModal(null);
            form.reset(DEFAULT_ORDER_VALUES);
            onClose?.();
            onOpenChange?.(false);
          }
        }}
      >
        <DialogContent className="overflow-x-hidden max-w-md w-full p-6 rounded-xl border-stone-200 bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <DialogTitle className="text-stone-900">Order Ingested Successfully!</DialogTitle>
            </div>
            <DialogDescription className="text-stone-500">
              Order #{savedOrderForModal?.orderNumber || "NEW"} has been recorded into the live roster.
            </DialogDescription>
          </DialogHeader>

          {savedOrderForModal && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <div>
                  <span className="font-bold text-stone-900 text-sm">
                    {savedOrderForModal.customerName}
                  </span>
                  <div className="text-stone-500 text-[11px]">
                    {savedOrderForModal.fulfillment === 0
                      ? "🏪 Walk-in Store Pickup"
                      : savedOrderForModal.fulfillment === 2
                      ? "📦 Lalamove Courier (Customer Paid)"
                      : "🚗 Freelance Delivery"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₱{savedOrderForModal.grandTotal.toLocaleString()}
                  </span>
                  <div className="text-[11px] font-medium text-stone-600">
                    Balance: ₱{savedOrderForModal.balanceDue.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-1 text-[11px]">
                <div className="font-semibold text-stone-700">Items:</div>
                <ul className="list-disc list-inside text-stone-600 space-y-0.5">
                  {savedOrderForModal.items.map((it, idx) => (
                    <li key={idx}>
                      {it.quantity}x {it.categoryName}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="mx-0 mb-0 bg-transparent border-t border-stone-200 pt-3 px-0 pb-0 flex sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-stone-300 text-stone-700 h-10"
              onClick={() => {
                setIsSuccessModalOpen(false);
                setSavedOrderForModal(null);
                form.reset(DEFAULT_ORDER_VALUES);
                onClose?.();
                onOpenChange?.(false);
              }}
            >
              Done / Close
            </Button>
            <Button
              type="button"
              className="bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold h-10 flex items-center gap-1.5"
              onClick={() => {
                if (savedOrderForModal) {
                  navigator.clipboard.writeText(
                    generateBookingConfirmation(savedOrderForModal)
                  );
                  toast.success("Copied confirmation for Messenger!");
                }
              }}
            >
              <Copy className="w-4 h-4" />
              Copy Messenger Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}