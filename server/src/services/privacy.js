// Privacy and access-control engine. Every profile detail, contact link and research paper
// is filtered here before it leaves the server.
import { Connection, pairKeyOf } from '../models/index.js';

/**
 * Relationship between the viewer and a profile owner:
 * anonymous | self | connected | pending_sent | pending_received | none
 */
export async function getRelation(viewerId, targetId) {
  if (!viewerId) return { status: 'anonymous', connectionId: null };
  if (String(viewerId) === String(targetId)) return { status: 'self', connectionId: null };
  const connection = await Connection.findOne({ pairKey: pairKeyOf(viewerId, targetId) }).lean();
  if (!connection) return { status: 'none', connectionId: null };
  if (connection.status === 'accepted') return { status: 'connected', connectionId: String(connection._id) };
  const sent = String(connection.requester) === String(viewerId);
  return { status: sent ? 'pending_sent' : 'pending_received', connectionId: String(connection._id) };
}

export async function areConnected(a, b) {
  if (!a || !b || String(a) === String(b)) return false;
  const found = await Connection.exists({ pairKey: pairKeyOf(a, b), status: 'accepted' });
  return !!found;
}

/** Ids of everyone the user is connected with. */
export async function getConnectionIds(userId) {
  const rows = await Connection.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .select('requester recipient')
    .lean();
  return rows.map((r) => (String(r.requester) === String(userId) ? r.recipient : r.requester));
}

/** Can a viewer with this relation see a detail that has the given visibility? */
export function canSee(visibility, status) {
  if (status === 'self') return true;
  if (visibility === 'public') return true;
  if (visibility === 'connections') return status === 'connected';
  return false;
}

export function canViewPaper(paper, status) {
  return canSee(paper.viewAccess, status);
}

/** Downloads always need a signed-in account so the author can be told who downloaded. */
export function canDownloadPaper(paper, status) {
  if (status === 'self') return true;
  if (status === 'anonymous') return false;
  if (!canViewPaper(paper, status)) return false;
  if (paper.downloadAccess === 'paid') return false;
  if (paper.downloadAccess === 'everyone') return true;
  if (paper.downloadAccess === 'connections') return status === 'connected';
  return false;
}

/** Explains why a download is blocked, in plain language for the app. */
export function downloadBlockReason(paper, status) {
  if (paper.downloadAccess === 'paid') return 'The full paper is paid. Title and abstract are free; checkout is coming soon.';
  if (status === 'anonymous') return 'Sign in to download this paper.';
  if (paper.downloadAccess === 'none') return 'The author has turned off downloads for this paper.';
  if (paper.downloadAccess === 'connections') return 'Only connections can download this paper.';
  return 'You cannot download this paper.';
}
