// Creates in-app notifications, pushes them live over Socket.IO, and keeps badge counts fresh.
import { Connection, Conversation, Notification } from '../models/index.js';
import { emitToUser, isOnline, isOnScreen } from '../realtime/socket.js';
import { notificationView, SUMMARY_FIELDS } from './serializers.js';
import { sendPushToUser } from './push.js';

/** Unread badge numbers for the tab bar. */
export async function getCounts(userId) {
  const [notifications, connectionRequests, conversations] = await Promise.all([
    Notification.countDocuments({ recipient: userId, read: false }),
    Connection.countDocuments({ recipient: userId, status: 'pending' }),
    Conversation.find({ participants: userId, lastMessageAt: { $ne: null } })
      .select('status requestedBy unread')
      .lean(),
  ]);
  let messages = 0;
  let messageRequests = 0;
  for (const c of conversations) {
    const isRequester = c.requestedBy && String(c.requestedBy) === String(userId);
    if (c.status === 'active') {
      if ((c.unread?.[String(userId)] || 0) > 0) messages += 1;
    } else if (c.status === 'request' && !isRequester) {
      messageRequests += 1;
    }
  }
  return { notifications, connectionRequests, messages, messageRequests };
}

export async function pushCounts(userId) {
  if (!userId || !isOnline(userId)) return;
  try {
    emitToUser(userId, 'counts', await getCounts(userId));
  } catch (error) {
    console.error('[notify] count refresh failed', error.message);
  }
}

/**
 * Creates a notification and delivers it instantly.
 * Pass `replace` to remove an earlier notification of the same kind first (e.g. like → unlike → like).
 */
export async function notify({
  recipient,
  actor = null,
  type,
  post = null,
  paper = null,
  conversation = null,
  connection = null,
  snippet = '',
}) {
  if (!recipient) return null;
  if (actor && String(actor) === String(recipient)) return null;

  const doc = await Notification.create({ recipient, actor, type, post, paper, conversation, connection, snippet });
  const populated = await Notification.findById(doc._id).populate('actor', SUMMARY_FIELDS).populate('paper', 'title').lean();
  const view = notificationView(populated);
  emitToUser(recipient, 'notification:new', view);
  pushCounts(recipient);
  if (!isOnScreen(recipient)) {
    const body = view.actor ? capitalize(view.text) : view.text;
    sendPushToUser(recipient, {
      title: view.actor?.name || 'LetResearch',
      body,
      url: notificationUrl(view),
      badge: await unreadTotal(recipient),
    });
  }
  return view;
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** Unread total for the app icon badge. */
export async function unreadTotal(userId) {
  try {
    const c = await getCounts(userId);
    return c.notifications + c.connectionRequests + c.messages + c.messageRequests;
  } catch {
    return undefined;
  }
}

/** The page a notification opens in the web app (mirrors the app's own links). */
export function notificationUrl(view) {
  switch (view.type) {
    case 'connection_request':
      return '/network?tab=requests';
    case 'connection_accepted':
      return view.actor ? `/u/${view.actor.username}` : '/network';
    case 'message_request':
    case 'message_request_accepted':
      return view.conversationId ? `/chat/${view.conversationId}` : '/messages';
    case 'paper_download':
      return view.paper ? `/paper/${view.paper.id}` : '/papers';
    case 'post_like':
    case 'post_comment':
    case 'post_flagged':
    case 'post_restored':
    case 'post_removed':
      return view.postId ? `/post/${view.postId}` : '/notifications';
    default:
      return '/notifications';
  }
}

/** Removes notifications that no longer make sense (e.g. after an unlike or a withdrawn request). */
export async function retractNotifications(filter) {
  const docs = await Notification.find(filter).select('recipient').lean();
  if (!docs.length) return;
  await Notification.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  for (const recipient of new Set(docs.map((d) => String(d.recipient)))) pushCounts(recipient);
}
