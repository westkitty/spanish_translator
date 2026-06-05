// Saves a text file. On a native device (Capacitor) it writes to the app's
// Documents and opens the share sheet so the user can keep it in Files or send
// it anywhere. On the web it falls back to a normal browser download.

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function browserDownload(fileName: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function browserBlobDownload(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.replace(/^data:.*;base64,/, ''));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function saveTextFile(
  fileName: string,
  mime: string,
  content: string
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    browserDownload(fileName, mime, content);
    return;
  }

  const result = await Filesystem.writeFile({
    path: fileName,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  try {
    await Share.share({
      title: fileName,
      text: `Transcript: ${fileName}`,
      url: result.uri,
    });
  } catch {
    // User dismissed the share sheet — the file is still saved to Documents.
  }
}

export async function saveBlobFile(fileName: string, blob: Blob): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    browserBlobDownload(fileName, blob);
    return;
  }

  const result = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(blob),
    directory: Directory.Documents,
    recursive: true,
  });

  try {
    await Share.share({
      title: fileName,
      text: `Audio clip: ${fileName}`,
      url: result.uri,
    });
  } catch {
    // User dismissed the share sheet — the file is still saved to Documents.
  }
}
