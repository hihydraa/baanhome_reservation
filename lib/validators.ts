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
export const paymentMethodEnum = z.enum(["CASH", "TRANSFER", "CREDIT_CARD"]);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const timeOnly = z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง");

export const addonInputSchema = z.object({
  serviceId: z.string().optional().nullable(),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
});

export const specialServiceScopeEnum = z.enum(["ACCOMMODATION", "BANQUET"]);

export const specialServiceInputSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อบริการ"),
  price: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
  scope: specialServiceScopeEnum.default("ACCOMMODATION"),
});

/** Optional first deposit recorded at the moment a booking is created. */
export const initialPaymentInputSchema = z.object({
  amount: z.coerce.number().min(0).default(0),
  method: paymentMethodEnum.default("CASH"),
  notes: z.string().optional(),
});

/** A single entry recorded in a booking's payment ledger (one "receipt").
 *  `receiptNumber` is auto-generated when omitted; staff can still override it
 *  (e.g. to match a physical receipt already issued, or fix a migrated one). */
export const paymentEntryInputSchema = z.object({
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  method: paymentMethodEnum,
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง"),
  receivedById: z.string().optional().nullable(),
  notes: z.string().optional(),
  receiptNumber: z.string().trim().min(1).optional(),
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
    initialPayment: initialPaymentInputSchema.optional(),
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
    initialPayment: initialPaymentInputSchema.optional(),
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
    addons: z.array(addonInputSchema).default([]),
    initialPayment: initialPaymentInputSchema.optional(),
  })
  .refine((b) => b.endTime > b.startTime, {
    message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
    path: ["endTime"],
  });

export const resourcePricingInputSchema = z.object({
  price: z.coerce.number().min(0).optional().nullable(),
  hourlyPrice: z.coerce.number().min(0).optional().nullable(),
  dailyPrice: z.coerce.number().min(0).optional().nullable(),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
  roomType: z.string().optional().nullable(),
  priceCondition: z.string().optional().nullable(),
  equipment: z.string().optional().nullable(),
});

export const checkConflictInputSchema = z.object({
  resourceId: z.string().min(1),
  eventDate: dateOnly,
  startTime: timeOnly,
  endTime: timeOnly,
  excludeBookingId: z.string().optional(),
});

const usernameField = z
  .string()
  .min(3, "อย่างน้อย 3 ตัวอักษร")
  .regex(/^[a-zA-Z0-9._-]+$/, "ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ -");

export const userInputSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  username: usernameField,
  password: z.string().min(6, "รหัสผ่านอย่างน้อย 6 ตัวอักษร"),
  role: z.enum(["ADMIN", "STAFF", "HOUSEKEEPER"]).default("STAFF"),
});

/** `password` is optional — leaving it blank keeps the user's existing password. */
export const userUpdateInputSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  username: usernameField,
  password: z.union([z.literal(""), z.string().min(6, "รหัสผ่านอย่างน้อย 6 ตัวอักษร")]).optional(),
  role: z.enum(["ADMIN", "STAFF", "HOUSEKEEPER"]),
});
