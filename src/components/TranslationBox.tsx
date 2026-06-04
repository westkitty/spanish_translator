
interface TranslationBoxProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  isReadOnly: boolean;
}

export default function TranslationBox({ label, placeholder, value, onChange, isReadOnly }: TranslationBoxProps) {
  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="w-full bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col h-48 focus-within:border-blue-500/60 transition-colors shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest font-bold text-slate-400">{label}</span>
        {isReadOnly && value && (
          <button 
            onClick={handleCopy}
            className="text-xs text-blue-400 hover:text-blue-300 active:scale-90 transition-transform px-2 py-1 bg-brand-bg/50 rounded border border-brand-border cursor-pointer"
          >
            Copy
          </button>
        )}
      </div>
      <textarea
        className="w-full flex-grow bg-transparent text-white placeholder-slate-500 resize-none outline-none text-base leading-relaxed"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={isReadOnly}
      />
    </div>
  );
}
