import React, { useState } from 'react';
import { api, ApiError } from '../api';

export default function TokenScreen({ onLogin }) {
  const [token, setToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Invalid admin token.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem('adminToken', token.trim());
      await api.getKeys();
      onLogin();
    } catch (err) {
      sessionStorage.removeItem('adminToken');
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid admin token.');
      } else {
        setError('Could not reach the gateway.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-surface flex flex-col justify-center items-center px-margin">
      <div className="flex flex-col w-full items-center justify-center p-margin">
        <div className="relative w-full max-w-[420px] bg-surface-container-low rounded-lg shadow-xl p-space-xl flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">LLMGate</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Enter Admin Token to continue to gateway dashboard
            </p>
          </div>
          
          <form className="flex flex-col gap-space-md" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label className="font-label-code-md text-label-code-md text-on-surface-variant flex items-center justify-between" htmlFor="admin-token">
                <span>Admin token</span>
              </label>
              <div className="relative flex items-center">
                <input 
                  id="admin-token" 
                  name="admin-token" 
                  type={showPassword ? "text" : "password"} 
                  className="w-full bg-surface-container-lowest text-on-surface font-label-code-lg text-label-code-lg px-3 py-2 rounded focus:outline-none focus:bg-surface-container-high transition-colors tracking-widest" 
                  placeholder="••••••••••••••••••••••••" 
                  spellCheck="false" 
                  value={token}
                  onChange={e => setToken(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle token visibility" 
                  className="absolute right-2.5 text-outline hover:text-on-surface flex items-center justify-center focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
            
            {error && (
              <div className="flex items-start gap-2 bg-error-container/20 px-2.5 py-2 rounded">
                <span className="material-symbols-outlined text-error text-[15px] mt-0.5 shrink-0">error</span>
                <div className="flex-1 flex flex-col">
                  <span className="font-label-code-sm text-label-code-sm text-error leading-tight">
                    {error}
                  </span>
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full bg-primary hover:bg-[#6dfbc0] text-on-primary font-label-code-md text-label-code-md py-2.5 rounded font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer mt-1 ${loading ? 'opacity-80 pointer-events-none' : ''}`}
            >
              <span>{loading ? 'Authenticating...' : 'Continue'}</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
