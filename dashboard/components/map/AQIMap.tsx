'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAQICategory } from '@/lib/aqi-utils';

// Fix Leaflet default icon issue with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Device {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  currentAqi?: number;
  lastSeen?: Date;
}

interface AQIMapProps {
  devices: Device[];
  center?: [number, number];
  zoom?: number;
}

export function AQIMap({ devices, center, zoom = 12 }: AQIMapProps) {
  const defaultCenter: [number, number] = center || [
    parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LAT || '28.6139'),
    parseFloat(process.env.NEXT_PUBLIC_MAP_CENTER_LNG || '77.2090'),
  ];

  // Create custom markers based on AQI
  const createCustomIcon = (aqi: number) => {
    const category = getAQICategory(aqi);
    return L.divIcon({
      className: 'custom-aqi-marker',
      html: `
        <div class="relative">
          <div class="w-12 h-12 rounded-full flex items-center justify-center shadow-lg animate-pulse" 
               style="background-color: ${category.color}">
            <span class="text-white font-bold text-sm">${Math.round(aqi)}</span>
          </div>
          <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 
                      border-l-8 border-r-8 border-t-8 border-transparent"
               style="border-top-color: ${category.color}">
          </div>
        </div>
      `,
      iconSize: [48, 58],
      iconAnchor: [24, 58],
      popupAnchor: [0, -58],
    });
  };

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-lg">
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {devices.map((device) => {
          if (!device.latitude || !device.longitude) return null;

          const aqi = device.currentAqi || 0;
          const category = getAQICategory(aqi);

          return (
            <div key={device.id}>
              {/* Marker */}
              <Marker
                position={[device.latitude, device.longitude]}
                icon={createCustomIcon(aqi)}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-bold text-lg mb-2">{device.name}</h3>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">AQI:</span>
                        <span className={`text-xl font-bold ${category.textColor}`}>
                          {Math.round(aqi)}
                        </span>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${category.bgColor} ${category.textColor}`}>
                        {category.name}
                      </div>
                      {device.lastSeen && (
                        <div className="text-xs text-gray-500 mt-2">
                          Updated: {new Date(device.lastSeen).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <a
                      href={`/devices/${device.id}`}
                      className="mt-3 block w-full text-center bg-primary-500 hover:bg-primary-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
                    >
                      View Details
                    </a>
                  </div>
                </Popup>
              </Marker>

              {/* Circle overlay for visual impact */}
              <Circle
                center={[device.latitude, device.longitude]}
                radius={500}
                pathOptions={{
                  fillColor: category.color,
                  fillOpacity: 0.1,
                  color: category.color,
                  weight: 2,
                  opacity: 0.3,
                }}
              />
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}