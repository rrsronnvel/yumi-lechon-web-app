export interface ActiveCustomerOrderSummary {
  orderId: number;
  orderReference: string;
  customerName?: string;
  facebookName?: string | null;
  contactNumber?: string | null;
  deliveryAddress?: string | null;
  targetDeliveryTime?: string | null;
  grandTotal: number;
  itemsSummary: string;
  createdBy: string;
  isDraft?: boolean;
}

export interface DuplicateMatchEvaluation {
  order: ActiveCustomerOrderSummary;
  score: number;
  matchingFactors: string[];
  isSameDate: boolean;
  isSameDay: boolean;
}

export interface CurrentOrderDetails {
  orderId?: number;
  orderReference?: string;
  customerName?: string;
  facebookName?: string;
  contactNumber?: string;
  contactNumber2?: string;
  deliveryAddress?: string;
  targetDate?: string | null;
}

/**
 * Checks whether a phone number is a dummy/placeholder.
 * Matches exact common placeholders or numbers where unique digits <= 2 or length < 10.
 */
export const isPlaceholderPhone = (phone?: string | null): boolean => {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return true;
  if (
    digits === "09000000000" ||
    digits === "00000000000" ||
    digits === "09111111111" ||
    digits === "09999999999"
  ) {
    return true;
  }
  const unique = new Set(digits.split(""));
  return unique.size <= 2;
};

/**
 * Extracts and cleans valid 10/11-digit non-placeholder phone numbers.
 * Handles dual-contact comma-separated numbers and normalizes +63.
 */
export const cleanPhoneDigits = (phone?: string | null): string[] => {
  if (!phone) return [];
  return phone
    .split(",")
    .map((p) => {
      let d = p.replace(/\D/g, "");
      if (d.startsWith("63") && d.length === 12) {
        d = "0" + d.slice(2);
      }
      return d;
    })
    .filter((d) => d.length >= 10 && !isPlaceholderPhone(d));
};

export const normalizeName = (name?: string | null): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const tokenizeName = (name: string): string[] => {
  const stopWords = new Set([
    "de",
    "del",
    "la",
    "las",
    "los",
    "van",
    "von",
    "san",
    "santa",
  ]);
  return normalizeName(name)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token));
};

export const computeLevenshteinRatio = (s1: string, s2: string): number => {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longerLength - costs[shorter.length]) / longerLength;
};

/**
 * Factor 3: Name / Facebook Name Similarity (+1 pt)
 * Exact match, token overlap (e.g. "Dianne Belen" vs "Dianne De Belen"), or ratio >= 0.75.
 */
export const checkNameSimilarity = (
  nameA?: string | null,
  nameB?: string | null,
): boolean => {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  if (!normA || !normB) return false;
  if (normA.length < 2 || normB.length < 2) return false;

  // Case-insensitive exact match
  if (normA === normB) return true;

  // Substring match for substantial names
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  // Token overlap
  const tokensA = tokenizeName(normA);
  const tokensB = tokenizeName(normB);
  if (tokensA.length > 0 && tokensB.length > 0) {
    const setB = new Set(tokensB);
    const commonTokens = tokensA.filter((t) => setB.has(t));
    const minTokens = Math.min(tokensA.length, tokensB.length);
    if (commonTokens.length >= minTokens && minTokens >= 2) return true;
    if (commonTokens.length / Math.max(tokensA.length, tokensB.length) >= 0.75) {
      return true;
    }
  }

  // Levenshtein similarity ratio >= 0.75
  return computeLevenshteinRatio(normA, normB) >= 0.75;
};

/**
 * Factor 2: Event Date Proximity (+1 pt)
 * Same day or within ±1 calendar day.
 */
export const checkDateProximity = (
  dateA?: string | null,
  dateB?: string | null,
): { isNearby: boolean; isSameDay: boolean } => {
  if (!dateA || !dateB) return { isNearby: false, isSameDay: false };

  const parseYMD = (
    dStr: string,
  ): { y: number; m: number; d: number } | null => {
    const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return null;
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  };

  const pA = parseYMD(dateA);
  const pB = parseYMD(dateB);
  if (!pA || !pB) return { isNearby: false, isSameDay: false };

  const utcA = Date.UTC(pA.y, pA.m - 1, pA.d);
  const utcB = Date.UTC(pB.y, pB.m - 1, pB.d);
  const diffDays = Math.abs(utcA - utcB) / (1000 * 60 * 60 * 24);

  return {
    isSameDay: diffDays === 0,
    isNearby: diffDays <= 1,
  };
};

/**
 * Factor 4: Address / Location Overlap (+1 pt)
 * Same street/barangay and municipality (excluding pickup).
 */
export const checkAddressOverlap = (
  addrA?: string | null,
  addrB?: string | null,
): boolean => {
  if (!addrA || !addrB) return false;
  const cleanA = addrA.toLowerCase().trim();
  const cleanB = addrB.toLowerCase().trim();

  if (
    cleanA.includes("store pickup") ||
    cleanB.includes("store pickup") ||
    cleanA.length < 5 ||
    cleanB.length < 5
  ) {
    return false;
  }

  if (cleanA === cleanB) return true;

  const stopWords = new Set([
    "street",
    "st",
    "subdivision",
    "subd",
    "village",
    "phase",
    "blk",
    "block",
    "lot",
    "near",
    "front",
    "tapat",
    "brgy",
    "barangay",
    "cavite",
    "city",
  ]);

  const tokensA = cleanA
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  const tokensB = cleanB
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const setB = new Set(tokensB);
  const common = tokensA.filter((t) => setB.has(t));

  if (common.length >= 2) return true;
  const union = new Set([...tokensA, ...tokensB]);
  return union.size > 0 && common.length / union.size >= 0.5;
};

/**
 * 2-Factor Composite Duplicate Scoring Engine
 * Red Alert only fires when Score >= 2 across:
 * - Factor 1: Valid Phone Match (+1 pt)
 * - Factor 2: Event Date Proximity (+1 pt)
 * - Factor 3: Name / Facebook Name Similarity (+1 pt)
 * - Factor 4: Address / Location Overlap (+1 pt)
 */
export const evaluateDuplicateOrders = (
  current: CurrentOrderDetails,
  activeUpcomingOrders?: ActiveCustomerOrderSummary[] | null,
): {
  duplicates: DuplicateMatchEvaluation[];
  isRepeatCustomer: boolean;
  repeatOrderCount: number;
} => {
  if (!activeUpcomingOrders || activeUpcomingOrders.length === 0) {
    return { duplicates: [], isRepeatCustomer: false, repeatOrderCount: 0 };
  }

  const currentPhones = [
    ...cleanPhoneDigits(current.contactNumber),
    ...cleanPhoneDigits(current.contactNumber2),
  ];
  const hasValidCurrentPhone = currentPhones.length > 0;

  const evaluations: DuplicateMatchEvaluation[] = [];
  let validPhoneMatchesCount = 0;

  for (const candidate of activeUpcomingOrders) {
    // Self-Match Immunity in Edit Mode
    if (current.orderId && candidate.orderId === current.orderId) {
      continue;
    }
    if (
      current.orderReference &&
      candidate.orderReference &&
      candidate.orderReference.toLowerCase() ===
        current.orderReference.toLowerCase()
    ) {
      continue;
    }

    let score = 0;
    const matchingFactors: string[] = [];

    // Factor 1: Valid Phone Match (+1 pt)
    const candidatePhones = cleanPhoneDigits(candidate.contactNumber);
    const phoneMatches =
      hasValidCurrentPhone &&
      candidatePhones.some((cp) => currentPhones.includes(cp));

    if (phoneMatches) {
      score += 1;
      matchingFactors.push("Valid Phone Match");
      validPhoneMatchesCount += 1;
    }

    // Factor 2: Event Date Proximity (+1 pt)
    const dateEval = checkDateProximity(
      current.targetDate,
      candidate.targetDeliveryTime,
    );
    if (dateEval.isNearby) {
      score += 1;
      matchingFactors.push(
        dateEval.isSameDay ? "Exact Same Date" : "Date ±1 Day Proximity",
      );
    }

    // Factor 3: Name / Facebook Name Similarity (+1 pt)
    const nameMatches =
      checkNameSimilarity(current.customerName, candidate.customerName) ||
      checkNameSimilarity(current.facebookName, candidate.facebookName) ||
      checkNameSimilarity(current.customerName, candidate.facebookName) ||
      checkNameSimilarity(current.facebookName, candidate.customerName);

    if (nameMatches) {
      score += 1;
      matchingFactors.push("Name / FB Match");
    }

    // Factor 4: Address / Location Overlap (+1 pt)
    const addressMatches = checkAddressOverlap(
      current.deliveryAddress,
      candidate.deliveryAddress,
    );
    if (addressMatches) {
      score += 1;
      matchingFactors.push("Delivery Address Overlap");
    }

    // Threshold: Score >= 2 triggers duplicate flag
    if (score >= 2) {
      evaluations.push({
        order: candidate,
        score,
        matchingFactors,
        isSameDate: dateEval.isSameDay,
        isSameDay: dateEval.isSameDay,
      });
    }
  }

  evaluations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dateA = a.order.targetDeliveryTime
      ? new Date(a.order.targetDeliveryTime).getTime()
      : 0;
    const dateB = b.order.targetDeliveryTime
      ? new Date(b.order.targetDeliveryTime).getTime()
      : 0;
    return dateA - dateB;
  });

  return {
    duplicates: evaluations,
    isRepeatCustomer: validPhoneMatchesCount > 0,
    repeatOrderCount: activeUpcomingOrders.length,
  };
};
