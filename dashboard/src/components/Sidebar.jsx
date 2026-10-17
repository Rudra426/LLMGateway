import React from 'react';

export default function Sidebar({ currentView, setCurrentView, onLogout }) {
  const navItemClass = (view) => {
    const base = "px-space-sm py-space-xs rounded transition-colors ";
    if (view === currentView) {
      return base + "bg-surface-container-high text-on-surface font-medium";
    }
    return base + "font-label-code-lg text-label-code-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container";
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-container-lowest flex flex-col justify-between p-space-lg select-none z-50">
      <div className="flex flex-col gap-space-xl">
        <div className="px-space-sm pt-space-xs">
          <span className="font-headline-md text-headline-md tracking-tight text-on-surface font-semibold">LLMGate</span>
        </div>
        <nav className="flex flex-col gap-space-xs">
          <button onClick={() => setCurrentView('overview')} className={navItemClass('overview')} type="button" style={{textAlign: 'left'}}>Overview</button>
          <button onClick={() => setCurrentView('keys')} className={navItemClass('keys')} type="button" style={{textAlign: 'left'}}>Keys</button>
          <button onClick={() => setCurrentView('logs')} className={navItemClass('logs')} type="button" style={{textAlign: 'left'}}>Logs</button>
        </nav>
      </div>
      <div className="pt-space-md">
        <button 
          onClick={onLogout}
          className="w-full text-left px-space-sm py-space-xs rounded font-label-code-lg text-label-code-lg text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors" 
          type="button"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
