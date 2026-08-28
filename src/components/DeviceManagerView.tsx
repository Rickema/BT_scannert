import React from 'react';
import { SavedTargetDevice } from '../types';

interface DeviceManagerViewProps {
  target: SavedTargetDevice;
  onBack: () => void;
  onClearTarget: () => void;
  onShowToast: (msg: string) => void;
}

export const DeviceManagerView: React.FC<DeviceManagerViewProps> = ({
  target,
  onBack,
  onClearTarget,
  onShowToast,
}) => {
  return (
    <div id="activity_device_manager" className="flex flex-col h-full p-4 space-y-4 max-w-2xl mx-auto">
      {/* Android Activity Header / Title */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <h1 id="deviceManagerTitle" className="text-lg font-bold text-gray-900">
          Dispositivi salvati
        </h1>
        {target.isSet && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
            {target.isNear ? "Stato: Vicino (Near)" : "Stato: Lontano (Far)"}
          </span>
        )}
      </div>

      {/* savedDeviceListView */}
      <div id="savedDeviceListView" className="flex-1 overflow-y-auto bg-white rounded border border-gray-200 shadow-sm p-4">
        {target.isSet && target.mac ? (
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Nome: {target.name || "N/D"}
                  </h2>
                  <p className="text-xs font-mono text-gray-600 mt-1">
                    MAC: {target.mac}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 break-all">
                    UUID: {target.uuid || "N/D"}
                  </p>
                  {target.lastSeen ? (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Ultimo rilevamento: {new Date(target.lastSeen).toLocaleTimeString()}
                    </p>
                  ) : null}
                </div>

                <div className="text-right flex flex-col items-end">
                  <span
                    className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                      target.isNear
                        ? "bg-green-600 text-white animate-pulse"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {target.isNear ? "IN PROSSIMITÀ" : "FUORI PORTATA"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const info = `Nome: ${target.name || "N/D"}\nMAC: ${target.mac}\nUUID: ${target.uuid || "N/D"}`;
                    onShowToast(info);
                  }}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium px-3 py-1.5 rounded border border-indigo-200"
                >
                  Mostra Dettagli (Toast)
                </button>
                <button
                  type="button"
                  onClick={onClearTarget}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-3 py-1.5 rounded border border-red-200"
                >
                  Rimuovi Target
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-blue-50/70 p-3 rounded border border-blue-100">
              <span className="font-semibold text-blue-900">Nota di sistema (ScannerService):</span>
              <p className="mt-1 text-blue-800">
                Il servizio in background monitora costantemente questo target. Quando il segnale RSSI è superiore a -75 dBm per 5 secondi, viene generato l'evento <code>ITAG_NEAR</code>. Se assente per oltre 15 secondi, viene generato l'evento <code>ITAG_FAR</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500 space-y-2">
            <svg
              className="w-12 h-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            <p className="text-sm font-medium">Nessun dispositivo salvato</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Torna alla schermata principale di scansione e fai clic su "Seleziona" su qualsiasi dispositivo rilevato per impostarlo come target.
            </p>
          </div>
        )}
      </div>

      {/* backButton */}
      <button
        id="backButton"
        type="button"
        onClick={onBack}
        className="android-btn w-full py-2.5 uppercase font-medium bg-[#3F51B5] hover:bg-[#303F9F] text-white rounded shadow"
      >
        Torna alla scansione
      </button>
    </div>
  );
};
