import { ChecklistCategory } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import { prisma } from '../lib/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'object' && 'toNumber' in d && typeof (d as { toNumber: unknown }).toNumber === 'function') {
    return (d as { toNumber(): number }).toNumber();
  }
  return Number(d) || 0;
}

function appError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

export const REMINDER_CATEGORIES: ChecklistCategory[] = [
  'RENT',
  'ELECTRICITY',
  'WATER',
  'INTERNET',
  'MOBILE',
  'CREDIT_CARD',
  'EMI_HOME_LOAN',
  'EMI_CAR_LOAN',
  'EMI_PERSONAL_LOAN',
  'INSURANCE',
  'SUBSCRIPTION',
  'DOMESTIC_HELP',
  'MAINTENANCE',
  'OTHER',
];

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateReminderDto {
  label:          string;
  category:       ChecklistCategory;
  amount:         number;
  dueDayOfMonth:  number;
  isRecurring?:   boolean;
}

export interface UpdateReminderDto {
  label?:          string;
  amount?:         number;
  dueDayOfMonth?:  number;
}

export interface ReminderItem {
  id:              string;
  label:           string;
  category:        string;
  amount:          number | null;
  dueDayOfMonth:   number;
  isPaid:          boolean;
  paidAt:          string | null;
  actualAmount:    number | null;
  daysUntilDue:    number;
  isOverdue:       boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getReminders(userId: string): Promise<ReminderItem[]> {
  const now = new Date();
  const today = now.getDate();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const templates = await prisma.checklistTemplate.findMany({
    where:   { userId, isActive: true },
    include: {
      entries: {
        where: {
          monthYear: {
            gte: monthStart,
            lt:  new Date(monthStart.getTime() + 1),
          },
        },
        take: 1,
      },
    },
    orderBy: { dueDayOfMonth: 'asc' },
  });

  return templates.map((t) => {
    const entry = t.entries[0];
    const dueDay = t.dueDayOfMonth;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, monthEnd.getDate()));
    const daysUntilDue = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0 && !(entry?.isPaid ?? false);

    return {
      id:            t.id,
      label:         t.label,
      category:      t.category,
      amount:        t.amount ? toNum(t.amount) : null,
      dueDayOfMonth: t.dueDayOfMonth,
      isPaid:        entry?.isPaid ?? false,
      paidAt:        entry?.paidAt?.toISOString() ?? null,
      actualAmount:  entry?.actualAmount ? toNum(entry.actualAmount) : null,
      daysUntilDue,
      isOverdue,
    };
  });
}

export async function createReminder(userId: string, dto: CreateReminderDto) {
  if (!REMINDER_CATEGORIES.includes(dto.category)) {
    throw appError(`Invalid category. Valid: ${REMINDER_CATEGORIES.join(', ')}`, 400);
  }
  if (dto.dueDayOfMonth < 1 || dto.dueDayOfMonth > 31) {
    throw appError('dueDayOfMonth must be between 1 and 31', 400);
  }

  try {
    const template = await prisma.checklistTemplate.create({
      data: {
        userId,
        label:         dto.label.trim(),
        category:      dto.category,
        amount:        dto.amount,
        dueDayOfMonth: dto.dueDayOfMonth,
      },
    });

    return {
      id:            template.id,
      label:         template.label,
      category:      template.category,
      amount:        toNum(template.amount),
      dueDayOfMonth: template.dueDayOfMonth,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('invalid input value') && msg.includes('ChecklistCategory')) {
      throw appError(
        'Database missing new category values. Run prisma/add-reminder-categories.sql in Supabase SQL Editor.',
        400
      );
    }
    throw err;
  }
}

export async function updateReminder(userId: string, templateId: string, dto: UpdateReminderDto) {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId, isActive: true },
  });
  if (!template) throw appError('Reminder not found', 404);

  if (dto.dueDayOfMonth != null && (dto.dueDayOfMonth < 1 || dto.dueDayOfMonth > 31)) {
    throw appError('dueDayOfMonth must be between 1 and 31', 400);
  }

  const updated = await prisma.checklistTemplate.update({
    where: { id: templateId },
    data:  {
      ...(dto.label != null && { label: dto.label.trim() }),
      ...(dto.amount != null && { amount: dto.amount }),
      ...(dto.dueDayOfMonth != null && { dueDayOfMonth: dto.dueDayOfMonth }),
    },
  });

  return {
    id:            updated.id,
    label:         updated.label,
    category:      updated.category,
    amount:        toNum(updated.amount),
    dueDayOfMonth: updated.dueDayOfMonth,
  };
}

export async function deleteReminder(userId: string, templateId: string) {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId },
  });
  if (!template) throw appError('Reminder not found', 404);

  await prisma.checklistTemplate.update({
    where: { id: templateId },
    data:  { isActive: false },
  });

  return { success: true, message: 'Reminder deleted' };
}

export async function getUpcomingReminders(userId: string): Promise<ReminderItem[]> {
  const all = await getReminders(userId);
  const unpaid = all.filter((r) => !r.isPaid);
  const overdue = unpaid.filter((r) => r.isOverdue);
  const upcoming = unpaid.filter((r) => !r.isOverdue && r.daysUntilDue <= 7 && r.daysUntilDue >= 0);

  return [...overdue, ...upcoming].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export async function markPaid(userId: string, templateId: string, actualAmount?: number) {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId, isActive: true },
  });
  if (!template) throw appError('Reminder not found', 404);

  const now = new Date();
  const monthYear = new Date(now.getFullYear(), now.getMonth(), 1);

  const entry = await prisma.checklistEntry.upsert({
    where:  { templateId_monthYear: { templateId, monthYear } },
    create: {
      templateId,
      userId,
      monthYear,
      isPaid:       true,
      actualAmount: actualAmount ?? template.amount,
      paidAt:       now,
    },
    update: {
      isPaid:       true,
      actualAmount: actualAmount ?? undefined,
      paidAt:       now,
    },
  });

  return {
    id:           entry.id,
    templateId,
    isPaid:       true,
    actualAmount: entry.actualAmount ? toNum(entry.actualAmount) : null,
    paidAt:       entry.paidAt?.toISOString() ?? null,
  };
}

export async function markUnpaid(userId: string, templateId: string) {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId, isActive: true },
  });
  if (!template) throw appError('Reminder not found', 404);

  const now = new Date();
  const monthYear = new Date(now.getFullYear(), now.getMonth(), 1);

  const entry = await prisma.checklistEntry.upsert({
    where:  { templateId_monthYear: { templateId, monthYear } },
    create: {
      templateId,
      userId,
      monthYear,
      isPaid: false,
    },
    update: {
      isPaid:       false,
      actualAmount: null,
      paidAt:       null,
    },
  });

  return {
    id:     entry.id,
    templateId,
    isPaid: false,
  };
}

export interface CibilSuggestion {
  label:          string;
  category:       string;
  amount:         number;
  dueDayOfMonth:  number;
}

export async function parseCibilPdf(userId: string, fileBuffer: Buffer): Promise<{ suggestions: CibilSuggestion[]; error?: string }> {
  const aiUrl = process.env['AI_SERVICE_URL'] ?? 'http://localhost:8000';
  const url   = `${aiUrl.replace(/\/$/, '')}/parse-cibil`;

  try {
    const form = new FormData();
    form.append('file', fileBuffer, { filename: 'cibil.pdf', contentType: 'application/pdf' });

    const res = await axios.post<{ suggestions?: CibilSuggestion[]; error?: string }>(url, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const json = res.data;
    const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
    return { suggestions, error: json.error };
  } catch (err) {
    console.error('[parseCibilPdf]', err);
    return { suggestions: [], error: 'Could not connect to AI service' };
  }
}
