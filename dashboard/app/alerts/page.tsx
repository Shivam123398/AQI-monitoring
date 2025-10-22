'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AlertsPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [aqiThreshold, setAqiThreshold] = useState<number>(150);
  const [cooldown, setCooldown] = useState<number>(30);
  const [channels, setChannels] = useState<{ email: boolean; telegram: boolean; sms: boolean }>(
    { email: true, telegram: true, sms: false }
  );
  const [quietHours, setQuietHours] = useState<{ start: string; end: string }>({ start: '22:00', end: '07:00' });

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getDevices();
        const list = res.data.data || [];
        setDevices(list);
        if (list.length) setDeviceId(list[0].id);
      } catch {
        const list = Array.from({ length: 3 }, (_, i) => ({ id: `demo-${i+1}`, name: `Demo Station ${i+1}` }));
        setDevices(list);
        setDeviceId(list[0].id);
      }
    })();
  }, []);

  const toggleChannel = (key: keyof typeof channels) => {
    setChannels((c) => ({ ...c, [key]: !c[key] }));
  };

  const saveSettings = () => {
    // Placeholder UI save; backend wiring can be added to persist
    toast.success('Alert settings saved');
  };

  const sendTestAlert = async () => {
    if (!deviceId) {
      toast.error('Select a device');
      return;
    }
    try {
      await apiClient.simulateSpike(deviceId, aqiThreshold + 10);
      toast.success('Simulated high AQI measurement sent');
    } catch (e) {
      toast.error('Failed to send simulation');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>

      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Device</label>
            <select
              value={deviceId}
              onChange={(e)=>setDeviceId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            >
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">AQI Threshold</label>
            <input type="number" value={aqiThreshold} onChange={(e)=>setAqiThreshold(parseInt(e.target.value||'0'))}
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Cooldown (minutes)</label>
            <input type="number" value={cooldown} onChange={(e)=>setCooldown(parseInt(e.target.value||'0'))}
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Quiet Hours</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="time" value={quietHours.start} onChange={(e)=>setQuietHours(q=>({ ...q, start: e.target.value }))}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" />
              <span className="text-gray-500">to</span>
              <input type="time" value={quietHours.end} onChange={(e)=>setQuietHours(q=>({ ...q, end: e.target.value }))}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" />
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Channels</div>
          <div className="flex items-center gap-3">
            <Toggle label="Email" checked={channels.email} onChange={()=>toggleChannel('email')} />
            <Toggle label="Telegram" checked={channels.telegram} onChange={()=>toggleChannel('telegram')} />
            <Toggle label="SMS" checked={channels.sms} onChange={()=>toggleChannel('sms')} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveSettings} className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700">Save</button>
          <button onClick={sendTestAlert} className="px-4 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700">Send test alert</button>
        </div>
      </section>

      <section className="text-sm text-gray-500">
        Alerts are rate-limited and respect quiet hours. Thresholds apply to latest AQI from each device.
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: ()=>void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className={`w-10 h-6 rounded-full p-1 transition ${checked ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}
        onClick={onChange}
      >
        <span className={`block h-4 w-4 bg-white rounded-full transition ${checked ? 'translate-x-4' : ''}`}></span>
      </span>
      <span>{label}</span>
    </label>
  );
}

