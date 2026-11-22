export function getPaymentChannelBadgeText(
  order?: {
    downpaymentMethod?: string | null;
    paymentChannelsSummary?: { paymentMethod: string; amount: number }[];
    paymentLogs?: { paymentMethod: string; amount: number; isVoided?: boolean }[];
  } | null,
  fallbackMethod?: string | null
): string {
  if (!order) return fallbackMethod || 'GCash';

  // 1. Inspect non-voided payment logs
  if (order.paymentLogs && order.paymentLogs.length > 0) {
    const activeLogs = order.paymentLogs.filter((p) => !p.isVoided && Number(p.amount) > 0);
    const distinctMethods: string[] = [];
    for (const log of activeLogs) {
      const method = (log.paymentMethod || '').trim();
      if (method && !distinctMethods.includes(method)) {
        distinctMethods.push(method);
      }
    }
    if (distinctMethods.length > 1) {
      return `Split (${distinctMethods.join(' + ')})`;
    }
    if (distinctMethods.length === 1) {
      return distinctMethods[0];
    }
  }

  // 2. Inspect paymentChannelsSummary
  if (order.paymentChannelsSummary && order.paymentChannelsSummary.length > 0) {
    const activeChannels = order.paymentChannelsSummary.filter((c) => Number(c.amount) > 0);
    const distinctMethods = Array.from(
      new Set(activeChannels.map((c) => c.paymentMethod.trim()).filter(Boolean))
    );
    if (distinctMethods.length > 1) {
      return `Split (${distinctMethods.join(' + ')})`;
    }
    if (distinctMethods.length === 1) {
      return distinctMethods[0];
    }
  }

  // 3. Check downpaymentMethod starting with Split
  const dpMethod = (order.downpaymentMethod || '').trim();
  if (dpMethod.toLowerCase().startsWith('split')) {
    return dpMethod;
  }

  // 4. Fallback
  return dpMethod || fallbackMethod || 'GCash';
}
