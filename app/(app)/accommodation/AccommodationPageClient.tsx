"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingFormDialog } from "@/components/accommodation/BookingFormDialog";

export function AccommodationPageClient({
  resources,
}: {
  resources: { id: string; name: string; zone: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const newResource = searchParams.get("newResource");
  const date = searchParams.get("date");

  const [open, setOpen] = useState(() => !!newResource);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && newResource) {
      router.replace("/accommodation");
    }
  }

  return (
    <BookingFormDialog
      resources={resources}
      open={open}
      onOpenChange={handleOpenChange}
      initialOverrides={{
        ...(newResource ? { resourceId: newResource } : {}),
        ...(date ? { checkIn: date } : {}),
      }}
    />
  );
}
