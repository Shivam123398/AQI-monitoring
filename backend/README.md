# AeroGuard Backend

## Windows install notes (TensorFlow / Node 22)

This project can optionally use TensorFlow for AQI forecasts. On Windows with Node.js 22, installing `@tensorflow/tfjs-node` often fails due to missing prebuilt binaries and native build toolchain requirements.

What we changed:
- TensorFlow is now an optional dependency and is loaded at runtime only if available.
- If TensorFlow is not installed, the rest of the backend works; forecasts are simply disabled and logged.

How to install dependencies:
1. Open a terminal in this folder and run:
   - CMD:
     - `cd backend`
     - `npm install`

You may see warnings about `fast-jwt` (engine <22). They are safe to ignore; install will complete.

How to enable ML forecasts (optional):
- Option A (recommended): Use Node.js 20 LTS where prebuilt TensorFlow binaries are available.
  - Install Node 20, then run `npm install` again.
- Option B (build from source): Install Visual Studio Build Tools with the "Desktop development with C++" workload and a recent Windows SDK, then run `npm install`.
- Option C: Keep Node 22 and skip TensorFlow (default). Forecast APIs will return empty results; logs will note that ML is disabled.

Verification:
- TypeScript build: `npm run build` should succeed.
- Runtime: Starting the server requires environment variables (DATABASE_URL, JWT_SECRET, etc.). Provide them in a `.env` file before running `npm run dev`.

Notes:
- The `ENABLE_JOBS` env controls background jobs. If enabled and TensorFlow is not installed, the forecaster job will log that ML is unavailable and skip predictions.

