export const Constants = {
  // Service UUID per FFE0 (16-bit)
  SERVICE_UUID_FFE0: "0000ffe0-0000-1000-8000-00805f9b34fb",
  // Nome del dispositivo iTAG (opzionale)
  DEVICE_NAME: "iTAG",
  // Soglia RSSI: -75 dBm significa "abbastanza vicino"
  RSSI_THRESHOLD: -75,
  // Tempo di presenza prima di dichiarare "vicino" (ms)
  NEAR_DEBOUNCE_MS: 5000,
  // Tempo di assenza prima di dichiarare "lontano" (ms)
  FAR_DEBOUNCE_MS: 15000,
  // Azioni broadcast
  ACTION_NEAR: "com.example.itagscanner.ITAG_NEAR",
  ACTION_FAR: "com.example.itagscanner.ITAG_FAR",
} as const;
