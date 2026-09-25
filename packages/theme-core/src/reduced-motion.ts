/**
 * The `<html>` attribute the reduced-motion store sets to `"true"` while motion is reduced. The
 * app's CSS kill switch keys on `:root[data-reduced-motion='true']`, beside an
 * `@media (prefers-reduced-motion: reduce)` block that covers the paint before the store runs.
 */
export const REDUCED_MOTION_ATTRIBUTE = "data-reduced-motion";
