// Shared enums used by models, routes and the privacy engine.

/** Who can see a profile detail. */
export const VISIBILITY = ['public', 'connections', 'private'];

/** Who can open a research paper's details. */
export const PAPER_VIEW_ACCESS = ['public', 'connections', 'private'];

/** How a research paper or external link can be accessed. */
export const PAPER_DOWNLOAD_ACCESS = ['everyone', 'connections', 'none', 'paid'];

/** Personal details that carry their own privacy toggle. */
export const PROFILE_FIELDS = ['qualification', 'institution', 'location', 'bio', 'interests'];

/** Contact methods and external links that carry their own privacy toggle. */
export const LINK_FIELDS = [
  'email',
  'phone',
  'whatsapp',
  'linkedin',
  'github',
  'portfolio',
  'researchgate',
  'scholar',
  'orcid',
  'telegram',
  'twitter',
];

/** Extra privacy toggles that are not tied to a single field value. */
export const META_VISIBILITY_FIELDS = ['connectionsList'];

export const ALL_VISIBILITY_FIELDS = [...PROFILE_FIELDS, ...LINK_FIELDS, ...META_VISIBILITY_FIELDS];

export const DEFAULT_VISIBILITY = {
  qualification: 'public',
  institution: 'public',
  location: 'public',
  bio: 'public',
  interests: 'public',
  email: 'private',
  phone: 'private',
  whatsapp: 'connections',
  linkedin: 'public',
  github: 'public',
  portfolio: 'public',
  researchgate: 'public',
  scholar: 'public',
  orcid: 'public',
  telegram: 'connections',
  twitter: 'public',
  connectionsList: 'connections',
};

/** Categories every feed post must belong to. Keeps the feed academic. */
export const POST_CATEGORIES = [
  'Research update',
  'Publication',
  'Preprint',
  'Conference & events',
  'Dataset & code',
  'Methods & tutorials',
  'Collaboration call',
  'Academic question',
  'Funding & opportunities',
];

export const POST_KINDS = ['update', 'link', 'paper', 'media'];

export const NOTIFICATION_TYPES = [
  'connection_request',
  'connection_accepted',
  'message_request',
  'message_request_accepted',
  'post_like',
  'post_comment',
  'post_mention',
  'comment_mention',
  'paper_download',
  'post_flagged',
  'post_removed',
  'post_restored',
];

export const NOTIFICATION_CATEGORY = {
  connection_request: 'requests',
  connection_accepted: 'requests',
  message_request: 'requests',
  message_request_accepted: 'requests',
  post_like: 'engagement',
  post_comment: 'engagement',
  post_mention: 'engagement',
  comment_mention: 'engagement',
  post_flagged: 'engagement',
  post_removed: 'engagement',
  post_restored: 'engagement',
  paper_download: 'downloads',
};

export const NOTIFICATION_TYPES_BY_CATEGORY = {
  requests: ['connection_request', 'connection_accepted', 'message_request', 'message_request_accepted'],
  engagement: ['post_like', 'post_comment', 'post_mention', 'comment_mention', 'post_flagged', 'post_removed', 'post_restored'],
  downloads: ['paper_download'],
};
