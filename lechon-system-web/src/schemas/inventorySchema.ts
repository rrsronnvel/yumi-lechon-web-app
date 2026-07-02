import { z } from "zod";

// The strict rulebook for manual adjustments
export const adjustmentSchema = z.object({
  itemCategoryId: z.coerce.number().min(1, "Category ID is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  transactionType: z.enum(["StockIn", "StockOut", "Adjustment"]),
  reason: z.string().min(5, "You must provide a detailed reason (min 5 chars)."),
});

// Exporting the Type so React knows exactly what shape the form is
export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;