// Shapes database documents into the JSON the app receives. Privacy filtering happens here,
// so private details never leave the server.
import { DEFAULT_VISIBILITY, LINK_FIELDS, NOTIFICATION_CATEGORY, PROFILE_FIELDS } from '../constants.js';
import { isOnline } from '../realtime/socket.js';
import { publicFileUrl, signedFileUrl } from './files.js';
import { canDownloadPaper, canSee, canViewPaper } from './privacy.js';
import { paperPricing } from './paper-pricing.js';

/** Fields to select when a lightweight user summary is needed. */
export const SUMMARY_FIELDS =
  'name username headline avatar profile.institution visibility.institution openToCollaborate lastSeenAt';

export function visibilityOf(user) {
  return { ...DEFAULT_VISIBILITY, ...(user?.visibility || {}) };
}

export function userSummary(user) {
  if (!user || !user._id) return null;
  const vis = visibilityOf(user);
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    headline: user.headline || '',
    avatarUrl: publicFileUrl(user.avatar),
    institution: vis.institution === 'public' ? user.profile?.institution || '' : '',
    openToCollaborate: !!user.openToCollaborate,
    online: isOnline(user._id),
    lastSeenAt: user.lastSeenAt || null,
  };
}

/** Full profile, filtered by what this viewer is allowed to see. */
export function profileForViewer(user, status) {
  const vis = visibilityOf(user);
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    const value = user.profile?.[field];
    const empty = Array.isArray(value) ? value.length === 0 : !value;
    if (!empty && canSee(vis[field], status)) profile[field] = value;
  }
  const links = {};
  for (const field of LINK_FIELDS) {
    const value = user.links?.[field];
    if (value && canSee(vis[field], status)) links[field] = value;
  }
  const result = {
    ...userSummary(user),
    institution: profile.institution || '',
    coverUrl: publicFileUrl(user.cover),
    profile,
    links,
    joinedAt: user.createdAt,
    canSeeConnections: canSee(vis.connectionsList, status),
  };
  if (status === 'self') {
    // The owner gets their raw values plus every privacy setting, so they can edit them.
    result.profile = {
      qualification: user.profile?.qualification || '',
      institution: user.profile?.institution || '',
      location: user.profile?.location || '',
      bio: user.profile?.bio || '',
      interests: user.profile?.interests || [],
    };
    result.links = Object.fromEntries(LINK_FIELDS.map((f) => [f, user.links?.[f] || '']));
    result.visibility = vis;
    result.settings = { messageRequests: user.settings?.messageRequests || 'everyone' };
    result.email = user.email;
  }
  return result;
}

function fileInfo(paper) {
  if (paper.kind !== 'file' || !paper.file?.id) return null;
  return { name: paper.file.name, mime: paper.file.mime, size: paper.file.size };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function paperSummary(paper, status) {
  const isOwner = status === 'self';
  return {
    id: String(paper._id),
    ownerId: String(paper.owner?._id || paper.owner),
    title: paper.title,
    venue: paper.venue || '',
    year: paper.year || null,
    authors: paper.authors || [],
    keywords: paper.keywords || [],
    abstractPreview: (paper.abstract || '').slice(0, 240),
    kind: paper.kind,
    file: fileInfo(paper),
    linkHost: paper.kind === 'link' ? hostOf(paper.link) : '',
    viewAccess: paper.viewAccess,
    downloadAccess: paper.downloadAccess,
    pricing: paper.downloadAccess === 'paid' ? paperPricing() : null,
    showOnProfile: paper.showOnProfile,
    order: paper.order,
    canDownload: canDownloadPaper(paper, status),
    stats: isOwner ? paper.stats : undefined,
    createdAt: paper.createdAt,
  };
}

export function paperDetail(paper, status) {
  return {
    ...paperSummary(paper, status),
    abstract: paper.abstract || '',
    doi: paper.doi || '',
    owner: userSummary(paper.owner),
    isOwner: status === 'self',
    stats: status === 'self' ? paper.stats : { views: paper.stats?.views || 0, downloads: paper.stats?.downloads || 0 },
  };
}

/**
 * The profile's paper index: the author's chosen papers, in the author's order.
 * Papers this viewer cannot open appear as locked rows; "Only me" papers are omitted.
 */
export function paperIndexForViewer(papers, status) {
  const rows = [];
  for (const paper of papers) {
    if (!paper.showOnProfile) continue;
    if (paper.viewAccess === 'private' && status !== 'self') continue;
    const index = rows.length + 1;
    if (canViewPaper(paper, status)) rows.push({ index, locked: false, ...paperSummary(paper, status) });
    else rows.push({ index, locked: true, id: null, reason: 'connections' });
  }
  return rows;
}

export function mediaUrl(media) {
  return media.access === 'private' ? signedFileUrl(media.id) : publicFileUrl(media.id);
}

export function postView(post, { viewerId, connectedIds = new Set(), likedIds = new Set() }) {
  const authorId = String(post.author?._id || post.author);
  const status = !viewerId
    ? 'anonymous'
    : authorId === String(viewerId)
      ? 'self'
      : connectedIds.has(authorId)
        ? 'connected'
        : 'none';
  let paper = null;
  if (post.paper && post.paper._id) {
    paper = canViewPaper(post.paper, status)
      ? {
          locked: false,
          id: String(post.paper._id),
          title: post.paper.title,
          venue: post.paper.venue || '',
          year: post.paper.year || null,
          authors: post.paper.authors || [],
          kind: post.paper.kind,
          canDownload: canDownloadPaper(post.paper, status),
          downloadAccess: post.paper.downloadAccess || 'everyone',
          pricing: post.paper.downloadAccess === 'paid' ? paperPricing() : null,
        }
      : { locked: true, id: null };
  } else if (post.kind === 'paper') {
    paper = { locked: true, id: null, removed: true };
  }
  return {
    id: String(post._id),
    author: userSummary(post.author),
    kind: post.kind,
    text: post.text,
    category: post.category,
    audience: post.audience,
    link: post.kind === 'link' ? { url: post.link?.url || '', domain: post.link?.domain || '' } : null,
    paper,
    media: (post.media || []).map((m) => ({ url: mediaUrl(m), kind: m.kind, mime: m.mime })),
    likeCount: post.likeCount || 0,
    commentCount: post.commentCount || 0,
    liked: likedIds.has(String(post._id)),
    isOwner: status === 'self',
    moderation: { status: post.moderation?.status || 'approved' },
    createdAt: post.createdAt,
  };
}

export function commentView(comment, viewerId) {
  return {
    id: String(comment._id),
    postId: String(comment.post),
    author: userSummary(comment.author),
    text: comment.text,
    isOwner: viewerId ? String(comment.author?._id || comment.author) === String(viewerId) : false,
    createdAt: comment.createdAt,
  };
}

export function messageView(message) {
  const att = message.attachment?.id
    ? {
        url: signedFileUrl(message.attachment.id, { name: message.attachment.name }),
        downloadUrl: signedFileUrl(message.attachment.id, { download: true, name: message.attachment.name }),
        name: message.attachment.name,
        mime: message.attachment.mime,
        size: message.attachment.size,
      }
    : null;
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    senderId: String(message.sender),
    text: message.text || '',
    kind: message.kind,
    attachment: att,
    readAt: message.readAt || null,
    createdAt: message.createdAt,
  };
}

function unreadFor(conversation, userId) {
  const unread = conversation.unread;
  if (!unread) return 0;
  if (unread instanceof Map) return unread.get(String(userId)) || 0;
  return unread[String(userId)] || 0;
}

export function conversationView(conversation, viewerId, otherUser) {
  const isRequester = conversation.requestedBy ? String(conversation.requestedBy) === String(viewerId) : false;
  // A declined request still looks pending to the sender, so the decline stays private.
  const status = conversation.status === 'declined' && isRequester ? 'request' : conversation.status;
  return {
    id: String(conversation._id),
    status,
    isRequester,
    other: userSummary(otherUser),
    lastMessage: conversation.lastMessage?.createdAt
      ? {
          text: conversation.lastMessage.text,
          kind: conversation.lastMessage.kind,
          senderId: String(conversation.lastMessage.sender),
          createdAt: conversation.lastMessage.createdAt,
        }
      : null,
    unread: unreadFor(conversation, viewerId),
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
  };
}

const NOTIFICATION_TEXT = {
  connection_request: () => 'sent you a connection request',
  connection_accepted: () => 'accepted your connection request',
  message_request: () => 'sent you a message request',
  message_request_accepted: () => 'accepted your message request',
  post_like: () => 'liked your post',
  post_comment: (n) => (n.snippet ? `commented on your post: “${n.snippet}”` : 'commented on your post'),
  post_mention: () => 'mentioned you in a post',
  comment_mention: () => 'mentioned you in a comment',
  paper_download: (n) =>
    n.snippet === 'link'
      ? `opened the link to your paper “${n.paper?.title || 'a paper'}”`
      : `downloaded your research paper “${n.paper?.title || 'a paper'}”`,
  post_flagged: () => 'Your post is hidden while moderators review community reports.',
  post_removed: (n) =>
    `A moderator removed your post because it does not follow the academic content guidelines${n.snippet ? `: ${n.snippet}` : '.'}`,
  post_restored: () => 'Your post was reviewed and is visible again.',
};

export function notificationView(notification) {
  const text = NOTIFICATION_TEXT[notification.type]?.(notification) || '';
  return {
    id: String(notification._id),
    type: notification.type,
    category: NOTIFICATION_CATEGORY[notification.type] || 'engagement',
    actor: userSummary(notification.actor),
    text,
    postId: notification.post ? String(notification.post._id || notification.post) : null,
    paper: notification.paper?._id ? { id: String(notification.paper._id), title: notification.paper.title } : null,
    conversationId: notification.conversation ? String(notification.conversation) : null,
    connectionId: notification.connection ? String(notification.connection) : null,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}
