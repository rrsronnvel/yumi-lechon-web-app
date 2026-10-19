/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useEditOrder } from "@/hooks/useEditOrder";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

interface AddOnItem {
  quantity: number;
  name: string;
}

export default function EditOrderForm({
  order,
  onClose,
}: {
  order: any;
  onClose: () => void;
}) {
  const editMutation = useEditOrder();

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
    customerName: string;
    targetDeliveryTime: string;
    contactNumber: string;
    deliveryAddress: string;
    remarks: string;
    price: number;
    deliveryFee: number;
    distanceKm: number;
    fulfillment: number;
    downpayment: number;
    discount: number;
    items: any[];
    dynamicAddOns: AddOnItem[];
  }>({
    defaultValues: {
      id: 0,
      customerName: "",
      targetDeliveryTime: "",
      items: [{ id: 0, itemCategoryId: 1, quantity: 1 }],
      contactNumber: "",
      deliveryAddress: "",
      remarks: "",
      price: 0,
      deliveryFee: 0,
      distanceKm: 0,
      fulfillment: 1, // Default to Delivery
      downpayment: 0,
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
      const dt = new Date(order.targetDeliveryTime);
      const formattedDate = new Date(
        dt.getTime() - dt.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);

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

      form.reset({
        id: order.id,
        customerName: order.customerName || "",
        targetDeliveryTime: formattedDate,
        contactNumber: order.contactNumber || "",
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
        fulfillment: resolvedFulfillment,
        dynamicAddOns: parsedAddOns,
        items: order.orderItems?.map((i: any) => ({
          id: i.id,
          itemCategoryId: i.itemCategoryId,
          quantity: i.quantity,
        })) || [
          { id: 0, itemCategoryId: lechonOptions[0]?.id || 1, quantity: 1 },
        ],
      });
    }
  }, [order, form, lechonOptions]);

  // THE SMART BALANCE & BOUNCER STATE (Deeply Reactive via useWatch)
  const watchedItems = useWatch({
    control: form.control,
    name: "items",
  });

  const watchedAddOns = useWatch({
    control: form.control,
    name: "dynamicAddOns",
  });

  const [deliveryFee, downpayment, discount, fulfillment] = form.watch([
    "deliveryFee",
    "downpayment",
    "discount",
    "fulfillment",
  ]);

  // 3. THE FEE BOUNCER: If changed to Pickup (0) or Lalamove (2), force fee & distance to 0!
  useEffect(() => {
    const currentFulfillment = Number(fulfillment);
    if (currentFulfillment === 0 || currentFulfillment === 2) {
      form.setValue("deliveryFee", 0, { shouldValidate: true, shouldDirty: true });
      form.setValue("distanceKm", 0, { shouldValidate: true, shouldDirty: true });
    }
  }, [fulfillment, form]);

  // 🚀 REACTIVE LECHON SUBTOTAL: Immediately recalculated on add, remove, size or qty change!
  const lechonSubtotal = useMemo(() => {
    if (!watchedItems || watchedItems.length === 0) return 0;
    return watchedItems.reduce((acc: number, item: any) => {
      const cat = categories.find(
        (c: any) => c.id === Number(item?.itemCategoryId)
      );
      const unitPrice = cat?.basePrice ?? cat?.price ?? 0;
      const qty = Number(item?.quantity) || 0;
      return acc + unitPrice * qty;
    }, 0);
  }, [watchedItems, categories]);

  // 🚀 REACTIVE ADD-ONS SUBTOTAL: Pulls live pricing directly from CMS and updates on any selection or quantity edit
  const totalAddOnCost = useMemo(() => {
    return (watchedAddOns || []).reduce(
      (total: number, addon: any) => {
        if (!addon || !addon.name) return total;
        const addonName = String(addon.name).trim().toLowerCase();
        const found = liveAddOns.find(
          (a: any) => a.name.trim().toLowerCase() === addonName
        );
        const itemPrice = found?.basePrice || found?.price || 0;
        const qty = Number(addon.quantity) || 1;
        return total + itemPrice * qty;
      },
      0,
    );
  }, [watchedAddOns, liveAddOns]);

  const addOnsTotal = totalAddOnCost;
  const currentFulfillment = Number(fulfillment);
  const activeDeliveryFee =
    currentFulfillment === 0 || currentFulfillment === 2
      ? 0
      : Number(deliveryFee) || 0;
  const activeDiscount = Number(discount) || 0;
  const downpaymentReceived = Number(downpayment) || 0;

  const dynamicGrandTotal = Math.max(
    0,
    lechonSubtotal + addOnsTotal + activeDeliveryFee - activeDiscount
  );

  const remainingBalance = dynamicGrandTotal - downpaymentReceived;

  function onSubmit(data: any) {
    const combinedAddOns = (data.dynamicAddOns || [])
      .filter((a: any) => a.name && a.name.trim() !== "")
      .map((a: any) => `${a.quantity || 1}x ${a.name}`)
      .join(", ");

    const fulfillmentNum = Number(data.fulfillment);
    const finalDeliveryFee =
      fulfillmentNum === 0 || fulfillmentNum === 2
        ? 0
        : Number(data.deliveryFee) || 0;

    const payload = {
      ...data,
      price: lechonSubtotal,
      fulfillment: fulfillmentNum,
      deliveryFee: finalDeliveryFee,
      addOns: combinedAddOns,
      grandTotal: dynamicGrandTotal,
    };

    // Strip out the temporary React array so C# doesn't choke on it!
    delete payload.dynamicAddOns;
    delete payload.distanceKm;

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
          {/* Customer & Delivery Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-stone-700">Customer Name</FormLabel>
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
                  <FormLabel className="text-xs font-semibold text-stone-700">
                    Contact Number
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

            <FormField
              control={form.control}
              name="targetDeliveryTime"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-stone-700">Target Time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      className="h-10 bg-stone-50 border-stone-300"
                    />
                  </FormControl>
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
                    <div className="grid grid-cols-3 w-full p-1 bg-stone-100 rounded-lg border border-stone-200 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(1);
                        }}
                        className={cn(
                          "min-w-0 flex items-center justify-center gap-1.5 h-9 px-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                          Number(field.value) === 1
                            ? "bg-white text-[#C81E1E] shadow-xs border border-stone-200"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
                        )}
                      >
                        <span className="text-sm shrink-0">🚗</span>
                        <span className="truncate">Delivery</span>
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
                          "min-w-0 flex items-center justify-center gap-1.5 h-9 px-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                          Number(field.value) === 0
                            ? "bg-white text-[#C81E1E] shadow-xs border border-stone-200"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
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
                          "min-w-0 flex items-center justify-center gap-1.5 h-9 px-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                          Number(field.value) === 2
                            ? "bg-white text-[#C81E1E] shadow-xs border border-stone-200"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60"
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
                          ? "Customer Address / Landmark (For records)"
                          : Number(fulfillment) === 2
                          ? "Drop-off Address for Lalamove Courier"
                          : "Full Address or Delivery Landmark"
                      }
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
                    Remarks / Instructions
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Use the side gate"
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
                          { shouldValidate: true, shouldDirty: true }
                        );
                      },
                    })}
                  />

                  <select
                    {...form.register(`items.${index}.itemCategoryId` as const, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const val = parseInt(e.target.value, 10);
                        form.setValue(`items.${index}.itemCategoryId`, val, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      },
                    })}
                    className="w-full h-10 rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {/* ONLY SHOW LECHONS HERE */}
                    {lechonOptions.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} (₱{(cat.basePrice || cat.price || 0).toLocaleString()})
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
              <span className="text-amber-600">ℹ</span> Changing the Delivery
              Time or Size will recalculate the Kitchen timeline.
            </p>
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
                            { shouldValidate: true, shouldDirty: true }
                          );
                        },
                      },
                    )}
                  />
                  <select
                    {...form.register(`dynamicAddOns.${index}.name` as const, {
                      onChange: (e) => {
                        form.setValue(`dynamicAddOns.${index}.name`, e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
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
                    remainingBalance < 0
                      ? "text-rose-600"
                      : "text-emerald-600"
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
              Cancel / Discard
            </Button>
            <Button
              type="submit"
              className="w-1/2 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium h-11 shadow-sm transition-colors"
              disabled={editMutation.isPending}
            >
              {editMutation.isPending
                ? "Securely Saving..."
                : "Save Modifications"}
            </Button>
          </div>
        </form>
      </div>
    </Form>
  );
}
