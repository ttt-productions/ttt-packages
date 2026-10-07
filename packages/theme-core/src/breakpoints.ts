/**
 * The first non-mobile pixel width, where Tailwind's `md:` breakpoint starts. Mobile is every width
 * below it: query `max-width: ${MOBILE_BREAKPOINT - 1}px` for mobile, `min-width: ${MOBILE_BREAKPOINT}px`
 * for everything else.
 */
export const MOBILE_BREAKPOINT = 768;
