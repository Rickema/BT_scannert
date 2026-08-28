import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Constants } from './constants';
import { DeviceItem, SavedTargetDevice } from './types';
import { DatabaseManager } from './services/DatabaseManager';
import { BluetoothFingerprinter } from './services/BluetoothFingerprinter';
import { BluetoothScanner } from './services/BluetoothScanner';
import { ScannerService } from './services/ScannerService';
import { DeviceListItem } from './components/DeviceListItem';
import { DeviceManagerView } from './components/DeviceManagerView';
import { ToastContainer, ToastMessage } from './components/Toast';

export const App: React.FC = () => {
  // Navigation: "main" (MainActivity) or "device_manager" (DeviceManagerActivity)
  const [currentView, setCurrentView] = useState<'main' | 'device_manager'>('main');

  // Core singletons
  const dbManagerRef = useRef<DatabaseManager>(new DatabaseManager());
  const fingerprinterRef = useRef<BluetoothFingerprinter>(
    new BluetoothFingerprinter(dbManagerRef.current)
  );
  const scannerServiceRef = useRef<ScannerService>(ScannerService.getInstance());

  // App state
  const [scanning, setScanning] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Scansione ferma");
  const [includeClassic, setIncludeClassic] = useState<boolean>(false);
  const [rssiProgress, setRssiProgress] = useState<number>(25); // 0..50, progress 25 = -75 dBm
  const [deviceList, setDeviceList] = useState<DeviceItem[]>([]);
  const [debugText, setDebugText] = useState<string>("In attesa di avvio scansione...");
  const [targetDevice, setTargetDevice] = useState<SavedTargetDevice>(
    scannerServiceRef.current.getTargetDevice()
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Computed min RSSI from seekbar: -100 + progress
  const minRssi = useMemo(() => -100 + rssiProgress, [rssiProgress]);

  // Scanner instance
  const scannerRef = useRef<BluetoothScanner | null>(null);

  // Helper to show Android Toast
  const showToast = (text: string, duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, duration }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initialize Scanner and ScannerService subscriptions
  useEffect(() => {
    const db = dbManagerRef.current;
    const fingerprinter = fingerprinterRef.current;
    const scannerService = scannerServiceRef.current;

    // Load initial target
    const currentTarget = scannerService.loadTargetFromStorage();
    setTargetDevice(currentTarget);
    if (currentTarget.isSet && currentTarget.name) {
      setStatusText(`Tracking di ${currentTarget.name} attivo`);
    }

    // Initialize scanner
    const scanner = new BluetoothScanner(db, fingerprinter, (device) => {
      // Process incoming device
      setDeviceList((prevList) => {
        const existingIndex = prevList.findIndex((d) => d.address === device.address);
        if (existingIndex >= 0) {
          const updated = [...prevList];
          updated[existingIndex] = device;
          return updated;
        } else {
          return [...prevList, device];
        }
      });

      // Feed to tracking engine
      scannerService.processScanResult(device);
    });

    scanner.setMinRssi(minRssi);
    scanner.setIncludeClassic(includeClassic);
    scannerRef.current = scanner;

    // Subscribe to ScannerService events (Action Near, Action Far, etc.)
    const unsubscribe = scannerService.subscribe((event) => {
      if (event.type === "ACTION_NEAR") {
        showToast("iTAG: Dispositivo rilevato VICINO (Near)!");
        setTargetDevice(scannerService.getTargetDevice());
      } else if (event.type === "ACTION_FAR") {
        showToast("iTAG: Dispositivo LONTANO o assente (Far)!");
        setTargetDevice(scannerService.getTargetDevice());
      } else if (event.type === "SCAN_UPDATE" || event.type === "STATUS_UPDATE") {
        setTargetDevice(scannerService.getTargetDevice());
      }
    });

    return () => {
      scanner.stopScan();
      unsubscribe();
    };
  }, []);

  // Update scanner parameters when UI controls change
  useEffect(() => {
    if (scannerRef.current) {
      scannerRef.current.setMinRssi(minRssi);
      scannerRef.current.setIncludeClassic(includeClassic);
    }
  }, [minRssi, includeClassic]);

  // Start scanning (mimics MainActivity startButton.setOnClickListener)
  const handleStartScan = async () => {
    const db = dbManagerRef.current;
    try {
      await db.ensureDatabases();
    } catch (e: any) {
      console.warn("Database ensure error", e);
    }

    const debugInfo = db.getDebugInfo();
    setDebugText(debugInfo);
    showToast(debugInfo, 4000);

    setDeviceList([]);
    setScanning(true);
    setStatusText(
      targetDevice.isSet && targetDevice.name
        ? `Tracking di ${targetDevice.name} attivo`
        : "Scansione attiva"
    );

    if (scannerRef.current) {
      scannerRef.current.startScan();
    }
  };

  // Stop scanning (mimics MainActivity stopButton.setOnClickListener)
  const handleStopScan = () => {
    if (scannerRef.current) {
      scannerRef.current.stopScan();
    }
    setScanning(false);
    setStatusText(
      targetDevice.isSet && targetDevice.name
        ? `Tracking di ${targetDevice.name} in pausa`
        : "Scansione ferma"
    );
  };

  // Device selection (mimics MainActivity onDeviceSelected)
  const handleDeviceSelected = (item: DeviceItem) => {
    handleStopScan();

    const scannerService = scannerServiceRef.current;
    scannerService.setTargetDevice(item);
    setTargetDevice(scannerService.getTargetDevice());

    const message = `Selezionato: ${item.name} (${item.address})`;
    showToast(message, 4000);
    setStatusText(`Tracking di ${item.name} attivo`);
  };

  // Clear target
  const handleClearTarget = () => {
    const scannerService = scannerServiceRef.current;
    scannerService.clearTargetDevice();
    setTargetDevice(scannerService.getTargetDevice());
    setStatusText(scanning ? "Scansione attiva" : "Scansione ferma");
    showToast("Target rimosso.");
  };

  // Connect real Web Bluetooth device if browser allows
  const handlePairWebBluetooth = async () => {
    if (!scannerRef.current) return;
    try {
      showToast("Apertura finestra associazione Bluetooth del browser...", 2000);
      const dev = await scannerRef.current.triggerWebBluetoothPairing();
      if (dev) {
        showToast(`Dispositivo associato con successo: ${dev.name}`);
      }
    } catch (err: any) {
      showToast(`Errore Web Bluetooth: ${err?.message || err}`);
    }
  };

  // Filtered devices according to RSSI and Classic settings
  const filteredDevices = useMemo(() => {
    return deviceList.filter((device) => {
      if (device.rssi < minRssi) return false;
      if (device.type === "Classic" && !includeClassic) return false;
      return true;
    });
  }, [deviceList, minRssi, includeClassic]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      {/* Android Material ActionBar / Top App Bar */}
      <header
        id="app_header"
        className="bg-[#3F51B5] text-white px-4 py-3.5 shadow-md flex items-center justify-between sticky top-0 z-40"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm tracking-wider">
            iT
          </div>
          <div>
            <h1 className="text-lg font-medium leading-tight">iTAG Scanner</h1>
            <p className="text-[11px] text-indigo-100 opacity-90">
              {scanning ? "Scansione BLE / Classic" : "In attesa"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof navigator !== "undefined" && "bluetooth" in navigator && (
            <button
              type="button"
              onClick={handlePairWebBluetooth}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded transition-colors"
              title="Cerca un vero dispositivo hardware BLE via Web Bluetooth"
            >
              + Associa BLE
            </button>
          )}

          {targetDevice.isSet && (
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                targetDevice.isNear
                  ? "bg-green-500 text-white animate-pulse"
                  : "bg-indigo-800 text-indigo-100"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>{targetDevice.isNear ? "VICINO" : "LONTANO"}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main View Router */}
      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto p-4 sm:p-5">
        {currentView === 'device_manager' ? (
          <DeviceManagerView
            target={targetDevice}
            onBack={() => setCurrentView('main')}
            onClearTarget={handleClearTarget}
            onShowToast={showToast}
          />
        ) : (
          /* MainActivity Layout (1:1 with activity_main.xml) */
          <div id="activity_main" className="flex flex-col flex-1 space-y-3.5">
            {/* statusText */}
            <div
              id="statusText"
              className="text-lg font-bold text-gray-900 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    scanning ? 'bg-green-500 animate-ping' : 'bg-gray-400'
                  }`}
                />
                <span>{statusText}</span>
              </span>
              {deviceList.length > 0 && (
                <span className="text-xs font-normal text-gray-500">
                  {filteredDevices.length} trovati
                </span>
              )}
            </div>

            {/* startButton */}
            <button
              id="startButton"
              type="button"
              onClick={handleStartScan}
              disabled={scanning}
              className="android-btn w-full py-2.5 bg-[#3F51B5] hover:bg-[#303F9F] text-white uppercase font-medium rounded shadow transition"
            >
              Avvia scansione BLE
            </button>

            {/* stopButton */}
            <button
              id="stopButton"
              type="button"
              onClick={handleStopScan}
              disabled={!scanning}
              className="android-btn android-btn-secondary w-full py-2.5 bg-gray-600 hover:bg-gray-700 text-white uppercase font-medium rounded shadow transition"
            >
              Ferma scansione
            </button>

            {/* manageButton */}
            <button
              id="manageButton"
              type="button"
              onClick={() => setCurrentView('device_manager')}
              className="android-btn android-btn-accent w-full py-2.5 bg-[#FF4081] hover:bg-[#F50057] text-white uppercase font-medium rounded shadow transition flex items-center justify-center gap-2"
            >
              <span>Gestisci dispositivi selezionati</span>
              {targetDevice.isSet && (
                <span className="w-2 h-2 rounded-full bg-white ml-1" />
              )}
            </button>

            {/* includeClassicCheckBox */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                id="includeClassicCheckBox"
                type="checkbox"
                checked={includeClassic}
                onChange={(e) => setIncludeClassic(e.target.checked)}
                className="w-4 h-4 text-[#3F51B5] border-gray-300 rounded focus:ring-[#3F51B5] cursor-pointer"
              />
              <label
                htmlFor="includeClassicCheckBox"
                className="text-sm font-medium text-gray-800 cursor-pointer select-none"
              >
                Includi Bluetooth classico
              </label>
            </div>

            {/* rssi threshold section */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Soglia minima RSSI (dBm):</span>
                <span id="rssiValueText" className="font-bold text-gray-900 font-mono">
                  {minRssi} dBm
                </span>
              </div>
              <input
                id="rssiSeekBar"
                type="range"
                min="0"
                max="50"
                value={rssiProgress}
                onChange={(e) => setRssiProgress(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>-100 dBm (Lontano)</span>
                <span>-75 dBm (Standard)</span>
                <span>-50 dBm (Molto vicino)</span>
              </div>
            </div>

            {/* deviceListView */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Dispositivi rilevati ({filteredDevices.length})
              </div>

              <div
                id="deviceListView"
                className="flex-1 overflow-y-auto bg-white rounded border border-gray-300 shadow-inner max-h-[360px] divide-y divide-gray-200"
              >
                {filteredDevices.length > 0 ? (
                  filteredDevices.map((item) => (
                    <DeviceListItem
                      key={item.address}
                      item={item}
                      onSelect={handleDeviceSelected}
                      isTarget={targetDevice.isSet && targetDevice.mac === item.address}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 space-y-1">
                    <p className="text-sm">Nessun dispositivo rilevato</p>
                    <p className="text-xs">
                      {scanning
                        ? "Ricerca pacchetti BLE in corso con soglia " + minRssi + " dBm..."
                        : "Premi 'Avvia scansione BLE' per cercare tag e dispositivi nelle vicinanze."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* debugText inside ScrollView */}
            <div className="space-y-1 pt-1">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Log Database & Diagnostica
              </div>
              <div className="max-h-28 overflow-y-auto bg-[#F0F0F0] border border-gray-300 rounded p-2 debug-scroll">
                <pre
                  id="debugText"
                  className="font-mono text-[10px] text-gray-800 whitespace-pre-wrap leading-tight"
                >
                  {debugText}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Android Toast Overlay */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
