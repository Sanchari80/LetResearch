// Imperative actions shared by several pages.
import { toast } from '@/store/toast';
import { api, ApiError, errorMessage } from './api';
import { fileUrl } from './config';
import { feedback } from './feedback';
import { navigate } from './nav';
import { keys, queryClient } from './queries';

/** Opens a link in a new tab (mail, phone and WhatsApp links open their apps). */
export function openUrl(url: string, preopened?: Window | null) {
  if (/^(mailto|tel|sms):/i.test(url)) {
    window.location.href = url;
    return;
  }
  if (preopened && !preopened.closed) {
    preopened.location.href = url;
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function legacyCopy(text: string) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

export async function copyToClipboard(text: string, message = 'Copied') {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else if (!legacyCopy(text)) throw new Error('blocked');
    feedback.success();
    toast.success(message, text.length < 80 ? text : undefined);
  } catch {
    if (legacyCopy(text)) {
      feedback.success();
      toast.success(message, text.length < 80 ? text : undefined);
    } else {
      toast.error('Copy failed', 'Your browser blocked clipboard access.');
    }
  }
}

/** Shares a link with the phone's share sheet when there is one, otherwise copies it. */
export async function shareLink(url: string, title: string, copiedMessage = 'Link copied') {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; canShare?: (data: ShareData) => boolean };
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && typeof nav.share === 'function') {
    try {
      await nav.share({ title, url });
      return;
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
    }
  }
  await copyToClipboard(url, copiedMessage);
}

/**
 * Downloads a paper (or opens its external link). The server checks the author's download
 * setting and notifies the author in real time.
 */
export async function downloadPaper(paperId: string, { signedIn, kind }: { signedIn: boolean; kind?: 'file' | 'link' }) {
  if (!signedIn) {
    toast.info('Sign in to download', 'Authors can see who downloads their papers.');
    navigate('/login');
    return;
  }
  // Browsers only allow new tabs that open during the click itself, so open it first for links.
  const preopened = kind === 'link' ? window.open('', '_blank') : null;
  try {
    const result = await api<{ kind: 'file' | 'link'; url: string; filename?: string }>(`/api/papers/${paperId}/download`, {
      method: 'POST',
    });
    if (result.kind === 'file') {
      preopened?.close();
      // The signed link answers with "Content-Disposition: attachment", so the page stays put.
      window.location.href = fileUrl(result.url)!;
    } else {
      openUrl(result.url, preopened);
    }
    feedback.success();
    toast.success(result.kind === 'link' ? 'Opening the paper' : 'Download started', result.filename);
    queryClient.invalidateQueries({ queryKey: keys.paper(paperId) });
  } catch (error) {
    preopened?.close();
    feedback.error();
    toast.error(
      error instanceof ApiError && error.code === 'DOWNLOAD_BLOCKED' ? 'Download not allowed' : 'Download failed',
      errorMessage(error),
    );
  }
}

/** Opens (or creates) a conversation and goes to it. Used by every Message button. */
export async function openChatWith(userId: string, { signedIn }: { signedIn: boolean }) {
  if (!signedIn) {
    toast.info('Sign in to send a message');
    navigate('/login');
    return;
  }
  try {
    const result = await api<{ conversation: { id: string } }>('/api/conversations/open', { method: 'POST', body: { userId } });
    navigate(`/chat/${result.conversation.id}`);
  } catch (error) {
    feedback.error();
    toast.error(
      error instanceof ApiError && error.code === 'MESSAGES_RESTRICTED' ? 'Messages are limited' : 'Could not open the chat',
      errorMessage(error),
    );
  }
}
