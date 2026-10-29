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
  fulfillment: number;
  deliveryAddress?: string | null;
  landmark?: string | null;
  remarks?: string | null;
  deliveryFee?: number | null;
  distanceKm?: number | null;
  discount?: number | null;
  downpayment?: number | null;
  downpaymentMethod?: "Cash" | "GCash" | "Maya" | "Bank Transfer" | null;
  freebiesOptOut?: boolean | null;
  rawInnards?: boolean | null;
  items: ParsedOrderItemDto[];
}

export interface MessengerParserPricingConfig {
  noFreebiesDiscountPerPig?: number;
}

const BOILERPLATE_PATTERN =
  /to confirm your order|with\s+7\s+freebies|spaghetti,\s*palabok.*consumed|delivery suggestion\s*:|kung gusto nyo po ng mas masarap|total balance\s*:/i;

const FIELD_LINE_PATTERN =
  /^(?:name|customer|fb|facebook|messenger|pickup\s*or\s*deliver|fulfillment|del\s*add|deliver(?:y\s*address)?|delivery|address|location|landmark|cp\s*#?\s*[12]?|contact(?:\s*number)?\s*#?|phone|mobile|date(?:\s*(?:&|and)\s*time)?|time|type\s*of\s*event|event|occasion|order\s*\/\s*size|order|size|freebies?\s*or|add-ons?|additional\s+.+|special\s*request|remarks?|notes?|distance|dp(?:\s*&\s*mode)?|downpayment|deposit|delivery\s*(?:charge|fee)|deliver\s*charge|discount|price)\s*(?:[:#\-]|(?=0?9\d))/i;

const parsePesoNumber = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const normalizePhone = (raw: string): string => {
  const compact = raw.replace(/[^+\d]/g, "");
  if (compact.startsWith("+63")) return `0${compact.slice(3)}`;
  if (compact.startsWith("63") && compact.length === 12) {
    return `0${compact.slice(2)}`;
  }
  return compact;
};

const splitPhonesFromText = (text: string): string[] => {
  const matches = text.match(/(?:\+?63|0)9\d{2}(?:[\s-]?\d){7}/g) ?? [];
  return Array.from(
    new Set(matches.map(normalizePhone).filter((phone) => phone.length >= 10)),
  );
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCategoryName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const parseEventType = (raw: string): string | null => {
  if (/birthday|bday/i.test(raw)) return "Birthday";
  if (/anniversary/i.test(raw)) return "Anniversary";
  if (/binyag|baptismal|christening/i.test(raw)) return "Binyag";
  if (/wedding|kasal/i.test(raw)) return "Wedding";
  if (/fiesta/i.test(raw)) return "Fiesta";
  if (/corporate|office|company/i.test(raw)) return "Corporate";
  return raw.trim() ? "Other" : null;
};

const sniffPaymentMethod = (
  raw: string,
  downpayment: number,
): "Cash" | "GCash" | "Maya" | "Bank Transfer" | null => {
  if (downpayment <= 0) return null;
  if (/\bg\s*-?\s*cash\b/i.test(raw)) return "GCash";
  if (/\b(?:pay\s*)?maya\b/i.test(raw)) return "Maya";
  if (/\b(?:bank|bdo|bpi|transfer)\b/i.test(raw)) return "Bank Transfer";
  if (/\bcash\b/i.test(raw)) return "Cash";
  return "GCash";
};

const formatLocalDateTime = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseFlexibleDateTime = (raw: string): string | null => {
  const source = raw.replace(/\s+/g, " ").trim();
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
    const isoMatch = source.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    const monthMatch = source.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:\s*,\s*(\d{2,4})|\s+(20\d{2}))?/i,
    );
    const numericMatch = source.match(
      /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|20\d{2})\b/,
    );

    if (isoMatch) {
      year = Number(isoMatch[1]);
      month = Number(isoMatch[2]) - 1;
      day = Number(isoMatch[3]);
      hasDate = true;
    } else if (monthMatch) {
      const months = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ];
      month = months.findIndex((candidate) =>
        monthMatch[1].toLowerCase().startsWith(candidate),
      );
      day = Number(monthMatch[2]);
      const rawYear = monthMatch[3] || monthMatch[4];
      if (rawYear) {
        const parsedYear = Number(rawYear);
        year = rawYear.length === 2 ? 2000 + parsedYear : parsedYear;
      }
      hasDate = month >= 0;
    } else if (numericMatch) {
      month = Number(numericMatch[1]) - 1;
      day = Number(numericMatch[2]);
      const rawYear = numericMatch[3];
      year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      hasDate = true;
    }
  }

  if (!hasDate) return null;

  let hours = 12;
  let minutes = 0;
  const meridiemMatch = source.match(
    /\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?|nn|mn)\b/i,
  );
  const phraseMatch = source.match(
    /\b(\d{1,2})(?::([0-5]\d))?\s+in\s+the\s+(morning|afternoon|evening|night)\b/i,
  );
  const twentyFourHourMatch = source.match(
    /(?:\||\bat\b|\btime\s*[:\-]?)\s*(?:[01]?\d|2[0-3]):[0-5]\d\b/i,
  );

  if (meridiemMatch) {
    hours = Number(meridiemMatch[1]);
    minutes = Number(meridiemMatch[2] || 0);
    const meridiem = meridiemMatch[3].replace(/\./g, "").toLowerCase();
    if ((meridiem === "pm" || meridiem === "nn") && hours < 12) hours += 12;
    if ((meridiem === "am" || meridiem === "mn") && hours === 12) hours = 0;
  } else if (phraseMatch) {
    hours = Number(phraseMatch[1]);
    minutes = Number(phraseMatch[2] || 0);
    if (/afternoon|evening|night/i.test(phraseMatch[3]) && hours < 12) {
      hours += 12;
    }
    if (/morning/i.test(phraseMatch[3]) && hours === 12) hours = 0;
  } else if (twentyFourHourMatch) {
    const clock = twentyFourHourMatch[0].match(/(\d{1,2}):([0-5]\d)/);
    if (clock) {
      hours = Number(clock[1]);
      minutes = Number(clock[2]);
    }
  }

  const parsed = new Date(year, month, day, hours, minutes, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return formatLocalDateTime(parsed);
};

const createOptOutFreebiesText = (value: string): boolean | null => {
  if (/less\s*2\s*k|less\s*2,?000|cash\s*discount|no\s*freebie|walang\s*freebie/i.test(value)) {
    return true;
  }
  if (/freebie|frebbie/i.test(value)) return false;
  return null;
};

/** Parses the customer and staff variants of Yumi's four-phase Messenger template. */
export function parseMessengerTextToDraft(
  rawText: string,
  categories: ItemCategory[],
  pricingConfig?: MessengerParserPricingConfig,
): ParsedOrderDraftDto {
  const rawLines = (rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = rawLines
    .map((line) =>
      /^(?:order\s*\/\s*size|order(?:\s*size)?|size)\s*[:\-]/i.test(line)
        ? line.replace(/\s+with\s+7\s+(?:freebies|frebbies)\b.*$/i, "")
        : line,
    )
    .filter((line) => !BOILERPLATE_PATTERN.test(line));
  const sanitizedText = lines.join("\n");

  let customerName = "";
  let facebookName: string | null = null;
  let contactNumber = "";
  let contactNumber2: string | null = null;
  let fulfillment = 1;
  let deliveryAddress = "";
  let landmark: string | null = null;
  let eventType: string | null = null;
  let targetDeliveryTime: string | null = null;
  let deliveryFee: number | null = null;
  let distanceKm: number | null = null;
  let discount: number | null = null;
  let downpayment: number | null = null;
  let downpaymentMethod: ParsedOrderDraftDto["downpaymentMethod"] = null;
  let freebiesOptOut: boolean | null = null;
  let rawInnards: boolean | null = null;
  const remarks: string[] = [];
  const dateParts: string[] = [];
  const orderSources: string[] = [];
  const addOnSources: string[] = [];
  const additionalAddOns: string[] = [];
  const freebieValues: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let match: RegExpMatchArray | null;

    match = line.match(/^(?:name|customer(?:\s*name)?|buyer|client|ordered\s*by)\s*[:\-]\s*(.*)$/i);
    if (match) {
      customerName ||= match[1].trim();
      continue;
    }

    match = line.match(/^(?:fb|facebook(?:\s*name)?|messenger(?:\s*name)?)\s*[:\-]\s*(.*)$/i);
    if (match) {
      facebookName ||= match[1].trim() || null;
      continue;
    }

    match = line.match(/^cp\s*#?\s*2\s*(?:[:\-]\s*)?(.*)$/i);
    if (match) {
      contactNumber2 = normalizePhone(match[1]) || null;
      continue;
    }

    match = line.match(/^(?:cp\s*#?\s*(?:1\s*)?|contact(?:\s*number)?\s*#?|phone|mobile(?:\s*number)?|cellphone)\s*(?:[:\-]\s*)?(.*)$/i);
    if (match) {
      contactNumber ||= normalizePhone(match[1]);
      continue;
    }

    match = line.match(/^(?:pickup\s*or\s*deliver|fulfillment)\s*[:\-]\s*(.*)$/i);
    if (match) {
      const value = match[1];
      if (/pick\s*-?\s*up/i.test(value)) fulfillment = 0;
      else if (/lalamove/i.test(value)) fulfillment = 2;
      else if (/deliver/i.test(value)) fulfillment = 1;
      continue;
    }

    match = line.match(/^(?:del\s*add|deliver|delivery|address|location|delivery\s*address|drop[\s-]*off|venue)\s*[:\-]\s*(.*)$/i);
    if (match) {
      deliveryAddress ||= match[1].trim();
      continue;
    }

    match = line.match(/^(?:landmark|palatandaan|near)\s*[:\-]\s*(.*)$/i);
    if (match) {
      landmark ||= match[1].trim() || null;
      continue;
    }

    match = line.match(/^(?:type\s*of\s*event|event(?:\s*type)?|occasion|okasyon)\s*[:\-]\s*(.*)$/i);
    if (match) {
      eventType ||= parseEventType(match[1]);
      continue;
    }

    match = line.match(/^date\s*(?:&|and)\s*time\s*[:\-]\s*(.*)$/i);
    if (match) {
      let value = match[1].trim();
      const nextLine = lines[index + 1];
      const secondNextLine = lines[index + 2];
      if (!value && nextLine && !FIELD_LINE_PATTERN.test(nextLine)) {
        value = nextLine;
        index += 1;
      }
      if (
        value &&
        !/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|in\s+the\s+(?:morning|afternoon|evening|night))\b/i.test(value)
      ) {
        const lookahead = index + 1 < lines.length ? lines[index + 1] : secondNextLine;
        if (
          lookahead &&
          !FIELD_LINE_PATTERN.test(lookahead) &&
          /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|in\s+the\s+(?:morning|afternoon|evening|night))\b/i.test(lookahead)
        ) {
          value = `${value} ${lookahead}`;
          index += 1;
        }
      }
      if (value) dateParts.push(value);
      continue;
    }

    match = line.match(/^(?:date|delivery\s*date|target\s*date|schedule|petsa)\s*[:\-]\s*(.*)$/i);
    if (match) {
      if (match[1].trim()) dateParts.push(match[1].trim());
      continue;
    }

    match = line.match(/^(?:time|delivery\s*time|target\s*time|oras)\s*[:\-]\s*(.*)$/i);
    if (match) {
      if (match[1].trim()) dateParts.push(match[1].trim());
      continue;
    }

    match = line.match(/^(?:order\s*\/\s*size|order(?:\s*size)?|size)\s*[:\-]\s*(.*)$/i);
    if (match) {
      const cleaned = match[1]
        .replace(/\bwith\s+7\s+(?:freebies|frebbies)\b.*$/i, "")
        .trim();
      if (cleaned) orderSources.push(cleaned);
      continue;
    }

    match = line.match(/^(?:freebies?\s*or\s*(?:less\s*2\s*k|cash\s*discount)|freebies?)\s*[:\-]\s*(.*)$/i);
    if (match) {
      freebieValues.push(match[1].trim());
      continue;
    }

    match = line.match(/^add[\s-]*ons?\s*[:\-]\s*(.*)$/i);
    if (match) {
      if (match[1].trim()) addOnSources.push(match[1].trim());
      continue;
    }

    match = line.match(/^additional\s+(.+?)\s*[:\-]\s*(.*)$/i);
    if (match) {
      additionalAddOns.push(`${match[1].trim()}\u0000${match[2].trim()}`);
      continue;
    }

    match = line.match(/^(?:special\s*request|remarks?|notes?|bilin|instructions?)\s*[:\-]\s*(.*)$/i);
    if (match) {
      let value = match[1].trim();
      if (!value && lines[index + 1] && !FIELD_LINE_PATTERN.test(lines[index + 1])) {
        value = lines[index + 1].trim();
        index += 1;
      }
      if (value && !/^(?:n\/?a|none|-+)$/i.test(value) && !BOILERPLATE_PATTERN.test(value)) {
        remarks.push(value);
        if (/walang\s+dinuguan|hilaw\s+na\s+(?:laman\s*loob|innards?)|raw\s+innards?/i.test(value)) {
          rawInnards = true;
        }
      }
      continue;
    }

    match = line.match(/^distance\s*[:\-]\s*(.*)$/i);
    if (match) {
      const numeric = match[1].match(/\d+(?:\.\d+)?/);
      if (numeric) distanceKm = Number(numeric[0]);
      continue;
    }

    match = line.match(/^(?:dp\s*&\s*mode|dp|down\s*payment|downpayment|deposit)\s*[:\-]\s*(.*)$/i);
    if (match) {
      downpayment = parsePesoNumber(match[1]);
      downpaymentMethod = sniffPaymentMethod(match[1], downpayment);
      continue;
    }

    match = line.match(/^(?:delivery\s*(?:charge|fee)|deliver\s*charge|del\.?\s*fee|df)\s*[:\-]\s*(.*)$/i);
    if (match) {
      deliveryFee = parsePesoNumber(match[1]);
      continue;
    }

    match = line.match(/^discount\s*[:\-]\s*(.*)$/i);
    if (match) {
      discount = parsePesoNumber(match[1]);
    }
  }

  if (!customerName && lines[0] && !FIELD_LINE_PATTERN.test(lines[0])) {
    const candidate = lines[0];
    if (
      candidate.length >= 2 &&
      candidate.length <= 60 &&
      !/\d|^(?:order|lechon|booking|confirmation|hi|hello|good|magandang)\b/i.test(candidate)
    ) {
      customerName = candidate;
    }
  }

  const fallbackPhones = splitPhonesFromText(sanitizedText);
  contactNumber ||= fallbackPhones[0] || "";
  if (!contactNumber2) {
    contactNumber2 = fallbackPhones.find((phone) => phone !== contactNumber) || null;
  }

  if (/\blalamove\b/i.test(sanitizedText) && !/pickup\s*or\s*deliver\s*[:\-]/i.test(sanitizedText)) {
    fulfillment = 2;
  } else if (/\b(?:pick\s*-?\s*up|store\s*pickup)\b/i.test(sanitizedText) && !/pickup\s*or\s*deliver\s*[:\-]/i.test(sanitizedText)) {
    fulfillment = 0;
  }

  if (dateParts.length > 0) {
    targetDeliveryTime = parseFlexibleDateTime(dateParts.join(" | "));
  }
  if (!targetDeliveryTime) {
    targetDeliveryTime = parseFlexibleDateTime(sanitizedText);
  }

  if (!eventType) {
    const eventMatch = sanitizedText.match(
      /\b(?:birthday|bday|anniversary|binyag|baptismal|christening|wedding|kasal|fiesta|corporate)\b/gi,
    );
    if (eventMatch) eventType = parseEventType(eventMatch.join(" "));
  }

  for (const value of freebieValues) {
    const selection = createOptOutFreebiesText(value);
    if (selection !== null) freebiesOptOut = selection;
  }
  if (/\bwith\s+7\s+(?:freebies|frebbies)\b/i.test(rawText)) {
    freebiesOptOut = false;
  }
  const standaloneOptOut = lines.some(
    (line) =>
      /\b(?:price|discount)\s*[:\-]/i.test(line) &&
      /\(?\s*(?:less\s*2\s*k|less\s*2,?000|cash\s*discount|no\s*freebie|walang\s*freebie)/i.test(line.replace(/^[^:\-]*[:\-]/, "")),
  );
  if (standaloneOptOut) freebiesOptOut = true;
  if (freebiesOptOut === true) {
    const configuredDiscount = Number(pricingConfig?.noFreebiesDiscountPerPig ?? 2000);
    discount = Number.isFinite(configuredDiscount) ? Math.max(0, configuredDiscount) : 2000;
  }

  const matchedItems = new Map<number, number>();
  const activeCategories = categories.filter((category) => category.isActive !== false);
  const addItem = (category: ItemCategory | undefined, quantity = 1) => {
    if (!category) return;
    matchedItems.set(
      category.id,
      (matchedItems.get(category.id) || 0) + Math.max(1, Math.floor(quantity || 1)),
    );
  };

  const wholeAliases: Array<{
    pattern: string;
    names: string[];
    minimumWeightKg: number;
  }> = [
    { pattern: "(?:super\\s*jumbo|s\\.?\\s*jumbo)", names: ["s jumbo", "super jumbo"], minimumWeightKg: 41 },
    { pattern: "jumbo", names: ["jumbo"], minimumWeightKg: 37 },
    { pattern: "(?:xxl|2xl|xx[-\\s]?large|double\\s+(?:extra\\s+large|xl))", names: ["xxl", "2xl", "xx large", "double extra large", "double xl"], minimumWeightKg: 32 },
    { pattern: "(?:xl|1xl|x[-\\s]?large|extra[-\\s]+large)", names: ["xl", "1xl", "x large", "extra large"], minimumWeightKg: 28 },
    { pattern: "(?:xxs|2xs|xx[-\\s]?small|double\\s+extra\\s+small)", names: ["xxs", "2xs", "xx small", "double extra small"], minimumWeightKg: 13 },
    { pattern: "(?:xs|x[-\\s]?small|extra[-\\s]+small)", names: ["xs", "x small", "extra small"], minimumWeightKg: 16 },
    { pattern: "(?<!x[-\\s])(?<!xx[-\\s])(?<!extra[-\\s])(?:large|l)", names: ["l", "large"], minimumWeightKg: 25 },
    { pattern: "(?:medium|med|m)", names: ["m", "med", "medium"], minimumWeightKg: 22 },
    { pattern: "(?<!x[-\\s])(?<!xx[-\\s])(?<!extra[-\\s])(?:small|s)", names: ["s", "small"], minimumWeightKg: 20 },
  ];

  for (const source of orderSources) {
    const bellyMatch = source.match(/\b([2-5])\s*kg\b/i);
    if (bellyMatch) {
      const kg = Number(bellyMatch[1]);
      const bellyCategory = activeCategories.find(
        (category) =>
          /belly/i.test(category.name) &&
          (new RegExp(`\\b${kg}\\s*kg\\b`, "i").test(category.name) ||
            Number(category.minimumWeightKg) === kg),
      );
      const qtyMatch = source.match(/\b(\d+)\s*(?:x|pcs?|orders?)\s*(?:(?:lechon\s*)?belly\s*)?[2-5]\s*kg\b/i);
      addItem(bellyCategory, qtyMatch ? Number(qtyMatch[1]) : 1);
      continue;
    }

    for (const alias of wholeAliases) {
      const aliasRegex = new RegExp(`(?:^|\\b)(${alias.pattern})(?=$|\\b)`, "i");
      const aliasMatch = aliasRegex.exec(source);
      if (!aliasMatch) continue;
      const wholeCategory = activeCategories.find((category) => {
        if (category.minimumWeightKg < 13 || /belly/i.test(category.name)) return false;
        const normalized = normalizeCategoryName(category.name);
        return (
          alias.names.includes(normalized) ||
          Number(category.minimumWeightKg) === alias.minimumWeightKg
        );
      });
      const prefix = source.slice(0, aliasMatch.index);
      const quantityMatch = prefix.match(/(\d+)\s*(?:x|pcs?|orders?)?\s*$/i);
      addItem(wholeCategory, quantityMatch ? Number(quantityMatch[1]) : 1);
      break;
    }
  }

  const addOnCategories = activeCategories.filter(
    (category) => Number(category.minimumWeightKg) <= 0,
  );
  const addOnAliases = (category: ItemCategory): string[] => {
    const normalized = normalizeCategoryName(category.name);
    const aliases = [normalized];
    if (/sarsa|sauce/.test(normalized)) aliases.push("sarsa", "sauce");
    if (/pancit|pansit/.test(normalized)) aliases.push("pancit", "pansit");
    if (/coke/.test(normalized)) aliases.push("coke", "1.5l coke", "1.5 l coke");
    return Array.from(new Set(aliases)).sort((a, b) => b.length - a.length);
  };

  for (const source of addOnSources) {
    for (const category of addOnCategories) {
      const aliases = addOnAliases(category).map((alias) =>
        escapeRegex(alias).replace(/\\ /g, "\\s*"),
      );
      const match = source.match(
        new RegExp(`(?:^|[,/&+]|\\band\\b)\\s*(?:(\\d+)\\s*(?:x|pcs?|orders?|bottles?)?\\s*)?(?:${aliases.join("|")})(?=$|\\b|[,/&+])`, "i"),
      );
      if (match) addItem(category, match[1] ? Number(match[1]) : 1);
    }
  }

  for (const encoded of additionalAddOns) {
    const [label, value] = encoded.split("\u0000");
    const normalizedLabel = normalizeCategoryName(label);
    const category = addOnCategories.find((candidate) =>
      addOnAliases(candidate).some((alias) =>
        normalizedLabel.includes(normalizeCategoryName(alias)),
      ),
    );
    const explicitQuantity = value.match(/(?:qty\.?\s*)?(\d+)\s*(?:x|pcs?|orders?|bottles?)\b/i);
    addItem(category, explicitQuantity ? Number(explicitQuantity[1]) : 1);
  }

  const items: ParsedOrderItemDto[] = Array.from(matchedItems.entries()).map(
    ([itemCategoryId, quantity]) => ({ itemCategoryId, quantity }),
  );

  return {
    customerName,
    facebookName,
    contactNumber,
    contactNumber2,
    source: "Business FB Page",
    eventType,
    targetDeliveryTime,
    fulfillment,
    deliveryAddress: deliveryAddress || null,
    landmark,
    remarks: remarks.join(" | "),
    deliveryFee,
    distanceKm,
    discount,
    downpayment,
    downpaymentMethod,
    freebiesOptOut,
    rawInnards,
    items,
  };
}
