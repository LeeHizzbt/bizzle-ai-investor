# Ai Investor v4.20 — Test report

Build `2026-11-10.1846` · tested 2026-11-10 (ET). Not financial advice; paper trading only.

## Summary
| Suite | Result |
|---|---|
| Engine unit tests (`node tests/engine.test.js`) | 32/32 pass |
| Worker proxy tests (`node tests/proxy.test.mjs`) | 5/5 pass |
| Web e2e, LIVE Pages site (`tests/e2e.py --base https://leehizzbt.github.io/bizzle-ai-investor/`) | 32/33 pass |
| Web e2e, local (earlier full run on build .1825) | 33/33 pass |
| Android release APK on emulator (API 30 image, Android 11, WebView 83) | pass (details below) |

The 1 live failure is "Advanced AI Settings: Test AI key". It timed out after 90 s during the full suite because the free Gemini tier rate-limited the shared key (429), right after the suite's many other real-AI calls. A standalone re-run passed at once: `gemini-flash-latest` returned 429, it fell back to `gemini-flash-lite-latest` (200), and the result was "✓ gemini / gemini-3.5-flash-lite replied: OK". Every other real-AI check passed in the same run (rules, journal, chat, Bizzy, AI theme).

## Per width (live site, 11 routes each)
Each route was checked for no horizontal overflow, a themed back button, the not-financial-advice disclaimer, the neon v4.20 badge, and the Bizzy bubble.

| Width | Result |
|---|---|
| 360 | PASS |
| 390 | PASS |
| 768 | PASS |
| 1024 | PASS |
| 1440 | PASS |

## Android APK
- `com.nunyabizz.aiinvestor`, versionName 4.20.0, versionCode 420, minSdk 23, targetSdk 35. Release-signed (`apksigner verify` OK).
- SHA-256 `222ae6ede821063c74f0166d5fa2b9ebd2edbc0e2d466dab672ff36706c2cd48`, 3,888,892 bytes. The same file is on Pages and in the kief-releases tag.
- Checked on the emulator:
  - Install works.
  - The branded splash shows.
  - The first-run gate shows and can be accepted.
  - Home, Examples and Bizzy render.
  - Hardware back: Settings → Examples; it closes Bizzy if open; then Examples → Home; on Home it exits the app.
  - No horizontal overflow at 412 px.
  - No FATAL exceptions.
- Bugs this pass found and fixed:
  - Old WebView 83 ignored `inset:0`, which hid the gate modal. Now uses top/right/bottom/left.
  - `color-mix` now has fallbacks.
  - Hardware back fired twice. There is now a single `@capacitor/app` handler.
- Screenshots are in `test-shots/apk/`.

## Verified vs not
- Verified:
  - The engine is deterministic.
  - Fills happen at the real next open ± 5 bps.
  - The UI test run matches the engine exactly ($90,164.62, 31 trades, 2025-11-10→2026-11-10).
  - The hash-chained record detects tampering.
  - Keys are stored only as AES-GCM ciphertext.
  - Real Gemini works for rules, journal, chat, Bizzy and themes.
  - Error states work: no key, bad key, 429, offline.
- Not verified with real keys:
  - Massive/Polygon and Finnhub. There are no keys on the box, so they were mocked with real Yahoo daily bars saved as fixtures.
  - Finnhub news/profile/filings success path (only the 403 path was tested).
  - FRED (needs the proxy, which is not deployed).
