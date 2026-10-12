import { numberToThaiBahtText } from "@/lib/thai-baht-text";
import { VAT_RATE } from "@/lib/payment-calc";
import { QuotationActions } from "@/components/banquet/QuotationActions";
import { PreparedByField } from "@/components/banquet/PreparedByField";

const BUSINESS = {
  name: "สวนอาหารบ้านโฮม (สำนักงานใหญ่)",
  address: "141 ม.2 ต.คลองขาม อ.ยางตลาด จ.กาฬสินธุ์ 46120",
  facebook: "https://www.facebook.com/atbaanhome",
  phone: "098-342-5545",
  taxId: "3-4099-0001-724-3",
  bankName: "ธนาคารกรุงไทย จำกัด (มหาชน)",
  accountName: "นางวนิดา ชาวสามทอง",
  accountNumber: "662-3-99543-9",
};

export type QuotationLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

/** The printable A4 quotation shared by banquet and accommodation bookings. */
export function QuotationDocument({
  backHref,
  quotationNumber,
  revisionCount,
  customerName,
  phone,
  taxId,
  projectLine,
  lineItems,
  emptyHint,
  subtotal,
  discountAmount,
  discountType,
  discountValue,
  discountNote,
  exVat,
  vat,
  netTotal,
  preparedBy,
  issueDate,
  log,
}: {
  backHref: string;
  quotationNumber: string;
  revisionCount: number;
  customerName: string;
  phone: string | null;
  taxId?: string | null;
  projectLine: string;
  lineItems: QuotationLineItem[];
  emptyHint: string;
  subtotal: number;
  discountAmount: number;
  discountType: "BAHT" | "PERCENT";
  discountValue: number;
  discountNote: string | null;
  exVat: number;
  vat: number;
  netTotal: number;
  preparedBy: string;
  issueDate: string;
  log: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-100 p-4 print:bg-white print:p-0 md:p-8">
      <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-4">
        <QuotationActions backHref={backHref} />

        <div className="mx-auto flex w-[210mm] min-h-[297mm] max-w-full flex-col gap-3 rounded-lg border border-ink-900/20 bg-white p-6 text-sm text-ink-900 shadow-sm print:w-full print:rounded-none print:border-black print:p-8 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-ink-900/20 pb-3">
            <div className="flex items-center gap-3">
              <img src="/icon.png" alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              <div>
                <p className="text-base font-bold">{BUSINESS.name}</p>
                <p className="text-xs text-ink-600">{BUSINESS.address}</p>
                <p className="text-xs text-ink-600">
                  {BUSINESS.facebook} โทร : {BUSINESS.phone}
                </p>
                <p className="text-xs text-ink-600">เลขที่ผู้เสียภาษี : {BUSINESS.taxId}</p>
              </div>
            </div>
            <div className="shrink-0 rounded-md border border-ink-900 px-3 py-1.5 text-center font-bold">
              ใบเสนอราคา
              <div className="text-xs font-normal text-ink-600">{quotationNumber}</div>
              {revisionCount > 1 && <div className="text-xs font-normal text-ink-600">แก้ไขครั้งที่ {revisionCount - 1}</div>}
            </div>
          </div>

          {/* Customer info */}
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="w-28 border border-ink-900/20 px-2 py-1.5 font-medium">ชื่อลูกค้า / Customers</td>
                <td className="border border-ink-900/20 px-2 py-1.5" colSpan={3}>
                  {customerName}
                </td>
              </tr>
              <tr>
                <td className="border border-ink-900/20 px-2 py-1.5 font-medium">โทร</td>
                <td className="border border-ink-900/20 px-2 py-1.5">{phone || "-"}</td>
                <td className="w-20 border border-ink-900/20 px-2 py-1.5 font-medium">เลขที่ / No.</td>
                <td className="border border-ink-900/20 px-2 py-1.5">{quotationNumber}</td>
              </tr>
              {taxId && (
                <tr>
                  <td className="border border-ink-900/20 px-2 py-1.5 font-medium">เลขนิติบุคคล</td>
                  <td className="border border-ink-900/20 px-2 py-1.5" colSpan={3}>
                    {taxId}
                  </td>
                </tr>
              )}
              <tr>
                <td className="border border-ink-900/20 px-2 py-1.5 font-medium">Project</td>
                <td className="border border-ink-900/20 px-2 py-1.5 font-semibold text-red-700" colSpan={3}>
                  {projectLine}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Line items */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-cream-100 print:bg-white">
                <th className="border border-ink-900/20 px-2 py-1.5 text-center font-medium">ลำดับที่</th>
                <th className="border border-ink-900/20 px-2 py-1.5 text-left font-medium">รายการ</th>
                <th className="border border-ink-900/20 px-2 py-1.5 text-center font-medium">จำนวน</th>
                <th className="border border-ink-900/20 px-2 py-1.5 text-right font-medium">ราคา/หน่วย</th>
                <th className="border border-ink-900/20 px-2 py-1.5 text-right font-medium">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-ink-900/20 px-2 py-4 text-center text-ink-400">
                    {emptyHint}
                  </td>
                </tr>
              ) : (
                lineItems.map((item, i) => (
                  <tr key={item.id}>
                    <td className="border border-ink-900/20 px-2 py-1.5 text-center">{i + 1}</td>
                    <td className="border border-ink-900/20 px-2 py-1.5">{item.description}</td>
                    <td className="border border-ink-900/20 px-2 py-1.5 text-center">{item.quantity}</td>
                    <td className="border border-ink-900/20 px-2 py-1.5 text-right">{item.unitPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                    <td className="border border-ink-900/20 px-2 py-1.5 text-right">{item.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-medium" colSpan={4}>
                  รวมเงิน (รวม VAT) / TOTAL
                </td>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-semibold">
                  {subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              {discountAmount > 0 && (
                <tr>
                  <td className="border border-ink-900/20 px-2 py-1.5 text-right font-medium" colSpan={4}>
                    ส่วนลด / DISCOUNT{discountType === "PERCENT" ? ` ${discountValue}%` : ""}
                    {discountNote ? ` — ${discountNote}` : ""}
                  </td>
                  <td className="border border-ink-900/20 px-2 py-1.5 text-right font-semibold text-red-700">
                    -{discountAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
              <tr>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-medium" colSpan={4}>
                  มูลค่าก่อนภาษี / PRICE BEFORE VAT
                </td>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-semibold">
                  {exVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-medium" colSpan={4}>
                  ภาษีมูลค่าเพิ่ม / VAT {Math.round(VAT_RATE * 100)}% (รวมอยู่ในราคาแล้ว)
                </td>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-semibold">
                  {vat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-gold-100 print:bg-white">
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-bold" colSpan={4}>
                  ยอดเงินสุทธิ / NET AMOUNT
                </td>
                <td className="border border-ink-900/20 px-2 py-1.5 text-right font-bold">
                  {netTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="border border-ink-900/20 px-2 py-1.5" colSpan={5}>
                  <span className="text-ink-600">ตัวอักษร: </span>
                  {numberToThaiBahtText(netTotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Payment details */}
          <div className="rounded-md border border-ink-900/20 px-3 py-2 text-xs">
            <p className="font-semibold">รายละเอียดการชำระเงิน</p>
            <p>{BUSINESS.bankName}</p>
            <p>ชื่อบัญชี: {BUSINESS.accountName}</p>
            <p>เลขที่บัญชี: {BUSINESS.accountNumber}</p>
            <p className="mt-1 text-ink-600">กรุณาแจ้งสลิปโอนเงินทุกครั้งหลังชำระเงิน เพื่อยืนยันการทำรายการ</p>
          </div>

          {/* Signatures */}
          <div className="mt-6 grid grid-cols-2 gap-8 text-xs">
            <div className="flex flex-col items-center gap-2">
              <PreparedByField defaultValue={preparedBy} />
              <div className="text-center">
                <p>ผู้จัดทำ / ผู้เสนอราคา</p>
                <p className="mt-3">วันที่ {issueDate}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-8">
              <div className="w-full border-b border-dotted border-ink-900/40 pt-8" />
              <div className="-mt-8 text-center">
                <p>ผู้อนุมัติการเสนอราคา / ผู้อนุมัติสั่งซื้อ</p>
                <p className="mt-3">วันที่ ..........................................</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-[210mm] print:hidden">
        {log}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
