-- Run this in Supabase SQL Editor to add new ChecklistCategory enum values.
-- Required for Bill Reminders to work with categories like Credit Card, EMI, etc.

ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'ELECTRICITY';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'WATER';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'INTERNET';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'MOBILE';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'CREDIT_CARD';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'EMI_HOME_LOAN';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'EMI_CAR_LOAN';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'EMI_PERSONAL_LOAN';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'INSURANCE';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'DOMESTIC_HELP';
ALTER TYPE "ChecklistCategory" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
