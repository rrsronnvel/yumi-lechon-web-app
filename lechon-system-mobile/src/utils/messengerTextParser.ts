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
  secondaryContactNumber?: string | null;
  source?: string | null;
  eventType?: string | null;
  targetDeliveryTime?: string | null;
  isTimeTbd?: boolean | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
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
  freebiesMode?: "standard" | "custom" | "optOut" | null;
  freebieOverrides?: Record<string, number> | null;
  freebiesCustomizationNote?: string | null;
  items: ParsedOrderItemDto[];
}

export interface MessengerParserPricingConfig {
  noFreebiesDiscountPerPig?: number | null;
}

const BOILERPLATE_PATTERN =
  /to confirm your order|with\s+7\s+freebies|^assisted\s+by\s+admin|^spaghetti,\s*palabok.*consumed|^delivery suggestion\b|^kung gusto nyo po ng mas masarap|total balance\s*:/i;

const FOOTER_DISCLAIMER_PATTERN =
  /Spaghetti,\s*Palabok|Delivery\s*Suggestion|Kung\s*gusto\s*nyo\s*po|Assisted\s*by/i;

const HORIZONTAL_RULE_PATTERN = /^[—\-_=\u2014\u2013\u2015\s]{3,}$/;

const CULINARY_PREP_PATTERN =
  /\b(?:liver\s*sauce(?:\s*only)?|sarsa\s*lang|sauce\s*lang|walang\s*dinuguan|raw\s*innards?|hilaw\s*na\s*(?:laman\s*loob|innards?)|extra\s*crispy|crispy\s*skin|crispy|chopped|hiwain|chop|shoutout|print|happy\s*birthday|dedication|walang\s*betsin|less\s*salt|spicy)\b/i;

const FREEBIE_ITEM_PATTERN =
  /\b(?:palabok|pancit|pansit|bihon|canton|spaghetti|spag|puto|biko|coke|pepsi|mountain\s*dew|7\s*up|mirinda|softdrinks?)\b/i;

function cleanNoteText(str: string): string {
  if (!str) return "";
  return str
    .replace(/^[\s✅❗👉•\-*#:!?]+/gu, "")
    .replace(/[\s✅❗👉•\-*#:!?]+$/gu, "")
    .trim();
}

function extractNonFreebieRemarks(value: string): string[] {
  if (!value) return [];
  const unwrapped = value.replace(/^\s*\((.*)\)\s*$/, (_, g1) => g1).trim();
  const rawParts = unwrapped
    .split(/[,;\n\/]+/)
    .map((p) => cleanNoteText(p))
    .filter(Boolean);

  const nonFreebieParts: string[] = [];
  for (const part of rawParts) {
    const hasFreebie = FREEBIE_ITEM_PATTERN.test(part);
    const hasCulinary = CULINARY_PREP_PATTERN.test(part);

    // If it has freebie items and NO culinary prep instruction, it's a pure freebie swap
    if (hasFreebie && !hasCulinary) {
      continue;
    }

    // If it has culinary keywords or does not mention freebie items, it's a kitchen instruction
    if (hasCulinary || !hasFreebie) {
      nonFreebieParts.push(part);
    }
  }

  if (nonFreebieParts.length === 0 && rawParts.length <= 1) {
    if (!FREEBIE_ITEM_PATTERN.test(unwrapped)) {
      const cleaned = cleanNoteText(unwrapped);
      if (cleaned) nonFreebieParts.push(cleaned);
    }
  }

  return nonFreebieParts;
}

const FIELD_LABEL_PATTERN =
  /^(?:name|customer(?:\s*name)?|buyer|client|ordered\s*by|fb|facebook(?:\s*name)?|messenger(?:\s*name)?|cp\s*#?\s*[12]?|contact(?:\s*number)?\s*#?[12]?|phone|mobile(?:\s*number)?|cellphone|pickup\s*or\s*deliver|fulfillment|del\s*add|deliver(?:y\s*address)?|delivery|address|location|landmark|palatandaan|near|type\s*of\s*event|event(?:\s*type)?|occasion|okasyon|date\s*(?:&|and)\s*time|date|delivery\s*date|target\s*date|schedule|petsa|time|delivery\s*time|target\s*time|oras|order\s*\/\s*size|order(?:\s*size)?|size|freebies?\s*or\s*(?:less\s*2\s*k|cash\s*discount)|freebies?|add[\s-]*ons?(?:\s*\([^)]*\))?|additional\s+.+|special\s*requests?|remarks?|notes?|bilin|instructions?|distance(?:\s*km)?|dp\s*(?:&|and)\s*mode(?:\s*\([^)]*\))?|dp|down\s*payment(?:\s*&\s*mode)?|downpayment(?:\s*&\s*mode)?|deposit|delivery\s*(?:charge|fee)|deliver\s*charge|del\.?\s*fee|df|discount|price)\s*[:\-]/i;

const WORD_NUMBER_MAP: Record<string, number> = {
  isa: 1,
  isang: 1,
  one: 1,
  "1": 1,
  dalawa: 2,
  dalawang: 2,
  two: 2,
  "2": 2,
  tatlo: 3,
  tatlong: 3,
  three: 3,
  "3": 3,
  apat: 4,
  "apat na": 4,
  four: 4,
  "4": 4,
  lima: 5,
  limang: 5,
  five: 5,
  "5": 5,
  anim: 6,
  "anim na": 6,
  six: 6,
  "6": 6,
  pito: 7,
  pitong: 7,
  seven: 7,
  "7": 7,
  walo: 8,
  walong: 8,
  eight: 8,
  "8": 8,
  siyam: 9,
  "siyam na": 9,
  nine: 9,
  "9": 9,
  sampu: 10,
  sampung: 10,
  ten: 10,
  "10": 10,
};

const parseWordNumber = (str: string): number => {
  if (!str) return 1;
  const clean = str.trim().toLowerCase();
  if (WORD_NUMBER_MAP[clean] !== undefined) return WORD_NUMBER_MAP[clean];
  const num = parseInt(clean, 10);
  return !isNaN(num) && num > 0 ? num : 1;
};

const parsePesoNumber = (raw: string): number => {
  const cleaned = (raw || "").replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const normalizePhone = (raw: string): string => {
  const compact = (raw || "").replace(/[^+\d]/g, "");
  if (compact.startsWith("+63")) return `0${compact.slice(3)}`;
  if (compact.startsWith("63") && compact.length === 12) {
    return `0${compact.slice(2)}`;
  }
  return compact;
};

const extractPhone = (raw: string): string => {
  const candidate = (raw || "").match(/(?:\+63|0)9\d{2}(?:[\s-]?\d){7}/)?.[0];
  return candidate ? normalizePhone(candidate) : "";
};

const splitPhonesFromText = (text: string): string[] => {
  const matches = (text || "").match(/(?:\+?63|0)9\d{2}(?:[\s-]?\d){7}/g) ?? [];
  return Array.from(
    new Set(matches.map(normalizePhone).filter((phone) => phone.length >= 10)),
  );
};

const parseEventType = (raw: string): string | null => {
  if (!raw) return null;
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
  if (/\b(?:bank|bdo|bpi|metrobank|instapay|pesonet|transfer)\b/i.test(raw))
    return "Bank Transfer";
  if (/\bcash\b/i.test(raw)) return "Cash";
  return "GCash";
};

const FREEBIE_ALIASES: { item: string; pattern: string }[] = [
  { item: "Palabok", pattern: "palabok" },
  { item: "Pancit", pattern: "pancit|pansit|bihon|canton" },
  { item: "Spaghetti", pattern: "spaghetti|spag" },
  { item: "Puto", pattern: "puto" },
  { item: "Sarsa", pattern: "sarsa|sauce" },
  { item: "Dinuguan", pattern: "dinuguan" },
  {
    item: "1.5L Coke",
    pattern: "coke|pepsi|mountain\\s+dew|7\\s*up|mirinda|softdrinks?",
  },
];

const parseFreebieOverrides = (value: string): Record<string, number> => {
  const overrides: Record<string, number> = {};
  for (const alias of FREEBIE_ALIASES) {
    const noMatch = value.match(
      new RegExp(`\\b(?:no|walang|without)\\s+(?:${alias.pattern})\\b`, "i"),
    );
    if (noMatch) {
      overrides[alias.item] = 0;
      continue;
    }
    const quantityMatch = value.match(
      new RegExp(
        `\\b(\\d+|isa|isang|one|dalawa|dalawang|two|tatlo|tatlong|three|apat|four|lima|limang|five|anim|six|pito|pitong|seven|walo|walong|eight|siyam|nine|sampu|sampung|ten)\\s*(?:x|pcs?\\.?|pieces?|tub|tubs)?\\s*(?:${alias.pattern})\\b`,
        "i",
      ),
    );
    if (quantityMatch) {
      overrides[alias.item] = parseWordNumber(quantityMatch[1]);
    }
  }
  return overrides;
};

const ADDON_MAP = [
  {
    keywords: [
      "raw innards",
      "lamang loob",
      "lamang-loob",
      "hilaw na laman loob",
      "hilaw na laman",
    ],
    nameMatch: "raw innards",
  },
  { keywords: ["sarsa", "sauce", "lechon sauce"], nameMatch: "sarsa" },
  {
    keywords: [
      "1.5 l coke",
      "1.5l coke",
      "coke",
      "pepsi",
      "softdrink",
      "softdrinks",
      "soda",
    ],
    nameMatch: "coke",
  },
  { keywords: ["pancit", "pansit", "bihon", "canton"], nameMatch: "pancit" },
  { keywords: ["palabok"], nameMatch: "palabok" },
  { keywords: ["spaghetti", "spag"], nameMatch: "spaghetti" },
  { keywords: ["dinuguan"], nameMatch: "dinuguan" },
  { keywords: ["puto"], nameMatch: "puto" },
];

const wholeAliases = [
  {
    pattern: "(?:super\\s*jumbo|s\\.?\\s*jumbo)",
    names: ["s jumbo", "super jumbo"],
    minWeight: 41,
    maxWeight: 45,
  },
  { pattern: "jumbo", names: ["jumbo"], minWeight: 37, maxWeight: 40 },
  {
    pattern: "(?:xxl|2xl|xx[-\\s]?large|double\\s+(?:extra\\s+large|xl))",
    names: [
      "xxl",
      "2xl",
      "xx large",
      "double extra large",
      "double xl",
    ],
    minWeight: 32,
    maxWeight: 35,
  },
  {
    pattern: "(?:xl|1xl|x[-\\s]?large|extra[-\\s]+large)",
    names: ["xl", "1xl", "x large", "extra large"],
    minWeight: 28,
    maxWeight: 30,
  },
  {
    pattern: "(?:xxs|2xs|xx[-\\s]?small|double\\s+extra\\s+small)",
    names: [
      "xxs",
      "2xs",
      "xx small",
      "double extra small",
    ],
    minWeight: 13,
    maxWeight: 15,
  },
  {
    pattern: "(?:xs|x[-\\s]?small|extra[-\\s]+small)",
    names: ["xs", "x small", "extra small"],
    minWeight: 16,
    maxWeight: 19,
  },
  {
    pattern: "(?<!x[-\\s])(?<!xx[-\\s])(?<!extra[-\\s])(?:large|l)",
    names: ["l", "large"],
    minWeight: 25,
    maxWeight: 27,
  },
  {
    pattern: "(?:medium|med|m)",
    names: ["m", "med", "medium"],
    minWeight: 22,
    maxWeight: 24,
  },
  {
    pattern: "(?<!x[-\\s])(?<!xx[-\\s])(?<!extra[-\\s])(?:small|s)",
    names: ["s", "small"],
    minWeight: 20,
    maxWeight: 21,
  },
];

const parseFlexibleDateTimeAndTbd = (
  source: string,
): { targetDeliveryTime: string | null; isTimeTbd: boolean } => {
  if (!source) return { targetDeliveryTime: null, isTimeTbd: false };

  const clean = source.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();

  const isExplicitTbd =
    /\b(?:tba|tbd|to\s*follow|waiting\s*sa\s*(?:oras|time)|no\s*time|oras\s*to\s*follow)\b/i.test(
      lower,
    );

  const now = new Date();
  let year = 2026;
  let month = now.getMonth();
  let day = now.getDate();
  let hasDate = false;

  if (/\b(?:tomorrow|bukas)\b/i.test(clean)) {
    const tomorrow = new Date(year, month, day + 1);
    year = tomorrow.getFullYear();
    month = tomorrow.getMonth();
    day = tomorrow.getDate();
    hasDate = true;
  } else if (/\b(?:today|ngayon)\b/i.test(clean)) {
    hasDate = true;
  } else {
    const isoMatch = clean.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    const monthMatch = clean.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:\s*,\s*(\d{2,4})|\s+(20\d{2}))?/i,
    );
    const numericMatch = clean.match(
      /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|20\d{2})\b/,
    );

    if (isoMatch) {
      year = Number(isoMatch[1]);
      if (year < 2025) year = 2026;
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
      month = months.findIndex((m) =>
        monthMatch[1].toLowerCase().startsWith(m),
      );
      day = Number(monthMatch[2]);
      const rawYear = monthMatch[3] || monthMatch[4];
      if (rawYear) {
        const parsedYear = Number(rawYear);
        year = rawYear.length === 2 ? 2000 + parsedYear : parsedYear;
        if (year < 2025) year = 2026;
      }
      hasDate = month >= 0;
    } else if (numericMatch) {
      month = Number(numericMatch[1]) - 1;
      day = Number(numericMatch[2]);
      const rawYear = numericMatch[3];
      year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      if (year < 2025) year = 2026;
      hasDate = true;
    }
  }

  if (!hasDate) return { targetDeliveryTime: null, isTimeTbd: false };

  const pad = (v: number) => String(v).padStart(2, "0");

  if (isExplicitTbd) {
    return {
      targetDeliveryTime: `${year}-${pad(month + 1)}-${pad(day)}T12:00:00`,
      isTimeTbd: true,
    };
  }

  let hours = 12;
  let minutes = 0;
  let hasTime = false;

  // 1. "BEFORE 12PM" -> 11:30 AM
  const beforeMatch = clean.match(
    /\bbefore\s+(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?|nn|mn)?\b/i,
  );
  if (beforeMatch) {
    let rawH = Number(beforeMatch[1]);
    const rawM = beforeMatch[2] ? Number(beforeMatch[2]) : 0;
    const mer = beforeMatch[3]
      ? beforeMatch[3].replace(/\./g, "").toLowerCase()
      : rawH >= 7 && rawH <= 11
        ? "am"
        : "pm";
    if ((mer === "pm" || mer === "nn") && rawH < 12) rawH += 12;
    if ((mer === "am" || mer === "mn") && rawH === 12) rawH = 0;

    let totalMins = rawH * 60 + rawM - 30;
    if (totalMins < 0) totalMins += 24 * 60;
    hours = Math.floor(totalMins / 60);
    minutes = totalMins % 60;
    hasTime = true;
  }

  // 2. Range "10-10:30AM" -> use end time
  if (!hasTime) {
    const rangeMatch = clean.match(
      /\b\d{1,2}(?::\d{2})?\s*[-–]\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?|nn|mn)\b/i,
    );
    if (rangeMatch) {
      hours = Number(rangeMatch[1]);
      minutes = Number(rangeMatch[2] || 0);
      const mer = rangeMatch[3].replace(/\./g, "").toLowerCase();
      if ((mer === "pm" || mer === "nn") && hours < 12) hours += 12;
      if ((mer === "am" || mer === "mn") && hours === 12) hours = 0;
      hasTime = true;
    }
  }

  // 3. "around 11am", "approx 11am"
  if (!hasTime) {
    const approxMatch = clean.match(
      /\b(?:around|approx\.?|mga)\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?|nn|mn)?\b/i,
    );
    if (approxMatch) {
      hours = Number(approxMatch[1]);
      minutes = Number(approxMatch[2] || 0);
      const mer = approxMatch[3]
        ? approxMatch[3].replace(/\./g, "").toLowerCase()
        : hours >= 7 && hours <= 11
          ? "am"
          : "pm";
      if ((mer === "pm" || mer === "nn") && hours < 12) hours += 12;
      if ((mer === "am" || mer === "mn") && hours === 12) hours = 0;
      hasTime = true;
    }
  }

  // 4. Standard meridiem "11:30 AM", "12nn", "12mn"
  if (!hasTime) {
    const meridiemMatch = clean.match(
      /\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?|nn|mn)\b/i,
    );
    if (meridiemMatch) {
      hours = Number(meridiemMatch[1]);
      minutes = Number(meridiemMatch[2] || 0);
      const mer = meridiemMatch[3].replace(/\./g, "").toLowerCase();
      if ((mer === "pm" || mer === "nn") && hours < 12) hours += 12;
      if ((mer === "am" || mer === "mn") && hours === 12) hours = 0;
      hasTime = true;
    }
  }

  // 5. 24-hour time "14:30"
  if (!hasTime) {
    const twentyFourMatch = clean.match(
      /(?:\||\bat\b|\btime\s*[:\-]?)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i,
    );
    if (twentyFourMatch) {
      hours = Number(twentyFourMatch[1]);
      minutes = Number(twentyFourMatch[2]);
      hasTime = true;
    }
  }

  if (!hasTime) {
    return {
      targetDeliveryTime: `${year}-${pad(month + 1)}-${pad(day)}T12:00:00`,
      isTimeTbd: true,
    };
  }

  return {
    targetDeliveryTime: `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`,
    isTimeTbd: false,
  };
};

/** Parses the customer and staff variants of Yumi's four-phase Messenger template. */
export function parseMessengerTextToDraft(
  rawText: string,
  categories: ItemCategory[],
  pricingConfig?: MessengerParserPricingConfig,
): ParsedOrderDraftDto {
  const rawLines = (rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Group into sections with multiline values
  const sections: { header: string; value: string }[] = [];
  let currentHeader: string | null = null;
  let currentLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Hard boundary enforcement: dividers and disclaimers terminate multiline collection
    if (
      HORIZONTAL_RULE_PATTERN.test(line) ||
      FOOTER_DISCLAIMER_PATTERN.test(line) ||
      BOILERPLATE_PATTERN.test(line)
    ) {
      if (currentHeader !== null) {
        sections.push({
          header: currentHeader,
          value: currentLines.join("\n").trim(),
        });
        currentHeader = null;
        currentLines = [];
      }
      continue;
    }

    const match = line.match(FIELD_LABEL_PATTERN);
    if (match) {
      if (currentHeader !== null) {
        sections.push({
          header: currentHeader,
          value: currentLines.join("\n").trim(),
        });
      }
      const colonIndex = line.indexOf(":");
      const dashIndex = line.indexOf("-");
      const splitIdx = colonIndex !== -1 ? colonIndex : dashIndex;
      currentHeader = line.slice(0, splitIdx).trim().toLowerCase();
      const rest = line.slice(splitIdx + 1).trim();
      currentLines = rest ? [rest] : [];
    } else {
      // Floating culinary notes isolation: never let non-remarks headers swallow kitchen instructions
      const cleanedLine = cleanNoteText(line);
      const isCulinaryNote = CULINARY_PREP_PATTERN.test(cleanedLine);

      if (
        isCulinaryNote &&
        currentHeader !== null &&
        !/^(?:special\s*requests?|remarks?|notes?|bilin|instructions?)$/i.test(
          currentHeader,
        )
      ) {
        sections.push({
          header: currentHeader,
          value: currentLines.join("\n").trim(),
        });
        currentHeader = null;
        currentLines = [];
      }

      if (currentHeader !== null) {
        currentLines.push(line);
      } else {
        sections.push({ header: "_raw", value: line });
      }
    }
  }
  if (currentHeader !== null) {
    sections.push({
      header: currentHeader,
      value: currentLines.join("\n").trim(),
    });
  }

  let customerName = "";
  let facebookName: string | null = null;
  let contactNumber = "";
  let contactNumber2: string | null = null;
  let fulfillment = 1;
  let fulfillmentExplicit = false;
  let deliveryAddress = "";
  let landmark: string | null = null;
  let eventType: string | null = null;
  let targetDeliveryTime: string | null = null;
  let isTimeTbd = false;
  let deliveryFee: number | null = null;
  let distanceKm: number | null = null;
  let discount: number | null = null;
  let downpayment: number | null = null;
  let downpaymentMethod: ParsedOrderDraftDto["downpaymentMethod"] = null;
  let freebiesOptOut: boolean | null = null;
  let rawInnards: boolean | null = null;
  let freebiesMode: ParsedOrderDraftDto["freebiesMode"] = null;
  const freebieOverrides: Record<string, number> = {};
  const freebiesCustomizationNotes: string[] = [];
  const remarks: string[] = [];
  const dateParts: string[] = [];
  const orderSources: string[] = [];
  const addOnSources: string[] = [];
  const additionalAddOns: string[] = [];
  const freebieValues: string[] = [];

  for (const sec of sections) {
    const { header, value } = sec;
    if (!value) continue;

    if (header === "_raw") {
      const cleaned = cleanNoteText(value);
      if (cleaned && CULINARY_PREP_PATTERN.test(cleaned)) {
        if (!remarks.some((r) => r.toLowerCase() === cleaned.toLowerCase())) {
          remarks.push(cleaned);
          if (
            /walang\s+dinuguan|hilaw\s+na\s+(?:laman\s*loob|innards?)|raw\s+innards?/i.test(
              cleaned,
            )
          ) {
            rawInnards = true;
          }
        }
      }
      continue;
    }

    if (
      /^(?:name|customer(?:\s*name)?|buyer|client|ordered\s*by)$/i.test(header)
    ) {
      customerName = customerName || value;
    } else if (
      /^(?:fb|facebook(?:\s*name)?|messenger(?:\s*name)?)$/i.test(header)
    ) {
      facebookName = facebookName || value || null;
    } else if (/^cp\s*#?\s*2$/i.test(header)) {
      contactNumber2 = extractPhone(value) || null;
    } else if (
      /^(?:cp\s*#?\s*(?:1\s*)?|contact(?:\s*number)?\s*#?|phone|mobile(?:\s*number)?|cellphone)$/i.test(
        header,
      )
    ) {
      contactNumber = contactNumber || extractPhone(value);
    } else if (/^(?:pickup\s*or\s*deliver|fulfillment)$/i.test(header)) {
      if (/pick\s*-?\s*up/i.test(value)) {
        fulfillment = 0;
        fulfillmentExplicit = true;
      } else if (/lalamove/i.test(value)) {
        fulfillment = 2;
        fulfillmentExplicit = true;
      } else if (/deliver/i.test(value)) {
        fulfillment = 1;
        fulfillmentExplicit = true;
      }
    } else if (
      /^(?:del\s*add|deliver|delivery|address|location|delivery\s*address|drop[\s-]*off|venue)$/i.test(
        header,
      )
    ) {
      deliveryAddress = deliveryAddress ? `${deliveryAddress}, ${value}` : value;
    } else if (/^(?:landmark|palatandaan|near)$/i.test(header)) {
      landmark = landmark || value || null;
    } else if (
      /^(?:type\s*of\s*event|event(?:\s*type)?|occasion|okasyon)$/i.test(header)
    ) {
      eventType = eventType || parseEventType(value);
    } else if (/^date\s*(?:&|and)\s*time$/i.test(header)) {
      dateParts.push(value);
    } else if (
      /^(?:date|delivery\s*date|target\s*date|schedule|petsa)$/i.test(header)
    ) {
      dateParts.push(value);
    } else if (/^(?:time|delivery\s*time|target\s*time|oras)$/i.test(header)) {
      dateParts.push(value);
    } else if (/^(?:order\s*\/\s*size|order(?:\s*size)?|size)$/i.test(header)) {
      orderSources.push(value);
    } else if (
      /^(?:freebies?\s*or\s*(?:less\s*2\s*k|cash\s*discount)|freebies?)$/i.test(
        header,
      )
    ) {
      freebieValues.push(value);
    } else if (/^add[\s-]*ons?(?:\s*\([^)]*\))?$/i.test(header)) {
      addOnSources.push(value);
    } else if (/^additional\s+(.+)$/i.test(header)) {
      const match = header.match(/^additional\s+(.+)$/i);
      if (match) additionalAddOns.push(`${match[1]}\u0000${value}`);
    } else if (
      /^(?:special\s*requests?|remarks?|notes?|bilin|instructions?)$/i.test(
        header,
      )
    ) {
      if (
        !/^(?:n\/?a|none|-+)$/i.test(value) &&
        !BOILERPLATE_PATTERN.test(value)
      ) {
        if (
          /\b(?:palabok|pancit|pansit|bihon|canton|spaghetti|spag|biko|puto|sarsa|dinuguan|coke|pepsi)\b/i.test(
            value,
          )
        ) {
          const overrides = parseFreebieOverrides(value);
          if (Object.keys(overrides).length > 0) {
            freebiesMode = "custom";
            Object.assign(freebieOverrides, overrides);
            freebiesCustomizationNotes.push(value);
          }
        }
        // Extract ONLY non-freebie culinary/prep instructions into remarks
        const nonFreebieNotes = extractNonFreebieRemarks(value);
        for (const note of nonFreebieNotes) {
          if (!remarks.some((r) => r.toLowerCase() === note.toLowerCase())) {
            remarks.push(note);
          }
        }
        if (
          /walang\s+dinuguan|hilaw\s+na\s+(?:laman\s*loob|innards?)|raw\s+innards?/i.test(
            value,
          )
        ) {
          rawInnards = true;
        }
      }
    } else if (/^distance(?:\s*km)?$/i.test(header)) {
      const lines = value
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const firstLine = lines[0] || "";
      if (firstLine) {
        // Reject if followed by hour/hours/oras/min/mins/minutes/pm/am/%
        const hasRejectedUnit =
          /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|oras|mins?|minutes?|pm|am|%)\b/i.test(
            firstLine,
          );
        if (!hasRejectedUnit) {
          const kmMatch = firstLine.match(
            /(\d+(?:\.\d+)?)\s*(?:km\b|kilometers?\b)?/i,
          );
          if (kmMatch && kmMatch[1]) {
            const parsedVal = Number(kmMatch[1]);
            if (Number.isFinite(parsedVal)) {
              distanceKm = parsedVal;
            }
          }
        }
      }
    } else if (
      /^(?:dp\s*(?:&|and)\s*mode(?:\s*\([^)]*\))?|dp|down\s*payment(?:\s*&\s*mode)?|downpayment(?:\s*&\s*mode)?|deposit)$/i.test(
        header,
      )
    ) {
      downpayment = parsePesoNumber(value);
      downpaymentMethod = sniffPaymentMethod(value, downpayment);
    } else if (
      /^(?:delivery\s*(?:charge|fee)|deliver\s*charge|del\.?\s*fee|df)$/i.test(
        header,
      )
    ) {
      deliveryFee = parsePesoNumber(value);
    } else if (/^discount$/i.test(header)) {
      discount = parsePesoNumber(value);
    }
  }

  // Floating Culinary Notes Scanner across all unlabelled lines
  for (const line of rawLines) {
    if (FIELD_LABEL_PATTERN.test(line)) continue;
    if (HORIZONTAL_RULE_PATTERN.test(line)) continue;
    if (FOOTER_DISCLAIMER_PATTERN.test(line)) continue;
    if (BOILERPLATE_PATTERN.test(line)) continue;

    const cleaned = cleanNoteText(line);
    if (!cleaned) continue;

    if (CULINARY_PREP_PATTERN.test(cleaned)) {
      if (!remarks.some((r) => r.toLowerCase() === cleaned.toLowerCase())) {
        remarks.push(cleaned);
        if (
          /walang\s+dinuguan|hilaw\s+na\s+(?:laman\s*loob|innards?)|raw\s+innards?/i.test(
            cleaned,
          )
        ) {
          rawInnards = true;
        }
      }
    }
  }

  const sanitizedText = rawText || "";
  if (!customerName) {
    const rawSec = sections.find((s) => s.header === "_raw");
    if (
      rawSec &&
      rawSec.value.length >= 2 &&
      rawSec.value.length <= 60 &&
      !/\d|^(?:order|lechon|booking|hi|hello)/i.test(rawSec.value)
    ) {
      customerName = rawSec.value;
    }
  }

  const fallbackPhones = splitPhonesFromText(sanitizedText);
  contactNumber = contactNumber || fallbackPhones[0] || "";
  if (!contactNumber2) {
    contactNumber2 = fallbackPhones.find((p) => p !== contactNumber) || null;
  }

  if (distanceKm === null) {
    const distMatch = sanitizedText.match(/(\d+(?:\.\d+)?)\s*km\b/i);
    if (distMatch) distanceKm = Number(distMatch[1]);
  }

  if (!fulfillmentExplicit) {
    if (/\blalamove\b/i.test(sanitizedText)) {
      fulfillment = 2;
    } else if (/\b(?:pick\s*-?\s*up|store\s*pickup)\b/i.test(sanitizedText)) {
      fulfillment = 0;
    }
  }

  // Date & Time
  const dateStr = dateParts.length > 0 ? dateParts.join(" ") : sanitizedText;
  const dtResult = parseFlexibleDateTimeAndTbd(dateStr);
  targetDeliveryTime = dtResult.targetDeliveryTime;
  isTimeTbd = dtResult.isTimeTbd;

  if (!eventType) {
    const eventMatch = sanitizedText.match(
      /\b(?:birthday|bday|anniversary|binyag|baptismal|wedding|kasal|fiesta|corporate)\b/i,
    );
    if (eventMatch) eventType = parseEventType(eventMatch[0]);
  }

  // Freebies / Less 2k
  for (const fVal of freebieValues) {
    if (
      /less\s*2\s*k|less\s*2,?000|cash\s*discount|no\s*freebie|walang\s*freebie/i.test(
        fVal,
      )
    ) {
      freebiesOptOut = true;
    } else if (/freebie/i.test(fVal)) {
      freebiesOptOut = false;
    }
  }
  if (/\bwith\s+7\s+(?:freebies|frebbies)\b/i.test(sanitizedText)) {
    freebiesOptOut = false;
  }
  if (freebiesOptOut === true) {
    freebiesMode = "optOut";
    const confDiscount = Number(pricingConfig?.noFreebiesDiscountPerPig ?? 2000);
    discount = Number.isFinite(confDiscount) ? Math.max(0, confDiscount) : 2000;
  }

  // Parse Items (Cart: Pigs + Bellies + Add-Ons)
  const matchedItems = new Map<number, number>();
  const activeCategories = categories.filter((c) => c.isActive !== false);
  const addItem = (cat: ItemCategory | undefined, quantity = 1) => {
    if (!cat) return;
    const current = matchedItems.get(cat.id) || 0;
    matchedItems.set(cat.id, current + Math.max(1, Math.floor(quantity || 1)));
  };

  // 1. Whole Pigs & Bellies from orderSources
  for (const src of orderSources) {
    const cleaned = src.replace(
      /\bwith\s+7\s+(?:freebies|frebbies)\b.*$/i,
      "",
    );
    const tokens = cleaned
      .split(/[,/&+;]|\band\b|\bat\b|\btsaka\b|\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const lower = token.toLowerCase();

      // Check Belly
      const bellyKgMatch = lower.match(
        /\b([2-5])\s*kg\s*(?:lechon\s*)?belly\b|\b(?:lechon\s*)?belly\s*([2-5])\s*kg\b|\b([2-5])\s*kg\b/i,
      );
      const isBellyMention = /belly/i.test(lower);
      if (isBellyMention || (bellyKgMatch && bellyKgMatch[1])) {
        const kg = Number(
          bellyKgMatch
            ? bellyKgMatch[1] || bellyKgMatch[2] || bellyKgMatch[3]
            : 0,
        );
        const bellyCategory = activeCategories.find((c) =>
          /belly/i.test(c.name) && (kg ? c.minimumWeightKg === kg : true),
        );
        if (bellyCategory) {
          let qty = 1;
          const qm = lower.match(
            /(\d+|isang?|dalawang?|tatlong?|apat|lima)\s*(?:x|pcs?|orders?)?\s*(?:(?:lechon\s*)?belly|[2-5]\s*kg)/i,
          );
          if (qm) qty = parseWordNumber(qm[1]);
          addItem(bellyCategory, qty);
          continue;
        }
      }

      // Check Weight Range (e.g. 25-27kg)
      const rangeMatch = lower.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*kg\b/i);
      if (rangeMatch) {
        const minKg = Number(rangeMatch[1]);
        const maxKg = Number(rangeMatch[2]);
        const matchedCat = activeCategories.find(
          (c) =>
            c.minimumWeightKg >= 13 &&
            Math.abs(c.minimumWeightKg - minKg) <= 1 &&
            Math.abs(c.maximumWeightKg - maxKg) <= 1,
        );
        if (matchedCat) {
          let qty = 1;
          const qm = lower.match(
            /(?:^|\s+)(\d+|isang?|dalawang?|tatlong?)\s*(?:x|pcs?|orders?)\s*(?:ng\s+)?\d{1,2}\s*[-–]\s*\d{1,2}\s*kg/i,
          );
          if (qm) qty = parseWordNumber(qm[1]);
          addItem(matchedCat, qty);
          continue;
        }
      }

      // Check Whole Lechon Aliases
      let matchedCategory: ItemCategory | undefined;
      let matchedQty = 1;
      for (const alias of wholeAliases) {
        const regex = new RegExp(`(?:^|\\b)(${alias.pattern})(?=$|\\b)`, "i");
        const match = regex.exec(lower);
        if (!match) continue;

        matchedCategory = activeCategories.find((c) => {
          if (c.minimumWeightKg < 13 || /belly/i.test(c.name)) return false;
          const norm = c.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
          return (
            alias.names.includes(norm) || c.minimumWeightKg === alias.minWeight
          );
        });

        if (matchedCategory) {
          const prefix = lower.slice(0, match.index);
          const qm = prefix.match(
            /(\d+|isang?|dalawang?|tatlong?|apat|lima)\s*(?:x|pcs?|orders?)?\s*$/i,
          );
          if (qm) matchedQty = parseWordNumber(qm[1]);
          break;
        }
      }
      if (matchedCategory) {
        addItem(matchedCategory, matchedQty);
      }
    }
  }

  // 2. Add-Ons from addOnSources
  const addOnCategories = activeCategories.filter(
    (c) => c.minimumWeightKg === 0,
  );
  for (const src of addOnSources) {
    const tokens = src
      .split(/[,/&+;]|\band\b|\bat\b|\btsaka\b|\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const token of tokens) {
      const lower = token.toLowerCase();
      let matchedDef: (typeof ADDON_MAP)[0] | null = null;
      for (const def of ADDON_MAP) {
        for (const kw of def.keywords) {
          if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
            matchedDef = def;
            break;
          }
        }
        if (matchedDef) break;
      }
      if (!matchedDef) continue;
      const cat = addOnCategories.find((c) =>
        c.name.toLowerCase().includes(matchedDef!.nameMatch),
      );
      if (!cat) continue;

      let qty = 1;
      const leadingMatch = lower.match(
        /^(?:(?:qty\.?|x)\s*)?(\d+|isang?|dalawang?|tatlong?|apat(?:\s*na)?|limang?|anim(?:\s*na)?|pitong?|walong?|siyam(?:\s*na)?|sampung?|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x|pcs?|pieces?|bottles?|bote|boteng|orders?|packs?|pack|bilao)?\s*(?:ng\s+)?/i,
      );
      const trailingMatch = lower.match(
        /(?:\s*(?:x|qty\.?|-|:|\(|\b)\s*)(\d+|isa|isang|dalawa|dalawang|tatlo|tatlong|apat|lima|anim|pito|walo|siyam|sampu|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*(?:x|pcs?|pieces?|bottles?|bote|orders?|packs?|bilao|\)))?$/i,
      );
      if (leadingMatch && leadingMatch[1]) {
        qty = parseWordNumber(leadingMatch[1]);
      } else if (trailingMatch && trailingMatch[1]) {
        qty = parseWordNumber(trailingMatch[1]);
      }
      addItem(cat, qty);
    }
  }

  // 3. Additional items
  for (const encoded of additionalAddOns) {
    const [label, val] = encoded.split("\u0000");
    const lowerLabel = label.toLowerCase();
    const cat = addOnCategories.find(
      (c) =>
        lowerLabel.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(lowerLabel),
    );
    if (cat) {
      const qm = val.match(/(\d+)\b/);
      addItem(cat, qm ? Number(qm[1]) : 1);
    }
  }

  const items = Array.from(matchedItems.entries()).map(
    ([itemCategoryId, quantity]) => ({
      itemCategoryId,
      quantity,
    }),
  );

  return {
    customerName,
    facebookName,
    contactNumber,
    contactNumber2,
    secondaryContactNumber: contactNumber2,
    source: "Business FB Page",
    eventType,
    targetDeliveryTime,
    isTimeTbd,
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
    freebiesMode,
    freebieOverrides:
      Object.keys(freebieOverrides).length > 0 ? freebieOverrides : null,
    freebiesCustomizationNote:
      freebiesCustomizationNotes.length > 0
        ? freebiesCustomizationNotes.join(" | ")
        : null,
    items,
  };
}
