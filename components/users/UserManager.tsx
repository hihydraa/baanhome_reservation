"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
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

type FormState = { name: string; username: string; password: string; role: string };

const EMPTY_FORM: FormState = { name: "", username: "", password: "", role: "STAFF" };

export function UserManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreateDialog() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEditDialog(user: UserRow) {
    setEditingUser(user);
    setForm({ name: user.name, username: user.username, password: "", role: user.role });
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    setOpen(false);
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
        <Button variant="gold" onClick={openCreateDialog}>
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
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)}>
                  <Pencil className="h-4 w-4 text-forest-700" />
                </Button>
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
            <DialogTitle>{editingUser ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งานใหม่"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อ-นามสกุล</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อผู้ใช้ (username)</Label>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>รหัสผ่าน{editingUser && <span className="text-ink-400"> — เว้นว่างไว้เพื่อไม่เปลี่ยนรหัสผ่าน</span>}</Label>
              <Input
                required={!editingUser}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>สิทธิ์การใช้งาน</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="STAFF">พนักงาน</option>
                <option value="HOUSEKEEPER">แม่บ้าน</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
              </Select>
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="gold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingUser ? "บันทึกการแก้ไข" : "สร้างบัญชี"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
