import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';

const SHORTCUTS = [
  { keys: 'Space', action: 'Play or pause when retained source audio is available and focus is not on a control.' },
  { keys: '← / →', action: 'Seek backward or forward 5 seconds when retained source audio is available.' },
  { keys: 'Esc', action: 'Close the active dialog or popover.' },
  { keys: 'Tab', action: 'Move through controls using native focus order.' },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shortcut-help">
      <button type="button" onClick={() => setOpen(true)} className="shortcut-help__trigger" aria-label="Open keyboard shortcuts"><Keyboard className="w-5 h-5" aria-hidden="true" /></button>
      <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" labelledBy="shortcut-help-title">
        <p className="shortcut-help__subtitle">Shortcuts never replace the native keyboard behavior of a focused button, link, input, or menu.</p>
        <dl className="shortcut-help__list">{SHORTCUTS.map((shortcut) => <div key={shortcut.keys} className="shortcut-help__row"><dt><kbd>{shortcut.keys}</kbd></dt><dd>{shortcut.action}</dd></div>)}</dl>
      </Modal>
    </div>
  );
}
