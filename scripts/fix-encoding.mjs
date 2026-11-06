import fs from 'fs';
import path from 'path';

// Windows-1252 byte mapping for characters in the 0x80-0x9F range
const win1252Map = new Map([
  [0x20AC, 0x80], // €
  [0x201A, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201E, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02C6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8A], // Š
  [0x2039, 0x8B], // ‹
  [0x0152, 0x8C], // Œ
  [0x017D, 0x8E], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201C, 0x93], // “
  [0x201D, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02DC, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9A], // š
  [0x203A, 0x9B], // ›
  [0x0153, 0x9C], // œ
  [0x017E, 0x9E], // ž
  [0x0178, 0x9F], // Ÿ
]);

function decodeWindows1252Run(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (win1252Map.has(code)) {
      bytes.push(win1252Map.get(code));
    } else if (code <= 0xFF) {
      bytes.push(code);
    } else {
      return null;
    }
  }
  try {
    const res = Buffer.from(bytes).toString('utf8');
    if (res.includes('\uFFFD')) return null;
    return res;
  } catch {
    return null;
  }
}

// Explicit mappings from Prompt Specification
const EXPLICIT_PHRASE_MAPPINGS = [
  // UI Phrases & Labels
  ['ðŸ• Order Entry Terminal', '🐷 Order Entry Terminal'],
  ['ðŸ“‹ Tentative Draft Inquiry', '📝 Tentative Draft Inquiry'],
  ['ðŸ“\x9D Tentative Draft Inquiry', '📝 Tentative Draft Inquiry'],
  ['ðŸ“  Tentative Draft Inquiry', '📝 Tentative Draft Inquiry'],
  ['ðŸ· Whole / Belly Lechon', '🐷 Whole / Belly Lechon'],
  ['ðŸ · Whole / Belly Lechon', '🐷 Whole / Belly Lechon'],
  ['ðŸ” Non-Lechon / Extras Only', '🍔 Non-Lechon / Extras Only'],
  ['ðŸ ² Non-Lechon / Extras Only', '🍔 Non-Lechon / Extras Only'],
  ['ðŸ“‹< Paste Messenger Form', '📋 Paste Messenger Form (Ctrl+V)'],
  ['ðŸ“‹ Paste Messenger Form', '📋 Paste Messenger Form (Ctrl+V)'],
  ['ðŸ‘¤ + Assisted by Admin', '👤 + Assisted by Admin'],
  ['ðŸš— Freelance Delivery', '🛵 Freelance Delivery'],
  ['ðŸª Store Pickup', '🏪 Store Pickup'],
  ['ðŸ ª Store Pickup', '🏪 Store Pickup'],
  ['ðŸ“¦ Lalamove Courier', '📦 Lalamove Courier'],
  ['ðŸ•’ Time TBD', '⏰ Time TBD'],
  ['ðŸ’° VIP Trusted', '👑 VIP Trusted'],
  ['ðŸ‘‘ VIP Trusted', '👑 VIP Trusted'],
  ['ðŸ›µ Rider Departure Time', '🛵 Rider Departure Time (Kitchen Zero-Hour Anchor)'],
  ['ðŸ· Whole Lechon & Belly', '🐷 Whole Lechon & Belly'],
  ['ðŸ · Whole Lechon & Belly', '🐷 Whole Lechon & Belly'],
  ['ðŸŸ£ Add-Ons & Extras', '🟣 Add-Ons & Extras'],
  ['ðŸ¥£ Add-Ons & Extras', '🟣 Add-Ons & Extras'],
  ['ðŸ¥« Add-Ons & Extras', '🟣 Add-Ons & Extras'],
  ['ðŸ – Whole Lechon Sizes', '🐷 Whole Lechon Sizes'],
  ['ðŸ¥“ Lechon Belly Tiers', '🥓 Lechon Belly Tiers'],
];

const EXACT_TOKEN_MAPPINGS = [
  // Currencies & Math
  ['â‚±', '₱'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['Ã—', '×'],
  ['âœ“', '✓'],
  ['âœ…', '✅'],
  ['â€¢', '•'],
  ['â€˜', '‘'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['Â±', '±'],
  ['âˆ’', '−'],
  ['âœ•', '✕'],
  ['âš¡', '⚡'],
  ['âšª', '⚪'],
  ['âœ¨', '✨'],
  ['â­ ', '⭐'],
  ['â­\x90', '⭐'],
  ['â†©ï¸\x8F', '↩️'],
  ['â†©ï¸ ', '↩️'],
  ['â†©', '↩️'],
  ['âž•', '➕'],
  ['âœ ï¸\x8F', '✍️'],
  ['âœ ï¸ ', '✍️'],
  ['â ³', '⏳'],
  ['â–²', '▲'],
  ['â–¼', '▼'],

  // Emojis from table
  ['ðŸŽ', '🎁'],
  ['ðŸ¥©', '🥩'],
  ['âš™ï¸\x8F', '⚙️'],
  ['âš™ï¸ ', '⚙️'],
  ['âš™', '⚙️'],
  ['ðŸ¥¤', '🥤'],
  ['ðŸ”„', '🔄'],
  ['ðŸ—‘ï¸\x8F', '🗑️'],
  ['ðŸ—‘ï¸ ', '🗑️'],
  ['ðŸ—‘', '🗑️'],
  ['âš ï¸\x8F', '⚠️'],
  ['âš ï¸ ', '⚠️'],
  ['âš ', '⚠️'],
  ['ðŸ¦', '🏦'],
  ['ðŸ\x8F¦', '🏦'],
  ['ðŸ ¦', '🏦'],
  ['ðŸ’µ', '💵'],
  ['ðŸ’¸', '💸'],
  ['ðŸ”ª', '🔪'],
  ['ðŸ“‹', '📋'],
  ['ðŸ‘‘', '👑'],
  ['ðŸ‘¤', '👤'],
  ['ðŸš—', '🛵'],
  ['ðŸ\x8Fª', '🏪'],
  ['ðŸ ª', '🏪'],
  ['ðŸ“¦', '📦'],
  ['ðŸ•’', '⏰'],
  ['ðŸ›µ', '🛵'],
  ['ðŸ\x90·', '🐷'],
  ['ðŸ ·', '🐷'],
  ['ðŸ\x90–', '🐷'],
  ['ðŸ –', '🐷'],
  ['ðŸ¥“', '🥓'],
  ['ðŸ¥«', '🟣'],
  ['ðŸŸ£', '🟣'],
  ['ðŸ¥£', '🟣'],
  ['ðŸ ²', '🍔'],
  ['ðŸ\x8D²', '🍔'],
  ['ðŸ’°', '💰'],
  ['ðŸ’¾', '💾'],
  ['ðŸŽ‰', '🎉'],
  ['ðŸ“±', '📱'],
  ['ðŸ“²', '📲'],
  ['ðŸ“·', '📷'],
  ['ðŸ–¼ï¸\x8F', '🖼️'],
  ['ðŸ–¼ï¸ ', '🖼️'],
  ['ðŸ–¼', '🖼️'],
  ['ðŸ›’', '🛒'],
  ['ðŸ” ', '🔍'],
  ['ðŸ”\x8D', '🔍'],
  ['ðŸ”\x90', '🔒'],
  ['ðŸ” ', '🔒'],
  ['ðŸŸ¢', '🟢'],
  ['ðŸŸ¡', '🟡'],
  ['ðŸ›‘', '🛑'],
  ['ðŸ“ ', '📍'],
  ['ðŸ“\x8D', '📍'],
  ['ðŸ“ž', '📞'],
  ['ðŸ’š', '💚'],
  ['ðŸ’¡', '💡'],
  ['ðŸš¨', '🚨'],
  ['ðŸ“\x9D', '📝'],
  ['ðŸ“…', '📅'],
  ['ðŸ‘\x81ï¸\x8F', '👁️'],
  ['ðŸ‘\x81ï¸ ', '👁️'],
  ['ðŸ‘ ', '👁️'],
  ['ðŸ’³', '💳'],
  ['\xE2\x9D\u2014', '❗'],
  ['\xF0\u0178\u2018\u2030', '👉'],
  ['\xC3\xA2\xE2\u201A\xAC\u201C', '–'],
  ['\xC3\xA2\xE2\u201A\xAC\u201D\x9D', '—'],
  ['🎁‰', '🎉'],
];

EXPLICIT_PHRASE_MAPPINGS.sort((a, b) => b[0].length - a[0].length);
EXACT_TOKEN_MAPPINGS.sort((a, b) => b[0].length - a[0].length);

export function cleanFileContent(filePath, content) {
  // If file is freebiesHelper.ts, preserve the regexes in sanitizeFreebiesSummary
  let updated = content;

  // 1. Explicit phrase mappings first
  for (const [from, to] of EXPLICIT_PHRASE_MAPPINGS) {
    if (updated.includes(from)) {
      updated = updated.split(from).join(to);
    }
  }

  // 2. Exact token mappings
  for (const [from, to] of EXACT_TOKEN_MAPPINGS) {
    if (filePath.endsWith('freebiesHelper.ts') && /Ã°Å¸|ðŸŽ|ðŸš«|ðŸ¥©/.test(from)) {
      // Keep intentional regex replacements in freebiesHelper.ts
      continue;
    }
    if (updated.includes(from)) {
      updated = updated.split(from).join(to);
    }
  }

  // 3. For any remaining non-ASCII mojibake sequences, attempt Windows-1252 decode
  if (!filePath.endsWith('freebiesHelper.ts')) {
    updated = updated.replace(/â[^\sa-zA-Z0-9<>{}[\]()]+|ðŸ[^\sa-zA-Z0-9<>{}[\]()]+|Ã[^\sa-zA-Z0-9<>{}[\]()]+/g, (match) => {
      const decoded = decodeWindows1252Run(match);
      return decoded !== null ? decoded : match;
    });
  }

  // 4. Strip stray Â non-breaking space artifacts
  updated = updated.replace(/Â(?=[\s\-_=₱–—×✓✅•‘’“”±])/g, '');

  return updated;
}

function processDirectory(dir, modifiedFiles = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'build') {
        processDirectory(fullPath, modifiedFiles);
      }
    } else if (/\.(tsx?|jsx?|json|css|html)$/.test(entry.name)) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const cleaned = cleanFileContent(fullPath, original);
      if (cleaned !== original) {
        fs.writeFileSync(fullPath, cleaned, 'utf8');
        modifiedFiles.push(fullPath);
      }
    }
  }
  return modifiedFiles;
}

const targetDirs = [
  path.resolve('lechon-system-web/src'),
  path.resolve('lechon-system-mobile/src'),
];

const allModified = [];
for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    processDirectory(dir, allModified);
  }
}

console.log(`Cleaned ${allModified.length} files:`);
for (const f of allModified) {
  console.log(' -', path.relative(process.cwd(), f));
}
