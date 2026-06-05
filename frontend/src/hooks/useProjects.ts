import { useCallback, useEffect, useState } from 'react';
import {
  listProjects,
  getProject,
  putProject,
  deleteProject,
  type ProjectMeta,
  type StoredProject,
} from '../lib/db';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (project: StoredProject) => {
      await putProject(project);
      await refresh();
    },
    [refresh]
  );

  const open = useCallback((id: string) => getProject(id), []);

  const remove = useCallback(
    async (id: string) => {
      await deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const existing = await getProject(id);
      if (existing) {
        await putProject({ ...existing, name, updatedAt: Date.now() });
        await refresh();
      }
    },
    [refresh]
  );

  return { projects, refresh, save, open, remove, rename };
}
