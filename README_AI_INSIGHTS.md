# 🧠 AI Water Insights - Complete Implementation Guide

## Overview

This implementation adds a complete AI-powered water quality analysis system to your Smart Water App:

### Components:
1. **Frontend** - React Native screen to display AI insights
2. **Backend** - Node.js API endpoint that orchestrates ML + Groq/Llama
3. **ML Model** - Trained Gradient Boosting classifier with WHO rules
4. **Groq/Llama Integration** - AI-generated expert reports

---

## 📋 What Was Implemented

### Frontend Changes:
- ✅ **WaterInsightsScreen.tsx** - New screen showing water quality analysis
- ✅ **DashboardScreen.tsx** - Added "🧠 View AI Water Insights" button
- ✅ **App.tsx** - Added navigation route
- ✅ **api.ts** - Added analysisAPI service

### Backend Changes:
- ✅ **analysis.controller.ts** - API endpoint handler
- ✅ **analysis.service.ts** - Core analysis logic (ML + Groq/Llama)
- ✅ **analysis.routes.ts** - Route definition
- ✅ **index.ts** - Initialize ML service on startup
- ✅ **routes/index.ts** - Register analysis routes

### New Scripts:
- ✅ **train_ml_model.py** - Trains and saves ML model
- ✅ **predict_water_quality.py** - Prediction endpoint (called by Node.js)
- ✅ **SETUP_AI_INSIGHTS.md** - Detailed setup guide
- ✅ **SETUP_COMMANDS_WINDOWS.ps1** - PowerShell command reference

---

## 🚀 Quick Start (5 minutes)

### Terminal 1: Install & Train Model

```bash
cd D:\SMART_WATER_APP\smart-water-backend

# Install dependencies
npm install

# Install Python ML packages
pip install scikit-learn pandas joblib numpy

# Train ML model (creates .pkl files)
python train_ml_model.py

# Verify model files exist
dir *.pkl
```

### Terminal 2: Start Backend

```bash
cd D:\SMART_WATER_APP\smart-water-backend
npm run dev
```

**Expected output:**
```
✅ ML service initialized (uses Python subprocess)
Server running on port 4000
```

### Terminal 3: Start Frontend

```bash
cd D:\SMART_WATER_APP
npx react-native start --reset-cache
```

### Terminal 4: Run Android

```bash
cd D:\SMART_WATER_APP
npx react-native run-android
```

---

## 🧪 Test the Endpoint

**PowerShell:**
```powershell
$deviceId = "your_device_id"
$token = "your_access_token"

$response = Invoke-RestMethod `
    -Uri "http://localhost:4000/api/analysis/$deviceId" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

$response | ConvertTo-Json
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "who_status": "Safe (Potable)",
    "ml_prediction": "Potable Water",
    "ml_probability": 0.95,
    "ai_insights": "### 1. Water Quality Classification\n\n..."
  }
}
```

---

## 📁 File Structure

```
smart-water-backend/
├── train_ml_model.py                # ← Training script
├── predict_water_quality.py          # ← Prediction endpoint
├── gb_water_model.pkl               # ← Trained model (created by train script)
├── scaler.pkl                       # ← Feature scaler (created by train script)
├── model_features.pkl               # ← Feature list (created by train script)
├── SETUP_AI_INSIGHTS.md             # ← Detailed setup guide
├── SETUP_COMMANDS_WINDOWS.ps1       # ← Command reference
├── package.json                     # ← Dependencies (added axios-based Groq API call)
├── src/
│   ├── index.ts                     # ← (modified) Initialize ML service
│   ├── controllers/
│   │   └── analysis.controller.ts   # ← New analysis API controller
│   ├── services/
│   │   └── analysis.service.ts      # ← New ML + Groq/Llama service
│   └── routes/
│       ├── index.ts                 # ← (modified) Register analysis routes
│       └── analysis.routes.ts       # ← New analysis routes

src/ (frontend)
├── services/
│   └── api.ts                       # ← (modified) Added analysisAPI
├── screens/
│   ├── DashboardScreen.tsx          # ← (modified) Added AI button
│   └── WaterInsightsScreen.tsx      # ← New insights screen
└── App.tsx                          # ← (modified) Added navigation route
```

---

## 🔄 How It Works

### User Flow:
```
1. User views Dashboard
2. User clicks "🧠 View AI Water Insights" button
3. Frontend navigates to WaterInsightsScreen
4. Screen fetches: GET /api/analysis/:deviceId
5. Backend:
   - Gets latest telemetry from MongoDB
   - Calls Python subprocess (predict_water_quality.py)
   - Python runs: WHO rules → ML model → probability
   - Backend calls Groq API with Llama 3.3 70B Versatile for expert insights
   - Returns complete analysis
6. Frontend displays:
   - WHO status (colored badge)
   - ML confidence (%)
   - Groq/Llama insights (scrollable)
```

### ML Model Flow:
```
Input: [pH, Turbidity, Conductivity, Dissolved Oxygen, TDS]
         ↓
WHO Hard Rules Check (immediate fail if violated)
         ↓
Standard Scaler (normalize features)
         ↓
Gradient Boosting Classifier (300 estimators)
         ↓
Output: [Probability (0-1), Confidence Score]
```

---

## ⚙️ Configuration

### `.env` File (Backend)
```
GROQ_API_KEY=gsk_...
MONGO_URI=mongodb+srv://<user>:<pass>@water-monitor.uyei05r.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=test
NODE_ENV=development
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```

### ML Model Training Defaults
- **Test Size**: 25%
- **Random State**: 42 (reproducible)
- **Scaler**: StandardScaler
- **Model**: GradientBoostingClassifier
  - n_estimators: 300
  - learning_rate: 0.05
  - max_depth: 3

### WHO Safety Thresholds
```
Safe if ALL of:
- 6.5 ≤ pH ≤ 8.5
- Turbidity < 5 NTU
- Conductivity < 400 µS/cm
- 6.5 ≤ Dissolved Oxygen ≤ 8 mg/L
- TDS < 400 ppm
```

---

## 🔍 Troubleshooting

### Issue: "Model files not found"
```bash
cd D:\SMART_WATER_APP\smart-water-backend
python train_ml_model.py
dir *.pkl  # Verify files created
```

### Issue: "GROQ_API_KEY not found"
1. Check `.env` exists in backend root
2. Has: `GROQ_API_KEY=gsk_...`
3. Restart: `npm run dev`

### Issue: "No telemetry data found"
1. Device must send data to MongoDB first
2. Use Dashboard to generate telemetry
3. Wait 5-10 seconds before calling analysis

### Issue: "Python not found"
```bash
python --version  # Verify Python installed
# If not found, add to PATH or use full path:
C:\Python311\python.exe train_ml_model.py
```

### Issue: "ModuleNotFoundError: scikit-learn"
```bash
pip install --upgrade scikit-learn pandas joblib numpy
```

### Issue: "Groq AI insights disabled"
Set `GROQ_API_KEY` in `.env` and restart the backend.

### Debug Python Prediction
```bash
# Test predict script directly
python predict_water_quality.py '{"ph": 7.2, "turbidity": 2.0, "conductivity": 300, "dissolved_oxygen": 7.2, "tds": 192}'

# Should output JSON:
# {"who_status": "Safe (Potable)", "ml_prediction": "Potable Water", "ml_probability": 0.95, "reason": "ML confidence model"}
```

---

## 📊 Dependencies Added

### Backend (Node.js)
```json
{
  "axios": "^1.13.2"
}
```

### Python
```
scikit-learn >= 1.0.0
pandas >= 1.0.0
joblib >= 1.0.0
numpy >= 1.20.0
```

---

## ✅ Verification Checklist

- [ ] Python installed: `python --version`
- [ ] ML packages: `pip list | findstr scikit`
- [ ] Node modules: `dir node_modules | findstr axios`
- [ ] Model trained: `dir *.pkl` (shows 3 files)
- [ ] Backend running: `npm run dev`
- [ ] API responds: `GET http://localhost:4000/api/analysis/:deviceId`
- [ ] Frontend loads: `npx react-native start`
- [ ] App runs: `npx react-native run-android`
- [ ] Button works: Dashboard → click AI button → see insights

---

## 🎯 Next Steps

1. **Follow setup**: See [SETUP_AI_INSIGHTS.md](SETUP_AI_INSIGHTS.md)
2. **Run commands**: Use [SETUP_COMMANDS_WINDOWS.ps1](SETUP_COMMANDS_WINDOWS.ps1)
3. **Test endpoint**: Verify API response
4. **Test frontend**: Click button on Dashboard
5. **Customize model**: Edit `train_ml_model.py` if needed

---

## 🔐 Security Notes

- ✅ **No Groq API key on mobile** - Backend-only
- ✅ **No ML logic on frontend** - Backend-only
- ✅ **Requires authentication** - JWT token needed for `/api/analysis`
- ✅ **Model offline** - Works without internet (Python runs locally)

---

## 📞 Support

For detailed instructions, see:
- [SETUP_AI_INSIGHTS.md](SETUP_AI_INSIGHTS.md) - Complete setup guide
- [SETUP_COMMANDS_WINDOWS.ps1](SETUP_COMMANDS_WINDOWS.ps1) - Command reference
- Backend logs: `npm run dev`
- Python logs: Run scripts directly to see output

---

**🎉 Your AI Water Insights system is ready to deploy!**

