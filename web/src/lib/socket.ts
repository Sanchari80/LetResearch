import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';

let socket: Socket | null = null;

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/** Tells the server whether LetResearch is on screen, so it knows when to send phone notifications instead. */
function reportVisibility() {
  if (socket?.connected) socket.emit('visibility', { visible: visible() });
}

export function connectSocket(token: string) {
  if (socket) socket.disconnect();
  document.removeEventListener('visibilitychange', reportVisibility);
  document.addEventListener('visibilitychange', reportVisibility);
  socket = io(API_URL, {
    // A function, so every reconnect sends the current state.
    auth: (cb) => cb({ token, visible: visible() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  document.removeEventListener('visibilitychange', reportVisibility);
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let typingFor: string | null = null;
let lastTypingSent = 0;

/** Throttled typing signal: sends "typing" at most every 2.5s and "stopped" after 3s idle. */
export function signalTyping(conversationId: string) {
  if (!socket?.connected) return;
  const now = Date.now();
  if (typingFor !== conversationId || now - lastTypingSent > 2500) {
    socket.emit('typing', { conversationId, isTyping: true });
    lastTypingSent = now;
    typingFor = conversationId;
  }
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => stopTyping(conversationId), 3000);
}

export function stopTyping(conversationId: string) {
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = null;
  if (typingFor === conversationId && socket?.connected) {
    socket.emit('typing', { conversationId, isTyping: false });
  }
  typingFor = null;
  lastTypingSent = 0;
}
