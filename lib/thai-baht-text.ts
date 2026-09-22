const THAI_DIGIT_NAMES = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACE_NAMES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function convertInteger(n: number): string {
  if (n === 0) return "ศูนย์";
  const digits = String(n);
  const len = digits.length;
  let text = "";
  for (let i = 0; i < len; i++) {
    const digit = Number(digits[i]);
    const place = len - i - 1;
    if (digit === 0) continue;
    if (place === 0) {
      text += digit === 1 && len > 1 ? "เอ็ด" : THAI_DIGIT_NAMES[digit];
    } else if (place === 1) {
      if (digit === 1) text += "สิบ";
      else if (digit === 2) text += "ยี่สิบ";
      else text += THAI_DIGIT_NAMES[digit] + "สิบ";
    } else {
      text += THAI_DIGIT_NAMES[digit] + (THAI_PLACE_NAMES[place] ?? "");
    }
  }
  return text;
}

/** Standard "บาทถ้วน" style Thai amount-in-words, e.g. 7242.99 -> "เจ็ดพันสองร้อยสี่สิบสองบาทเก้าสิบเก้าสตางค์". */
export function numberToThaiBahtText(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);
  const bahtText = convertInteger(baht);
  if (satang === 0) return `${bahtText}บาทถ้วน`;
  return `${bahtText}บาท${convertInteger(satang)}สตางค์`;
}
