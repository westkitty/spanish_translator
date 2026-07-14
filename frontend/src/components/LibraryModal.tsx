import { useState } from 'react';
import { AlertTriangle, Clock, FileAudio, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import type { ProjectMeta } from '../lib/db';
import type { ProjectStoreStatus } from '../hooks/useProjects';

interface LibraryModalProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectMeta[];
  status: ProjectStoreStatus;
  error: string | null;
  onRetry: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => Promise<void> | void;
}

function relativeDate(ms: number): string {
  const date = new Date(ms);
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function LibraryModal({
  open,
  onClose,
  projects,
  status,
  error,
  onRetry,
  onOpenProject,
  onDeleteProject,
}: LibraryModalProps) {
  const [pendingDelete, setPendingDelete] = useState<ProjectMeta | null>(null);
  const loading = status === 'loading';

  return (
    <Modal open={open} onClose={onClose} title="Saved transcripts" labelledBy="library-title">
      {error && (
        <div className="state-message state-message--error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Library unavailable</strong>
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="secondary-button">Try again</button>
          </div>
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="empty-state" role="status">
          <Loader2 className="animate-spin" aria-hidden="true" />
          <p>Loading saved transcripts…</p>
        </div>
      ) : projects.length === 0 && !error ? (
        <div className="empty-state">
          <FolderOpen aria-hidden="true" />
          <h3>Nothing saved yet</h3>
          <p>Completed transcripts appear here after they are saved on this device.</p>
        </div>
      ) : (
        <div className="library-list">
          {projects.map((project) => (
            <div key={project.id} className="library-row">
              <FileAudio aria-hidden="true" />
              <button type="button" onClick={() => onOpenProject(project.id)} className="library-row__open">
                <strong>{project.name}</strong>
                <span><Clock aria-hidden="true" /> {relativeDate(project.updatedAt)} · {duration(project.durationSec)}</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(project)}
                aria-label={`Delete ${project.name}`}
                className="icon-button icon-button--danger"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="delete-confirmation" role="alertdialog" aria-labelledby="delete-project-title">
          <h3 id="delete-project-title">Delete “{pendingDelete.name}”?</h3>
          <p>The transcript, translation, edits, and any retained source audio will be permanently removed.</p>
          <div className="dialog-actions">
            <button type="button" onClick={() => setPendingDelete(null)} className="secondary-button">Cancel</button>
            <button
              type="button"
              onClick={async () => {
                await onDeleteProject(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="danger-button"
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
