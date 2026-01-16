import type { FileInputProps } from "../types";
import { FileInput } from "./file-input";

export function ImageInput(props: Omit<FileInputProps, "acceptTypes">) {
  return <FileInput {...props} acceptTypes={["image"]} />;
}
