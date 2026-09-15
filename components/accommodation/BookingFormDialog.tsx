"use client";

import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AccommodationBookingForm,
  defaultAccommodationFormValue,
  type AccommodationBookingFormValue,
} from "@/components/accommodation/BookingForm";

export function BookingFormDialog({
  resources,
  open,
  onOpenChange,
  initialOverrides,
}: {
  resources: { id: string; name: string; zone: string }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialOverrides?: Partial<AccommodationBookingFormValue>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" />
          จองห้องพักใหม่
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>จองห้องพักใหม่</DialogTitle>
        </DialogHeader>
        <AccommodationBookingForm
          resources={resources}
          initial={defaultAccommodationFormValue(initialOverrides)}
          onSaved={() => onOpenChange?.(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
