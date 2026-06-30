import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { orderFormSchema } from "@/schemas/orderSchema";
import { z } from "zod";
import { toast } from "sonner";

type OrderFormValues = z.infer<typeof orderFormSchema>;

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
// 1. Import the Shadcn Select components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export default function OrderForm() {
  const queryClient = useQueryClient();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      targetDeliveryTime: "",
      fulfillmentType: "1",
      items: [{ itemCategoryId: 1, quantity: 1 }],

      // -- ADD THESE NEW DEFAULT VALUES --
      address: "",
      remarks: "",
      price: 0,
      addOns: "",
      deliveryFee: 0,
    },
  });

  
  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (newOrder: OrderFormValues) => {
      // The spread operator (...) automatically includes our new fields
      // like address, remarks, price, addOns, and deliveryFee!
      const payload = {
        ...newOrder,
        fulfillment: parseInt(newOrder.fulfillmentType, 10) 
      };

      const response = await axios.post(
        "http://localhost:5199/api/orders",
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Order Created Successfully!", {
        description: "The order slip is now live on your dashboard roster.",
      });
      form.reset(); // Clear the form for the next customer
      
      // -- NEW: AGGRESSIVE CACHE INVALIDATION --
      // Tell React to instantly refresh these specific views
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "daily-sheets"] });
    },
    onError: () => {
      toast.error("Submission Failed", {
        description: "Could not deliver order request to .NET backend.",
      });
    },
  });

  function onSubmit(data: OrderFormValues) {
    createOrderMutation.mutate(data);
  }

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

        {/* 2. The Updated Shadcn Select Field for Fulfillment */}
        <FormField
          control={form.control}
          name="fulfillmentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fulfillment Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="focus:ring-orange-500">
                    <SelectValue placeholder="Select fulfillment method" />
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

                    // 1. Convert the HTML string into a real JavaScript Date object
                    const dateObj = new Date(rawValue);

                    // 2. The Math: Round to the nearest 15 minutes (in milliseconds)
                    // 15 minutes = 1000ms * 60s * 15m = 900,000 milliseconds
                    const ms = 1000 * 60 * 15;
                    const snappedDate = new Date(Math.round(dateObj.getTime() / ms) * ms);

                    // 3. Rebuild the string manually so it stays in Local Time for the UI
                    // (Padding with "0" ensures we get "09" instead of just "9")
                    const year = snappedDate.getFullYear();
                    const month = String(snappedDate.getMonth() + 1).padStart(2, "0");
                    const day = String(snappedDate.getDate()).padStart(2, "0");
                    const hours = String(snappedDate.getHours()).padStart(2, "0");
                    const mins = String(snappedDate.getMinutes()).padStart(2, "0");

                    // 4. Send the perfectly formatted, snapped time back to the form!
                    field.onChange(`${year}-${month}-${day}T${hours}:${mins}`);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* -- NEW ROUTING FIELDS -- */}
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
                >
                  <option value={1}>Whole Lechon (Small 15kg)</option>
                  <option value={2}>Whole Lechon (Medium 20kg)</option>
                  <option value={3}>Lechon Belly (Per kg)</option>
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

        {/* -- NEW FINANCIAL FIELDS -- */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
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
            <FormLabel>Distance (KM) - Auto Calculator</FormLabel>
            <Input
              type="number"
              placeholder="e.g., 5"
              onChange={(e) => {
                const km = parseFloat(e.target.value) || 0;
                const calculatedFee = km > 0 ? 50 + 15 * km : 0;
                form.setValue("deliveryFee", calculatedFee); // Magically updates the field below!
              }}
            />
            <p className="text-xs text-muted-foreground">
              Formula: ₱50 + (₱15 x KM). Override the fee below if free
              delivery.
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
          name="addOns"
          render={({ field }) => (
            <FormItem className="mb-6">
              <FormLabel>Add-Ons (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Extra Dinuguan, 2x Sarsa"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
