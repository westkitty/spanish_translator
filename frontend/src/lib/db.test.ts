import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteProject, getProject, listProjects, putProject, type StoredProject } from './db';

function project(id: string, updatedAt: number, audioSize = 0): StoredProject {
  return {
    id,
    name: `Project ${id}`,
    createdAt: 1,
    updatedAt,
    model: 'Xenova/whisper-base',
    durationSec: 12,
    audioBlob: new Blob([new Uint8Array(audioSize)], { type: 'audio/wav' }),
    words: [{ id: 'word-0', text: 'hola', start: 0, end: 1 }],
    translation: null,
  };
}

async function clearDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('dexterpreter');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
  });
}

afterEach(clearDatabase);

describe('project database', () => {
  it('commits project data and lightweight metadata together', async () => {
    await putProject(project('one', 20, 8));
    const stored = await getProject('one');
    expect(stored?.audioBlob.size).toBe(8);
    expect(await listProjects()).toEqual([
      expect.objectContaining({ id: 'one', updatedAt: 20, hasAudio: true }),
    ]);
    expect((await listProjects())[0]).not.toHaveProperty('audioBlob');
  });

  it('sorts metadata newest first and deletes both stores', async () => {
    await putProject(project('old', 10));
    await putProject(project('new', 30));
    expect((await listProjects()).map((item) => item.id)).toEqual(['new', 'old']);
    await deleteProject('new');
    expect(await getProject('new')).toBeUndefined();
    expect((await listProjects()).map((item) => item.id)).toEqual(['old']);
  });
});
