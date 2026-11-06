import fs from 'fs';
import path from 'path';

function checkDir(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'build') {
        count += checkDir(fullPath);
      }
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Exclude intentional regex in freebiesHelper
        if (fullPath.includes('freebiesHelper.ts') && /replace\(/.test(line)) return;

        // Check for mojibake patterns: â‚±, ðŸ, â€, Ã—, Â±, etc., or \uFFFD
        if (/â‚±|ðŸ|â€“|â€”|Ã—|âœ“|âœ…|Â±|â€¢|â€˜|â€™|â€œ|â€|âˆ’|âœ•|âš¡|â ³|â–|ðŸ|Ã[\x80-\xBF]|â[\x80-\xBF]|\uFFFD/.test(line)) {
          console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
          count++;
        }
      });
    }
  }
  return count;
}

const wCount = checkDir('lechon-system-web/src');
const mCount = checkDir('lechon-system-mobile/src');
console.log(`Scan complete. Found ${wCount + mCount} issues.`);
