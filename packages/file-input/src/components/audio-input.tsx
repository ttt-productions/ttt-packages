import type { FileInputProps } from "../types";
import { FileInput } from "./file-input";

export function AudioInput(props: Omit<FileInputProps, "acceptTypes">) {
  return <FileInput {...props} acceptTypes={["audio"]} />;
}
