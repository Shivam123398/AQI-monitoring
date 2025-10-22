'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [sample, setSample] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getDevices();
        const list = res.data.data || [];
        setDevices(list);
        if (list.length) setDeviceId(list[0].id);
      } catch {
        const list = Array.from({ length: 2 }, (_, i) => ({ id: `demo-${i+1}`, name: `Demo Station ${i+1}` }));
        setDevices(list); setDeviceId(list[0].id);
      }
    })();
  }, []);

  async function loadPreview() {
    if (!deviceId) return;
    try {
      const params: any = { device_id: deviceId, limit: 200 };
      if (start) params.start = new Date(start).toISOString();
      if (end) params.end = new Date(end).toISOString();
      const res = await apiClient.getMeasurements(params);
      setSample(res.data.data || []);
    } catch {
      setSample([]);
    }
  }

  async function exportCsv() {
    if (!deviceId) { toast.error('Choose a device'); return; }
    try {
      const params: any = { device_id: deviceId };
      if (start) params.start = new Date(start).toISOString();
      if (end) params.end = new Date(end).toISOString();
      const res = await apiClient.exportCSV(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `report-${deviceId}-${Date.now()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  const stats = useMemo(() => quickStats(sample), [sample]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Reports & Exports</h1>

      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Device</label>
            <select value={deviceId} onChange={(e)=>setDeviceId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Start</label>
            <input type="datetime-local" value={start} onChange={(e)=>setStart(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">End</label>
            <input type="datetime-local" value={end} onChange={(e)=>setEnd(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={loadPreview} className="w-full px-4 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700">Preview</button>
            <button onClick={exportCsv} className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700">Export CSV</button>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Points" value={stats.count} />
          <Stat label="Avg AQI" value={stats.avgAqi} />
          <Stat label="Min AQI" value={stats.minAqi} />
          <Stat label="Max AQI" value={stats.maxAqi} />
        </div>
        <p className="mt-4 text-xs text-gray-500">Tip: Use this export for further analysis or to share with municipal systems.</p>
      </section>
    </div>
  );
}

function quickStats(rows: any[]) {
  if (!rows.length) return { count: 0, avgAqi: 0, minAqi: 0, maxAqi: 0 };
  const aqis = rows.map((r) => r.aqiCalculated).filter((x: any) => typeof x === 'number');
  if (!aqis.length) return { count: rows.length, avgAqi: 0, minAqi: 0, maxAqi: 0 };
  const avg = aqis.reduce((a: number, b: number) => a + b, 0) / aqis.length;
  return { count: rows.length, avgAqi: Math.round(avg), minAqi: Math.min(...aqis), maxAqi: Math.max(...aqis) };
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-4 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

