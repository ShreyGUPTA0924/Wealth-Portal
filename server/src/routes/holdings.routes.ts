import { Router }        from 'express';
import multer            from 'multer';
import { z }             from 'zod';
import { AssetClass, TransactionType } from '@prisma/client';

import { authenticate }  from '../middleware/auth.middleware';
import { validate }      from '../middleware/validate.middleware';
import * as ctrl         from '../controllers/holdings.controller';

const router = Router();

// All holdings routes require authentication
router.use(authenticate);

// Multer — memory storage for CSV files (max 5 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ─── Validation schemas ───────────────────────────────────────────────────────

const assetClasses = Object.values(AssetClass) as [AssetClass, ...AssetClass[]];
const txnTypes     = Object.values(TransactionType) as [TransactionType, ...TransactionType[]];

const addHoldingSchema = z.object({
  assetClass:   z.enum(assetClasses),
  symbol:       z.string().optional(),
  name:         z.string().min(1),
  quantity:     z.number().positive(),
  buyPrice:     z.number().positive(),
  buyDate:      z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  maturityDate: z.string().optional(),
  interestRate: z.number().optional(),
  notes:        z.string().optional(),
});

const updateHoldingSchema = z.object({
  quantity:    z.number().positive().optional(),
  manualPrice: z.number().positive().optional(),
  notes:       z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const addTransactionSchema = z.object({
  type:         z.enum(txnTypes),
  quantity:     z.number().positive(),
  pricePerUnit: z.number().positive(),
  date:         z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  brokerage:    z.number().optional(),
  notes:        z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Static sub-routes MUST be registered before /:id to avoid route conflicts
router.post('/import-csv',   upload.single('file'), ctrl.importCsv);
router.post('/sync-broker',  ctrl.syncBroker);

router.get ('/',             ctrl.listHoldings);
router.post('/',             validate({ body: addHoldingSchema }),    ctrl.createHolding);

router.get ('/:id',          ctrl.getHolding);
router.patch('/:id',         validate({ body: updateHoldingSchema }), ctrl.updateHolding);
router.delete('/:id',        ctrl.removeHolding);

router.post('/:id/transactions',
  validate({ body: addTransactionSchema }),
  ctrl.createTransaction
);

export default router;
