import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as remindersService from '../services/reminders.service';
import multer from 'multer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const REMINDER_CATEGORIES = [
  'RENT', 'ELECTRICITY', 'WATER', 'INTERNET', 'MOBILE', 'CREDIT_CARD',
  'EMI_HOME_LOAN', 'EMI_CAR_LOAN', 'EMI_PERSONAL_LOAN', 'INSURANCE',
  'SUBSCRIPTION', 'DOMESTIC_HELP', 'MAINTENANCE', 'OTHER',
] as const;

const createReminderSchema = z.object({
  label:          z.string().min(1, 'Label is required'),
  category:       z.enum(REMINDER_CATEGORIES),
  amount:         z.number().min(0),
  dueDayOfMonth:  z.number().min(1).max(31),
  isRecurring:    z.boolean().optional(),
});

const updateReminderSchema = z.object({
  label:          z.string().min(1).optional(),
  amount:         z.number().min(0).optional(),
  dueDayOfMonth:  z.number().min(1).max(31).optional(),
});

const markPaidSchema = z.object({
  actualAmount: z.number().min(0).optional(),
});

// ─── Multer for file upload ───────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getReminders = wrap(async (req, res) => {
  const items = await remindersService.getReminders(req.user!.id);
  ok(res, { items });
});

export const createReminder = wrap(async (req, res) => {
  const parsed = createReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const template = await remindersService.createReminder(req.user!.id, parsed.data);
  ok(res, template, 201);
});

export const updateReminder = wrap(async (req, res) => {
  const templateId = [req.params['id']].flat()[0]!;
  const parsed = updateReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const template = await remindersService.updateReminder(req.user!.id, templateId, parsed.data);
  ok(res, template);
});

export const deleteReminder = wrap(async (req, res) => {
  const templateId = [req.params['id']].flat()[0]!;
  await remindersService.deleteReminder(req.user!.id, templateId);
  ok(res, { message: 'Reminder deleted' });
});

export const getUpcomingReminders = wrap(async (req, res) => {
  const items = await remindersService.getUpcomingReminders(req.user!.id);
  ok(res, { items });
});

export const markPaid = wrap(async (req, res) => {
  const templateId = [req.params['id']].flat()[0]!;
  const parsed = markPaidSchema.safeParse(req.body);
  const actualAmount = parsed.success ? parsed.data.actualAmount : undefined;
  const entry = await remindersService.markPaid(req.user!.id, templateId, actualAmount);
  ok(res, entry);
});

export const markUnpaid = wrap(async (req, res) => {
  const templateId = [req.params['id']].flat()[0]!;
  const entry = await remindersService.markUnpaid(req.user!.id, templateId);
  ok(res, entry);
});

export const importCibil = [
  upload.single('file'),
  wrap(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file || !file.buffer) {
      res.status(400).json({ success: false, message: 'PDF file is required' });
      return;
    }
    const result = await remindersService.parseCibilPdf(req.user!.id, file.buffer);
    ok(res, result);
  }),
];
