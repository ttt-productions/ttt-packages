import type { FileInputProps } from "../types.js";
import { FileInput } from "./file-input.js";

export function ImageInput(props: Omit<FileInputProps, "acceptTypes">) {
  return <FileInput {...props} acceptTypes={["image"]} />;
}
