import { z } from "zod";

// We define the exact shape of a valid order (The Bouncer)
export const orderFormSchema = z
  .object({
    isDraft: z.boolean().default(false),
    customerName: z.string().default(""),
    customerPhone: z.string().default(""),
    facebookName: z.string().optional().default(""),
    source: z.string().optional().default("Business FB Page"),
    eventType: z.string().optional().default(""),
    landmark: z.string().optional().default(""),
    targetDeliveryTime: z.string().default(""),
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
    downpaymentMethod: z
      .enum(["Cash", "GCash", "Maya", "Bank Transfer", "None"])
      .default("None"),
    freebiesSummary: z.string().nullable().optional(),
    freebiesConfigJson: z.string().nullable().optional(),
    isTrustedCustomer: z.boolean().default(false),

    items: z
      .array(
        z.object({
          itemCategoryId: z.number().min(1, { message: "Must select a valid item." }),
          quantity: z.number().min(1, { message: "Quantity must be at least 1." }),
        })
      )
      .default([]),

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
    if (data.isDraft) {
      // Draft rules: Require at least one identifier
      const hasName = data.customerName && data.customerName.trim().length > 0;
      const hasFb = data.facebookName && data.facebookName.trim().length > 0;
      if (!hasName && !hasFb) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Customer Name or Facebook Name is required for a draft inquiry.",
          path: ["customerName"],
        });
      }
      // Date, address, and items can be empty for drafts!
    } else {
      // Production rules: Strict enforcement
      if (!data.customerName || data.customerName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Name must be at least 2 characters.",
          path: ["customerName"],
        });
      }

      if (!data.customerPhone || data.customerPhone.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid phone number (min 10 digits).",
          path: ["customerPhone"],
        });
      }

      if (!data.targetDeliveryTime || data.targetDeliveryTime.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target delivery/pickup time is required.",
          path: ["targetDeliveryTime"],
        });
      }

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

      if (!data.items || data.items.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one item is required.",
          path: ["items"],
        });
      }
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
