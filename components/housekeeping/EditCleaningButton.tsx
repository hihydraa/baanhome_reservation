"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CleaningRecordDialog, type CleaningRecordFormValue } from "@/components/housekeeping/CleaningRecordDialog";
import { useScrollSafeRefresh } from "@/lib/use-scroll-safe-refresh";

/** Opens the cleaning form pre-filled with an existing record so any housekeeper or staff can correct it. */
export function EditCleaningButton({
  record,
  rooms,
  maxDate,
}: {
  record: CleaningRecordFormValue & { id: string };
  rooms: { id: string; name: string }[];
  maxDate: string;
}) {
  const refresh = useScrollSafeRefresh();
  const [open, setOpen] = useState(false);
  // Remount the dialog on every open so it starts from the record's saved values.
  const [openCount, setOpenCount] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="print:hidden"
        onClick={() => {
          setOpenCount((n) => n + 1);
          setOpen(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        แก้ไข
      </Button>
      <CleaningRecordDialog
        key={openCount}
        open={open}
        onOpenChange={setOpen}
        title="แก้ไขบันทึกการทำความสะอาด"
        rooms={rooms}
        maxDate={maxDate}
        initial={record}
        onSaved={refresh}
      />
    </>
  );
}
