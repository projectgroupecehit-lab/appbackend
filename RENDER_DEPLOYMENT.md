# Render Deployment Guide

Deploy only this `smart-water-backend` folder as the Render web service source.

## Upload to GitHub

Include:

- `src/`
- `server.js`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `render.yaml`
- `requirements.txt`
- `predict_water_quality.py`
- `gb_water_model.pkl`
- `scaler.pkl`
- `model_features.pkl`

Do not include:

- `.env`
- `node_modules/`
- `dist/`
- `__pycache__/`

## Render Settings

If you create the service manually instead of using `render.yaml`, use:

- Environment: `Node`
- Build command: `npm ci && npm run build && python3 -m pip install -r requirements.txt`
- Start command: `npm start`

## Required Environment Variables

Set these in Render Dashboard:

```text
NODE_ENV=production
MONGO_URI=<your MongoDB Atlas connection string>
MONGO_DB_NAME=test
JWT_ACCESS_SECRET=<long random secret>
JWT_REFRESH_SECRET=<another long random secret>
GOOGLE_WEB_CLIENT_ID=<google web client id>
PYTHON_BIN=python3
MQTT_ENABLED=false
```

Optional:

```text
GROQ_API_KEY=<required only for AI insights>
GROQ_MODEL=llama-3.3-70b-versatile
CORS_ORIGINS=<comma-separated web origins, if you add a web client>
MQTT_ENABLED=true
MQTT_URL=<public mqtts/mqtt broker url>
MQTT_USERNAME=<broker username>
MQTT_PASSWORD=<broker password>
```

## After Deployment

Verify:

```text
https://<your-render-service>.onrender.com/api/health
```

Then update the React Native app API base URL to:

```text
https://<your-render-service>.onrender.com/api
```
