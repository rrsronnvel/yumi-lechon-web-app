export interface TemplateOrderItem {
  categoryName: string;
  quantity: number;
}

export interface TemplateOrderData {
  orderNumber?: string | number;
  customerName: string;
  targetDeliveryTime: string | Date;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  deliveryAddress?: string;
  items: TemplateOrderItem[];
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
  downpayment: number;
  balanceDue: number;
  remarks?: string;
}

export interface RiderInfo {
  name: string;
  phone?: string;
}

const formatDateTime = (dateVal: string | Date) => {
  const d = new Date(dateVal);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export const generateBookingConfirmation = (order: TemplateOrderData): string => {
  const fulfillmentLabels: Record<number, string> = {
    0: "🏪 Walk-in Store Pickup",
    1: "🚗 Freelance Delivery",
    2: "📦 Lalamove Courier (Customer Paid)",
  };

  const itemsList = order.items
    .map((i) => `• (${i.quantity}x) ${i.categoryName}`)
    .join("\n");

  const addressLine = order.deliveryAddress?.trim()
    ? `📍 Address: ${order.deliveryAddress}`
    : "📍 Address: (Store Counter Handover)";

  return `🐷 YUMI'S LECHON - ORDER CONFIRMATION
Order Reference: #${order.orderNumber || "NEW"}

Magandang araw po, ${order.customerName}! 
Kumpirmado na po ang inyong reservation:

📅 Target Date & Time: ${formatDateTime(order.targetDeliveryTime)}
📍 Fulfillment: ${fulfillmentLabels[order.fulfillment] || "Delivery"}
${addressLine}

📋 ORDER SUMMARY:
${itemsList}
${order.remarks ? `Bilin/Remarks: ${order.remarks}\n` : ""}
💰 FINANCIAL SUMMARY:
• Lechon & Items: ₱${order.subtotal.toLocaleString()}
• Delivery Fee: ₱${order.deliveryFee.toLocaleString()}
• Grand Total: ₱${order.grandTotal.toLocaleString()}
• Downpayment Received: ₱${order.downpayment.toLocaleString()}

👉 REMAINING BALANCE TO PAY: ₱${order.balanceDue.toLocaleString()}

Maraming salamat po sa pagtitiwala sa Yumi's Lechon! Kung mayroon po kayong karagdagang bilin, reply lang po rito.`;
};

export const generateVerificationReminder = (order: TemplateOrderData): string => {
  const itemsList = order.items
    .map((i) => `(${i.quantity}x) ${i.categoryName}`)
    .join(", ");

  const locationLine =
    order.fulfillment === 0
      ? "🏪 Store Pickup"
      : `📍 Drop-off: ${order.deliveryAddress || "Address on record"}`;

  return `⚠️ YUMI'S LECHON - FINAL DELIVERY CONFIRMATION

Hi po ${order.customerName}!
Pa-double check lang po namin ang detalye ng inyong lechon bukas:

📅 Petsa at Oras: ${formatDateTime(order.targetDeliveryTime)}
${locationLine}
🐷 Order: ${itemsList}
💵 Balance to Collect: ₱${order.balanceDue.toLocaleString()}

Paki-reply po ng "CONFIRMED" kung tama po ang lahat para masalang po namin ng tama. Salamat po!`;
};

export const generateDispatchNotification = (
  order: TemplateOrderData,
  rider?: RiderInfo
): string => {
  if (order.fulfillment === 0) {
    return `🐷 YUMI'S LECHON - READY FOR PICKUP!

Magandang araw po, ${order.customerName}!
Luto at naka-package na po ang inyong lechon para sa inyong pickup sa aming tindahan.

💵 EKSAMPTONG BALANCE NA BABAYARAN SA COUNTER: ₱${order.balanceDue.toLocaleString()}

Maraming salamat po!`;
  }

  if (order.fulfillment === 2) {
    return `📦 YUMI'S LECHON - LALAMOVE HANDOVER DISPATCHED

Magandang araw po, ${order.customerName}!
Na-turnover na po sa Lalamove courier ang inyong bagong lutong lechon!

📍 Drop-off Destination: ${order.deliveryAddress || "Address on record"}
💵 BALANCE NA IAABOT/SESEND SA TINDAHAN: ₱${order.balanceDue.toLocaleString()}

(Ihiwalay po ang bayad sa delivery fare ng Lalamove app). Maraming salamat po!`;
  }

  const riderDetails = rider?.name
    ? `🛵 Assigned Rider: ${rider.name}\n📞 Rider Contact: ${rider.phone || "On file"}`
    : "🛵 Assigned Rider: Out for delivery via freelance courier";

  return `🛵 YUMI'S LECHON - ON THE WAY NA PO!

Magandang araw po, ${order.customerName}!
Ang inyong mainit at bagong lutong lechon ay papunta na po sa inyong lokasyon!

${riderDetails}
📍 Delivery Destination: ${order.deliveryAddress || "Address on record"}
💵 EKSAMPTONG HALAGA NA IAABOT SA RIDER: ₱${order.balanceDue.toLocaleString()}

(Pakihanda po ang eksaktong halaga para mabilis po ang turnover. Enjoy your lechon!)`;
};
