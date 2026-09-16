import { z } from "zod";

export const bookingSourceEnum = z.enum(["WALK_IN", "AGODA", "PHONE", "LINE_OA", "OTHER"]);
export const accommodationStatusEnum = z.enum([
  "RESERVED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
]);
export const banquetEventTypeEnum = z.enum(["MEETING", "BANQUET", "SEMINAR", "OTHER"]);
export const banquetStatusEnum = z.enum(["RESERVED", "CONFIRMED", "CANCELLED"]);
export const paymentStatusEnum = z.enum(["PAID", "DEPOSIT", "PAY_LATER"]);
export const paymentMethodEnum = z.enum(["CASH", "TRANSFER"]);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const timeOnly = z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง");

export const addonInputSchema = z.object({
  serviceId: z.string().optional().nullable(),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
});

export const specialServiceInputSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อบริการ"),
  price: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
});

/** `totalAmount` holds the "จ่ายแล้ว" (paid beyond deposit) amount; the net total is depositAmount + totalAmount. */
export const paymentInputSchema = z.object({
  totalAmount: z.coerce.number().min(0).default(0),
  depositAmount: z.coerce.number().min(0).default(0),
  status: paymentStatusEnum,
  method: paymentMethodEnum,
  notes: z.string().optional(),
});

export const accommodationBookingInputSchema = z
  .object({
    resourceId: z.string().min(1, "กรุณาเลือกห้อง"),
    customerName: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
    phone: z.string().min(1, "กรุณากรอกเบอร์โทรศัพท์"),
    source: bookingSourceEnum.default("WALK_IN"),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guestCount: z.coerce.number().int().min(1).default(1),
    roomPrice: z.coerce.number().min(0).optional().nullable(),
    status: accommodationStatusEnum.default("RESERVED"),
    notes: z.string().optional(),
    cancelReason: z.string().optional(),
    addons: z.array(addonInputSchema).default([]),
    payment: paymentInputSchema.optional(),
  })
  .refine((b) => b.checkOut > b.checkIn, {
    message: "วันที่เช็คเอาท์ต้องอยู่หลังวันที่เช็คอิน",
    path: ["checkOut"],
  });

export const accommodationChargeScopeEnum = z.enum(["RESORT", "POOL_VILLA", "ALL"]);

export const accommodationBulkBookingInputSchema = z
  .object({
    scope: accommodationChargeScopeEnum,
    customerName: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
    phone: z.string().min(1, "กรุณากรอกเบอร์โทรศัพท์"),
    source: bookingSourceEnum.default("WALK_IN"),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guestCount: z.coerce.number().int().min(1).default(1),
    status: accommodationStatusEnum.default("RESERVED"),
    notes: z.string().optional(),
    payment: paymentInputSchema,
  })
  .refine((b) => b.checkOut > b.checkIn, {
    message: "วันที่เช็คเอาท์ต้องอยู่หลังวันที่เช็คอิน",
    path: ["checkOut"],
  });

export const banquetBookingInputSchema = z
  .object({
    resourceId: z.string().min(1, "กรุณาเลือกห้อง"),
    eventDate: dateOnly,
    startTime: timeOnly,
    endTime: timeOnly,
    eventType: banquetEventTypeEnum.default("MEETING"),
    headcount: z.coerce.number().int().min(1).default(1),
    foodService: z.string().optional(),
    linkedAccommodationIds: z.array(z.string()).default([]),
    status: banquetStatusEnum.default("RESERVED"),
    notes: z.string().optional(),
    cancelReason: z.string().optional(),
    customerName: z.string().min(1, "กรุณากรอกชื่อลูกค้า/ผู้ติดต่อ"),
    phone: z.string().optional(),
    payment: paymentInputSchema,
  })
  .refine((b) => b.endTime > b.startTime, {
    message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
    path: ["endTime"],
  });

export const checkConflictInputSchema = z.object({
  resourceId: z.string().min(1),
  eventDate: dateOnly,
  startTime: timeOnly,
  endTime: timeOnly,
  excludeBookingId: z.string().optional(),
});

export const userInputSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  username: z
    .string()
    .min(3, "อย่างน้อย 3 ตัวอักษร")
    .regex(/^[a-zA-Z0-9._-]+$/, "ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ -"),
  password: z.string().min(6, "รหัสผ่านอย่างน้อย 6 ตัวอักษร"),
  role: z.enum(["ADMIN", "STAFF", "HOUSEKEEPER"]).default("STAFF"),
});
