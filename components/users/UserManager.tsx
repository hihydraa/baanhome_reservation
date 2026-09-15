"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_LABELS } from "@/lib/labels";

type UserRow = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "STAFF" | "HOUSEKEEPER";
  createdAt: string;
};

const ROLE_BADGE_VARIANT: Record<string, "gold" | "muted" | "outline"> = {
  ADMIN: "gold",
  STAFF: "muted",
  HOUSEKEEPER: "outline",
};

export function UserManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STAFF");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, role }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด");
      return;
    }
    setOpen(false);
    setName("");
    setUsername("");
    setPassword("");
    setRole("STAFF");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบผู้ใช้นี้?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="gold" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          เพิ่มผู้ใช้งาน
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อ</TableHead>
            <TableHead>ชื่อผู้ใช้</TableHead>
            <TableHead>สิทธิ์</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>
                <Badge variant={ROLE_BADGE_VARIANT[u.role] ?? "muted"}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {u.id !== currentUserId && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้งานใหม่</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อ-นามสกุล</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อผู้ใช้ (username)</Label>
              <Input required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>รหัสผ่าน</Label>
              <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>สิทธิ์การใช้งาน</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="STAFF">พนักงาน</option>
                <option value="HOUSEKEEPER">แม่บ้าน</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
              </Select>
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="gold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              สร้างบัญชี
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
