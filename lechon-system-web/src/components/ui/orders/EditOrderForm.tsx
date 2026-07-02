/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useEditOrder } from "@/hooks/useEditOrder";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";

export default function EditOrderForm({ order, onClose }: { order: any, onClose: () => void }) {
  const editMutation = useEditOrder();

  // Fetch categories for the size dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: async () => {
      const response = await apiClient.get("/inventory/categories");
      return response.data;
    },
  });

  // Initialize a blank form
  const form = useForm({
    defaultValues: {
      id: 0,
      customerName: "",
      targetDeliveryTime: "",
      items: [{ id: 0, itemCategoryId: 1, quantity: 1 }],
      // Include other fields to satisfy the C# DTO
      contactNumber: "", deliveryAddress: "", remarks: "", price: 0, addOns: "", deliveryFee: 0, downpayment: 0, fulfillment: 1
    }
  });

  const { fields } = useFieldArray({ name: "items", control: form.control });

  // THE MAGIC: Pre-fill the form when the 'order' prop changes!
  useEffect(() => {
    if (order) {
      // Format datetime to fit the HTML input type="datetime-local"
      const formattedDate = new Date(order.targetDeliveryTime).toISOString().slice(0, 16);
      
      form.reset({
        id: order.id,
        customerName: order.customerName || "",
        targetDeliveryTime: formattedDate,
        contactNumber: order.contactNumber || "",
        deliveryAddress: order.location || "",
        remarks: order.remarks || "",
        price: order.totalAmount || 0,
        addOns: order.addOns || "",
        deliveryFee: order.deliveryFee || 0,
        downpayment: order.downpayment || 0,
        fulfillment: 1,
        // Map the items to include their existing IDs
        items: order.orderItems?.map((i: any) => ({
          id: i.id, 
          itemCategoryId: i.itemCategoryId,
          quantity: i.quantity
        })) || [{ id: 0, itemCategoryId: 1, quantity: 1 }]
      });
    }
  }, [order, form]);

  // Handle Submission
  function onSubmit(data: any) {
    editMutation.mutate(data, {
      onSuccess: () => {
        onClose(); // Slide the sheet closed upon success!
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        
        <FormField control={form.control} name="customerName" render={({ field }) => (
          <FormItem>
            <FormLabel>Customer Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="targetDeliveryTime" render={({ field }) => (
          <FormItem>
            <FormLabel>Target Delivery Time</FormLabel>
            <FormControl><Input type="datetime-local" {...field} /></FormControl>
          </FormItem>
        )} />

        <div className="pt-2 border-t">
          <FormLabel className="mb-2 block">Lechon Size</FormLabel>
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <select
                {...form.register(`items.${index}.itemCategoryId`, { valueAsNumber: true })}
                className="w-full h-10 rounded-md border border-input bg-white px-3"
              >
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          ))}
          <p className="text-xs text-orange-600 mt-2 font-medium">
            *Changing the Delivery Time or Size will instantly recalculate the Kitchen timeline.
          </p>
        </div>

        <Button type="submit" className="w-full bg-orange-600 mt-4" disabled={editMutation.isPending}>
          {editMutation.isPending ? "Saving Changes..." : "Save & Reschedule"}
        </Button>
      </form>
    </Form>
  );
}