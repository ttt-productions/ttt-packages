// Server-safe entry: no React. React code lives at `@ttt-productions/upload-ui/react/guard`,
// `/react/upload`, and `/react/tray`.
export { formatFileSize, createUploadDisplayFormatters } from './upload-display.js';
export type {
  UploadDisplayCopy,
  UploadDisplayConfig,
  UploadDisplayFormatters,
} from './upload-display.js';
