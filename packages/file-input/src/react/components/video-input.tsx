import type { FileInputProps } from "../../types.js";
import { FileInput } from "./file-input.js";

export function VideoInput(props: Omit<FileInputProps, "acceptTypes">) {
  return <FileInput {...props} acceptTypes={["video"]} />;
}
