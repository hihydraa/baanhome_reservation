"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteBanquetButton({ id, redirectTo }: { id: string; redirectTo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/banquet-bookings/${id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {confirming ? "ยืนยันลบการจอง" : "ลบการจอง"}
    </Button>
  );
}
