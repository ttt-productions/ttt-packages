import type { DeleteFileArgs } from "../types";
import { deleteObject, ref } from "firebase/storage";

export async function deleteFile(args: DeleteFileArgs): Promise<void> {
  const { storage, path } = args;
  await deleteObject(ref(storage, path));
}
