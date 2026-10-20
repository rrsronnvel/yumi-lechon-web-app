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

  return `🐷 YUMI'S LECHON - ORDER CONFIRMATION
Order Reference: #${order.orderNumber || 'NEW'}

Magandang araw po, ${order.customerName}! 
Kumpirmado na po ang inyong reservation:

📅 Target Date & Time: ${formatDateTime(order.targetDeliveryTime)}
📍 Fulfillment: ${fulfillmentLabels[order.fulfillment] || 'Delivery'}
${addressLine}

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
