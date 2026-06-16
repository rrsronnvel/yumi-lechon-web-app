import { z } from "zod";

// We define the exact shape of a valid order
export const orderFormSchema = z.object({
  customerName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  customerPhone: z.string().min(10, { message: "Please enter a valid phone number." }),
  targetDeliveryTime: z.string().nonempty({ message: "Delivery time is required." }),
  fulfillmentType: z.enum(["Delivery", "Pickup"]),
  
  // We expect an array of items (e.g., 1 Lechon, 2kg Belly)
  items: z.array(
    z.object({
      itemCategoryId: z.number(),
      quantity: z.number().min(1, { message: "Must order at least 1." })
    })
  ).min(1, { message: "Order must contain at least one item." })
});

// This magically creates a TypeScript type out of our schema!
export type OrderFormValues = z.infer<typeof orderFormSchema>;