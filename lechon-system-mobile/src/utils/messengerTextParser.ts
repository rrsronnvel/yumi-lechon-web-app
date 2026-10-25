export interface ItemCategory {
  id: number;
  name: string;
  basePrice: number;
  isActive: boolean;
  minimumWeightKg: number;
  maximumWeightKg: number;
  minimumSafetyStock?: number;
}

export interface ParsedOrderItemDto {
  itemCategoryId: number;
  quantity: number;
}

export interface ParsedOrderDraftDto {
  customerName: string;
  facebookName?: string | null;
  contactNumber: string;
  contactNumber2?: string | null;
  source?: string | null;
  eventType?: string | null;
  targetDeliveryTime?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  deliveryAddress?: string | null;
  landmark?: string | null;
  remarks?: string | null;
  deliveryFee?: number | null;
  downpayment?: number | null;
  freebiesOptOut?: boolean | null;
  rawInnards?: boolean | null;
  distanceKm?: number | null;
  discount?: number | null;
  downpaymentMethod?: string | null;
  items: ParsedOrderItemDto[];
}

export interface MessengerParserPricingConfig {
  noFreebiesDiscountPerPig?: number | null;
}

const BOILERPLATE_LINE_PATTERN =
  /to confirm your order|^\s*with\s+7\s+fre+bb?ies\b|spaghetti,\s*palabok.*consumed|delivery suggestion\s*:|kung gusto nyo po ng mas masarap|total balance\s*:/i;

const FIELD_LINE_PATTERN =
  /^(?:name|customer(?:\s*name)?|fb|facebook(?:\s*name)?|messenger(?:\s*name)?|pickup\s*or\s*deliver|del(?:ivery)?\s*add(?:ress)?|address|location|landmark|cp\s*#?\s*[12]|contact(?:\s*number)?|mobile|date\s*(?:&|and)\s*time|date|time|type\s*of\s*event|event(?:\s*type)?|occasion|order\s*\/\s*size|order|size|freebies?\s*or|add[\s-]*ons?|additional\s+.+|special\s*requests?|remarks?|notes?|distance|dp\s*(?:&|and)\s*mode|dp|down\s*payment|downpayment|deposit|delivery\s*(?:fee|charge)|deliver\s*charge|discount|price)\s*[:\-]/i;

const parsePesoNumber = (raw: string): number => {
  const cleaned = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  const value = cleaned ? Number(cleaned[0]) : 0;
  return Number.isFinite(value) ? value : 0;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeLine = (rawLine: string): string => {
  let line = rawLine.trim();
  if (!line) return '';

  // An order line may legitimately end with this phrase. Keep the order and
  // remove only the promotional suffix before applying the line-level guard.
  if (/^\s*(?:order\s*\/\s*size|order|size)\s*[:\-]/i.test(line)) {
    line = line.replace(/\s+with\s+7\s+fre+bb?ies\b.*$/i, '').trim();
  }

  return BOILERPLATE_LINE_PATTERN.test(line) ? '' : line;
};

const normalizePhone = (raw: string): string => {
  const candidate = raw.match(/(?:\+63|0)9\d{2}(?:[-\s]?\d{3})(?:[-\s]?\d{4})/);
  if (!candidate) return raw.trim();
  const compact = candidate[0].replace(/[-\s]/g, '');
  return compact.startsWith('+63') ? `0${compact.slice(3)}` : compact;
};

const normalizeEventType = (raw: string): string | null => {
  if (!raw.trim()) return null;
  if (/birthday|bday/i.test(raw)) return 'Birthday';
  if (/anniversary/i.test(raw)) return 'Anniversary';
  if (/binyag|baptismal|christening/i.test(raw)) return 'Binyag';
  if (/wedding|kasal/i.test(raw)) return 'Wedding';
  if (/fiesta/i.test(raw)) return 'Fiesta';
  if (/corporate|office|company/i.test(raw)) return 'Corporate';
  return 'Other';
};

const sniffPaymentMethod = (raw: string, downpayment: number | null): string | null => {
  if (/pay\s*maya|\bmaya\b/i.test(raw)) return 'Maya';
  if (/bank\s*transfer|\bbank\b|\bbdo\b|\bbpi\b/i.test(raw)) {
    return 'Bank Transfer';
  }
  if (/\bgcash\b|g[-\s]?cash/i.test(raw)) return 'GCash';
  if (/\bcash\b/i.test(raw)) return 'Cash';
  return downpayment !== null && downpayment > 0 ? 'GCash' : null;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const parseDateTime = (raw: string): string | null => {
  const source = raw.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!source) return null;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hasDate = false;

  if (/\b(?:tomorrow|bukas)\b/i.test(source)) {
    const tomorrow = new Date(year, month, day + 1);
    year = tomorrow.getFullYear();
    month = tomorrow.getMonth();
    day = tomorrow.getDate();
    hasDate = true;
  } else if (/\b(?:today|ngayon)\b/i.test(source)) {
    hasDate = true;
  } else {
    const isoMatch = source.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
    const numericMatch = source.match(
      /\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](\d{2}|20\d{2})\b/
    );
    const monthMatch = source.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:\s*,?\s*(\d{2}|20\d{2}))?\b/i
    );

    if (isoMatch) {
      year = Number(isoMatch[1]);
      month = Number(isoMatch[2]) - 1;
      day = Number(isoMatch[3]);
      hasDate = true;
    } else if (numericMatch) {
      month = Number(numericMatch[1]) - 1;
      day = Number(numericMatch[2]);
      const parsedYear = Number(numericMatch[3]);
      year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
      hasDate = true;
    } else if (monthMatch) {
      const monthNames = [
        'jan',
        'feb',
        'mar',
        'apr',
        'may',
        'jun',
        'jul',
        'aug',
        'sep',
        'oct',
        'nov',
        'dec',
      ];
      month = monthNames.findIndex((entry) =>
        monthMatch[1].toLowerCase().startsWith(entry)
      );
      day = Number(monthMatch[2]);
      if (monthMatch[3]) {
        const parsedYear = Number(monthMatch[3]);
        year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
      }
      hasDate = month >= 0;
    }
  }

  let hour = 12;
  let minute = 0;
  let hasTime = false;
  const clockMatch = source.match(
    /\b(0?\d|1\d|2[0-3])(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.|nn|mn)\b/i
  );
  const phraseMatch = source.match(
    /\b(0?\d|1[0-2])(?::([0-5]\d))?\s*(?:in\s+the\s+)?(morning|afternoon|evening)\b/i
  );
  const twentyFourHourMatch = source.match(/(?:^|\s|\|)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/);

  if (clockMatch) {
    hour = Number(clockMatch[1]);
    minute = Number(clockMatch[2] || 0);
    const meridiem = clockMatch[3].toLowerCase().replace(/\./g, '');
    if ((meridiem === 'pm' || meridiem === 'nn') && hour < 12) hour += 12;
    if ((meridiem === 'am' || meridiem === 'mn') && hour === 12) hour = 0;
    hasTime = true;
  } else if (phraseMatch) {
    hour = Number(phraseMatch[1]);
    minute = Number(phraseMatch[2] || 0);
    const period = phraseMatch[3].toLowerCase();
    if ((period === 'afternoon' || period === 'evening') && hour < 12) hour += 12;
    if (period === 'morning' && hour === 12) hour = 0;
    hasTime = true;
  } else if (twentyFourHourMatch) {
    hour = Number(twentyFourHourMatch[1]);
    minute = Number(twentyFourHourMatch[2]);
    hasTime = true;
  }

  if (!hasDate && !hasTime) return null;
  const parsed = new Date(year, month, day, hour, minute, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(
    parsed.getDate()
  )}T${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
};

const extractQuantity = (source: string): number => {
  const explicit = source.match(/(?:^|\b)(\d+)\s*(?:x|pcs?|pieces?|orders?)\b/i);
  if (explicit) return Math.max(1, Number(explicit[1]));
  const leading = source.match(/^\s*(\d+)\s+(?!kg\b)/i);
  return leading ? Math.max(1, Number(leading[1])) : 1;
};

const resolveWholeLechonCategory = (
  source: string,
  categories: ItemCategory[]
): ItemCategory | undefined => {
  const aliases: { source: RegExp; category: RegExp }[] = [
    { source: /\bsuper\s*jumbo\b|\bs\.?\s*jumbo\b/i, category: /super\s*jumbo|s\.?\s*jumbo/i },
    { source: /\bxxl\b/i, category: /\bxxl\b/i },
    { source: /\bxxs\b/i, category: /\bxxs\b/i },
    { source: /\bjumbo\b/i, category: /\bjumbo\b/i },
    { source: /\bextra\s*large\b|\bxl\b/i, category: /extra\s*large|\bxl\b/i },
    { source: /\bxs\b/i, category: /\bxs\b/i },
    { source: /\blarge\b|(?:^|\W)l(?:$|\W)/i, category: /\blarge\b|(?:^|\W)l(?:$|\W)/i },
    { source: /\bmedium\b|(?:^|\W)m(?:$|\W)/i, category: /\bmedium\b|(?:^|\W)m(?:$|\W)/i },
    { source: /\bsmall\b|(?:^|\W)s(?:$|\W)/i, category: /\bsmall\b|(?:^|\W)s(?:$|\W)/i },
    { source: /\bde\s*leche\b/i, category: /\bde\s*leche\b/i },
  ];
  const match = aliases.find((entry) => entry.source.test(source));
  if (!match) return undefined;
  return categories.find(
    (category) =>
      category.minimumWeightKg >= 13 && match.category.test(category.name)
  );
};

const resolveBellyCategory = (
  source: string,
  categories: ItemCategory[]
): ItemCategory | undefined => {
  const kgMatch = source.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (!/belly/i.test(source) && !kgMatch) return undefined;
  if (!/belly/i.test(source) && kgMatch) {
    const kg = Number(kgMatch[1]);
    if (kg < 2 || kg > 5) return undefined;
  }
  const bellyCategories = categories.filter(
    (category) =>
      /belly/i.test(category.name) ||
      (category.minimumWeightKg > 0 && category.maximumWeightKg < 13)
  );
  if (!kgMatch) return bellyCategories[0];
  const kg = Number(kgMatch[1]);
  return bellyCategories.find(
    (category) =>
      new RegExp(`\\b${escapeRegExp(kgMatch[1])}\\s*kg\\b`, 'i').test(category.name) ||
      (category.minimumWeightKg <= kg && category.maximumWeightKg >= kg)
  );
};

const addOnKeyword = (categoryName: string): string => {
  const known = categoryName.match(
    /sarsa|sauce|dinuguan|pancit|pansit|palabok|spaghetti|puto|coke/i
  );
  return known ? known[0] : categoryName;
};

/**
 * Parses both the compact customer reply and the four-phase staff-annotated
 * Messenger template into a POS draft.
 */
export function parseMessengerTextToDraft(
  rawText: string,
  categories: ItemCategory[],
  pricingConfig?: MessengerParserPricingConfig
): ParsedOrderDraftDto {
  const rawLines = (rawText || '').split(/\r?\n/);
  const lines = rawLines.map(sanitizeLine).filter(Boolean);
  const text = lines.join('\n');
  const noFreebiesDiscountPerPig = Math.max(
    0,
    Number(pricingConfig?.noFreebiesDiscountPerPig ?? 2000) || 0
  );

  let customerName = '';
  let facebookName: string | null = null;
  let contactNumber = '';
  let contactNumber2: string | null = null;
  let fulfillment = 1;
  let fulfillmentExplicit = false;
  let deliveryAddress = '';
  let landmark: string | null = null;
  let eventType: string | null = null;
  let deliveryFee: number | null = null;
  let distanceKm: number | null = null;
  let downpayment: number | null = null;
  let downpaymentMethod: string | null = null;
  let explicitDiscount: number | null = null;
  let dateTimeCandidate = '';
  let separateDateCandidate = '';
  let separateTimeCandidate = '';
  const remarks: string[] = [];
  const orderSources: string[] = [];
  const addOnSources: string[] = [];
  const additionalItemSources: { name: string; value: string }[] = [];
  const freebiesSources: string[] = [];

  const valueAfterLabel = (line: string, pattern: RegExp): string | null => {
    const match = line.match(pattern);
    return match ? (match[1] || '').trim() : null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let value: string | null;

    value = valueAfterLabel(
      line,
      /^(?:name|customer(?:\s*name)?|buyer|client|ordered\s*by)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      customerName = value;
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:fb|facebook(?:\s*name)?|messenger(?:\s*name)?)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      facebookName = value || null;
      continue;
    }

    value = valueAfterLabel(line, /^pickup\s*or\s*deliver\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      if (/pick\s*-?\s*up/i.test(value)) fulfillment = 0;
      else if (/lalamove/i.test(value)) fulfillment = 2;
      else if (/deliver/i.test(value)) fulfillment = 1;
      fulfillmentExplicit = true;
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:del(?:ivery)?\s*add(?:ress)?|address|location|drop[\s-]*off|venue)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      deliveryAddress = value;
      continue;
    }

    value = valueAfterLabel(line, /^(?:landmark|palatandaan|near)\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      landmark = value || null;
      continue;
    }

    value = valueAfterLabel(line, /^cp\s*#?\s*1\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      contactNumber = normalizePhone(value);
      continue;
    }

    value = valueAfterLabel(line, /^cp\s*#?\s*2\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      contactNumber2 = value ? normalizePhone(value) : null;
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:contact(?:\s*number)?|mobile|phone)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      contactNumber = normalizePhone(value);
      continue;
    }

    value = valueAfterLabel(
      line,
      /^date\s*(?:&|and)\s*time\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      const pieces = [value];
      for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 3); lookahead += 1) {
        const candidate = lines[lookahead];
        if (FIELD_LINE_PATTERN.test(candidate)) break;
        if (
          /\b(?:am|pm|morning|afternoon|evening)\b/i.test(candidate) ||
          /\b\d{1,2}:\d{2}\b/.test(candidate) ||
          (!pieces[0] && /\b(?:20\d{2}|\d{2})\b/.test(candidate))
        ) {
          pieces.push(candidate);
          index = lookahead;
        } else if (!pieces[0]) {
          pieces.push(candidate);
          index = lookahead;
        } else {
          break;
        }
      }
      dateTimeCandidate = pieces.filter(Boolean).join(' ');
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:type\s*of\s*event|event(?:\s*type)?|occasion|okasyon)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      eventType = normalizeEventType(value);
      continue;
    }

    value = valueAfterLabel(line, /^(?:order\s*\/\s*size|order|size)\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      orderSources.push(value.replace(/\s+with\s+7\s+fre+bb?ies\b.*$/i, '').trim());
      continue;
    }

    value = valueAfterLabel(
      line,
      /^freebies?\s*or\s*(?:less\s*2k|cash\s*discount)?\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      freebiesSources.push(value);
      continue;
    }

    value = valueAfterLabel(line, /^add[\s-]*ons?\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      if (value) addOnSources.push(value);
      continue;
    }

    const additionalMatch = line.match(/^additional\s+(.+?)\s*[:\-]\s*(.*)$/i);
    if (additionalMatch) {
      additionalItemSources.push({
        name: additionalMatch[1].trim(),
        value: additionalMatch[2].trim(),
      });
      continue;
    }

    value = valueAfterLabel(
      line,
      /^special\s*requests?\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      if (!value && lines[index + 1] && !FIELD_LINE_PATTERN.test(lines[index + 1])) {
        value = lines[index + 1];
        index += 1;
      }
      if (value && !BOILERPLATE_LINE_PATTERN.test(value)) remarks.push(value);
      continue;
    }

    value = valueAfterLabel(line, /^distance\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      const parsedDistance = parsePesoNumber(value);
      distanceKm = parsedDistance >= 0 ? parsedDistance : null;
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:dp\s*(?:&|and)\s*mode|dp|down\s*payment|downpayment|deposit)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      downpayment = parsePesoNumber(value);
      downpaymentMethod = sniffPaymentMethod(value, downpayment);
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:delivery\s*(?:fee|charge)|deliver\s*charge|del\.?\s*fee|df)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      deliveryFee = parsePesoNumber(value);
      continue;
    }

    value = valueAfterLabel(line, /^discount\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      explicitDiscount = parsePesoNumber(value);
      continue;
    }

    value = valueAfterLabel(line, /^price\s*[:\-]\s*(.*)$/i);
    if (value !== null) {
      freebiesSources.push(value);
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:date|delivery\s*date|target\s*date|schedule|petsa)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      separateDateCandidate = value;
      continue;
    }

    value = valueAfterLabel(
      line,
      /^(?:time|delivery\s*time|target\s*time|oras)\s*[:\-]\s*(.*)$/i
    );
    if (value !== null) {
      separateTimeCandidate = value;
    }
  }

  const phoneMatches = text.match(/(?:\+63|0)9\d{2}(?:[-\s]?\d{3})(?:[-\s]?\d{4})/g) || [];
  const normalizedPhones = Array.from(new Set(phoneMatches.map(normalizePhone)));
  if (!contactNumber && normalizedPhones[0]) contactNumber = normalizedPhones[0];
  if (!contactNumber2) {
    contactNumber2 =
      normalizedPhones.find((phone) => phone !== contactNumber) || null;
  }

  if (!customerName && lines[0] && !FIELD_LINE_PATTERN.test(lines[0])) {
    const firstLine = lines[0];
    if (
      firstLine.length >= 3 &&
      firstLine.length <= 45 &&
      !/[:\d₱]/.test(firstLine) &&
      !/^(order|lechon|booking|confirmation|hi|hello|good|magandang)/i.test(firstLine)
    ) {
      customerName = firstLine;
    }
  }

  if (!fulfillmentExplicit) {
    if (/\blalamove\b/i.test(text)) fulfillment = 2;
    else if (/\b(?:pick\s*-?\s*up|store\s*pickup)\b/i.test(text)) fulfillment = 0;
  }

  if (!deliveryAddress) {
    const addressLine = lines.find(
      (line) =>
        !FIELD_LINE_PATTERN.test(line) &&
        /\b(?:blk|block|lot|phase|subd|village|brgy|barangay|imus|bacoor|dasma|dasmarinas|kawit|noveleta|rosario|general\s*trias|gen\s*tri|tanza|trece|silang|tagaytay|cavite)\b/i.test(
          line
        )
    );
    if (addressLine) deliveryAddress = addressLine;
  }

  if (!eventType) {
    const eventMatch = text.match(
      /\b(?:birthday|bday|anniversary|binyag|baptismal|wedding|kasal|fiesta|corporate)\b.*$/im
    );
    if (eventMatch) eventType = normalizeEventType(eventMatch[0]);
  }

  const targetDeliveryTime = parseDateTime(
    dateTimeCandidate || `${separateDateCandidate} ${separateTimeCandidate}`.trim()
  );

  const standaloneFreebiesSignals = lines
    .filter((line) => !/^freebies?\s*or\b/i.test(line))
    .join(' ');
  const freebiesText = `${freebiesSources.join(' ')} ${standaloneFreebiesSignals}`;
  let freebiesOptOut: boolean | null = null;
  if (/less\s*2\s*k|less\s*2,?000|cash\s*discount|no\s*freebies?|walang\s*freebies?/i.test(freebiesText)) {
    freebiesOptOut = true;
  } else if (/\b(?:freebies?|frebbies?)\b/i.test(freebiesText)) {
    freebiesOptOut = false;
  }

  const cleanRemarks = remarks
    .map((entry) => entry.trim())
    .filter((entry) => entry && !BOILERPLATE_LINE_PATTERN.test(entry));
  const remarksText = cleanRemarks.join(' | ');
  const rawInnards = /walang\s+dinuguan|hilaw\s+na\s+laman\s*loob|raw\s+innards?/i.test(
    remarksText
  );

  const activeCategories = categories.filter((category) => category.isActive !== false);
  const matchedItems = new Map<number, number>();
  const addItem = (category: ItemCategory | undefined, quantity: number) => {
    if (!category) return;
    matchedItems.set(
      category.id,
      (matchedItems.get(category.id) || 0) + Math.max(1, Math.floor(quantity || 1))
    );
  };

  const effectiveOrderSources =
    orderSources.length > 0 ? orderSources : lines.filter((line) => !FIELD_LINE_PATTERN.test(line));
  for (const source of effectiveOrderSources) {
    const belly = resolveBellyCategory(source, activeCategories);
    if (belly) {
      const explicitQty = source.match(/\b(\d+)\s*x\s*(?:lechon\s*)?belly/i);
      addItem(belly, explicitQty ? Number(explicitQty[1]) : 1);
      continue;
    }
    addItem(resolveWholeLechonCategory(source, activeCategories), extractQuantity(source));
  }

  const addOnCategories = activeCategories.filter(
    (category) => category.minimumWeightKg === 0
  );
  for (const source of addOnSources) {
    for (const category of addOnCategories) {
      const keyword = addOnKeyword(category.name);
      const keywordPattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
      if (!keywordPattern.test(source)) continue;
      const prefix = source.slice(0, source.search(keywordPattern));
      const quantityMatch = prefix.match(/(\d+)\s*(?:x|pcs?|pieces?)?\s*$/i);
      addItem(category, quantityMatch ? Number(quantityMatch[1]) : 1);
    }
  }

  for (const additional of additionalItemSources) {
    const category = addOnCategories.find((candidate) => {
      const keyword = addOnKeyword(candidate.name);
      return (
        new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(additional.name) ||
        candidate.name.toLowerCase().includes(additional.name.toLowerCase())
      );
    });
    const quantityMatch = additional.value.match(/(\d+)\s*(?:x|pcs?|pieces?)\b/i);
    addItem(category, quantityMatch ? Number(quantityMatch[1]) : 1);
  }

  if (orderSources.length === 0 && addOnSources.length === 0 && additionalItemSources.length === 0) {
    for (const category of addOnCategories) {
      if (matchedItems.has(category.id)) continue;
      const keyword = addOnKeyword(category.name);
      const match = text.match(new RegExp(`(?:(\\d+)\\s*x?\\s*)?${escapeRegExp(keyword)}`, 'i'));
      if (match && !new RegExp(`(?:walang|no)\\s+${escapeRegExp(keyword)}`, 'i').test(text)) {
        addItem(category, match[1] ? Number(match[1]) : 1);
      }
    }
  }

  const discount =
    freebiesOptOut === true ? noFreebiesDiscountPerPig : explicitDiscount;
  const items = Array.from(matchedItems.entries()).map(
    ([itemCategoryId, quantity]) => ({ itemCategoryId, quantity })
  );

  return {
    customerName,
    facebookName,
    contactNumber,
    contactNumber2,
    source: 'Business FB Page',
    eventType,
    targetDeliveryTime,
    fulfillment,
    deliveryAddress: deliveryAddress || null,
    landmark,
    remarks: remarksText,
    deliveryFee,
    downpayment,
    freebiesOptOut,
    rawInnards,
    distanceKm,
    discount,
    downpaymentMethod,
    items,
  };
}
