import type { FileInputProps } from './file-input.js';
import { FileInput } from './file-input.js';

export function VideoInput(props: Omit<FileInputProps, 'acceptTypes'>) {
  return <FileInput {...props} acceptTypes={['video']} />;
}
