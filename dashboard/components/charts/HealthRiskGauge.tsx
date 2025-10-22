'use client';

import { motion } from 'framer-motion';
import { Heart, Wind, Flower2, Activity } from 'lucide-react';

interface HealthRiskGaugeProps {
  diseaseRisks: {
    asthma_risk: number;
    copd_risk: number;
    cardiovascular_risk: number;
    allergy_risk: number;
  };
  exposureScore: number;
}

export function HealthRiskGauge({ diseaseRisks, exposureScore }: HealthRiskGaugeProps) {
  const risks = [
    { name: 'Asthma', value: diseaseRisks.asthma_risk, icon: Wind, color: 'text-blue-500' },
    { name: 'COPD', value: diseaseRisks.copd_risk, icon: Wind, color: 'text-purple-500' },
    { name: 'Cardiovascular', value: diseaseRisks.cardiovascular_risk, icon: Heart, color: 'text-red-500' },
    { name: 'Allergy', value: diseaseRisks.allergy_risk, icon: Flower2, color: 'text-green-500' },
  ];

  const getRiskLevel = (value: number) => {
    if (value < 25) return { label: 'Low', color: 'bg-green-500' };
    if (value < 50) return { label: 'Moderate', color: 'bg-yellow-500' };
    if (value < 75) return { label: 'High', color: 'bg-orange-500' };
    return { label: 'Very High', color: 'bg-red-500' };
  };

  return (
    <div className="space-y-6">
      {/* Overall exposure score */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-500" />
            <span className="text-sm font-medium">Overall Exposure Score</span>
          </div>
          <span className="text-2xl font-bold text-primary-600">{exposureScore}</span>
        </div>
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${exposureScore}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
          />
        </div>
      </div>

      {/* Individual disease risks */}
      <div className="grid grid-cols-2 gap-4">
        {risks.map((risk, index) => {
          const riskLevel = getRiskLevel(risk.value);
          const Icon = risk.icon;

          return (
            <motion.div
              key={risk.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${risk.color}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{risk.name}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${riskLevel.color} text-white`}>
                  {riskLevel.label}
                </span>
              </div>

              <div className="relative">
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${risk.value}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    className={`h-full ${riskLevel.color}`}
                  />
                </div>
                <div className="mt-1 text-right">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{risk.value.toFixed(1)}</span>
                  <span className="text-xs text-gray-500">/100</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}