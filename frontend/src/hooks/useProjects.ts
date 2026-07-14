import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteProject,
  getProject,
  listProjects,
  putProject,
  type ProjectMeta,
  type StoredProject,
} from '../lib/db';

export type ProjectStoreStatus = 'idle' | 'loading' | 'saving' | 'deleting' | 'error';

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [status, setStatus] = useState<ProjectStoreStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSavesRef = useRef(0);

  const loadProjects = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      await loadProjects();
      setStatus('idle');
    } catch (cause) {
      setStatus('error');
      setError(`Saved transcripts could not be loaded. ${messageFrom(cause)}`);
    }
  }, [loadProjects]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback((project: StoredProject): Promise<void> => {
    pendingSavesRef.current += 1;
    setStatus('saving');
    setError(null);

    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await putProject(project);
        await loadProjects();
      });

    saveQueueRef.current = operation;
    return operation.then(
      () => {
        pendingSavesRef.current -= 1;
        if (pendingSavesRef.current === 0) setStatus('idle');
      },
      (cause) => {
        pendingSavesRef.current -= 1;
        setStatus('error');
        setError(`This transcript was not saved. ${messageFrom(cause)}`);
        throw cause;
      }
    );
  }, [loadProjects]);

  const open = useCallback(async (id: string) => {
    setError(null);
    try {
      return await getProject(id);
    } catch (cause) {
      setStatus('error');
      setError(`That saved transcript could not be opened. ${messageFrom(cause)}`);
      return undefined;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setStatus('deleting');
    setError(null);
    try {
      await deleteProject(id);
      await loadProjects();
      setStatus('idle');
    } catch (cause) {
      setStatus('error');
      setError(`That transcript could not be deleted. ${messageFrom(cause)}`);
      throw cause;
    }
  }, [loadProjects]);

  const rename = useCallback(async (id: string, name: string) => {
    const existing = await getProject(id);
    if (!existing) return;
    await save({ ...existing, name, updatedAt: Date.now() });
  }, [save]);

  return { projects, status, error, refresh, save, open, remove, rename };
}
