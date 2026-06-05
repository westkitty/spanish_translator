import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { putProject, getProject, listProjects, deleteProject, newProjectId } from './db';

const make = (id: string, name: string, updatedAt: number) => ({
  id,
  name,
  createdAt: updatedAt,
  updatedAt,
  model: 'Xenova/whisper-base',
  durationSec: 12,
  audioBlob: new Blob(['x']),
  words: [{ id: 'w0', text: 'hola', start: 0, end: 1 }],
  translation: { text: 'hello', segments: [{ id: 's0', text: 'hello', start: 0, end: 1 }] },
});

describe('db', () => {
  it('stores and retrieves a project with its blob', async () => {
    await putProject(make('a', 'Clip A', 100));
    const got = await getProject('a');
    expect(got?.name).toBe('Clip A');
    expect(got?.audioBlob).toBeInstanceOf(Blob);
    expect(got?.words[0].text).toBe('hola');
  });

  it('lists metadata newest-first without blobs', async () => {
    await putProject(make('b', 'Older', 50));
    await putProject(make('c', 'Newer', 200));
    const list = await listProjects();
    const ids = list.map((p) => p.id);
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('b'));
    expect((list[0] as any).audioBlob).toBeUndefined();
  });

  it('deletes a project', async () => {
    await putProject(make('d', 'Temp', 10));
    await deleteProject('d');
    expect(await getProject('d')).toBeUndefined();
  });

  it('generates unique ids', () => {
    expect(newProjectId()).not.toBe(newProjectId());
  });
});
