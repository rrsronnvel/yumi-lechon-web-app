import { z } from "zod";

// We define the exact shape of a valid order (The Bouncer)
export const orderFormSchema = z
  .object({
    customerName: z
      .string()
      .min(2, { message: "Name must be at least 2 characters." }),
    customerPhone: z
      .string()
      .min(10, { message: "Please enter a valid phone number (min 10 digits)." }),
    facebookName: z.string().optional().default(""),
    source: z.string().optional().default("Business FB Page"),
    eventType: z.string().optional().default(""),
    landmark: z.string().optional().default(""),
    targetDeliveryTime: z
      .string()
      .min(1, { message: "Target delivery/pickup time is required." }),
    riderDepartureTime: z.string().optional().default(""),
    fulfillment: z.number().default(1), // 0 = Pickup, 1 = Delivery, 2 = Lalamove
    distanceKm: z.number().min(0).default(0),

    // -- FINANCIAL & ROUTING FIELDS --
    address: z.string().optional().default(""),
    remarks: z.string().optional().default(""),
    price: z.number().min(0, { message: "Price cannot be negative." }).default(0),
    addOns: z.string().optional().default(""),
    deliveryFee: z.number().min(0, { message: "Delivery fee cannot be negative." }).default(0),
    discount: z.number().min(0, { message: "Discount cannot be negative." }).default(0),
    grandTotal: z.number().min(0).default(0),
    downpayment: z.number().min(0, { message: "Downpayment cannot be negative." }).default(0),
    isTrustedCustomer: z.boolean().default(false),

    items: z
      .array(
        z.object({
          itemCategoryId: z.number().min(1, { message: "Must select a valid item." }),
          quantity: z.number().min(1, { message: "Quantity must be at least 1." }),
        })
      )
      .min(1, { message: "At least one item is required." }),

    // Backward-compatible fields
    fulfillmentType: z.string().optional(),
    addOnArray: z
      .array(
        z.object({
          name: z.string(),
          quantity: z.number().min(1),
          price: z.number().min(0),
        })
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    // If Delivery (1) or Lalamove (2) is chosen, address is mandatory
    if ((data.fulfillment === 1 || data.fulfillment === 2) && (!data.address || data.address.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          data.fulfillment === 2
            ? "Drop-off address is required for Lalamove courier orders."
            : "Delivery address is required for delivery orders.",
        path: ["address"],
      });
    }
  });

// Export the inferred TypeScript interface (The Blueprint)
export type OrderFormData = z.infer<typeof orderFormSchema>;

export interface ParsedOrderItemDto {
  itemCategoryId: number;
  quantity: number;
}

export interface ParsedOrderDraftDto {
  customerName: string;
  contactNumber: string;
  facebookName?: string | null;
  targetDeliveryTime?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  deliveryAddress?: string | null;
  landmark?: string | null;
  eventType?: string | null;
  remarks?: string | null;
  deliveryFee?: number | null;
  downpayment?: number | null;
  items: ParsedOrderItemDto[];
}
