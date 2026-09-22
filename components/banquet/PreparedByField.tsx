"use client";

import { useState } from "react";

export function PreparedByField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="ชื่อผู้จัดทำ"
      className="w-full border-0 border-b border-dotted border-ink-900/40 bg-transparent px-1 pb-1 text-center text-xs text-ink-900 outline-none print:placeholder:text-transparent"
    />
  );
}
