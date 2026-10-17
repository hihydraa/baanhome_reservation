"use client";

import { AdminDeleteBookingButton } from "@/components/accommodation/DeleteBookingButton";

/** ADMIN-only soft delete of a banquet booking (reason required). */
export function DeleteBanquetButton({ id, redirectTo }: { id: string; redirectTo: string }) {
  return <AdminDeleteBookingButton endpoint={`/api/banquet-bookings/${id}`} redirectTo={redirectTo} />;
}
