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
export type ProjectStoreErrorAction = 'load' | 'save' | 'open' | 'delete';
export interface ProjectStoreError {
  action: ProjectStoreErrorAction;
  message: string;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [status, setStatus] = useState<ProjectStoreStatus>('idle');
  const [error, setError] = useState<ProjectStoreError | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationsRef = useRef(0);
  const deletedIdsRef = useRef(new Set<string>());

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
      setError({ action: 'load', message: `Saved transcripts could not be loaded. ${messageFrom(cause)}` });
    }
  }, [loadProjects]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback((project: StoredProject): Promise<void> => {
    if (deletedIdsRef.current.has(project.id)) {
      const cause = new Error('This transcript was deleted and will not be recreated by autosave.');
      setStatus('error');
      setError({ action: 'save', message: cause.message });
      return Promise.reject(cause);
    }

    pendingMutationsRef.current += 1;
    setStatus('saving');
    setError(null);

    const operation = mutationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (deletedIdsRef.current.has(project.id)) {
          throw new Error('This transcript was deleted and will not be recreated by autosave.');
        }
        await putProject(project);
        await loadProjects();
      });

    mutationQueueRef.current = operation;
    return operation.then(
      () => {
        pendingMutationsRef.current -= 1;
        if (pendingMutationsRef.current === 0) setStatus('idle');
      },
      (cause) => {
        pendingMutationsRef.current -= 1;
        setStatus('error');
        setError({ action: 'save', message: `This transcript was not saved. ${messageFrom(cause)}` });
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
      setError({ action: 'open', message: `That saved transcript could not be opened. ${messageFrom(cause)}` });
      return undefined;
    }
  }, []);

  const remove = useCallback((id: string): Promise<void> => {
    deletedIdsRef.current.add(id);
    pendingMutationsRef.current += 1;
    setStatus('deleting');
    setError(null);

    const operation = mutationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await deleteProject(id);
        await loadProjects();
      });

    mutationQueueRef.current = operation;
    return operation.then(
      () => {
        pendingMutationsRef.current -= 1;
        if (pendingMutationsRef.current === 0) setStatus('idle');
      },
      (cause) => {
        deletedIdsRef.current.delete(id);
        pendingMutationsRef.current -= 1;
        setStatus('error');
        setError({ action: 'delete', message: `That transcript could not be deleted. ${messageFrom(cause)}` });
        throw cause;
      }
    );
  }, [loadProjects]);

  const rename = useCallback(async (id: string, name: string) => {
    const existing = await getProject(id);
    if (!existing) return;
    await save({ ...existing, name, updatedAt: Date.now() });
  }, [save]);

  return { projects, status, error, refresh, save, open, remove, rename };
}
