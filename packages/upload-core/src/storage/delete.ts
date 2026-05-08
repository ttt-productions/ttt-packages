import type { DeleteFileArgs } from "../browser/types.js";
import { deleteObject, ref } from "firebase/storage";

export async function deleteFile(args: DeleteFileArgs): Promise<void> {
  const { storage, path } = args;
  await deleteObject(ref(storage, path));
}
