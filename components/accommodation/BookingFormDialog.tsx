"use client";

import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AccommodationBookingForm,
  defaultAccommodationFormValue,
  type AccommodationBookingFormValue,
} from "@/components/accommodation/BookingForm";
import { CharterBookingForm } from "@/components/accommodation/CharterBookingForm";
import type { ServiceOption } from "@/components/accommodation/AddonEditor";

export function BookingFormDialog({
  resources,
  services,
  open,
  onOpenChange,
  initialOverrides,
}: {
  resources: { id: string; name: string; zone: string; price: number | null }[];
  services: ServiceOption[];
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
        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single">เลือกห้อง</TabsTrigger>
            <TabsTrigger value="charter">เหมาทั้งโซน</TabsTrigger>
          </TabsList>
          <TabsContent value="single">
            <AccommodationBookingForm
              resources={resources}
              services={services}
              initial={defaultAccommodationFormValue(initialOverrides)}
              onSaved={() => onOpenChange?.(false)}
            />
          </TabsContent>
          <TabsContent value="charter">
            <CharterBookingForm initialCheckIn={initialOverrides?.checkIn} onSaved={() => onOpenChange?.(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
