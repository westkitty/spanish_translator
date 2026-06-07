import { FolderOpen, Trash2, Clock, FileAudio } from 'lucide-react';
import { Modal } from './Modal';
import type { ProjectMeta } from '../lib/db';

interface LibraryModalProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectMeta[];
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

function relativeDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function LibraryModal({ open, onClose, projects, onOpenProject, onDeleteProject }: LibraryModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Your saved transcripts" labelledBy="library-title">
      {projects.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">Nothing saved yet</p>
          <p className="text-[11px] mt-1">Transcribe a file and it’ll be saved here automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/20 flex items-center justify-center">
                <FileAudio className="w-4 h-4 text-sky-300" />
              </div>
              <button
                onClick={() => onOpenProject(p.id)}
                className="flex-grow text-left overflow-hidden cursor-pointer"
              >
                <p className="text-[13px] font-semibold text-slate-100 truncate">{p.name}</p>
                <p className="text-[11px] font-mono mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-subtle)' }}>
                  <Clock className="w-3 h-3" /> {relativeDate(p.updatedAt)} · {fmtDuration(p.durationSec)}
                </p>
              </button>
              <button
                onClick={() => onDeleteProject(p.id)}
                aria-label={`Delete ${p.name}`}
                className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
