// IndexedDB-backed project store. Projects and lightweight metadata are kept in
// separate stores so opening the library never clones every retained audio blob
// into memory. Version 2 migrates existing projects into the metadata store.

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
  peaks?: number[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  durationSec: number;
  hasAudio: boolean;
}

const DB_NAME = 'dexterpreter';
const PROJECTS_STORE = 'projects';
const META_STORE = 'projectMeta';
const VERSION = 2;

function toMeta(project: StoredProject): ProjectMeta {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    model: project.model,
    durationSec: project.durationSec,
    hasAudio: project.audioBlob.size > 0,
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      if (!transaction) return;

      const projects = db.objectStoreNames.contains(PROJECTS_STORE)
        ? transaction.objectStore(PROJECTS_STORE)
        : db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });

      if (!projects.indexNames.contains('updatedAt')) {
        projects.createIndex('updatedAt', 'updatedAt');
      }

      const metadata = db.objectStoreNames.contains(META_STORE)
        ? transaction.objectStore(META_STORE)
        : db.createObjectStore(META_STORE, { keyPath: 'id' });

      if (!metadata.indexNames.contains('updatedAt')) {
        metadata.createIndex('updatedAt', 'updatedAt');
      }

      if (event.oldVersion < 2) {
        const cursorRequest = projects.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          metadata.put(toMeta(cursor.value as StoredProject));
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    request.onblocked = () => reject(new Error('Storage upgrade is blocked by another open Dexterpreter window.'));
  });
}

function requestValue<T>(storeName: string, mode: IDBTransactionMode, createRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = createRequest(transaction.objectStore(storeName));
    let value: T;
    let settled = false;

    const fail = (error: DOMException | null | undefined) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error ?? new Error('IndexedDB transaction failed.'));
    };

    request.onsuccess = () => { value = request.result; };
    request.onerror = () => fail(request.error);
    transaction.onabort = () => fail(transaction.error ?? request.error);
    transaction.onerror = () => fail(transaction.error ?? request.error);
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      resolve(value!);
    };
  }));
}

export function putProject(project: StoredProject): Promise<void> {
  return openDB().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      db.close();
      reject(transaction.error ?? new Error('Project save transaction failed.'));
    };
    transaction.objectStore(PROJECTS_STORE).put(project);
    transaction.objectStore(META_STORE).put(toMeta(project));
    transaction.onabort = fail;
    transaction.onerror = fail;
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      resolve();
    };
  }));
}

export function getProject(id: string): Promise<StoredProject | undefined> {
  return requestValue(PROJECTS_STORE, 'readonly', (store) => store.get(id) as IDBRequest<StoredProject | undefined>);
}

export function deleteProject(id: string): Promise<void> {
  return openDB().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([PROJECTS_STORE, META_STORE], 'readwrite');
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      db.close();
      reject(transaction.error ?? new Error('Project deletion transaction failed.'));
    };
    transaction.objectStore(PROJECTS_STORE).delete(id);
    transaction.objectStore(META_STORE).delete(id);
    transaction.onabort = fail;
    transaction.onerror = fail;
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      db.close();
      resolve();
    };
  }));
}

export function listProjects(): Promise<ProjectMeta[]> {
  return requestValue(META_STORE, 'readonly', (store) => store.getAll() as IDBRequest<ProjectMeta[]>).then((all) =>
    all.sort((a, b) => b.updatedAt - a.updatedAt)
  );
}

export function newProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
