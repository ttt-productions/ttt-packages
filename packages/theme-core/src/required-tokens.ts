export const REQUIRED_TOKENS = [
  "--brand-primary",
  "--brand-secondary",
  "--brand-accent",
] as const;

export type RequiredToken = (typeof REQUIRED_TOKENS)[number];
