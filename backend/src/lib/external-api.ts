import axios from 'axios';
import { config } from '../config';

interface OpenWeatherAirPollution {
  pm2_5?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  co?: number;
  so2?: number;
}

export async function fetchOpenWeatherAirQuality(lat: number, lon: number): Promise<OpenWeatherAirPollution | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution`;
    const response = await axios.get(url, {
      params: {
        lat,
        lon,
        appid: config.openWeatherApiKey,
      },
      timeout: 5000,
    });

    const components = response.data?.list?.[0]?.components;
    if (!components) return null;

    return {
      pm2_5: components.pm2_5,
      pm10: components.pm10,
      no2: components.no2,
      o3: components.o3,
      co: components.co,
      so2: components.so2,
    };
  } catch (error) {
    console.error('OpenWeather API error:', error);
    return null;
  }
}

// Add IQAir/AirVisual API if you have a key
export async function fetchAirVisualData(lat: number, lon: number): Promise<any> {
  if (!config.airVisualApiKey) return null;
  
  try {
    const url = `https://api.airvisual.com/v2/nearest_city`;
    const response = await axios.get(url, {
      params: {
        lat,
        lon,
        key: config.airVisualApiKey,
      },
      timeout: 5000,
    });
    return response.data?.data?.current?.pollution;
  } catch (error) {
    console.error('AirVisual API error:', error);
    return null;
  }
}