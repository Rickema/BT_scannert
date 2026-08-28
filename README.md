# iTAG Scanner (Web / React)

Applicazione web React + TypeScript riscritta a partire dall'applicazione nativa Android `com.example.itagscanner` per la scansione, il fingerprinting e il tracciamento di prossimità di dispositivi BLE (Bluetooth Low Energy) e Bluetooth classico, con particolare supporto per tag anti-smarrimento iTAG e beacon compatibili.

## Caratteristiche Portate

- **Interfaccia e Layout Android AppCompat**:
  - Layout fedele 1:1 con i componenti Android originali (`activity_main.xml`, `activity_device_manager.xml`, `device_list_item.xml`).
  - Palette originale Material Design (`colorPrimary`: `#3F51B5`, `colorPrimaryDark`: `#303F9F`, `colorAccent`: `#FF4081`).
  - Riproduzione dei messaggi nativi Toast Android con animazione di dissolvenza.

- **Database SIG e Assegnazione Numeri (`DatabaseManager`)**:
  - Gestione automatica e download delle specifiche ufficiali Bluetooth SIG (Company Identifiers, Service UUIDs, Appearance Values).
  - Cache locale (`localStorage`) con verifica dell'intervallo di aggiornamento a 30 giorni.
  - Fallback integrato per garantire il funzionamento istantaneo offline.
  - Visualizzatore di diagnostica e log di debug (`getDebugInfo()`).

- **Fingerprinting e Classificazione Intelligente (`BluetoothFingerprinter`)**:
  - Estrazione dei dati del produttore (Company ID: Apple `0x004C`, Samsung `0x0075`, Google `0x001D`, Microsoft `0x0006`, Tile `0x0131`, Nordic `0x0059`, Amazon `0x0157`, ecc.).
  - Riconoscimento dei Service UUID (iTAG `0000FFE0-...`, Fast Pair `0000FE2C-...`, A2DP `0000110B-...`, AVRCP, HFP).
  - Parsing del GAP Appearance (Tag, Audio/Cuffie, Computer, Watch, ecc.).
  - Estrazione del Model ID da Google Fast Pair.
  - Assegnazione del punteggio di confidenza (0–100%) e classificazione in categorie (Tracker, Audio, SmartTag/Find, Fast Pair device, ecc.).

- **Motore di Tracciamento e Prossimità (`ScannerService`)**:
  - Tracciamento del dispositivo target selezionato per indirizzo MAC, nome o UUID del servizio.
  - Soglia RSSI di prossimità a `-75 dBm`.
  - Logica di debounce per stato **VICINO** (`NEAR_DEBOUNCE_MS = 5000ms`) e trasmissione evento `ACTION_NEAR` con segnale acustico.
  - Logica di debounce per stato **LONTANO** (`FAR_DEBOUNCE_MS = 15000ms`) e trasmissione evento `ACTION_FAR` con segnale acustico.
  - Aggiornamento periodico dello stato ogni 10 secondi.

- **Gestione Dispositivi (`DeviceManagerActivity`)**:
  - Schermata dedicata "Dispositivi salvati" per ispezionare il target memorizzato.
  - Possibilità di dissociare o visualizzare lo stato di connessione in tempo reale.

- **Supporto Hardware Web Bluetooth & Simulatore**:
  - Supporto nativo Web Bluetooth API (`navigator.bluetooth.requestDevice`).
  - Simulatore integrato di beacon e pacchetti di advertisement BLE per test immediati su qualsiasi browser.

## Sviluppo ed Esecuzione

```bash
# Avvio in modalità sviluppo (porta 3000)
npm run dev

# Compilazione di produzione
npm run build
```
