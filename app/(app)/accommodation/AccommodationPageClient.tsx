"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingFormDialog } from "@/components/accommodation/BookingFormDialog";
import type { ServiceOption } from "@/components/accommodation/AddonEditor";

export function AccommodationPageClient({
  resources,
  services,
}: {
  resources: { id: string; name: string; zone: string; price: number | null }[];
  services: ServiceOption[];
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
      services={services}
      open={open}
      onOpenChange={handleOpenChange}
      initialOverrides={{
        ...(newResource ? { resourceId: newResource } : {}),
        ...(date ? { checkIn: date } : {}),
      }}
    />
  );
}
