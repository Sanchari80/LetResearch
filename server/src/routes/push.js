// Web push subscriptions: the web app turns notifications on and off for this browser.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPublicKey, isAllowedEndpoint, removeSubscription, saveSubscription } from '../services/push.js';
import { badRequest } from '../utils/http.js';

const router = Router();

/** The public key browsers need to subscribe. */
router.get('/key', async (_req, res) => {
  const publicKey = await getPublicKey();
  res.json({ publicKey: publicKey || '', enabled: !!publicKey });
});

router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !isAllowedEndpoint(endpoint)) {
    throw badRequest('This browser’s notification service is not supported.');
  }
  if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
    throw badRequest('The notification subscription is incomplete. Try turning notifications on again.');
  }
  await saveSubscription(req.userId, { endpoint, keys });
  res.status(201).json({ ok: true });
});

router.delete('/subscribe', requireAuth, async (req, res) => {
  await removeSubscription(req.userId, req.body?.endpoint);
  res.json({ ok: true });
});

export default router;
