"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A line of the quotation staff can retype on the page before printing (project line, address, ID number).
 * The edit is kept in this browser for this quotation, so it survives a reload or switching the room-price option,
 * and prints as plain text. It is not saved to the booking or the customer directory.
 */
export function EditableText({ field, value, className }: { field: string; value: string; className?: string }) {
  const pathname = usePathname();
  const ref = useRef<HTMLSpanElement>(null);
  const key = `quotation-edit:${pathname}:${field}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved != null && ref.current) ref.current.textContent = saved;
    } catch {
      // Storage can be blocked (private window); the text just stays as the booking has it.
    }
  }, [key]);

  function save() {
    const text = ref.current?.innerText ?? "";
    try {
      if (text === value) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, text);
    } catch {
      // ignore
    }
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="แก้ไขข้อความ"
      onBlur={save}
      onPaste={(e) => {
        // Paste as plain text so nothing from another page's styling ends up in the quotation.
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      className={cn(
        "block min-h-5 cursor-text rounded-sm outline-none focus:bg-gold-100/60 focus:ring-1 focus:ring-gold-500",
        "hover:bg-gold-100/40 print:cursor-auto print:bg-transparent print:ring-0",
        className
      )}
    >
      {value}
    </span>
  );
}
