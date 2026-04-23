/** Suspicious Thai service-style keywords that reclassify goods sale → hire of work */
const SUSPICIOUS_KEYWORDS = [
  "ว่าจ้าง",
  "จ้างทำ",
  "รับจ้างผลิต",
  "รับจ้างทำ",
  "ค่าจ้าง",
];

export function detectServiceWording(text: string | null | undefined): {
  flagged: boolean;
  matches: string[];
} {
  if (!text) return { flagged: false, matches: [] };
  const matches = SUSPICIOUS_KEYWORDS.filter((kw) => text.includes(kw));
  return { flagged: matches.length > 0, matches };
}
