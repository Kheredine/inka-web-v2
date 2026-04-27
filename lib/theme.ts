export const colors = {
  primary:         '#E8902A',
  secondary:       '#E8902A',
  accent:          '#E8902A',
  accentMuted:     'rgba(232, 144, 42, 0.15)',
  background:      '#0d0d0d',
  surface:         '#1a1a1a',
  surfaceElevated: '#242424',
  textPrimary:     '#F0EDE8',
  textSecondary:   '#8A8680',
  textMuted:       '#4A4744',
  success:         '#4CAF50',
  error:           '#CF6679',
  border:          'rgba(255,255,255,0.08)',
  borderHover:     'rgba(255,255,255,0.14)',
} as const

export const gradients = {
  primary: ['#E8902A', '#B8701E'] as string[],
  card:    ['#1a1a1a', '#0d0d0d'] as string[],
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
} as const

export const typography = {
  xs:   { fontSize: 11, lineHeight: 16 },
  sm:   { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 15, lineHeight: 22 },
  md:   { fontSize: 17, lineHeight: 24 },
  lg:   { fontSize: 20, lineHeight: 28 },
  xl:   { fontSize: 24, lineHeight: 32 },
  xxl:  { fontSize: 30, lineHeight: 38 },
} as const
