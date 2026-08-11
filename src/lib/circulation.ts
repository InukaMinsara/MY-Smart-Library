import { supabase } from "@/integrations/supabase/client";
import { addDays, daysBetween } from "@/lib/library-utils";

export const MAX_BOOKS_PER_MEMBER = 5;
export const MAX_COPIES_PER_BOOK = 10;
export const FINE_PER_DAY = 5;

/** Reminder offsets in days before the due date. */
const REMINDER_OFFSETS = [
  { days: 7, label: "One week" },
  { days: 3, label: "3 days" },
  { days: 1, label: "1 day" },
  { days: 0, label: "Final day" },
];

export type BorrowCheck = { ok: boolean; reason?: string };

/** Enforces loan limit, reference-only books and outstanding overdue items. */
export async function checkBorrowEligibility(memberId: string, copyId: string): Promise<BorrowCheck> {
  const { data: copy } = await supabase
    .from("book_copies")
    .select("id, status, books(title, reference_only)")
    .eq("id", copyId)
    .maybeSingle();

  if (!copy) return { ok: false, reason: "That copy no longer exists." };
  if ((copy as any).books?.reference_only)
    return { ok: false, reason: "This is a reference-only book and cannot be borrowed." };
  if (copy.status !== "available") return { ok: false, reason: "That copy is not available." };

  const { data: active } = await supabase
    .from("loans")
    .select("id, due_at")
    .eq("member_id", memberId)
    .eq("status", "active");

  const list = active ?? [];
  if (list.length >= MAX_BOOKS_PER_MEMBER)
    return { ok: false, reason: `This member already has ${MAX_BOOKS_PER_MEMBER} books on loan.` };

  const today = new Date();
  if (list.some((l) => new Date(l.due_at) < today))
    return { ok: false, reason: "This member has an overdue book and cannot borrow until it is returned." };

  const { data: fines } = await supabase
    .from("fines")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "outstanding");
  if ((fines ?? []).length >= 3)
    return { ok: false, reason: "This member has too many unpaid fines." };

  return { ok: true };
}

/** Queues the 7/3/1/0-day return reminders for a loan. */
export async function scheduleReturnReminders(opts: {
  loanId: string;
  memberId: string;
  email: string | null;
  memberName: string;
  bookTitle: string;
  dueAt: string;
}) {
  if (!opts.email) return;
  const due = new Date(opts.dueAt);
  const now = new Date();

  const rows = REMINDER_OFFSETS.filter((o) => addDays(due, -o.days) > now).map((o) => ({
    member_id: opts.memberId,
    loan_id: opts.loanId,
    type: "return_reminder",
    recipient_email: opts.email,
    subject:
      o.days === 0
        ? `Due today: "${opts.bookTitle}"`
        : `${o.label} until "${opts.bookTitle}" is due`,
    body:
      `Dear ${opts.memberName},\n\n` +
      (o.days === 0
        ? `"${opts.bookTitle}" is due back today (${due.toDateString()}). Please return it to avoid a fine of LKR ${FINE_PER_DAY} per late day.`
        : `This is a reminder that "${opts.bookTitle}" is due on ${due.toDateString()} — ${o.label.toLowerCase()} from now.`) +
      `\n\nSmart Library Management System`,
    scheduled_for: addDays(due, -o.days).toISOString(),
    status: "pending",
  }));

  if (rows.length) await supabase.from("notifications").insert(rows);
}

/** Cancels any reminders still queued for a loan (used when a book comes back early). */
export async function cancelRemindersForLoan(loanId: string) {
  await supabase
    .from("notifications")
    .update({ status: "cancelled" })
    .eq("loan_id", loanId)
    .eq("status", "pending");
}

/** Creates a fine record for an overdue or damaged/lost return. Returns the amount. */
export async function recordReturnFine(opts: {
  loanId: string;
  memberId: string;
  dueAt: string;
  condition: string;
  returnedAt: Date;
}) {
  const lateDays = Math.max(0, daysBetween(new Date(opts.dueAt), opts.returnedAt));
  const overdueFine = lateDays * FINE_PER_DAY;
  const damageFine = opts.condition === "lost" ? 1000 : opts.condition === "damaged" ? 500 : 0;
  const amount = overdueFine + damageFine;
  if (amount <= 0) return 0;

  await supabase.from("fines").insert({
    loan_id: opts.loanId,
    member_id: opts.memberId,
    reason: damageFine > 0 ? (opts.condition === "lost" ? "lost" : "damaged") : "overdue",
    late_days: lateDays,
    amount,
    status: "outstanding",
  });
  return amount;
}

/** Promotes the next member in a book's reservation queue and queues their alert. */
export async function notifyNextReservation(bookId: string) {
  const { data: next } = await supabase
    .from("reservations")
    .select("id, member_id, members(full_name, email), books(title)")
    .eq("book_id", bookId)
    .eq("status", "waiting")
    .order("queue_position")
    .limit(1)
    .maybeSingle();
  if (!next) return;

  const expires = addDays(new Date(), 3);
  await supabase
    .from("reservations")
    .update({ status: "ready", ready_at: new Date().toISOString(), expires_at: expires.toISOString() })
    .eq("id", next.id);

  const member = (next as any).members;
  const title = (next as any).books?.title ?? "your reserved book";
  if (member?.email) {
    await supabase.from("notifications").insert({
      member_id: next.member_id,
      reservation_id: next.id,
      type: "reservation_ready",
      recipient_email: member.email,
      subject: `"${title}" is ready for collection`,
      body:
        `Dear ${member.full_name},\n\nThe book "${title}" you reserved is now available. ` +
        `Please collect it before ${expires.toDateString()}.\n\nSmart Library Management System`,
      scheduled_for: new Date().toISOString(),
      status: "pending",
    });
  }
}