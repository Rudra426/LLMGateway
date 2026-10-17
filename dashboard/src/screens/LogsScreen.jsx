import React, { useState, useEffect } from 'react';
import { api } from '../api';

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export default function LogsScreen() {
  const [logs, setLogs] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [appliedKey, setAppliedKey] = useState('');

  const fetchKeys = async () => {
    try {
      const res = await api.getKeys();
      setKeys(res);
    } catch (e) {}
  };

  const fetchLogs = async (k = appliedKey) => {
    try {
      if (!logs.length) setLoading(true);
      setError(null);
      const res = await api.getLogs(k);
      setLogs(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    fetchLogs(appliedKey);
    const intv = setInterval(() => fetchLogs(appliedKey), 10000);
    return () => clearInterval(intv);
  }, [appliedKey]);

  const handleApply = () => {
    setAppliedKey(selectedKey);
  };

  const getKeyLabel = (id) => {
    const k = keys.find(x => x._id === id);
    if (k) return k.label;
    return id.substring(0, 8) + '...';
  };

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pt-space-xs pb-space-sm border-b border-surface-container-high/40">
        <div className="flex items-center gap-space-md">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Logs</h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-low border border-surface-container-high">
            <span className="font-label-code-sm text-label-code-sm text-on-surface-variant font-medium">Latest 50 requests</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-code-sm text-label-code-sm uppercase tracking-wider text-primary font-medium">Auto-refresh: 10s</span>
          </div>
        </div>
        <div className="flex items-center gap-space-md font-label-code-sm text-label-code-sm text-on-surface-variant">
          Showing {logs.length} requests
        </div>
      </div>

      <div className="p-space-sm bg-surface-container-low border border-surface-container-high/60 rounded flex flex-wrap items-center gap-space-sm">
        <div className="flex items-center gap-2">
          <span className="font-label-code-md text-label-code-md text-on-surface-variant ml-1">Filter Key:</span>
          <select 
            value={selectedKey} 
            onChange={e => setSelectedKey(e.target.value)}
            className="bg-surface-container text-on-surface font-label-code-md text-label-code-md px-2 py-1 rounded border border-surface-container-high focus:outline-none focus:border-secondary transition-colors"
          >
            <option value="">All keys</option>
            {keys.map(k => (
              <option key={k._id} value={k._id}>{k.label}</option>
            ))}
          </select>
          <button onClick={handleApply} className="px-3 py-1 rounded font-label-code-md text-label-code-md bg-primary hover:bg-[#6dfbc0] text-on-primary font-semibold transition-colors">
            Apply
          </button>
        </div>
      </div>

      <div className="w-full bg-surface-container-low border border-surface-container-high/60 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container/50 border-b border-surface-container-high">
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3 w-40">Time</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3">Key</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3">Provider</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3">Model</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3">Status</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3">Cache</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3 text-right">Cost (INR)</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3 text-right">Latency</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3 text-right">Tokens In</th>
                <th className="font-label-code-sm text-label-code-sm font-medium text-on-surface-variant py-2 px-3 text-right">Tokens Out</th>
              </tr>
            </thead>
            <tbody className="font-label-code-sm text-label-code-sm">
              {loading && logs.length === 0 ? (
                <tr><td colSpan="10" className="py-8 text-center text-on-surface-variant">Loading requests...</td></tr>
              ) : error && logs.length === 0 ? (
                <tr><td colSpan="10" className="py-8 text-center text-error">{error}</td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">receipt_long</span>
                      <span className="text-on-surface-variant text-body-md font-body-md">No requests yet</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const d = new Date(log.ts);
                  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
                  
                  let statusEl;
                  if (log.status === 200) {
                    statusEl = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span>Success (200)</span>;
                  } else if (log.upstreamError) {
                    statusEl = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/20"><span className="w-1.5 h-1.5 rounded-full bg-error"></span>Upstream error ({log.status})</span>;
                  } else if (log.status === 429) {
                    statusEl = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/20"><span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Blocked (429)</span>;
                  } else {
                    statusEl = <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant border border-surface-container-high">{log.status}</span>;
                  }

                  return (
                    <tr key={log._id} className="border-b border-surface-container-high/40 hover:bg-surface-container-high/20 transition-colors h-8">
                      <td className="py-1 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-on-surface">{timeStr}</span>
                          <span className="text-on-surface-variant text-[9px]">{formatTimeAgo(log.ts)}</span>
                        </div>
                      </td>
                      <td className="py-1 px-3 text-on-surface-variant whitespace-nowrap">{getKeyLabel(log.keyId)}</td>
                      <td className="py-1 px-3 text-on-surface-variant whitespace-nowrap">{log.provider}</td>
                      <td className="py-1 px-3 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant border border-surface-container-high">{log.model}</span>
                      </td>
                      <td className="py-1 px-3 whitespace-nowrap">{statusEl}</td>
                      <td className="py-1 px-3 whitespace-nowrap">
                        {log.cacheHit ? <span className="text-secondary font-medium">Hit</span> : <span className="text-on-surface-variant">Miss</span>}
                      </td>
                      <td className="py-1 px-3 text-on-surface text-right whitespace-nowrap">
                        {log.cacheHit ? '₹0.00' : log.costINR == null ? '—' : '₹' + log.costINR.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                      <td className="py-1 px-3 text-on-surface text-right whitespace-nowrap">{log.latencyMs}ms</td>
                      <td className="py-1 px-3 text-on-surface-variant text-right whitespace-nowrap">{log.promptTokens == null ? '—' : log.promptTokens}</td>
                      <td className="py-1 px-3 text-on-surface-variant text-right whitespace-nowrap">{log.completionTokens == null ? '—' : log.completionTokens}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
