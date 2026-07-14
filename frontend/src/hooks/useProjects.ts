import { useCallback, useEffect, useState } from 'react';
import {
  listProjects,
  getProject,
  putProject,
  deleteProject,
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

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setProjects(await listProjects());
      setStatus('idle');
    } catch (cause) {
      setStatus('error');
      setError(`Saved transcripts could not be loaded. ${messageFrom(cause)}`);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (project: StoredProject) => {
    setStatus('saving');
    setError(null);
    try {
      await putProject(project);
      setProjects(await listProjects());
      setStatus('idle');
    } catch (cause) {
      setStatus('error');
      setError(`This transcript was not saved. ${messageFrom(cause)}`);
      throw cause;
    }
  }, []);

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
      setProjects(await listProjects());
      setStatus('idle');
    } catch (cause) {
      setStatus('error');
      setError(`That transcript could not be deleted. ${messageFrom(cause)}`);
      throw cause;
    }
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    const existing = await getProject(id);
    if (!existing) return;
    await save({ ...existing, name, updatedAt: Date.now() });
  }, [save]);

  return { projects, status, error, refresh, save, open, remove, rename };
}
