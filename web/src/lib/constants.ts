// Mirrors the server's academic categories and community guidelines.

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
] as const;

export const ALLOWED = [
  'Research updates, findings and work in progress',
  'Publications, preprints, datasets and code',
  'Figures, charts, lab and field photos, posters and talks',
  'Conference news, calls for collaboration and academic questions',
];

export const NOT_ALLOWED = [
  'Memes, reels, jokes and reaction images',
  'Entertainment clips and links to short-video platforms',
  'Giveaways, advertising and spam',
  'Profanity, harassment and explicit content',
];

export const GUIDELINES = [
  'Share research: updates, publications, preprints, datasets, methods, events and academic questions.',
  'Photos and short videos must show research context – figures, lab or field work, equipment, posters or talks.',
  'Memes, reels, jokes, reaction images, giveaways, ads and explicit content are removed.',
  'Keep language professional and respectful. Critique ideas, not people.',
  'Only share papers you authored or have the right to share.',
];

export const MAX_VIDEO_SECONDS = 90;
