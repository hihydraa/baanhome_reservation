"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { formatBytes } from "@/lib/reports";

export type AttachmentBookingType = "ACCOMMODATION" | "BANQUET";

export type AttachmentValue = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
  url: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export function AttachmentManager({
  bookingType,
  bookingId,
  initial,
}: {
  bookingType: AttachmentBookingType;
  bookingId: string;
  initial: AttachmentValue[];
}) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentValue[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`"${file.name}" มีขนาดเกิน ${formatBytes(MAX_SIZE_BYTES)}`);
    }

    const presignRes = await fetch("/api/attachments/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingType, bookingId, fileName: file.name, mimeType: file.type, size: file.size }),
    });
    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => ({}));
      throw new Error(body.error ?? `ไม่สามารถเตรียมอัปโหลด "${file.name}" ได้`);
    }
    const { uploadUrl, key } = await presignRes.json();

    const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
    if (!putRes.ok) throw new Error(`อัปโหลด "${file.name}" ไม่สำเร็จ`);

    const createRes = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingType, bookingId, fileName: file.name, mimeType: file.type, size: file.size, key }),
    });
    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      throw new Error(body.error ?? `บันทึกข้อมูลไฟล์ "${file.name}" ไม่สำเร็จ`);
    }
    return (await createRes.json()) as AttachmentValue;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const created = await uploadFile(file);
        setAttachments((prev) => [created, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการอัปโหลด");
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }
    setConfirmingDeleteId(null);
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      showToast("ลบไฟล์แนบแล้ว");
    } else {
      showToast("ลบไฟล์ไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-forest-800">
          <Paperclip className="h-4 w-4" />
          ไฟล์แนบ
        </p>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          แนบไฟล์
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {attachments.length === 0 ? (
        <p className="rounded-md border border-dashed border-cream-200 p-4 text-center text-sm text-ink-400">
          ยังไม่มีไฟล์แนบ — รองรับรูปภาพ (JPEG, PNG, WEBP) และ PDF ขนาดไม่เกิน 20MB
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-md border border-cream-100 px-3 py-2">
              {a.mimeType.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-forest-600" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-forest-600" />
              )}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-forest-700 hover:underline"
                title={a.fileName}
              >
                {a.fileName}
              </a>
              <span className="whitespace-nowrap text-xs text-ink-400">{formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                className={
                  confirmingDeleteId === a.id
                    ? "shrink-0 rounded px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    : "shrink-0 rounded p-1 text-ink-400 hover:bg-cream-100 hover:text-red-600"
                }
                title="ลบ"
              >
                {confirmingDeleteId === a.id ? "ยืนยันลบ" : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
