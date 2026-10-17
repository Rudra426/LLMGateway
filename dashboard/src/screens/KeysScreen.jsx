import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function KeysScreen() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form state
  const [label, setLabel] = useState('');
  const [userId, setUserId] = useState('');
  const [rpmLimit, setRpmLimit] = useState('');
  const [budget, setBudget] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [createdKeyRaw, setCreatedKeyRaw] = useState('');
  
  // Modal state
  const [revokeKey, setRevokeKey] = useState(null); // the key object to revoke
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getKeys();
      setKeys(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    return () => setCreatedKeyRaw(''); // clear on leave
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!label.trim() || !userId.trim()) {
      setFormError('Label and User ID are required.');
      return;
    }
    const rpm = rpmLimit ? parseInt(rpmLimit, 10) : undefined;
    const bdg = budget ? parseFloat(budget) : undefined;
    
    if (rpmLimit && (isNaN(rpm) || rpm <= 0)) return setFormError('RPM limit must be positive.');
    if (budget && (isNaN(bdg) || bdg <= 0)) return setFormError('Budget must be positive.');
    
    try {
      setCreating(true);
      const res = await api.createKey({ label, userId, rpmLimit: rpm, dailyBudgetINR: bdg });
      setCreatedKeyRaw(res.key);
      setLabel('');
      setUserId('');
      setRpmLimit('');
      setBudget('');
      fetchKeys();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeKey) return;
    try {
      setRevoking(true);
      await api.revokeKey(revokeKey._id);
      setRevokeKey(null);
      fetchKeys();
    } catch (err) {
      alert(err.message);
    } finally {
      setRevoking(false);
    }
  };

  const activeCount = keys.filter(k => !k.revoked).length;
  const revokedCount = keys.length - activeCount;

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pt-space-xs pb-space-sm border-b border-surface-container-high/40">
        <div className="flex items-center gap-space-md">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Keys</h1>
        </div>
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container-low border border-surface-container-high font-label-code-sm text-label-code-sm">
            <span className="text-on-surface-variant"><strong className="text-on-surface">{keys.length}</strong> total</span>
            <span className="text-surface-container-high">|</span>
            <span className="text-on-surface-variant"><strong className="text-primary">{activeCount}</strong> active</span>
            <span className="text-surface-container-high">|</span>
            <span className="text-on-surface-variant"><strong className="text-on-surface-variant">{revokedCount}</strong> revoked</span>
          </div>
        </div>
      </div>

      {createdKeyRaw && (
        <div className="p-space-lg bg-primary/10 border border-primary/30 rounded flex flex-col gap-space-md">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary mt-0.5">check_circle</span>
            <div className="flex-1">
              <h3 className="font-headline-md text-primary font-semibold">Key created successfully</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                <span className="text-error font-medium">This key will not be shown again.</span> Please copy it now.
              </p>
            </div>
            <button onClick={() => setCreatedKeyRaw('')} className="px-3 py-1.5 rounded font-label-code-md text-label-code-md bg-surface-container-highest hover:bg-surface-container-high text-on-surface transition-colors">
              Done
            </button>
          </div>
          <div className="flex items-center gap-2 bg-surface p-2 rounded border border-surface-container-high">
            <code className="flex-1 font-label-code-lg text-label-code-lg text-on-surface select-all overflow-x-auto whitespace-nowrap">
              {createdKeyRaw}
            </code>
          </div>
        </div>
      )}

      <div className="p-space-lg bg-surface-container-low border border-surface-container-high/60 rounded">
        <h2 className="font-headline-md text-body-lg font-medium text-on-surface mb-space-md">Create key</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-space-md items-end">
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="font-label-code-md text-label-code-md text-on-surface-variant">Label (required)</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. prod-backend" className="w-full bg-surface-container text-on-surface font-label-code-md text-label-code-md px-2.5 py-1.5 rounded border border-surface-container-high focus:border-secondary focus:outline-none transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="font-label-code-md text-label-code-md text-on-surface-variant">User ID (required)</label>
            <input type="text" value={userId} onChange={e => setUserId(e.target.value)} placeholder="e.g. user_123" className="w-full bg-surface-container text-on-surface font-label-code-md text-label-code-md px-2.5 py-1.5 rounded border border-surface-container-high focus:border-secondary focus:outline-none transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="font-label-code-md text-label-code-md text-on-surface-variant">RPM Limit</label>
            <input type="number" value={rpmLimit} onChange={e => setRpmLimit(e.target.value)} placeholder="60 (default)" className="w-full bg-surface-container text-on-surface font-label-code-md text-label-code-md px-2.5 py-1.5 rounded border border-surface-container-high focus:border-secondary focus:outline-none transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="font-label-code-md text-label-code-md text-on-surface-variant">Daily Budget (INR)</label>
            <input type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="50 (default)" className="w-full bg-surface-container text-on-surface font-label-code-md text-label-code-md px-2.5 py-1.5 rounded border border-surface-container-high focus:border-secondary focus:outline-none transition-colors" />
          </div>
          <div className="md:col-span-1 flex flex-col gap-1.5">
            <button type="submit" disabled={creating} className={`w-full bg-primary hover:bg-[#6dfbc0] text-on-primary font-label-code-md text-label-code-md h-[30px] rounded font-semibold transition-colors flex items-center justify-center ${creating ? 'opacity-50' : ''}`}>
              {creating ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
        {formError && (
          <div className="mt-space-md text-error font-label-code-sm text-label-code-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {formError}
          </div>
        )}
      </div>

      <div className="w-full bg-surface-container-low border border-surface-container-high/60 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container/50 border-b border-surface-container-high">
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4">Label</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4">User ID</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4 text-right">RPM Limit</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4 text-right">Daily Budget (INR)</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4 w-48">Today's Spend (INR)</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4">Status</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4">Created</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-label-code-sm text-label-code-sm">
              {loading && keys.length === 0 ? (
                <tr><td colSpan="8" className="py-8 text-center text-on-surface-variant">Loading keys...</td></tr>
              ) : error && keys.length === 0 ? (
                <tr><td colSpan="8" className="py-8 text-center text-error">{error}</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan="8" className="py-8 text-center text-on-surface-variant">No keys found.</td></tr>
              ) : (
                keys.map(k => {
                  const spend = k.todaySpendINR || 0;
                  const bdg = k.dailyBudgetINR;
                  const pct = Math.min((spend / bdg) * 100, 100);
                  let colorClass = 'bg-primary';
                  if (pct >= 75 && pct < 100) colorClass = 'bg-tertiary';
                  if (pct >= 100) colorClass = 'bg-error';

                  return (
                    <tr key={k._id} className={`border-b border-surface-container-high/40 hover:bg-surface-container-high/20 transition-colors ${k.revoked ? 'opacity-50 grayscale' : ''}`}>
                      <td className="py-2.5 px-4 text-on-surface whitespace-nowrap">{k.label}</td>
                      <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">{k.userId}</td>
                      <td className="py-2.5 px-4 text-on-surface text-right whitespace-nowrap">{k.rpmLimit.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-on-surface text-right whitespace-nowrap">₹{bdg.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 w-full max-w-[140px]">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={pct >= 100 ? 'text-error font-medium' : 'text-on-surface'}>
                              ₹{spend.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {k.revoked ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant border border-surface-container-high">Revoked</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">
                        {new Date(k.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {!k.revoked && (
                          <button onClick={() => setRevokeKey(k)} className="px-2 py-1 rounded font-label-code-sm text-label-code-sm border border-error/50 text-error hover:bg-error/10 transition-colors">
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {revokeKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d16]/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-low border border-surface-container-high rounded-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-space-lg flex flex-col gap-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <h3 className="font-headline-md text-headline-md font-semibold">Revoke Key</h3>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Are you sure you want to revoke <strong className="text-on-surface font-label-code-md bg-surface px-1 py-0.5 rounded">{revokeKey.label}</strong> for user <strong className="text-on-surface">{revokeKey.userId}</strong>?
              </p>
              <div className="p-3 bg-error/10 border border-error/20 rounded mt-2">
                <p className="font-body-sm text-body-sm text-error/90 leading-relaxed">
                  Any application currently using this key will immediately receive 401 Unauthorized responses. <strong className="font-semibold text-error">This action cannot be undone.</strong>
                </p>
              </div>
            </div>
            <div className="p-space-md bg-surface-container flex items-center justify-end gap-space-md">
              <button disabled={revoking} onClick={() => setRevokeKey(null)} className="px-4 py-1.5 rounded font-label-code-md text-label-code-md border border-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors">
                Cancel
              </button>
              <button disabled={revoking} onClick={handleRevoke} className={`px-4 py-1.5 rounded font-label-code-md text-label-code-md border border-error text-error hover:bg-error/10 transition-colors ${revoking?'opacity-50':''}`}>
                {revoking ? 'Revoking...' : 'Yes, Revoke Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
