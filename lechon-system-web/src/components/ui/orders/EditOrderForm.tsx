/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
interface AddOnItem {
  quantity: number;
  name: string;
}

// 1. Paste your mock data here, right below imports
const AVAILABLE_ADDONS = [
  { id: 1, name: "Dinuguan", price: 100 },
  { id: 2, name: "Sarsa", price: 50 },
  { id: 3, name: "Pancit Palabok", price: 200 },
  { id: 4, name: "Puto", price: 200 },
];

export default function EditOrderForm({
  order,
  onClose,
}: {
  order: any;
  onClose: () => void;
}) {
  const editMutation = useEditOrder();

  // Fetch categories for the size dropdown
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: async () => {
      const response = await apiClient.get("/inventory/categories");
      return response.data;
    },
  });

  // Initialize a blank form WITH EXPLICIT TYPES
  const form = useForm<{
    id: number;
    customerName: string;
    targetDeliveryTime: string;
    contactNumber: string;
    deliveryAddress: string;
    remarks: string;
    price: number;
    deliveryFee: number;
    fulfillment: number;
    downpayment: number;
    discount: number;
    items: any[];
    dynamicAddOns: AddOnItem[]; // <-- Explicitly telling TS about our array!
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
      fulfillment: 1,
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

  // THE MAGIC: Pre-fill the form when the 'order' prop changes!
  useEffect(() => {
    if (order) {
      // THE TIMEZONE FIX: Extract exact local digits instead of letting UTC shift the hours!
      const dt = new Date(order.targetDeliveryTime);
      const formattedDate = new Date(
        dt.getTime() - dt.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);

      // THE PARSER: Safely reads the string and formats it for React Hook Form
      const parsedAddOns: AddOnItem[] = (order.addOns || "")
        .split(",")
        .map((item: string) => {
          const cleanItem = item.trim();
          if (!cleanItem) return null;

          const match = cleanItem.match(/^(\d+)x\s+(.+)$/);
          if (match) {
            // THE CLEANER: Strips away the "(₱100)" or "(+₱50)" from the end of the string!
            const rawName = match[2].replace(/\s*\([^)]+\)$/, "").trim();
            return { quantity: parseInt(match[1], 10), name: rawName };
          }

          // Fallback cleaner for items without quantities
          const rawFallbackName = cleanItem.replace(/\s*\([^)]+\)$/, "").trim();
          return { quantity: 1, name: rawFallbackName };
        })
        .filter(Boolean) as AddOnItem[];

      // Instantly inject the parsed array into the form!
      form.reset({
        id: order.id,
        customerName: order.customerName || "",
        targetDeliveryTime: formattedDate,
        contactNumber: order.contactNumber || "",
        deliveryAddress: order.deliveryAddress || "",
        remarks: order.remarks || "",
        price: order.price || 0,
        deliveryFee: order.deliveryFee || 0,
        discount: order.discount || 0,
        downpayment: order.downpayment || 0,
        fulfillment: 1,
        dynamicAddOns: parsedAddOns, // <-- Injecting the strongly-typed array
        items: order.orderItems?.map((i: any) => ({
          id: i.id,
          itemCategoryId: i.itemCategoryId,
          quantity: i.quantity,
        })) || [{ id: 0, itemCategoryId: 1, quantity: 1 }],
      });
    }
  }, [order, form]);

  // THE SMART BALANCE: Watch all financial AND Dynamic Add-On fields
  const [price, deliveryFee, downpayment, discount, dynamicAddOns] = form.watch(
    ["price", "deliveryFee", "downpayment", "discount", "dynamicAddOns"],
  );

  // 1. Calculate dynamic Add-on costs (Quantity * Price)
  const totalAddOnCost = (dynamicAddOns || []).reduce(
    (total: number, addon: any) => {
      if (!addon.name) return total;
      const found = AVAILABLE_ADDONS.find((a) => a.name === addon.name);
      return total + (found?.price || 0) * (addon.quantity || 1);
    },
    0,
  );

  // 2. Calculate the live Grand Total dynamically
  const dynamicGrandTotal =
    (Number(price) || 0) +
    totalAddOnCost +
    (Number(deliveryFee) || 0) -
    (Number(discount) || 0);

  // 3. Subtract the locked downpayment for the final balance
  const remainingBalance = dynamicGrandTotal - (Number(downpayment) || 0);

  // THE AUTO-PRICE CALCULATOR
  const handleCalculatePrice = () => {
    setTimeout(() => {
      // 🚀 THE FIX: Check if this is a historical order!
      const targetDate = new Date(form.getValues("targetDeliveryTime"));
      const isPastOrder = targetDate < new Date();

      // If the order is already in the past, ABORT the live recalculation to protect the receipt!
      if (isPastOrder) {
        return;
      }

      const currentCart = form.getValues("items") || [];
      const newTotal = currentCart.reduce((sum: number, item: any) => {
        const category = categories.find(
          (c: any) => c.id === item.itemCategoryId,
        );
        // Safely check for basePrice (or price, depending on your C# model)
        const itemPrice = category?.basePrice || category?.price || 0;
        return sum + itemPrice * (item.quantity || 1);
      }, 0);

      // Magically push the new total into the input box (leaving it unlocked!)
      form.setValue("price", newTotal, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }, 0);
  };

  // Handle Submission
  function onSubmit(data: any) {
    // THE STRINGIFIER: Turn the array back into "2x Sarsa, 1x Puto"
    const combinedAddOns = (data.dynamicAddOns || [])
      .filter((a: any) => a.name && a.name.trim() !== "")
      .map((a: any) => `${a.quantity || 1}x ${a.name}`)
      .join(", ");

    const payload = {
      ...data,
      addOns: combinedAddOns, // Send the compressed string!
      grandTotal: dynamicGrandTotal, // Send the perfect math!
    };

    editMutation.mutate(payload, {
      onSuccess: () => {
        onClose();
      },
    });
  }

  // THE SHIELD: Prevent the dropdowns from rendering until the C# menu data arrives!
  if (isCategoriesLoading || categories.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 animate-pulse">
        Loading menu configurations...
      </div>
    );
  }

  return (
    <Form {...form}>
      {/* THE POLISH: We wrapped the form in a white card with padding (p-6) to match the Dossier layout! */}
      <div className="bg-white p-6 rounded-md border shadow-sm mt-2">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Customer & Delivery Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
                  <FormLabel className="text-gray-700">Customer Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-slate-50 focus-visible:ring-orange-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetDeliveryTime"
              render={({ field }) => (
                <FormItem className="col-span-2 sm:col-span-1">
                  <FormLabel className="text-gray-700">
                    Target Delivery Time
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      className="bg-slate-50 focus-visible:ring-orange-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700">
                  Remarks / Instructions
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Use the side gate"
                    {...field}
                    className="bg-slate-50 focus-visible:ring-orange-500"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* --- LECHON CART BLOCK --- */}
          <div className="pt-5 border-t border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <FormLabel className="text-base font-semibold text-gray-800">
                Lechon Cart
              </FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-dashed border-gray-300 text-gray-600 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50"
                onClick={() => {
                  // Safely use the first category ID available, then calculate!
                  appendItem({
                    id: 0,
                    itemCategoryId: categories[0]?.id || 1,
                    quantity: 1,
                  });
                  handleCalculatePrice();
                }}
              >
                + Add Lechon
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex gap-3 items-center bg-slate-50/50 p-3 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <select
                    {...form.register(
                      `items.${index}.itemCategoryId` as const,
                      {
                        valueAsNumber: true,
                        onChange: handleCalculatePrice, // <-- Trigger math on change!
                      },
                    )}
                    className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-400 hover:text-red-700 hover:bg-red-50 shrink-0"
                      onClick={() => {
                        removeItem(index);
                        handleCalculatePrice(); // <-- Trigger math on removal!
                      }}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-orange-600/80 mt-2 font-medium flex items-center gap-1">
              <span className="text-orange-500">ℹ</span> Changing the Delivery
              Time or Size will recalculate the Kitchen timeline.
            </p>
          </div>

          {/* --- DYNAMIC ADD-ONS BLOCK --- */}
          <div className="pt-5 border-t border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <FormLabel className="text-base font-semibold text-gray-800">
                Extra Add-Ons
              </FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-dashed border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50"
                onClick={() => appendAddOn({ quantity: 1, name: "" })}
              >
                + Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {addOnFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex gap-3 items-center bg-slate-50/50 p-3 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <Input
                    type="number"
                    min="1"
                    className="w-16 bg-white h-9 text-sm text-center font-medium focus-visible:ring-indigo-500"
                    {...form.register(
                      `dynamicAddOns.${index}.quantity` as const,
                      {
                        valueAsNumber: true,
                      },
                    )}
                  />
                  <select
                    {...form.register(`dynamicAddOns.${index}.name` as const)}
                    className="flex-1 h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="" className="text-gray-400">
                      -- Select Add-On --
                    </option>
                    {AVAILABLE_ADDONS.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} (+₱{a.price})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-400 hover:text-red-700 hover:bg-red-50 shrink-0"
                    onClick={() => removeAddOn(index)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {addOnFields.length === 0 && (
                <p className="text-sm text-gray-400 italic py-2">
                  No extra items requested.
                </p>
              )}
            </div>
          </div>

          {/* --- FINANCIAL ADJUSTMENTS BLOCK --- */}
          <div className="pt-6 border-t border-slate-200 space-y-5">
            <h3 className="text-base font-semibold text-gray-800">
              Financial Adjustments
            </h3>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-600 text-xs uppercase tracking-wider">
                      Lechon Price (₱)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        className="font-medium text-lg h-11"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-600 text-xs uppercase tracking-wider">
                      Delivery Fee (₱)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        className="h-11"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-red-600 font-bold text-xs uppercase tracking-wider">
                      Discount (₱)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || 0}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                        className="border-red-200 focus-visible:ring-red-400 text-red-600 h-11"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel className="text-indigo-600 font-bold text-xs uppercase tracking-wider">
                  Add-Ons Total (₱)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    disabled
                    value={totalAddOnCost}
                    className="bg-indigo-50/50 border-indigo-100 font-bold text-indigo-700 cursor-not-allowed h-11"
                  />
                </FormControl>
              </FormItem>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 p-5 rounded-lg border border-slate-200 items-end justify-between shadow-inner">
              <FormField
                control={form.control}
                name="downpayment"
                render={({ field }) => (
                  <FormItem className="w-full sm:w-1/2">
                    <FormLabel className="text-gray-500 text-xs uppercase tracking-wider flex items-center gap-1">
                      🔒 Historical Downpayment
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        disabled
                        {...field}
                        className="bg-gray-200/80 cursor-not-allowed text-gray-500 font-medium h-11 border-transparent"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex flex-col items-end w-full sm:w-1/2 pt-2 sm:pt-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Remaining Balance
                </p>
                <p
                  className={`text-3xl font-black tracking-tight ${remainingBalance < 0 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {remainingBalance < 0
                    ? `Refund: ₱${Math.abs(remainingBalance).toLocaleString()}`
                    : `₱${remainingBalance.toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 text-lg shadow-md transition-all active:scale-[0.99] mt-6"
            disabled={editMutation.isPending}
          >
            {editMutation.isPending
              ? "Securely Saving..."
              : "Save Modifications"}
          </Button>
        </form>
      </div>
    </Form>
  );
}
