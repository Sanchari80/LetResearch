// Web push: notifications on phones and computers while LetResearch is closed.
// Browsers subscribe through the web app; the server signs each message with a VAPID key pair.
// Without VAPID_* settings the server creates a key pair once and keeps it in MongoDB.
import webpush from 'web-push';
import { config } from '../config.js';
import { AppSetting, User } from '../models/index.js';

const MAX_SUBSCRIPTIONS = 10;

// Push services run by the browser makers (Chrome/Android, Firefox, Safari/iOS, Edge).
// Anything else is refused, so the server never posts to an arbitrary address.
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)mozaws\.net$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isAllowedEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

let keysPromise = null;

async function loadKeys() {
  if (config.push.publicKey && config.push.privateKey) {
    return { publicKey: config.push.publicKey, privateKey: config.push.privateKey };
  }
  const saved = await AppSetting.findOne({ key: 'vapid' }).lean();
  if (saved?.value?.publicKey && saved?.value?.privateKey) return saved.value;
  // First start: create keys. If two servers race, the first saved pair wins for both.
  const generated = webpush.generateVAPIDKeys();
  await AppSetting.updateOne({ key: 'vapid' }, { $setOnInsert: { value: generated } }, { upsert: true });
  const stored = await AppSetting.findOne({ key: 'vapid' }).lean();
  return stored.value;
}

/** Prepares web push once; resolves with the key pair, or null if it could not be set up. */
export function initPush() {
  if (!keysPromise) {
    keysPromise = loadKeys()
      .then((keys) => {
        const subject = config.push.subject || `mailto:${config.adminEmails[0] || 'admin@letresearch.app'}`;
        webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
        return keys;
      })
      .catch((error) => {
        console.error('[push] web push is not available:', error.message);
        keysPromise = null;
        return null;
      });
  }
  return keysPromise;
}

export async function getPublicKey() {
  const keys = await initPush();
  return keys?.publicKey || null;
}

/** Saves a browser subscription for this user. A browser belongs to the account that last signed in on it. */
export async function saveSubscription(userId, subscription) {
  const entry = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    createdAt: new Date(),
  };
  await User.updateMany({ _id: { $ne: userId } }, { $pull: { pushSubscriptions: { endpoint: entry.endpoint } } });
  await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint: entry.endpoint } } });
  await User.updateOne({ _id: userId }, { $push: { pushSubscriptions: { $each: [entry], $slice: -MAX_SUBSCRIPTIONS } } });
}

export async function removeSubscription(userId, endpoint) {
  await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint: String(endpoint || '') } } });
}

/**
 * Sends a notification to every browser the user turned notifications on in.
 * `url` is the page that opens when it is tapped; `tag` groups related alerts (e.g. one chat);
 * `badge` is the unread total for the app icon.
 */
export async function sendPushToUser(userId, { title, body, url = '/', tag, badge }) {
  try {
    const user = await User.findById(userId).select('+pushSubscriptions').lean();
    const subscriptions = user?.pushSubscriptions || [];
    if (!subscriptions.length) return;
    if (!(await initPush())) return;
    const payload = JSON.stringify({ title, body: String(body || '').slice(0, 180), url, tag, badge });
    const stale = [];
    await Promise.all(
      subscriptions.map(async (subscription) => {
        if (!isAllowedEndpoint(subscription.endpoint)) {
          stale.push(subscription.endpoint);
          return;
        }
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload, {
            TTL: 24 * 60 * 60,
            urgency: 'high',
            timeout: 10000,
          });
        } catch (error) {
          // 404/410: the browser dropped the subscription (signed out, site data cleared, app removed).
          if (error?.statusCode === 404 || error?.statusCode === 410) stale.push(subscription.endpoint);
        }
      }),
    );
    if (stale.length) await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint: { $in: stale } } } });
  } catch (error) {
    // Push is best effort – in-app notifications are the source of truth.
    console.error('[push] send failed', error.message);
  }
}
