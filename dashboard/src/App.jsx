import React, { useState, useEffect } from 'react';
import TokenScreen from './screens/TokenScreen';
import OverviewScreen from './screens/OverviewScreen';
import KeysScreen from './screens/KeysScreen';
import LogsScreen from './screens/LogsScreen';
import Sidebar from './components/Sidebar';

function App() {
  const [hasToken, setHasToken] = useState(!!sessionStorage.getItem('adminToken'));
  const [currentView, setCurrentView] = useState('overview');

  useEffect(() => {
    const handleUnauthorized = () => setHasToken(false);
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  if (!hasToken) {
    return <TokenScreen onLogin={() => setHasToken(true)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'overview': return <OverviewScreen />;
      case 'keys': return <KeysScreen />;
      case 'logs': return <LogsScreen />;
      default: return <OverviewScreen />;
    }
  };

  return (
    <div className="pl-64 min-h-screen">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} onLogout={() => {
        sessionStorage.removeItem('adminToken');
        setHasToken(false);
      }} />
      <header className="fixed top-0 left-64 right-0 h-14 bg-surface/80 backdrop-blur-xl z-40"></header>
      <main className="w-full pt-14 px-margin bg-surface">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
