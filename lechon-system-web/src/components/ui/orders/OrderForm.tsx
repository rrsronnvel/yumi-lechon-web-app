/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { OrderFormData, orderFormSchema } from "@/schemas/orderSchema";
import { z } from "zod";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// MOCK CMS DATA: Future-proofing for our Add-Ons Database Table
const AVAILABLE_ADDONS = [
  { id: 1, name: "Dinuguan", price: 100 },
  { id: 2, name: "Sarsa", price: 50 },
  { id: 3, name: "Pancit Palabok", price: 200 },
  { id: 4, name: "Puto", price: 200 },
];

export default function OrderForm() {
  const queryClient = useQueryClient();

  // 1. FETCH DATA FIRST: Get live inventory categories from the backend
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: async () => {
      const response = await axios.get(
        "http://localhost:5199/api/inventory/categories",
      );
      return response.data;
    },
  });

  // 2. INITIALIZE FORM SECOND: Create the form so it exists in memory
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema as any),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      targetDeliveryTime: "",
      fulfillmentType: "1",
      items: [{ itemCategoryId: 1, quantity: 1 }],
      addOnArray: [],
      address: "",
      remarks: "",
      price: 0,
      addOns: "",
      deliveryFee: 0,
      downpayment: 0, // <--- Ensure this is exactly 0
      isTrustedCustomer: false, // <--- Ensure this is exactly false
      discount: 0,
      grandTotal: 0,
    },
  });

  // 3. SET UP WATCHERS THIRD: Now that the form exists, we can watch it

  // Array 1: The Main Lechon Items
  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  });

  // Array 2: The Lightweight Add-Ons
  const {
    fields: addOnFields,
    append: appendAddOn,
    remove: removeAddOn,
  } = useFieldArray({
    name: "addOnArray",
    control: form.control,
  });

  // 4. RUN THE MATH FOURTH: The Bulletproof RHF Subscription
  useEffect(() => {
    if (categories.length === 0) return; // Wait for backend data

    // Helper function so we can calculate immediately AND on every keystroke
    const calculatePrice = (cartItems: any[]) => {
      let runningTotal = 0;
      cartItems.forEach((cartItem) => {
        const categoryId = Number(cartItem?.itemCategoryId);
        const qty = Number(cartItem?.quantity) || 1;

        const dbCategory = categories.find(
          (c: { id: number; basePrice: number }) => c.id === categoryId,
        );

        if (dbCategory) {
          runningTotal += dbCategory.basePrice * qty;
        }
      });
      return runningTotal;
    };

    // 1. Force an immediate calculation the exact millisecond the backend API data loads
    const currentFormValues = form.getValues("items");
    form.setValue("price", calculatePrice(currentFormValues));

    // 2. Subscribe directly to the form's internal heartbeat for all future changes
    const subscription = form.watch((value) => {
      const newBasePrice = calculatePrice(value.items || []);
      const delivery = Number(value.deliveryFee) || 0;
      const discount = Number(value.discount) || 0;

      // 🚀 NEW: Sum up the Add-On prices dynamically
      const addOnsTotal = (value.addOnArray || []).reduce(
        (sum, item) => sum + (Number(item?.price) || 0),
        0,
      );

      // 🚀 NEW: The Final Equation: (Price + AddOns + DeliveryFee) - Discount
      const finalTotal = newBasePrice + addOnsTotal + delivery - discount;

      // Magically push the base price into the UI
      if (value.price !== newBasePrice) {
        form.setValue("price", newBasePrice, { shouldValidate: true });
      }

      // Magically push the Grand Total into the UI
      if (value.grandTotal !== finalTotal) {
        form.setValue("grandTotal", finalTotal, { shouldValidate: true });
      }
    });

    // Clean up memory when the component closes
    return () => subscription.unsubscribe();
  }, [categories, form]);

  // 5. SET UP SUBMISSION FIFTH: Handle sending the final payload to the backend
  const createOrderMutation = useMutation({
    mutationFn: async (newOrder: OrderFormData) => {
      const payload = {
        ...newOrder,
        fulfillment: parseInt(newOrder.fulfillmentType, 10),
      };

      const response = await axios.post(
        "http://localhost:5199/api/orders",
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Order Created Successfully!", {
        description: "The order slip is now live on your dashboard roster.",
      });
      form.reset(); // Clear the form for the next customer

      // AGGRESSIVE CACHE INVALIDATION
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      queryClient.invalidateQueries({
        queryKey: ["schedules", "daily-sheets"],
      });
    },
    onError: () => {
      toast.error("Submission Failed", {
        description: "Could not deliver order request to .NET backend.",
      });
    },
  });

  function onSubmit(data: OrderFormData) {
    // Format the array into a clean receipt string
    const addOnsString = data.addOnArray
      ?.filter((a) => a.name && a.name.trim() !== "")
      .map((a) => `${a.quantity}x ${a.name} (₱${a.price})`)
      .join(", ");

    const payload = {
      ...data,
      fulfillment: parseInt(data.fulfillmentType, 10),
      addOns: addOnsString || "", // Overwrite the string field with our formatted data!
    };

    createOrderMutation.mutate(payload);
  }

  // 6. RENDER THE UI
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-xl bg-white p-6 rounded-lg border shadow-sm"
      >
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Order Entry Terminal
          </h2>
          <p className="text-xs text-muted-foreground">
            Input Facebook Messenger payloads or walk-in tickets directly.
          </p>
        </div>

        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Juan Dela Cruz" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 0917XXXXXXX" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fulfillmentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="focus:ring-orange-500">
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1">🚗 Delivery Routing</SelectItem>
                  <SelectItem value="0">🏪 Walk-in Store Pickup</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targetDeliveryTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Delivery/Pickup Date & Time</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  step={900}
                  className="h-10 focus-visible:ring-orange-500"
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
                    const day = String(snappedDate.getDate()).padStart(2, "0");
                    const hours = String(snappedDate.getHours()).padStart(
                      2,
                      "0",
                    );
                    const mins = String(snappedDate.getMinutes()).padStart(
                      2,
                      "0",
                    );

                    field.onChange(`${year}-${month}-${day}T${hours}:${mins}`);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Address / Location</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 123 Main St, Bacoor" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Deliver to the blue gate"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">
              Weight & Categories
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ itemCategoryId: 1, quantity: 1 })}
            >
              + Add Item
            </Button>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex gap-3 items-start bg-slate-50 p-3 rounded-md relative border border-dashed"
            >
              <div className="flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Product Category
                </span>
                <select
                  {...form.register(`items.${index}.itemCategoryId` as const, {
                    valueAsNumber: true,
                  })}
                  className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none"
                  disabled={isCategoriesLoading}
                >
                  <option value={0} disabled>
                    {isCategoriesLoading
                      ? "Loading sizes..."
                      : "Select a size..."}
                  </option>

                  {categories.map(
                    (category: {
                      id: number;
                      name: string;
                      basePrice: number;
                    }) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="w-20 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Qty
                </span>
                <Input
                  type="number"
                  {...form.register(`items.${index}.quantity` as const, {
                    valueAsNumber: true,
                  })}
                  className="h-9 bg-white"
                />
              </div>

              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-5 h-9"
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t mt-4">
          <FormField
            control={form.control}
            name="price"
            render={() => (
              <FormItem>
                <FormLabel>Lechon Price (₱)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...form.register("price", { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-1 mb-4">
            <FormLabel>Distance (KM)</FormLabel>
            <Input
              type="number"
              placeholder="e.g., 5"
              onChange={(e) => {
                const km = parseFloat(e.target.value) || 0;
                const calculatedFee = km > 0 ? 50 + 15 * km : 0;
                form.setValue("deliveryFee", calculatedFee);
              }}
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Formula: ₱50 + (₱15 x KM). Override if free delivery.
            </p>
          </div>

          <FormField
            control={form.control}
            name="deliveryFee"
            render={() => (
              <FormItem>
                <FormLabel>Delivery Fee (₱)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...form.register("deliveryFee", { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="discount"
          render={() => (
            <FormItem>
              <FormLabel className="text-red-600">Discount (₱)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  {...form.register("discount", { valueAsNumber: true })}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="grandTotal"
          render={() => (
            <FormItem>
              <FormLabel className="font-bold text-green-700">
                Grand Total (₱)
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  readOnly
                  className="bg-green-50 font-bold text-lg"
                  {...form.register("grandTotal", { valueAsNumber: true })}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* --- NEW DOWNPAYMENT & VIP SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t mt-4 items-end">
          <FormField
            control={form.control}
            name="downpayment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Downpayment Received (₱)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...form.register("downpayment", { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isTrustedCustomer"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm h-[68px]">
                <div className="space-y-0.5">
                  <FormLabel className="text-base font-semibold text-orange-700">
                    👑 VIP Trusted Customer
                  </FormLabel>
                  <p className="text-[11px] text-muted-foreground">
                    Bypass the downpayment requirement.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3 border-t pt-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">
              Lightweight Add-Ons
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendAddOn({ name: "", quantity: 1, price: 0 })}
            >
              + Add Extra
            </Button>
          </div>

          {addOnFields.map((field, index) => (
            <div
              key={field.id}
              className="flex gap-3 items-end bg-orange-50/50 p-3 rounded-md relative border border-dashed border-orange-200"
            >
              <div className="flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Add-On Item
                </span>
                <select
                  className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none"
                  {...form.register(`addOnArray.${index}.name` as const, {
                    // The Magic Calculator: When they pick an item, find the price and push it!
                    onChange: (e) => {
                      const selectedItem = AVAILABLE_ADDONS.find(
                        (a) => a.name === e.target.value,
                      );
                      if (selectedItem) {
                        form.setValue(
                          `addOnArray.${index}.price`,
                          selectedItem.price,
                          { shouldValidate: true },
                        );
                      }
                    },
                  })}
                >
                  <option value="" disabled>
                    Select an add-on...
                  </option>
                  {AVAILABLE_ADDONS.map((addon) => (
                    <option key={addon.id} value={addon.name}>
                      {addon.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-20 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Qty
                </span>
                <Input
                  type="number"
                  {...form.register(`addOnArray.${index}.quantity` as const, {
                    valueAsNumber: true,
                  })}
                  className="h-9 bg-white"
                />
              </div>
              <div className="w-24 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Price (₱)
                </span>
                <Input
                  type="number"
                  placeholder="0"
                  {...form.register(`addOnArray.${index}.price` as const, {
                    valueAsNumber: true,
                  })}
                  className="h-9 bg-white"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9"
                onClick={() => removeAddOn(index)}
              >
                X
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="submit"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          disabled={createOrderMutation.isPending}
        >
          {createOrderMutation.isPending
            ? "Validating & Ingesting..."
            : "Submit Order Ticket"}
        </Button>
      </form>
    </Form>
  );
}
