'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HealthRiskGauge } from '@/components/charts/HealthRiskGauge';
import { apiClient } from '@/lib/api';
import { Activity, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HealthPage() {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getDevices();
        setDevices(res.data.data || []);
        if (res.data.data?.length) setSelectedDeviceId(res.data.data[0].id);
      } catch (e) {
        // non-blocking
      }
    })();
  }, []);

  const runAnalysis = async () => {
    if (!selectedDeviceId) {
      toast.error('Select a device to analyze');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.analyzeHealth({ deviceId: selectedDeviceId, periodDays: 7 });
      setAnalysis(res.data);
      toast.success('Health risk analysis complete!');
    } catch (error) {
      toast.error('Failed to analyze health risk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Activity className="w-10 h-10 text-red-500" />
          Personal Health Risk Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          AI-powered disease risk assessment based on air quality exposure
        </p>
      </motion.div>

      {/* CTA */}
      {!analysis && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-8 rounded-2xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">Generate Your Health Report</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our AI analyzes your 7-day air quality exposure to estimate risks for asthma, COPD,
                cardiovascular disease, and allergies based on WHO epidemiological data.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label htmlFor="device" className="text-sm text-gray-600 dark:text-gray-400">Device</label>
                <select
                  id="device"
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={runAnalysis}
                disabled={loading || !selectedDeviceId}
                className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Analyzing...' : 'Run Health Analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-6">Disease Risk Profile</h2>
              <HealthRiskGauge
                diseaseRisks={analysis.diseaseRisks}
                exposureScore={analysis.exposureScore}
              />
            </div>
          </div>

          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl border">
              <h3 className="font-bold mb-4">Exposure Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg AQI</span>
                  <span className="font-semibold">{analysis.stats.avgAqi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Peak AQI</span>
                  <span className="font-semibold text-red-500">{analysis.stats.peakAqi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Hours Unhealthy</span>
                  <span className="font-semibold">{analysis.stats.hoursUnhealthy}</span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                💡 Recommendations
              </h3>
              <ul className="space-y-2 text-sm">
                {analysis.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600 dark:text-amber-400 flex-shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
