import { ShortcutHelp } from './ShortcutHelp';
import { ThemePicker } from './ThemePicker';

export function ShellTools() {
  return (
    <div className="header-tools-shell">
      <ThemePicker />
      <ShortcutHelp />
    </div>
  );
}
