export const REQUIRED_TOKENS = [
    "--brand-primary",
    "--brand-secondary",
    "--brand-accent",
  
    "--status-success",
    "--status-warning",
    "--status-error"
  ] as const;
  
  export type RequiredToken = (typeof REQUIRED_TOKENS)[number];
  