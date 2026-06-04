
interface StatusIndicatorProps {
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;
  fileName: string;
}

export default function StatusIndicator({ status, progress, fileName }: StatusIndicatorProps) {
  const shortName = fileName ? fileName.split('/').pop() : '';

  return (
    <div className="w-full bg-brand-card/30 border border-brand-border/60 rounded-xl p-4 text-center">
      {status === 'idle' && (
        <span className="text-xs font-medium text-slate-400 tracking-wide">Initializing Pipeline Execution...</span>
      )}
      
      {status === 'loading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-300 px-1">
            <span className="truncate max-w-[200px]">Downloading: {shortName}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-brand-bg rounded-full h-2 overflow-hidden p-0.5 border border-brand-border">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">Requires ~75MB initialization download. Cached indefinitely post-load.</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Fully Offline Capable
        </div>
      )}

      {status === 'error' && (
        <span className="text-xs font-bold text-rose-400 tracking-wide">Runtime Sandbox Exception Met</span>
      )}
    </div>
  );
}
