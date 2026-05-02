/* ============================================================
   THE LEDGE BAGUIO — Store Routes (fixed + secured)
   ============================================================ */

const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { apiLimiter } = require('../middleware/rateLimiter');
const ctrl      = require('../controllers/storeController');

// FIX BUG 3: apply rate limiting to all store endpoints
// FIX BUG 10: /honesty/mine MUST be registered BEFORE /honesty/:id/verify
//             otherwise Express matches "mine" as the :id param

// ── Public ────────────────────────────────────────────────────
router.get('/products/public',     apiLimiter, ctrl.getPublicProducts);

// ── Guest (authenticated users, any role) ─────────────────────
// NOTE: /honesty/mine BEFORE /honesty/:id/verify — critical ordering
router.get('/honesty/mine',        apiLimiter, auth, ctrl.getMyHonestyEntries);
router.post('/honesty',            apiLimiter, auth, ctrl.submitHonestyEntry);

// ── GCash Accounts ────────────────────────────────────────────
router.get('/gcash-accounts',      auth, roleGuard('admin','manager','store_staff'), ctrl.getGcashAccounts);
router.post('/gcash-accounts',     auth, roleGuard('admin','manager'),               ctrl.createGcashAccount);
router.put('/gcash-accounts/:id',  auth, roleGuard('admin','manager'),               ctrl.updateGcashAccount);
router.delete('/gcash-accounts/:id', auth, roleGuard('admin','manager'),             ctrl.deleteGcashAccount);

// ── Products / Inventory ──────────────────────────────────────
router.get('/products',            auth, roleGuard('admin','manager','store_staff'), ctrl.getProducts);
router.post('/products',           auth, roleGuard('admin','manager'),               ctrl.createProduct);
router.put('/products/:id',        auth, roleGuard('admin','manager'),               ctrl.updateProduct);
router.delete('/products/:id',     auth, roleGuard('admin','manager'),               ctrl.deleteProduct);
router.patch('/products/:id/stock',auth, roleGuard('admin','manager','store_staff'), ctrl.adjustStock);

// ── Orders (POS) ──────────────────────────────────────────────
router.get('/orders',              auth, roleGuard('admin','manager','store_staff'), ctrl.getOrders);
router.post('/orders',             auth, roleGuard('admin','manager','store_staff'), ctrl.createOrder);
router.patch('/orders/:id/confirm',auth, roleGuard('admin','manager','store_staff'), ctrl.confirmPayment);
router.patch('/orders/:id/void',   auth, roleGuard('admin','manager','store_staff'), ctrl.voidOrder);

// ── Honesty Log (admin review) ────────────────────────────────
router.get('/honesty',             auth, roleGuard('admin','manager'),               ctrl.getAllHonestyEntries);
router.patch('/honesty/:id/verify',auth, roleGuard('admin','manager'),               ctrl.verifyHonestyEntry);

// ── Reports ───────────────────────────────────────────────────
router.get('/reports',             auth, roleGuard('admin','manager'),               ctrl.getStoreReports);

module.exports = router;
