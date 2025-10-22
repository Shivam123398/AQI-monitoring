/**
 * AQI Forecast Model - TensorFlow.js Inference
 * Loads trained LSTM model and generates 24-hour predictions
 */

// Remove static import of tfjs-node to avoid install/build failures on unsupported Node versions
// import * as tf from '@tensorflow/tfjs-node';
import { db } from '../lib/db';
import path from 'path';
import fs from 'fs';

interface ForecastInput {
  deviceId: string;
  lookbackHours?: number;
}

interface ForecastOutput {
  deviceId: string;
  predictions: {
    hour: number;
    aqi: number;
    category: string;
    timestamp: Date;
  }[];
  confidence: number;
  modelVersion: string;
}

class AQIForecaster {
  private model: any | null = null;
  private scalerParams: any = null;
  private modelVersion = '1.0.0';
  private tf: any | null = null;

  private async loadTF(): Promise<any | null> {
    if (this.tf) return this.tf;
    try {
      // Try to load native Node backend if available using computed specifier to avoid TS module resolution
      const pkgName = '@tensorflow/tfjs-node';
      const mod = await import(pkgName as string);
      this.tf = mod;
      return this.tf;
    } catch (err: any) {
      console.warn('[ML] TensorFlow backend not available. Forecasts are disabled.', err?.message || err);
      this.tf = null;
      return null;
    }
  }

  async loadModel() {
    if (this.model) return;

    const tf = await this.loadTF();
    if (!tf) {
      return; // TF not available, skip
    }

    const modelPath = path.join(process.cwd(), 'models', 'aqi_lstm_model');
    const scalerPath = path.join(process.cwd(), 'models', 'scaler_params.json');

    if (!fs.existsSync(modelPath)) {
      console.warn('AQI LSTM model not found. Run python train.py first.');
      return;
    }

    this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    this.scalerParams = JSON.parse(fs.readFileSync(scalerPath, 'utf-8'));

    console.log('✅ AQI Forecast model loaded');
  }

  private normalizeFeatures(data: number[][]): number[][] {
    if (!this.scalerParams) return data;

    const { min, max } = this.scalerParams;
    return data.map((row) =>
      row.map((val, i) => {
        const range = max[i] - min[i];
        return range > 0 ? (val - min[i]) / range : 0;
      })
    );
  }

  private denormalizeAQI(normalizedAQI: number): number {
    if (!this.scalerParams) return normalizedAQI;

    const { min, max } = this.scalerParams;
    const aqiIdx = 0; // AQI is first feature
    return normalizedAQI * (max[aqiIdx] - min[aqiIdx]) + min[aqiIdx];
  }

  async forecast(input: ForecastInput): Promise<ForecastOutput | null> {
    await this.loadModel();
    if (!this.model || !this.tf) return null;

    const tf = this.tf;
    const lookback = input.lookbackHours || 24;

    // Fetch last 24 hours of data
    const measurements = await db.measurement.findMany({
      where: {
        deviceId: input.deviceId,
        measuredAt: {
          gte: new Date(Date.now() - lookback * 60 * 60 * 1000),
        },
      },
      orderBy: { measuredAt: 'asc' },
      take: lookback,
    });

    if (measurements.length < lookback) {
      console.warn(`Insufficient data for device ${input.deviceId}: ${measurements.length}/${lookback}`);
      return null;
    }

    // Prepare features (must match training order)
    const featureData = measurements.map((m) => {
      const hour = new Date(m.measuredAt).getHours();
      const dow = new Date(m.measuredAt).getDay();

      return [
        m.aqiCalculated || 0,
        m.iaqScore || 0,
        m.temperature || 0,
        m.humidity || 0,
        m.pressureHpa || 0,
        hour,
        dow,
      ];
    });

    // Normalize
    const normalizedData = this.normalizeFeatures(featureData);

    // Convert to tensor [1, lookback, features]
    const inputTensor = tf.tensor3d([normalizedData]);

    // Predict
    const predictionTensor = this.model.predict(inputTensor) as any;
    const predictionData = await predictionTensor.data();

    inputTensor.dispose();
    predictionTensor.dispose();

    // Denormalize and format
    const now = new Date();
    const values = Array.from(predictionData as unknown as number[]);
    const predictions = values.map((normalizedAQI: number, i: number) => {
      const aqi = Math.max(0, Math.round(this.denormalizeAQI(normalizedAQI)));
      const timestamp = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000);

      return {
        hour: i + 1,
        aqi,
        category: this.getAQICategory(aqi),
        timestamp,
      };
    });

    // Calculate confidence (simple: inverse of recent variance)
    const recentAQIs = measurements.slice(-6).map((m) => m.aqiCalculated || 0);
    const variance = this.calculateVariance(recentAQIs);
    const confidence = Math.max(0.5, Math.min(1.0, 1 / (1 + variance / 100)));

    return {
      deviceId: input.deviceId,
      predictions,
      confidence: Math.round(confidence * 100) / 100,
      modelVersion: this.modelVersion,
    };
  }

  private getAQICategory(aqi: number): string {
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'unhealthy_sensitive';
    if (aqi <= 200) return 'unhealthy';
    if (aqi <= 300) return 'very_unhealthy';
    return 'hazardous';
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return variance;
  }
}

export const aqiForecaster = new AQIForecaster();
