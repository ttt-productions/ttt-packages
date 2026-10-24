import type { FileInputProps } from './file-input.js';
import { FileInput } from './file-input.js';

export function ImageInput(props: Omit<FileInputProps, 'acceptTypes'>) {
  return <FileInput {...props} acceptTypes={['image']} />;
}
