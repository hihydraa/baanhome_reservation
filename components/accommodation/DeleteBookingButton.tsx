"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-provider";

/**
 * ADMIN-only "ลบการจอง" — asks for a reason, then soft-deletes via the booking's DELETE endpoint.
 * The page renders this only for admins; the API enforces the same.
 */
export function AdminDeleteBookingButton({ endpoint, redirectTo }: { endpoint: string; redirectTo: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `ลบการจองไม่สำเร็จ (${res.status})`);
      return;
    }
    setOpen(false);
    showToast("ลบการจองแล้ว — บันทึกไว้ในประวัติการยกเลิก/ลบ");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => {
          setReason("");
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
        ลบการจอง
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบการจอง (เฉพาะผู้ดูแลระบบ)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-ink-600">
              การจองจะถูกซ่อนจากทุกหน้า แต่ข้อมูลการจองและการรับเงินทั้งหมดจะถูกเก็บไว้ในหน้า &quot;ประวัติการยกเลิก/ลบ&quot;
              หากลูกค้าเพียงไม่มาพัก ให้ใช้สถานะ &quot;ยกเลิก&quot; แทน
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>
                เหตุผลการลบ <span className="text-red-600">*</span>
              </Label>
              <Textarea
                rows={3}
                required
                minLength={3}
                placeholder="เช่น บันทึกซ้ำกับการจองอื่น"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                ยืนยันลบการจอง
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteBookingButton({ id, redirectTo }: { id: string; redirectTo: string }) {
  return <AdminDeleteBookingButton endpoint={`/api/accommodation-bookings/${id}`} redirectTo={redirectTo} />;
}
