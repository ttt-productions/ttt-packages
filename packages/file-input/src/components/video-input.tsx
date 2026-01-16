import type { FileInputProps } from "../types";
import { FileInput } from "./file-input";

export function VideoInput(props: Omit<FileInputProps, "acceptTypes">) {
  return <FileInput {...props} acceptTypes={["video"]} />;
}
