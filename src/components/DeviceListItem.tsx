import React from 'react';
import { DeviceItem } from '../types';

interface DeviceListItemProps {
  item: DeviceItem;
  onSelect: (item: DeviceItem) => void;
  isTarget?: boolean;
}

export const DeviceListItem: React.FC<DeviceListItemProps> = ({ item, onSelect, isTarget }) => {
  return (
    <div
      id={`device-item-${item.address.replace(/[^a-zA-Z0-9]/g, '-')}`}
      className={`flex items-center justify-between p-2.5 border-b border-gray-300 transition-colors ${
        isTarget ? 'bg-indigo-50/70' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex-1 pr-3 flex flex-col space-y-0.5 min-w-0">
        <div id="nameText" className="text-base font-bold text-gray-900 flex items-center gap-2 truncate">
          <span>Nome: {item.name}</span>
          {isTarget && (
            <span className="text-[10px] uppercase font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded">
              TARGET
            </span>
          )}
        </div>

        <div id="typeText" className="text-xs text-gray-700">
          Tipo: {item.classificationType} ({item.classificationConfidence}%)
        </div>

        <div id="appearanceText" className="text-xs text-gray-700">
          Aspetto: {item.appearance}
        </div>

        <div id="macText" className="text-xs font-mono text-gray-600">
          MAC: {item.address}
        </div>

        <div id="rssiText" className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
          <span>RSSI: {item.rssi} dBm</span>
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              item.rssi >= -75 ? 'bg-green-500' : 'bg-amber-500'
            }`}
            title={item.rssi >= -75 ? 'Segnale forte / Vicino' : 'Segnale debole / Lontano'}
          />
        </div>

        <div id="uuidText" className="text-[10px] text-gray-500 truncate" title={item.uuids}>
          UUID/Service: {item.uuids}
        </div>

        <div id="manufacturerText" className="text-[10px] text-gray-500 truncate" title={item.manufacturer}>
          Produttore: {item.manufacturer}
        </div>

        <div id="modelIdText" className="text-[10px] font-mono text-gray-500 truncate">
          Model ID: {item.modelId}
        </div>
      </div>

      <div className="flex-shrink-0">
        <button
          id="selectButton"
          type="button"
          onClick={() => onSelect(item)}
          className="android-btn text-xs px-3 py-1.5 uppercase font-medium bg-[#3F51B5] hover:bg-[#303F9F] text-white rounded shadow"
        >
          {isTarget ? "Selezionato" : "Seleziona"}
        </button>
      </div>
    </div>
  );
};
