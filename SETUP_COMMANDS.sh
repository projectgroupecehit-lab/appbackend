#!/usr/bin/env bash

# ============================================================
# SMART WATER - AI INSIGHTS SETUP COMMANDS
# ============================================================
# This file contains all commands needed to set up the AI insights feature
# Copy and paste the commands in order
# ============================================================

# ===== Step 1: Install Node Dependencies =====
echo "📦 Installing Node.js dependencies..."
cd D:\SMART_WATER_APP\smart-water-backend
npm install

# ===== Step 2: Verify Python =====
echo "🐍 Checking Python installation..."
python --version

# ===== Step 3: Install Python Dependencies =====
echo "📚 Installing Python ML packages..."
pip install scikit-learn pandas joblib numpy

# ===== Step 4: Train ML Model =====
echo "🤖 Training ML model..."
cd D:\SMART_WATER_APP\smart-water-backend
python train_ml_model.py

# ===== Step 5: Verify Model Files Created =====
echo "✅ Checking for model files..."
ls D:\SMART_WATER_APP\smart-water-backend\*.pkl

# ===== Step 6: Start Backend =====
echo "🚀 Starting backend server..."
cd D:\SMART_WATER_APP\smart-water-backend
npm run dev

# ===== Alternative: Check if running =====
# In a new terminal, test the endpoint:
# curl -X GET http://localhost:4000/api/analysis/YOUR_DEVICE_ID \
#   -H "Authorization: Bearer YOUR_TOKEN"
