import { Client } from "@blockshub/blocksdirecte";
import { Directory, File, Paths } from "expo-file-system";

// École Directe file downloads require an authenticated POST (X-Token
// header), so a plain URL can't be handed to a browser like other
// services' attachments — the bytes have to be fetched through the
// client and saved locally first.
export async function downloadEDAttachment(
  session: Client,
  fileId: string,
  fileType: string,
  fileName: string
): Promise<string> {
  const file = new File(new Directory(Paths.document, "ed-attachments"), `${fileId}-${fileName}`);
  if (file.exists) {
    return file.uri;
  }

  const stream = await session.downloader.getStream(Number(fileId), fileType);
  if (!stream) {
    throw new Error(`Failed to download attachment ${fileId}: empty response`);
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  file.create({ intermediates: true });
  file.write(bytes);
  return file.uri;
}
