import { z } from "zod";

// We define the exact shape of a valid order (The Bouncer)
export const orderFormSchema = z.object({
  customerName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  customerPhone: z.string().min(10, { message: "Please enter a valid phone number." }),
  targetDeliveryTime: z.string().nonempty({ message: "Delivery time is required." }),
  fulfillmentType: z.string(),

  // -- FINANCIAL & ROUTING FIELDS --
  address: z.string().min(1, { message: "Location/Address is required." }),
  remarks: z.string().optional(),
  price: z.number().min(0, { message: "Price cannot be negative." }),
  addOns: z.string().optional(),
  deliveryFee: z.number().min(0, { message: "Delivery fee cannot be negative." }),
  
  // 1. Add the downpayment field so Zod knows it exists!
  downpayment: z.number().min(0, { message: "Downpayment cannot be negative." }),
  isTrustedCustomer: z.boolean().default(false),
  
  items: z.array(
    z.object({
      itemCategoryId: z.number(),
      quantity: z.number().min(1, { message: "Must order at least 1." })
    })
  ).min(1, { message: "Order must contain at least one item." })

// 2. Chain the "Smart Cashier" rule onto the very end of the object
});

// Export the inferred TypeScript interface (The Blueprint)
export type OrderFormData = z.infer<typeof orderFormSchema>;