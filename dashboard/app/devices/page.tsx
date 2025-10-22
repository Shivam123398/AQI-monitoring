'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Search, Wifi, MapPin } from 'lucide-react';
import Link from 'next/link';
import { getAQICategory } from '@/lib/aqi-utils';

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await apiClient.getDevices();
      const list = res.data.data || [];
      setDevices(list);
    } catch (e) {
      // demo
      setDevices(Array.from({ length: 12 }, (_, i) => ({
        id: `demo-${i+1}`,
        name: `Demo Station ${i+1}`,
        latitude: 28.6139 + (Math.random()-0.5)*0.2,
        longitude: 77.2090 + (Math.random()-0.5)*0.2,
        lastSeen: new Date().toISOString(),
        currentAqi: Math.floor(30 + Math.random()*160),
        active: Math.random() > 0.1,
      })));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return devices.filter((d) => !q || d.name?.toLowerCase().includes(q) || d.id?.toLowerCase().includes(q));
  }, [devices, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devices</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
            <input
              placeholder="Search devices"
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              className="pl-8 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((d) => {
          const cat = getAQICategory(d.currentAqi || 0);
          return (
            <Link key={d.id} href={`/devices/${d.id}`} className="block bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="font-semibold">{d.name}</div>
                <div className={`w-2 h-2 rounded-full ${d.active!==false ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{d.latitude?.toFixed(3)}, {d.longitude?.toFixed(3)}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">AQI</div>
                  <div className="text-xl font-bold" style={{ color: cat.color }}>{Math.round(d.currentAqi || 0)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1"><Wifi className="w-3 h-3" /> Last: {d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : '—'}</div>
                <div className="px-2 py-1 rounded" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>{cat.name}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {!filtered.length && !loading && (
        <div className="text-center text-gray-500">No devices found.</div>
      )}
    </div>
  );
}

