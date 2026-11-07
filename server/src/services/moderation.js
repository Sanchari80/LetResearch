// Content moderation pipeline. LetResearch is an academic network, so reels, memes, jokes,
// spam and explicit content are rejected before they reach the feed.
//
// Layers:
//   1. Rule engine (always on): blocked terms, profanity, laughing-emoji spam, shouting,
//      entertainment/reel domains, animated GIFs, and an "academic context" requirement for media.
//   2. Optional AI review (set ANTHROPIC_API_KEY): images + caption are classified as academic or not.
//   3. Community reports: posts reported by several people are hidden until a moderator reviews them.
import { config } from '../config.js';

// Strong signals: one match rejects the content.
const BLOCKED_TERMS = [
  /\bmemes?\b/i,
  /\bdank\b/i,
  /\bshit\s?posts?(ing)?\b/i,
  /\bpranks?\b/i,
  /\btik\s?tok\b/i,
  /\breels?\b/i,
  /\bonly\s?fans\b/i,
  /\bnsfw\b/i,
  /\bf4f\b/i,
  /\bl4l\b/i,
  /\bsub4sub\b/i,
  /\bfollow\s+for\s+follow\b/i,
  /\blike\s+for\s+like\b/i,
  /\bgiveaways?\b/i,
  /\bsubscribe\s+to\s+my\s+channel\b/i,
  /\b(casino|betting|bet365|1xbet|jackpot)\b/i,
  /\bcrypto\s+(pump|signals?)\b/i,
  /\bairdrops?\b/i,
  /\bhot\s+singles\b/i,
  /\bdating\s+(app|site)s?\b/i,
];

const PROFANITY = [
  /\bf+u+c+k+(ing|er|ed|s)?\b/i,
  /\bsh[i1]t+(ty|s)?\b/i,
  /\bb[i1]tch(es)?\b/i,
  /\bbastards?\b/i,
  /\ba+ss+holes?\b/i,
  /\bdickheads?\b/i,
  /\bc+u+n+t+s?\b/i,
  /\bwh[o0]res?\b/i,
  /\bsluts?\b/i,
  /\bporn(o|ography)?\b/i,
  /\bxxx\b/i,
  /\bmotherf\w*/i,
  /\bwtf\b/i,
  /\bstfu\b/i,
];

// Weak signals: tolerated once inside clearly academic text, rejected otherwise.
const WEAK_TERMS = [
  /\blo+l+\b/i,
  /\blmf?ao+\b/i,
  /\brofl\b/i,
  /\b(ha){2,}h?\b/i,
  /\bxd+\b/i,
  /\bfunny\b/i,
  /\bjokes?\b/i,
  /\bcomedy\b/i,
  /\broast(ed|ing)?\b/i,
  /\btroll(ing|ed)?\b/i,
  /\bcringe\b/i,
  /\bvibe\s?check\b/i,
  /\bviral\b/i,
  /\bselfie\b/i,
];

const LAUGH_EMOJI = /[\u{1F602}\u{1F923}\u{1F606}\u{1F639}\u{1F480}\u{1F92A}\u{1F61C}\u{1F61D}\u{1F92D}\u{1F921}]/gu;

// Word stems that indicate research context.
const ACADEMIC_STEMS = [
  'research',
  'study',
  'studies',
  'paper',
  'preprint',
  'journal',
  'conference',
  'thesis',
  'dissertation',
  'experiment',
  'lab',
  'laborator',
  'data',
  'dataset',
  'analy',
  'method',
  'result',
  'finding',
  'hypothes',
  'theor',
  'model',
  'simulat',
  'algorithm',
  'survey',
  'sample',
  'specimen',
  'microscop',
  'figure',
  'chart',
  'graph',
  'plot',
  'poster',
  'presentation',
  'slide',
  'seminar',
  'workshop',
  'symposium',
  'lecture',
  'publication',
  'publish',
  'peer review',
  'citation',
  'abstract',
  'proposal',
  'grant',
  'fund',
  'fieldwork',
  'field work',
  'field trip',
  'observation',
  'measure',
  'prototype',
  'statist',
  'clinical',
  'trial',
  'protocol',
  'assay',
  'sequenc',
  'genom',
  'protein',
  'cell',
  'molecul',
  'chemi',
  'physic',
  'biolog',
  'math',
  'engineer',
  'comput',
  'machine learning',
  'deep learning',
  'neural',
  'benchmark',
  'evaluat',
  'literature',
  'academ',
  'universit',
  'faculty',
  'professor',
  'phd',
  'msc',
  'postdoc',
  'student',
  'scholar',
  'scien',
  'innovat',
  'report',
  'visuali',
  'map',
  'sensor',
  'device',
  'circuit',
  'robot',
  'material',
  'synthes',
  'spectr',
  'telescope',
  'satellite',
  'equipment',
  'instrument',
  'apparatus',
  'specimen',
  'diagram',
  'framework',
  'architecture',
  'code',
  'github',
  'repository',
  'curriculum',
  'course',
  'teaching',
  'class',
  'exam',
  'manuscript',
  'review',
  'doi',
  'arxiv',
  'ieee',
  'acm',
  'springer',
  'elsevier',
  'nature',
  'science',
  'medical',
  'medicine',
  'health',
  'clinic',
  'patient',
  'ecolog',
  'climate',
  'environment',
  'economic',
  'social',
  'policy',
  'psycholog',
  'linguist',
  'histor',
  'archaeolog',
  'geolog',
  'astronom',
  'quantum',
  'energy',
  'battery',
  'solar',
  'agricult',
  'crop',
  'soil',
  'water',
  'pharma',
  'drug',
  'vaccine',
  'virus',
  'bacteri',
  'species',
  'specimen',
  'conservation',
  'education',
  'learning',
  'training',
  'test',
  'trial',
];

const BLOCKED_DOMAINS = [
  'tiktok.com',
  'vm.tiktok.com',
  '9gag.com',
  'imgflip.com',
  'knowyourmeme.com',
  'memedroid.com',
  'ifunny.co',
  'cheezburger.com',
  'giphy.com',
  'tenor.com',
  'onlyfans.com',
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'bet365.com',
  '1xbet.com',
  'likee.video',
  'snapchat.com',
  'kwai.com',
  'triller.co',
  'fb.watch',
];

const BLOCKED_PATHS = [
  /instagram\.com\/(reel|reels|stories)\//i,
  /facebook\.com\/(reel|reels|watch|stories)\b/i,
  /youtube\.com\/shorts\//i,
  /reddit\.com\/r\/(memes|dankmemes|funny|meme|me_irl|shitposting|wholesomememes|prequelmemes|programmerhumor)\b/i,
];

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'];

// Stems match at the start of a word, so "cell" matches "cells" but not "excellent".
const ACADEMIC_PATTERNS = [...new Set(ACADEMIC_STEMS)].map(
  (stem) => new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
);

function academicHits(text) {
  const value = String(text || '');
  let hits = 0;
  for (const pattern of ACADEMIC_PATTERNS) if (pattern.test(value)) hits += 1;
  return hits;
}

/** Text checks shared by posts and comments. Returns a list of human-readable reasons. */
export function checkText(text, { strictAcademic = false } = {}) {
  const reasons = [];
  const value = String(text || '');
  if (BLOCKED_TERMS.some((re) => re.test(value))) {
    reasons.push('Memes, reels, giveaways and other non-academic content are not allowed on LetResearch.');
  }
  if (PROFANITY.some((re) => re.test(value))) {
    reasons.push('Please keep language professional – profanity and explicit words are not allowed.');
  }
  const laughs = (value.match(LAUGH_EMOJI) || []).length;
  if (laughs >= 3) reasons.push('Reaction-emoji posts look like memes. Describe the research instead.');

  const letters = value.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 24) {
    const upper = letters.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.75) reasons.push('Please avoid writing in all caps.');
  }

  const weak = WEAK_TERMS.filter((re) => re.test(value)).length + (laughs > 0 ? 1 : 0);
  const hits = academicHits(value);
  if (weak >= 2 || (weak >= 1 && hits === 0)) {
    reasons.push('This reads like entertainment content. LetResearch only allows research-related posts.');
  }
  if (strictAcademic && hits === 0) {
    reasons.push('Add a short description of the research context (what the image or video shows and why it matters).');
  }
  return [...new Set(reasons)];
}

export function checkLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return ['Enter a valid link that starts with http:// or https://.'];
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)) || BLOCKED_PATHS.some((re) => re.test(url))) {
    return ['Links to reels, short-video, meme or adult platforms are not allowed. Share research sources instead.'];
  }
  return [];
}

export function checkMediaFiles(files) {
  const reasons = [];
  const images = files.filter((f) => f.mimetype?.startsWith('image/'));
  const videos = files.filter((f) => f.mimetype?.startsWith('video/'));
  if (files.some((f) => f.mimetype === 'image/gif')) {
    reasons.push('Animated GIFs are not allowed. Share research figures or photos as JPG or PNG.');
  }
  if (
    files.some(
      (f) => !ALLOWED_IMAGE_TYPES.includes(f.mimetype) && !ALLOWED_VIDEO_TYPES.includes(f.mimetype) && f.mimetype !== 'image/gif',
    )
  ) {
    reasons.push('Only JPG, PNG, WEBP or HEIC images and MP4, MOV or WEBM videos are supported.');
  }
  if (videos.length > 1) reasons.push('You can attach one short video per post.');
  if (videos.length && images.length) reasons.push('Attach either images or one video, not both.');
  if (images.length > 4) reasons.push('You can attach up to 4 images per post.');
  if (videos.some((v) => v.size > config.limits.videoBytes)) {
    reasons.push(`Videos must be smaller than ${Math.round(config.limits.videoBytes / 1048576)} MB.`);
  }
  if (images.some((v) => v.size > config.limits.imageBytes)) {
    reasons.push(`Images must be smaller than ${Math.round(config.limits.imageBytes / 1048576)} MB.`);
  }
  return reasons;
}

/** Optional AI review of images and caption with Claude. Fails open if the service is unreachable. */
async function aiReview({ text, images }) {
  const { anthropicApiKey, anthropicModel } = config.moderation;
  if (!anthropicApiKey) return null;
  const supported = images
    .filter((f) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(f.mimetype) && f.size <= 5 * 1048576)
    .slice(0, 4);
  const content = supported.map((f) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: f.mimetype === 'image/jpg' ? 'image/jpeg' : f.mimetype,
      data: f.buffer.toString('base64'),
    },
  }));
  content.push({
    type: 'text',
    text:
      'You moderate LetResearch, a professional network for academic researchers. Decide whether this post is ' +
      'research-related (figures, charts, lab or field photos, equipment, posters, slides, conference photos, ' +
      'publications, datasets, academic events) or not (memes, jokes, reaction images, entertainment clips, ' +
      'advertising, selfies without research context, explicit or violent content). Reply with JSON only: ' +
      '{"academic": true|false, "reason": "one short sentence"}.\n\nCaption: ' +
      JSON.stringify(String(text || '').slice(0, 1500)),
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: anthropicModel, max_tokens: 150, messages: [{ role: 'user', content }] }),
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();
    const raw = (data.content || []).map((c) => c.text || '').join('');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const verdict = JSON.parse(match[0]);
    return { academic: verdict.academic !== false, reason: String(verdict.reason || '') };
  } catch {
    return null;
  }
}

/**
 * Runs every check for a new post. Returns { approved, reasons, checks }.
 * `files` are multer files (buffer, mimetype, size).
 */
export async function moderatePost({ kind, text, linkUrl, files = [] }) {
  const checks = ['rules'];
  const reasons = [];
  const minLength = kind === 'media' ? 20 : 10;
  if (String(text || '').trim().length < minLength) {
    reasons.push(
      kind === 'media'
        ? 'Describe what the photo or video shows in at least 20 characters.'
        : 'Write at least 10 characters so others understand your post.',
    );
  }
  reasons.push(...checkText(text, { strictAcademic: kind === 'media' }));
  if (kind === 'link' && linkUrl) reasons.push(...checkLink(linkUrl));
  if (kind === 'media') {
    if (!files.length) reasons.push('Attach at least one photo or a short video.');
    reasons.push(...checkMediaFiles(files));
  }
  // Links inside the text are checked too.
  for (const match of String(text || '').match(/https?:\/\/[^\s)]+/gi) || []) reasons.push(...checkLink(match));

  if (!reasons.length && kind === 'media') {
    const images = files.filter((f) => f.mimetype?.startsWith('image/'));
    if (images.length && config.moderation.anthropicApiKey) {
      checks.push('ai');
      const verdict = await aiReview({ text, images });
      if (verdict && !verdict.academic) {
        reasons.push(`This media does not look research-related${verdict.reason ? `: ${verdict.reason}` : '.'}`);
      }
    }
  }
  const unique = [...new Set(reasons)];
  return { approved: unique.length === 0, reasons: unique, checks };
}

export function moderateComment(text) {
  const reasons = [];
  if (!String(text || '').trim()) reasons.push('Write a comment first.');
  reasons.push(...checkText(text));
  for (const match of String(text || '').match(/https?:\/\/[^\s)]+/gi) || []) reasons.push(...checkLink(match));
  return [...new Set(reasons)];
}
