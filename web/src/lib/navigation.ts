import type { AppNotification } from './types';

/** Where tapping a notification should take the user. */
export function notificationHref(n: AppNotification): string | null {
  switch (n.type) {
    case 'connection_request':
      return '/network?tab=requests';
    case 'connection_accepted':
      return n.actor ? `/u/${n.actor.username}` : '/network';
    case 'message_request':
    case 'message_request_accepted':
      return n.conversationId ? `/chat/${n.conversationId}` : '/messages';
    case 'paper_download':
      return n.paper ? `/paper/${n.paper.id}` : '/papers';
    case 'post_like':
    case 'post_comment':
    case 'post_flagged':
    case 'post_restored':
    case 'post_removed':
      return n.postId ? `/post/${n.postId}` : null;
    default:
      return null;
  }
}
