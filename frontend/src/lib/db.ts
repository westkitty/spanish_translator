// IndexedDB-backed project store. Persists each transcription (audio + Spanish
// transcript + English translation + edits) on-device so outputs survive a
// refresh and can be reopened later. No server, no cloud.

import type { CaptionWord } from '../components/CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';

export interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  durationSec: number;
  audioBlob: Blob;
  words: CaptionWord[];
  translation: Translation | null;
  /** Cached peak envelope [0..1] per bucket, used to render the waveform without
   *  re-decoding the full audio on project open. Optional — computed async after
   *  transcription and absent on projects saved before this field was added. */
  peaks?: number[];
}

export type ProjectMeta = Omit<StoredProject, 'audioBlob' | 'words' | 'translation'>;

const DB_NAME = 'spanish-whisper';
const STORE = 'projects';
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = fn(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      })
  );
}

export function putProject(project: StoredProject): Promise<void> {
  return tx('readwrite', (s) => s.put(project) as IDBRequest<any>).then(() => undefined);
}

export function getProject(id: string): Promise<StoredProject | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<StoredProject | undefined>);
}

export function deleteProject(id: string): Promise<void> {
  return tx('readwrite', (s) => s.delete(id) as IDBRequest<any>).then(() => undefined);
}

/** Returns lightweight metadata (no audio blobs), newest first. */
export function listProjects(): Promise<ProjectMeta[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<StoredProject[]>).then((all) =>
    all
      .map(({ id, name, createdAt, updatedAt, model, durationSec }) => ({
        id,
        name,
        createdAt,
        updatedAt,
        model,
        durationSec,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  );
}

export function newProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
