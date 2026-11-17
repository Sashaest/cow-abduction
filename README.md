# Cow Abduction – Night Highway

Arcade 3D endless/level runner (Three.js) impacchettato per Android con Capacitor 8.

## Stack
| Layer | Tech |
|---|---|
| Gioco | `www/index.html` (HTML/CSS/JS ES module), Three.js r187 + addons (GLTFLoader, bloom) in `www/vendor/` (offline) |
| Modelli 3D | `www/models/*.glb` (ufo, cow, car, truck, tractor) generati da `tools/blender/models.py` (Blender 5.3 bpy) |
| Wrapper | Capacitor 8.6 · `@capacitor/app` (tasto Indietro) |
| Android | applicationId `com.sashaest.cowabduction` · minSdk 24 · target/compileSdk 36 · portrait · fullscreen immersivo |
| CI | `.github/workflows/android.yml` → AAB + APK firmati come artifact |

## Sorgenti
- `tools/src-parts/p*.{html,js}` → `sh tools/src-parts/build.sh` ricompone `www/index.html`.
- Modelli: `pip install bpy` → `python3 tools/blender/models.py --out www/models` (+ `--closeup` per render).
- Stile: low-poly hard-edge (mucche/veicoli, flat shading) + UFO dark sci-fi; bloom UnrealBloom soglia 0.86 solo con Qualità ALTA.
- Nodi GLB usati dal codice: `Head`, `LegFL/FR/BL/BR`, `Tail`, `Acc_Cyborg`, `Acc_Bull`, `Bell`, `LEDxx`; materiali ricolorati per nome: `Body`, `Spots`, `Pink`, `Hull`, `Neon`, `LED`, `Paint`, `Cargo`.
- Se i GLB non si caricano → fallback automatico ai modelli procedurali.

## Architettura `www/index.html`
1 Config/dati · 2 Salvataggio (localStorage) · 3 Audio Web Audio · 4 Mondo Three.js · 5 Modelli 3D · 6 Loop di gioco · 7 UI · 8 Input/main loop.

## Regole di gameplay (vincolanti)
- UFO in crociera `y=3.6`: auto/trattori passano sotto; camion e rocce colpiscono.
- Raggio attivo → UFO scende a `y=2.0`; qualsiasi veicolo nel raggio = danno.
- Aggancio mucca: mondo rallenta al 40%; rapimento in `1.5s × upgrade`.
- Close Call: veicolo supera l'UFO a 1.2–4.3 m laterali (raggio attivo o veicolo alto) → moltiplicatore +1 (max x5) + bullet-time.
- Spawn equo: mai 3 ostacoli alti in arrivo insieme (finestra 1.3 s).

## Flag (CFG in index.html)
- `HEARTS_ENABLED=false`, `IAP_ENABLED=false`, `AdService.enabled=false` → da attivare con AdMob/Play Billing.

## Build
Secret repo richiesti: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
Push su `main` o "Run workflow" → Actions → artifact `cow-abduction-N` (`app-release.aab` per Play Console, `app-release.apk` per installazione diretta).
`versionCode` = numero run Actions (cresce da solo).

## Dev locale
`npm run serve` → http://localhost:8080 (serve un server: i moduli ES non si caricano da file://).

## TODO
- AdMob rewarded (revive, raddoppio, cuori) via `AdService`
- Play Billing per "Pacchetto Illimitato"
- Privacy policy URL (obbligatoria in Play Console)
