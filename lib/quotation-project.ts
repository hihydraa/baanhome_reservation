/** The Project row: the generated line, the booking's notes, or both (notes on their own lines under the generated one). */
export function projectText(source: string | undefined, generated: string, notes: string | null | undefined) {
  const n = notes?.trim() ?? "";
  if (!n || (source !== "notes" && source !== "both")) return { text: generated, source: "auto" as const };
  return source === "notes" ? { text: n, source: "notes" as const } : { text: `${generated}\n${n}`, source: "both" as const };
}
