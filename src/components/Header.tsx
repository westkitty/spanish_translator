
interface HeaderProps {
  isEnglishToSpanish: boolean;
  onToggle: () => void;
  onClear: () => void;
}

export default function Header({ isEnglishToSpanish, onToggle, onClear }: HeaderProps) {
  return (
    <header className="w-full flex items-center justify-between border-b border-brand-border pb-4">
      <div className="flex items-center gap-3">
        <span className="font-bold text-sm tracking-wider uppercase bg-brand-card px-3 py-1.5 rounded-md border border-brand-border text-blue-400">
          {isEnglishToSpanish ? 'EN' : 'ES'}
        </span>
        <button 
          onClick={onToggle}
          className="p-2 bg-brand-card hover:bg-slate-800 rounded-full border border-brand-border active:scale-95 transition-transform cursor-pointer"
          aria-label="Toggle Language Direction"
        >
          ⇄
        </button>
        <span className="font-bold text-sm tracking-wider uppercase bg-brand-card px-3 py-1.5 rounded-md border border-brand-border text-emerald-400">
          {isEnglishToSpanish ? 'ES' : 'EN'}
        </span>
      </div>
      
      <button 
        onClick={onClear}
        className="text-xs tracking-widest uppercase font-semibold text-slate-400 hover:text-white px-3 py-2 bg-brand-card/50 rounded-md border border-brand-border/40 active:scale-95 transition-transform cursor-pointer"
      >
        Clear
      </button>
    </header>
  );
}
