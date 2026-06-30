import { z } from "zod";

// We define the exact shape of a valid order (The Bouncer)
export const orderFormSchema = z.object({
  customerName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  customerPhone: z.string().min(10, { message: "Please enter a valid phone number." }),
  targetDeliveryTime: z.string().nonempty({ message: "Delivery time is required." }),
  fulfillmentType: z.string(), 
  
  // -- NEW FINANCIAL & ROUTING FIELDS ADDED HERE --
  address: z.string().min(1, { message: "Location/Address is required." }),
  remarks: z.string().optional(),
  price: z.number().min(0, { message: "Price cannot be negative." }),
  addOns: z.string().optional(),
  deliveryFee: z.number().min(0, { message: "Delivery fee cannot be negative." }),

  items: z.array(
    z.object({
      itemCategoryId: z.number(),
      quantity: z.number().min(1, { message: "Must order at least 1." })
    })
  ).min(1, { message: "Order must contain at least one item." })
});

// 2. Export the inferred TypeScript interface (The Blueprint)
// This ensures whenever you use this schema in react-hook-form, VS Code knows the exact fields.
export type OrderFormData = z.infer<typeof orderFormSchema>;