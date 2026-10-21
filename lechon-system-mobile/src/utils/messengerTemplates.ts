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
  landmark?: string | null;
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

export const SOURCE_PILLS = [
  'Walk-in',
  'Business FB Page',
  'Personal FB Account',
  'Other',
] as const;

export const EVENT_TYPE_PILLS = [
  { id: 'Birthday', label: '🎂 Birthday' },
  { id: 'Anniversary', label: '🎉 Anniversary' },
  { id: 'Binyag', label: '👶 Binyag' },
  { id: 'Wedding', label: '💍 Wedding' },
  { id: 'Fiesta', label: '🎆 Fiesta' },
  { id: 'Corporate', label: '🏢 Corporate' },
  { id: 'Other', label: '✨ Other' },
] as const;

export const RIDER_DEPARTURE_NUDGE_PILLS = [
  { label: '-30m', minutes: -30 },
  { label: '-45m', minutes: -45 },
  { label: '-1h', minutes: -60 },
  { label: '-1h 30m', minutes: -90 },
  { label: '-2h', minutes: -120 },
] as const;

/**
 * 6-Tier Distance Departure Ladder Helper:
 * - Store Pickup (fulfillment === 0): 0 min offset (returns targetDeliveryTime)
 * - 0.0 – 2.9 km: -15 minutes
 * - 3.0 – 9.9 km: -30 minutes
 * - 10.0 – 15.0 km: -60 minutes (1 hr)
 * - 16.0 – 20.0 km: -75 minutes (1 hr 15m)
 * - 20.1 – 35.0 km: -90 minutes (1.5 hrs)
 * - > 35.0 km: -120 minutes (2 hrs)
 */
export const calculateRiderDepartureTime = (
  targetDeliveryTime: Date,
  distanceKm: number,
  fulfillment: number
): Date => {
  const baseTime = new Date(targetDeliveryTime.getTime());
  if (isNaN(baseTime.getTime())) {
    return new Date();
  }

  if (fulfillment === 0) {
    return baseTime;
  }

  const km = isNaN(distanceKm) || distanceKm < 0 ? 0 : distanceKm;
  let offsetMinutes = -15;

  if (km <= 2.9) {
    offsetMinutes = -15;
  } else if (km <= 9.9) {
    offsetMinutes = -30;
  } else if (km <= 15.0) {
    offsetMinutes = -60;
  } else if (km <= 20.0) {
    offsetMinutes = -75;
  } else if (km <= 35.0) {
    offsetMinutes = -90;
  } else {
    offsetMinutes = -120;
  }

  return new Date(baseTime.getTime() + offsetMinutes * 60 * 1000);
};

const formatDateTime = (dateVal: string | Date): string => {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const generateBookingConfirmation = (order: TemplateOrderData): string => {
  const fulfillmentLabels: Record<number, string> = {
    0: '🏪 Walk-in Store Pickup',
    1: '🚗 Freelance Delivery',
    2: '📦 Lalamove Courier (Customer Paid)',
  };

  const itemsList =
    order.items.length > 0
      ? order.items.map((i) => `• (${i.quantity}x) ${i.categoryName}`).join('\n')
      : '• Lechon Order';

  const addressLine = order.deliveryAddress?.trim()
    ? `📍 Address: ${order.deliveryAddress}`
    : '📍 Address: (Store Counter Handover)';

  const landmarkLine = order.landmark?.trim()
    ? `\n🧭 Landmark: ${order.landmark.trim()}`
    : '';

  return `🐷 YUMI'S LECHON - ORDER CONFIRMATION

Magandang araw po, ${order.customerName}! 
Kumpirmado na po ang inyong reservation:

📅 Target Date & Time: ${formatDateTime(order.targetDeliveryTime)}
📍 Fulfillment: ${fulfillmentLabels[order.fulfillment] || 'Delivery'}
${addressLine}${landmarkLine}

📋 ORDER SUMMARY:
${itemsList}
${order.remarks ? `Bilin/Remarks: ${order.remarks}\n` : ''}
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
    .join(', ');

  const landmarkSuffix = order.landmark?.trim()
    ? `\n🧭 Landmark: ${order.landmark.trim()}`
    : '';

  const locationLine =
    order.fulfillment === 0
      ? '🏪 Store Pickup'
      : `📍 Drop-off: ${order.deliveryAddress || 'Address on record'}${landmarkSuffix}`;

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
  const landmarkSuffix = order.landmark?.trim()
    ? `\n🧭 Landmark: ${order.landmark.trim()}`
    : '';

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

📍 Drop-off Destination: ${order.deliveryAddress || 'Address on record'}${landmarkSuffix}
💵 BALANCE NA IAABOT/SESEND SA TINDAHAN: ₱${order.balanceDue.toLocaleString()}

(Ihiwalay po ang bayad sa delivery fare ng Lalamove app). Maraming salamat po!`;
  }

  const riderDetails = rider?.name
    ? `🛵 Assigned Rider: ${rider.name}\n📞 Rider Contact: ${rider.phone || 'On file'}`
    : '🛵 Assigned Rider: Out for delivery via freelance courier';

  return `🛵 YUMI'S LECHON - ON THE WAY NA PO!

Magandang araw po, ${order.customerName}!
Ang inyong mainit at bagong lutong lechon ay papunta na po sa inyong lokasyon!

${riderDetails}
📍 Delivery Destination: ${order.deliveryAddress || 'Address on record'}${landmarkSuffix}
💵 EKSAMPTONG HALAGA NA IAABOT SA RIDER: ₱${order.balanceDue.toLocaleString()}

(Pakihanda po ang eksaktong halaga para mabilis po ang turnover. Enjoy your lechon!)`;
};
