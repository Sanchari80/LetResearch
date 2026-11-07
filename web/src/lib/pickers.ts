// File pickers built on <input type="file">. They return upload-ready files with previews.
import type { UploadFile } from './api';

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
};

function guessMime(name: string, fallback = 'application/octet-stream') {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? fallback;
}

interface PickOptions {
  accept: string;
  multiple?: boolean;
  capture?: 'user' | 'environment';
}

// The hidden input of the last chooser. Browsers without a "cancel" event never report a
// cancelled chooser, so a leftover input is removed when the next one opens.
let openInput: HTMLInputElement | null = null;

/** Opens the browser's file chooser. Resolves with the chosen files, or an empty list if cancelled. */
export function pickFiles({ accept, multiple, capture }: PickOptions): Promise<File[]> {
  return new Promise((resolve) => {
    openInput?.remove();
    const input = document.createElement('input');
    openInput = input;
    input.type = 'file';
    if (accept) input.accept = accept;
    input.multiple = !!multiple;
    if (capture) input.setAttribute('capture', capture);
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.opacity = '0';
    // Large files picked on phones (e.g. from a cloud photo library) can take a while to arrive,
    // so only the browser's own "change" or "cancel" event settles the choice.
    const finish = (files: File[]) => {
      input.remove();
      if (openInput === input) openInput = null;
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

function videoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (value?: number) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : undefined);
    video.onerror = () => finish(undefined);
    setTimeout(() => finish(undefined), 6000);
    video.src = url;
  });
}

/** Turns a File (chosen or dropped) into an upload-ready file with a preview URL. */
export async function toUpload(file: File, index = 0): Promise<UploadFile> {
  const isVideo = file.type.startsWith('video/');
  const fallbackName = `${isVideo ? 'video' : 'file'}-${Date.now()}-${index}`;
  const name = file.name || fallbackName;
  const type = file.type || guessMime(name);
  return {
    uri: URL.createObjectURL(file),
    name,
    type,
    size: file.size,
    blob: file,
    duration: type.startsWith('video/') ? await videoDuration(file) : undefined,
  };
}

/** Pick one or more images (and optionally a short video). */
export async function pickMedia({
  allowVideo = false,
  allowMultiple = false,
  limit = 4,
}: { allowVideo?: boolean; allowMultiple?: boolean; limit?: number } = {}): Promise<UploadFile[]> {
  const files = await pickFiles({ accept: allowVideo ? 'image/*,video/*' : 'image/*', multiple: allowMultiple });
  const chosen = files.slice(0, Math.max(1, limit));
  return Promise.all(chosen.map((file, i) => toUpload(file, i)));
}

/** Take a photo with the camera (phones open the camera; computers show the file chooser). */
export async function takePhoto(): Promise<UploadFile | null> {
  const [file] = await pickFiles({ accept: 'image/*', capture: 'environment' });
  return file ? toUpload(file) : null;
}

export const PAPER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Pick a document. Pass `types` to limit the choice (defaults to any file). */
export async function pickDocument(types?: string[]): Promise<UploadFile | null> {
  const accept = types?.length ? [...types, ...(types === PAPER_TYPES ? ['.pdf', '.doc', '.docx'] : [])].join(',') : '';
  const [file] = await pickFiles({ accept });
  return file ? toUpload(file) : null;
}

/** True on phones and tablets, where "Take a photo" makes sense. */
export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}
