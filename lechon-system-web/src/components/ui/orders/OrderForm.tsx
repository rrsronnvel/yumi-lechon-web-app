import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { orderFormSchema, OrderFormValues } from "@/schemas/orderSchema";
import { toast } from "sonner"; // 1. Grab Sonner's manager

// 2. Import your clean shadcn blocks
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OrderForm() {
  const queryClient = useQueryClient();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      targetDeliveryTime: "",
      fulfillmentType: "Delivery",
      items: [{ itemCategoryId: 1, quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (newOrder: OrderFormValues) => {
      const response = await axios.post(
        "http://localhost:5199/api/orders",
        newOrder,
      );
      return response.data;
    },
    onSuccess: () => {
      // 3. Seamless user notification!
      toast.success("Order Created Successfully!", {
        description: "The order slip is now live on your dashboard roster.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending"] });
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
    // 4. Wrap everything inside the smart Shadcn Form context shell
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

        {/* Customer Name Controlled Field */}
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Juan Dela Cruz" {...field} />
              </FormControl>
              <FormMessage /> {/* Displays automatic Zod messages perfectly */}
            </FormItem>
          )}
        />

        {/* Customer Phone Controlled Field */}
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

        {/* Fulfillment Type Selection Field */}
        <FormField
          control={form.control}
          name="fulfillmentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fulfillment Method</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Delivery">🚗 Delivery Routing</option>
                  <option value="Pickup">🏪 Walk-in Store Pickup</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Target Delivery Date & Time Field */}
        <FormField
          control={form.control}
          name="targetDeliveryTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Delivery/Pickup Date & Time</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  className="h-10 focus-visible:ring-orange-500"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dynamic Items Section */}
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
              {/* Native category selector remains for speed, styled with tailwind */}
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

              {/* Quantity input inside array row */}
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

        {/* Form Submit Controller */}
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
