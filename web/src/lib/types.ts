// Shapes returned by the LetResearch API.

export type Visibility = 'public' | 'connections' | 'private';
export type PaperViewAccess = 'public' | 'connections' | 'private';
export type PaperDownloadAccess = 'everyone' | 'connections' | 'none';

export type ProfileField = 'qualification' | 'institution' | 'location' | 'bio' | 'interests';
export type LinkField =
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'researchgate'
  | 'scholar'
  | 'orcid'
  | 'telegram'
  | 'twitter';
export type VisibilityField = ProfileField | LinkField | 'connectionsList';

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  headline: string;
  avatarUrl: string | null;
  institution: string;
  openToCollaborate: boolean;
  online: boolean;
  lastSeenAt: string | null;
}

export interface ProfileDetails {
  qualification?: string;
  institution?: string;
  location?: string;
  bio?: string;
  interests?: string[];
}

export interface Profile extends UserSummary {
  coverUrl: string | null;
  profile: ProfileDetails;
  links: Partial<Record<LinkField, string>>;
  joinedAt: string;
  canSeeConnections: boolean;
  // Only present when viewing your own profile:
  visibility?: Record<VisibilityField, Visibility>;
  settings?: { messageRequests: 'everyone' | 'none' };
  email?: string;
}

export type RelationStatus = 'anonymous' | 'self' | 'connected' | 'pending_sent' | 'pending_received' | 'none';

export interface Relation {
  status: RelationStatus;
  connectionId: string | null;
}

export interface PaperFileInfo {
  name: string;
  mime: string;
  size: number;
}

export interface PaperSummary {
  id: string;
  ownerId: string;
  title: string;
  venue: string;
  year: number | null;
  authors: string[];
  keywords: string[];
  abstractPreview: string;
  kind: 'file' | 'link';
  file: PaperFileInfo | null;
  linkHost: string;
  viewAccess: PaperViewAccess;
  downloadAccess: PaperDownloadAccess;
  showOnProfile: boolean;
  order: number;
  canDownload: boolean;
  stats?: { views: number; downloads: number };
  createdAt: string;
}

export interface PaperDetail extends PaperSummary {
  abstract: string;
  doi: string;
  owner: UserSummary;
  isOwner: boolean;
}

export type PaperIndexRow =
  ({ index: number; locked: false } & PaperSummary) | { index: number; locked: true; id: null; reason: 'connections' };

export interface ProfileResponse {
  user: Profile;
  relation: Relation;
  stats: { connections: number; posts: number; papers: number };
  paperIndex: PaperIndexRow[];
  conversationId: string | null;
  canMessage: boolean;
  messageNote: string;
}

export type PostKind = 'update' | 'link' | 'paper' | 'media';

export interface PostPaper {
  locked: boolean;
  removed?: boolean;
  id: string | null;
  title?: string;
  venue?: string;
  year?: number | null;
  authors?: string[];
  kind?: 'file' | 'link';
  canDownload?: boolean;
}

export interface Post {
  id: string;
  author: UserSummary;
  kind: PostKind;
  text: string;
  category: string;
  audience: 'public' | 'connections';
  link: { url: string; domain: string } | null;
  paper: PostPaper | null;
  media: { url: string; kind: 'image' | 'video'; mime: string }[];
  likeCount: number;
  commentCount: number;
  liked: boolean;
  isOwner: boolean;
  moderation: { status: 'approved' | 'flagged' | 'removed' };
  createdAt: string;
  reports?: { reason: string; at: string }[];
}

export interface Comment {
  id: string;
  postId: string;
  author: UserSummary;
  text: string;
  isOwner: boolean;
  createdAt: string;
}

export interface Page<T> {
  results: T[];
  nextCursor: string | null;
}

export interface ChatAttachment {
  url: string;
  downloadUrl: string;
  name: string;
  mime: string;
  size: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  kind: 'text' | 'image' | 'file';
  attachment: ChatAttachment | null;
  readAt: string | null;
  createdAt: string;
  clientId?: string | null;
  // Local-only state for optimistic sending.
  pending?: 'sending' | 'failed';
  localUri?: string;
}

export interface Conversation {
  id: string;
  status: 'active' | 'request' | 'declined';
  isRequester: boolean;
  other: UserSummary;
  lastMessage: { text: string; kind: string; senderId: string; createdAt: string } | null;
  unread: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export type NotificationCategory = 'requests' | 'engagement' | 'downloads';

export interface AppNotification {
  id: string;
  type:
    | 'connection_request'
    | 'connection_accepted'
    | 'message_request'
    | 'message_request_accepted'
    | 'post_like'
    | 'post_comment'
    | 'paper_download'
    | 'post_flagged'
    | 'post_removed'
    | 'post_restored';
  category: NotificationCategory;
  actor: UserSummary | null;
  text: string;
  postId: string | null;
  paper: { id: string; title: string } | null;
  conversationId: string | null;
  connectionId: string | null;
  read: boolean;
  createdAt: string;
}

export interface Counts {
  notifications: number;
  connectionRequests: number;
  messages: number;
  messageRequests: number;
}

export interface Suggestion extends UserSummary {
  location: string;
  interests: string[];
  sharedInterests: string[];
  reason: string;
}

export interface ConnectionRequest {
  id: string;
  user: UserSummary;
  createdAt: string;
}
