import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

function formatINR(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // e.g., "7 Oct"
}

export default function OverviewScreen() {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = async (r = range) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getStats(r);
      setData(res);
      setLastUpdated(new Date().toLocaleTimeString('en-GB'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(range);
    const intv = setInterval(() => fetchData(range), 30000);
    return () => clearInterval(intv);
  }, [range]);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-space-lg w-full pb-space-xl animate-pulse">
        <div className="flex items-center gap-2 text-on-surface-variant font-label-code-sm text-label-code-sm bg-surface-container-low p-2 rounded border border-surface-container-high">
          <span>Fetching gateway telemetry...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-sm w-full">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-surface-container-low border border-surface-container-high/40 rounded"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md w-full">
          <div className="h-64 bg-surface-container-low border border-surface-container-high/40 rounded"></div>
          <div className="h-64 bg-surface-container-low border border-surface-container-high/40 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-space-xl bg-surface-container-low rounded border border-error/50">
        <span className="material-symbols-outlined text-error mb-2">error</span>
        <h3 className="font-headline-md text-on-surface mb-4">{error}</h3>
        <button onClick={() => fetchData(range)} className="px-3 py-1.5 rounded bg-surface-container text-on-surface border border-surface-container-high hover:bg-surface-container-high">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { totals, daily, latency } = data;

  const handleRangeChange = (r) => {
    if (r !== range) {
      setRange(r);
      setData(null);
    }
  };

  const TopHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pt-space-xs pb-space-sm border-b border-surface-container-high/40">
      <div className="flex items-center gap-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Overview</h1>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-low border border-surface-container-high">
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant font-medium">Last updated {lastUpdated}</span>
        </div>
      </div>
      <div className="flex items-center gap-space-md">
        <div className="inline-flex p-0.5 rounded bg-surface-container-low border border-surface-container-high" role="group">
          {['1d', '7d', '30d'].map(r => (
            <button 
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`px-2.5 py-1 text-label-code-md font-label-code-md rounded transition-colors ${
                range === r ? 'bg-surface-container-highest text-on-surface font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (totals.requests === 0) {
    return (
      <div className="flex flex-col w-full pb-space-xl gap-space-lg">
        <TopHeader />
        <div className="p-space-xl bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col items-center text-center justify-center py-16">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-surface-container-high mb-3">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">data_thresholding</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">No data for this range</h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-1.5 mb-5">
            No gateway requests were logged during this interval.
          </p>
          <button 
            onClick={() => handleRangeChange('7d')}
            className="px-3 py-1.5 rounded font-label-code-md text-label-code-md bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high transition-colors"
          >
            Reset to 7d
          </button>
        </div>
      </div>
    );
  }

  const hitRate = totals.requests > 0 ? ((totals.cacheHits / totals.requests) * 100).toFixed(1) : '0.0';
  const notCached = daily.map(d => ({
    ...d,
    notCached: d.requests - d.cacheHits,
    dateLabel: formatDateLabel(d.date)
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="px-2 py-1 bg-surface-container-highest border border-surface-container-high rounded text-on-surface font-label-code-sm shadow-xl flex flex-col gap-1">
          <span className="text-on-surface-variant">{label}</span>
          {payload.map(p => (
            <div key={p.dataKey} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: p.color}}></span>
              <span>{p.name}: {p.name.includes('cost') ? formatINR(p.value) : p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col w-full pb-space-xl gap-space-lg">
      <TopHeader />
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-sm w-full">
        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Requests</span>
          <div className="mt-2">
            <span className="font-label-code-lg text-headline-md font-bold tracking-tight text-on-surface">
              {totals.requests.toLocaleString()}
            </span>
          </div>
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant/70 mt-1 truncate">Total requests</span>
        </div>

        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Cache hit rate</span>
          <div className="mt-2">
            <span className="font-label-code-lg text-headline-md font-bold tracking-tight text-on-surface">{hitRate}%</span>
          </div>
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant/70 mt-1 truncate">Cache hits / requests</span>
        </div>

        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Blocked requests</span>
          <div className="mt-2">
            <span className="font-label-code-lg text-headline-md font-bold tracking-tight text-on-surface">
              {totals.blocked.toLocaleString()}
            </span>
          </div>
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant/70 mt-1 truncate">429 from the gateway (rate limit or budget)</span>
        </div>

        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Upstream errors</span>
          <div className="mt-2">
            <span className="font-label-code-lg text-headline-md font-bold tracking-tight text-on-surface">
              {totals.upstreamErrors.toLocaleString()}
            </span>
          </div>
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant/70 mt-1 truncate">Provider failures</span>
        </div>

        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Total cost (INR)</span>
          <div className="mt-2">
            <span className="font-label-code-lg text-headline-md font-bold tracking-tight text-on-surface">
              {formatINR(totals.costINR)}
            </span>
          </div>
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant/70 mt-1 truncate">Sum of provider cost</span>
        </div>

        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Estimated saved</span>
          <div className="mt-2">
            <span className="font-label-code-lg text-headline-md font-bold tracking-tight text-on-surface">
              {formatINR(totals.estimatedSavedINR)}
            </span>
          </div>
          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant/70 mt-1 truncate">Estimate: cache hits x average cost of misses</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md w-full">
        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between relative">
          <div className="flex items-center justify-between mb-space-sm">
            <div>
              <h2 className="font-headline-md text-body-lg font-medium text-on-surface">Daily cost (INR)</h2>
            </div>
          </div>
          <div className="relative w-full h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={notCached} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="#262a34" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} tickFormatter={val => '₹'+val} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="costINR" name="Cost" stroke="#4cd7f6" strokeWidth={2} dot={{ r: 3, fill: '#0f131c', stroke: '#4cd7f6', strokeWidth: 1.5 }} activeDot={{ r: 4.5, fill: '#4cd7f6', stroke: '#0f131c', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <div>
              <h2 className="font-headline-md text-body-lg font-medium text-on-surface">Daily requests</h2>
            </div>
            <div className="flex items-center gap-space-sm font-label-code-sm text-label-code-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>
                <span className="text-on-surface-variant">Cache hits</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary-container"></span>
                <span className="text-on-surface-variant">Not cached</span>
              </div>
            </div>
          </div>
          <div className="relative w-full h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={notCached} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="#262a34" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#1c1f29'}} />
                <Bar dataKey="notCached" stackId="a" name="Not cached" fill="#03b5d3" radius={[0,0,0,0]} />
                <Bar dataKey="cacheHits" stackId="a" name="Cache hits" fill="#4edea3" radius={[1,1,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-space-md bg-surface-container-low border border-surface-container-high/60 rounded">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-xl">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant">p50 latency</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-label-code-lg text-headline-lg font-bold text-on-surface">{latency.p50}ms</span>
              </div>
            </div>
            <div className="hidden md:block w-px h-10 bg-surface-container-high"></div>
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant">p95 latency</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-label-code-lg text-headline-lg font-bold text-on-surface">{latency.p95}ms</span>
              </div>
            </div>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Based on the latest 10,000 non-blocked requests in this range.
          </span>
        </div>
      </div>

    </div>
  );
}
