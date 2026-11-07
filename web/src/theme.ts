// Colour values for places that need them in JavaScript (icon colours, inline tints).
// They mirror the CSS custom properties in styles/global.css.
export const colors = {
  bg: '#E9EBEE',
  bgDeep: '#DEE1E5',
  surface: '#F8F9FA',
  surfaceRaised: '#FFFFFF',
  ink: '#23272E',
  inkSoft: '#3A4049',
  text2: '#5F6772',
  text3: '#8A919B',
  hairline: '#D6DAE0',
  border: '#C7CDD5',
  silver: '#B9BFC8',
  accent: '#2F6F68',
  accentSoft: '#DCEAE7',
  steel: '#46607F',
  steelSoft: '#DFE6EF',
  danger: '#B3403A',
  dangerSoft: '#F5E2E0',
  like: '#C2414B',
  success: '#2E7D5B',
  successSoft: '#DDEEE6',
  warning: '#8F6512',
  warningSoft: '#F4EAD5',
  white: '#FFFFFF',
} as const;

/** Layout widths for tablets and desktop browsers. */
export const layout = {
  wideBreakpoint: 900,
  sidebarWidth: 248,
  feedWidth: 680,
  pageWidth: 880,
  formWidth: 640,
} as const;
