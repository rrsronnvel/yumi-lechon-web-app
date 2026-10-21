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
  source?: string | null;
  eventType?: string | null;
  targetDeliveryTime?: string | null;
  fulfillment: number; // 0 = Pickup, 1 = Delivery, 2 = Lalamove
  deliveryAddress?: string | null;
  landmark?: string | null;
  remarks?: string | null;
  deliveryFee?: number | null;
  downpayment?: number | null;
  items: ParsedOrderItemDto[];
}

const parsePesoNumber = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

/**
 * Parses unstructured or semi-structured Facebook Messenger booking text into a structured draft.
 */
export function parseMessengerTextToDraft(
  rawText: string,
  categories: ItemCategory[]
): ParsedOrderDraftDto {
  const text = (rawText || "").trim();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let customerName = "";
  let facebookName: string | null = null;
  let contactNumber = "";
  let eventType: string | null = null;
  let landmark: string | null = null;
  const secondaryPhones: string[] = [];
  let fulfillment = 1; // Default Delivery
  let deliveryAddress = "";
  let deliveryFee: number | null = null;
  let downpayment: number | null = null;
  let targetDeliveryTime: string | null = null;
  const remarksList: string[] = [];

  // 1. Extract all Philippine mobile numbers (09XXXXXXXXX or +639XXXXXXXXX)
  const phoneRegex = /(?:\+63|0)9\d{2}[-\s]?\d{3}[-\s]?\d{4}/g;
  const phoneMatches = text.match(phoneRegex) || [];
  const normalizedPhones = Array.from(
    new Set(
      phoneMatches.map((p) => {
        const digits = p.replace(/[-\s]/g, "");
        return digits.startsWith("+63") ? "0" + digits.slice(3) : digits;
      })
    )
  );

  if (normalizedPhones.length > 0) {
    contactNumber = normalizedPhones[0];
    if (normalizedPhones.length > 1) {
      secondaryPhones.push(...normalizedPhones.slice(1));
    }
  }

  // 2. Detect Fulfillment Mode
  if (/\blalamove\b/i.test(text)) {
    fulfillment = 2;
    deliveryFee = 0;
  } else if (/\b(pick\s*-?\s*up|store\s*pickup)\b/i.test(text)) {
    fulfillment = 0;
    deliveryFee = 0;
  }

  // 3. Line-by-line field extraction
  let dateCandidate = "";
  let timeCandidate = "";

  for (const line of lines) {
    // Customer Name
    if (!customerName) {
      const nameMatch = line.match(
        /^(?:name|customer(?:\s*name)?|buyer|client|ordered\s*by)\s*[:\-]\s*(.+)$/i
      );
      if (nameMatch) {
        customerName = nameMatch[1].trim();
        continue;
      }
    }

    // Facebook / Messenger Name
    if (!facebookName) {
      const fbMatch = line.match(
        /^(?:fb|facebook(?:\s*name)?|messenger(?:\s*name)?)\s*[:\-]\s*(.+)$/i
      );
      if (fbMatch) {
        facebookName = fbMatch[1].trim();
        continue;
      }
    }

    // Address / Location
    const addrMatch = line.match(
      /^(?:address|location|delivery\s*address|drop[\s-]*off|brgy|venue)\s*[:\-]\s*(.+)$/i
    );
    if (addrMatch && !deliveryAddress) {
      deliveryAddress = addrMatch[1].trim();
      continue;
    }

    // Landmark
    const landmarkMatch = line.match(
      /^(?:landmark|palatandaan|near)\s*[:\-]\s*(.+)$/i
    );
    if (landmarkMatch && !landmark) {
      landmark = landmarkMatch[1].trim();
      continue;
    }

    // Event / Occasion
    const eventMatch = line.match(
      /^(?:event|occasion|okasyon)\s*[:\-]\s*(.+)$/i
    );
    if (eventMatch && !eventType) {
      const rawEvt = eventMatch[1].trim();
      if (/bday|birthday/i.test(rawEvt)) eventType = "Birthday";
      else if (/fiesta/i.test(rawEvt)) eventType = "Fiesta";
      else if (/wedding|kasal/i.test(rawEvt)) eventType = "Wedding";
      else if (/corporate|office|company/i.test(rawEvt)) eventType = "Corporate";
      else eventType = "Other";
      continue;
    }

    // Kitchen Remarks / Notes
    const noteMatch = line.match(
      /^(?:remarks|notes?|bilin|instructions?)\s*[:\-]\s*(.+)$/i
    );
    if (noteMatch) {
      remarksList.push(noteMatch[1].trim());
      continue;
    }

    // Downpayment / Deposit
    const dpMatch = line.match(
      /(?:down\s*payment|downpayment|\bdp\b|deposit|paid\s*dp)\s*[:\-]?\s*(?:php|₱|p)?\s*([\d,]+(?:\.\d{1,2})?)/i
    );
    if (dpMatch && downpayment === null) {
      downpayment = parsePesoNumber(dpMatch[1]);
      continue;
    }

    // Delivery Fee
    const dfMatch = line.match(
      /(?:delivery\s*fee|del\.?\s*fee|df|freight)\s*[:\-]?\s*(?:php|₱|p)?\s*([\d,]+(?:\.\d{1,2})?)/i
    );
    if (dfMatch && deliveryFee === null && fulfillment === 1) {
      deliveryFee = parsePesoNumber(dfMatch[1]);
      continue;
    }

    // Date line
    const dateLineMatch = line.match(
      /^(?:date|delivery\s*date|target\s*date|schedule|petsa)\s*[:\-]\s*(.+)$/i
    );
    if (dateLineMatch && !dateCandidate) {
      dateCandidate = dateLineMatch[1].trim();
      continue;
    }

    // Time line
    const timeLineMatch = line.match(
      /^(?:time|delivery\s*time|target\s*time|oras)\s*[:\-]\s*(.+)$/i
    );
    if (timeLineMatch && !timeCandidate) {
      timeCandidate = timeLineMatch[1].trim();
      continue;
    }
  }

  // Fallback Customer Name: if first line looks like a person's name (no digits, no colon)
  if (!customerName && lines.length > 0) {
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

  // Fallback Address: look for Cavite municipalities or common address keywords
  if (!deliveryAddress) {
    const addrLine = lines.find((l) =>
      /\b(blk|block|lot|phase|subd|village|brgy|barangay|imus|bacoor|dasma|dasmariñas|kawit|noveleta|rosario|general\s*trias|gen\s*tri|tanza|trece|silang|tagaytay|cavite)\b/i.test(
        l
      )
    );
    if (addrLine) {
      deliveryAddress = addrLine
        .replace(/^(?:address|location|addr)\s*[:\-]\s*/i, "")
        .trim();
    }
  }

  // 4. Parse Date & Time into ISO string
  const now = new Date();
  let parsedDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0
  );
  let hasExtractedDateOrTime = false;

  const combinedSource = `${dateCandidate} ${timeCandidate} ${text}`;

  if (/\btomorrow\b|\bbukas\b/i.test(combinedSource)) {
    parsedDate.setDate(parsedDate.getDate() + 1);
    hasExtractedDateOrTime = true;
  } else if (/\btoday\b|\bngayon\b/i.test(combinedSource)) {
    hasExtractedDateOrTime = true;
  } else {
    const isoDateMatch = combinedSource.match(
      /\b(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/
    );
    const monthNameMatch = combinedSource.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:[,\s]+(202\d))?\b/i
    );

    if (isoDateMatch) {
      parsedDate = new Date(
        parseInt(isoDateMatch[1], 10),
        parseInt(isoDateMatch[2], 10) - 1,
        parseInt(isoDateMatch[3], 10),
        12,
        0,
        0
      );
      hasExtractedDateOrTime = true;
    } else if (monthNameMatch) {
      const monthNames = [
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
      const mIdx = monthNames.findIndex((m) =>
        monthNameMatch[1].toLowerCase().startsWith(m)
      );
      const dayNum = parseInt(monthNameMatch[2], 10);
      const yrNum = monthNameMatch[3]
        ? parseInt(monthNameMatch[3], 10)
        : now.getFullYear();
      if (mIdx >= 0 && dayNum >= 1 && dayNum <= 31) {
        parsedDate = new Date(yrNum, mIdx, dayNum, 12, 0, 0);
        hasExtractedDateOrTime = true;
      }
    }
  }

  // Extract time like "11:30 AM", "2:00 PM", "11am", "4pm"
  const timeMatch = combinedSource.match(
    /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm|nn|mn)\b/i
  );
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3].toLowerCase();
    if ((meridiem === "pm" || meridiem === "nn") && hours < 12) {
      hours += 12;
    } else if ((meridiem === "am" || meridiem === "mn") && hours === 12) {
      hours = 0;
    }
    parsedDate.setHours(hours, mins, 0, 0);
    hasExtractedDateOrTime = true;
  }

  if (hasExtractedDateOrTime) {
    const pad = (n: number) => String(n).padStart(2, "0");
    targetDeliveryTime = `${parsedDate.getFullYear()}-${pad(
      parsedDate.getMonth() + 1
    )}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(
      parsedDate.getMinutes()
    )}`;
  }

  // 5. Resolve Items against Active Categories
  const matchedItemsMap = new Map<number, number>();
  const activeCats = categories.filter((c) => c.isActive !== false);

  const addMatchedItem = (catId: number, qty: number) => {
    const prev = matchedItemsMap.get(catId) || 0;
    matchedItemsMap.set(catId, prev + Math.max(1, qty));
  };

  // Check Lechon Belly kg mentions first (e.g., "Belly 3kg", "3kg belly", "2x Belly 5kg")
  const bellyCategories = activeCats.filter((c) => /belly/i.test(c.name));
  for (const bellyCat of bellyCategories) {
    const kgNumMatch = bellyCat.name.match(/(\d+)\s*kg/i);
    if (kgNumMatch) {
      const kgVal = kgNumMatch[1];
      const bellyRegex = new RegExp(
        `(?:(\\d+)\\s*x?\\s*)?(?:belly\\s*${kgVal}\\s*kg|${kgVal}\\s*kg\\s*belly)`,
        "i"
      );
      const m = text.match(bellyRegex);
      if (m) {
        const qty = m[1] ? parseInt(m[1], 10) : 1;
        addMatchedItem(bellyCat.id, qty);
      }
    }
  }

  // Check Whole Lechon semantic sizes: Small, Medium, Large, XXL, XL, Jumbo, De Leche
  const wholeCategories = activeCats.filter(
    (c) => !/belly/i.test(c.name) && c.minimumWeightKg > 0
  );
  const sizeTokens = [
    "XXL",
    "S. Jumbo",
    "Jumbo",
    "Extra Large",
    "XL",
    "Large",
    "Medium",
    "Small",
    "XXS",
    "XS",
    "L",
    "M",
    "S",
    "De Leche",
  ];

  for (const token of sizeTokens) {
    const targetCat = wholeCategories.find((c) =>
      new RegExp(`^${token}$|\\b${token}\\b`, "i").test(c.name)
    );
    if (targetCat && !matchedItemsMap.has(targetCat.id)) {
      const regex = new RegExp(
        `(?:(\\d+)\\s*(?:x|pc|pcs|order|lechon)?\\s+)?\\b${token}\\b(?:\\s+(?:whole|lechon|size))?`,
        "i"
      );
      const m = text.match(regex);
      if (m) {
        const qty = m[1] ? parseInt(m[1], 10) : 1;
        addMatchedItem(targetCat.id, qty);
      }
    }
  }

  // Check Add-on categories (minimumWeightKg === 0)
  const addOnCats = activeCats.filter((c) => c.minimumWeightKg === 0);
  for (const addCat of addOnCats) {
    const escapedName = addCat.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:(\\d+)\\s*x?\\s*)?${escapedName}`, "i");
    const m = text.match(regex);
    if (m) {
      const qty = m[1] ? parseInt(m[1], 10) : 1;
      addMatchedItem(addCat.id, qty);
    }
  }

  // Fallback: direct substring match on any category name if still empty
  if (matchedItemsMap.size === 0) {
    for (const cat of activeCats) {
      if (text.toLowerCase().includes(cat.name.toLowerCase())) {
        addMatchedItem(cat.id, 1);
      }
    }
  }

  // 6. Bundle secondary phones and occasion keywords
  if (secondaryPhones.length > 0) {
    remarksList.unshift(`CP #2: ${secondaryPhones.join(", ")}`);
  }

  if (!eventType) {
    const occasionMatch = text.match(
      /\b(birthday|bday|baptismal|binyag|wedding|kasal|anniversary|fiesta|corporate|blessing|christmas|new\s*year)\b/i
    );
    if (occasionMatch) {
      const occ = occasionMatch[1].toLowerCase();
      if (occ === "birthday" || occ === "bday") eventType = "Birthday";
      else if (occ === "fiesta") eventType = "Fiesta";
      else if (occ === "wedding" || occ === "kasal") eventType = "Wedding";
      else if (occ === "corporate") eventType = "Corporate";
      else eventType = "Other";
    }
  }

  const items: ParsedOrderItemDto[] = Array.from(matchedItemsMap.entries()).map(
    ([itemCategoryId, quantity]) => ({
      itemCategoryId,
      quantity,
    })
  );

  return {
    customerName,
    facebookName,
    contactNumber,
    source: "Business FB Page",
    eventType,
    targetDeliveryTime,
    fulfillment,
    deliveryAddress: deliveryAddress || null,
    landmark,
    remarks: remarksList.length > 0 ? remarksList.join(" | ") : null,
    deliveryFee,
    downpayment,
    items,
  };
}
