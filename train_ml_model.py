# -*- coding: utf-8 -*-
"""
Smart Water Quality ML Training
WHO Rule-Based Label + Gradient Boosting
Saves: gb_water_model.pkl and scaler.pkl
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report
import joblib
import os

# ======================================================
# 1. LOAD DATASET
# ======================================================

csv_path = "Water Quality Testing.csv"

if not os.path.exists(csv_path):
    print(f"⚠️  WARNING: {csv_path} not found!")
    print("Creating synthetic training data for demo...")
    
    # Create synthetic data if CSV doesn't exist
    np.random.seed(42)
    n_samples = 500
    
    df = pd.DataFrame({
        'ph': np.random.uniform(6.0, 8.5, n_samples),
        'turbidity': np.random.uniform(0.5, 8.0, n_samples),
        'conductivity': np.random.uniform(200, 600, n_samples),
        'dissolved_oxygen': np.random.uniform(5.5, 9.0, n_samples),
        'tds': np.random.uniform(100, 500, n_samples)
    })
    print(f"✅ Created {n_samples} synthetic samples")
else:
    df = pd.read_csv(csv_path)
    print("Original columns:")
    print(df.columns.tolist())
    
    # Normalize column names
    df.columns = df.columns.str.strip().str.lower()
    
    # Rename to ML-friendly names
    df = df.rename(columns={
        "turbidity (ntu)": "turbidity",
        "conductivity (µs/cm)": "conductivity",
        "dissolved oxygen (mg/l)": "dissolved_oxygen",
        "temperature (°c)": "temperature",
        "tds (ppm)": "tds"
    })

# ======================================================
# 2. TEMPERATURE FILTER (if temperature column exists)
# ======================================================

if "temperature" in df.columns:
    df = df[(df["temperature"] >= 20) & (df["temperature"] <= 30)]

# Calculate TDS if not available, assuming ec = conductivity
if "tds" not in df.columns and "conductivity" in df.columns:
    df["tds"] = df["conductivity"] * 0.64
    print("✅ TDS calculated from conductivity (TDS = conductivity * 0.64)")


# ======================================================
# 3. FEATURE SELECTION
# ======================================================

features = [
    "ph",
    "turbidity",
    "conductivity",
    "dissolved_oxygen",
    "tds"
]

# Select only features that exist
available_features = [f for f in features if f in df.columns]
print(f"Available features: {available_features}")

df = df[available_features]

print("Training features preview:")
print(df.head())

# Handle missing values
df = df.fillna(df.median(numeric_only=True))

# ======================================================
# 4. WHO RULE-BASED LABEL CREATION
# ======================================================

def who_label(row):
    if not (6.5 <= row["ph"] <= 8.5):
        return 0
    if row["turbidity"] >= 5:
        return 0
    if row["conductivity"] >= 400:
        return 0
    if "dissolved_oxygen" in row.index:
        if not (6.5 <= row["dissolved_oxygen"] <= 8):
            return 0
    if row["tds"] >= 400:
        return 0
    return 1

df["safe"] = df.apply(who_label, axis=1)

print("Label distribution:")
print(df["safe"].value_counts())

# ======================================================
# 5. TRAIN / TEST SPLIT
# ======================================================

X = df[available_features]
y = df["safe"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

# ======================================================
# 6. FEATURE SCALING
# ======================================================

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# ======================================================
# 7. GRADIENT BOOSTING MODEL
# ======================================================

gb_model = GradientBoostingClassifier(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=3,
    random_state=42
)

gb_model.fit(X_train_scaled, y_train)

# ======================================================
# 8. MODEL EVALUATION
# ======================================================

y_proba = gb_model.predict_proba(X_test_scaled)[:, 1]
y_pred = (y_proba >= 0.5).astype(int)

print("\n📊 Classification Report:")
print(classification_report(y_test, y_pred))

# ======================================================
# 9. WHO RULE CHECK (FOR APP USE)
# ======================================================

def who_rule_check(sample):
    if sample["ph"] < 6.5 or sample["ph"] > 8.5:
        return 0
    if sample["turbidity"] >= 5:
        return 0
    if sample["conductivity"] >= 400:
        return 0
    if "dissolved_oxygen" in sample:
        if sample["dissolved_oxygen"] < 6.5 or sample["dissolved_oxygen"] > 8:
            return 0
    if sample["tds"] >= 400:
        return 0
    return None

# ======================================================
# 10. HYBRID PREDICTION FUNCTION
# ======================================================

def hybrid_predict(sample_df, threshold=0.5):
    sample_dict = sample_df.iloc[0].to_dict()

    # WHO hard fail
    if who_rule_check(sample_dict) == 0:
        return {
            "Decision": 0,
            "Reason": "WHO rule violation",
            "ML_Probability": 0.0
        }

    sample_scaled = scaler.transform(sample_df)
    prob = gb_model.predict_proba(sample_scaled)[0][1]

    return {
        "Decision": int(prob >= threshold),
        "Reason": "ML confidence model",
        "ML_Probability": round(prob, 3)
    }

# ======================================================
# 11. TEST SAMPLES
# ======================================================

print("\n🧪 Test Predictions:")

sample_safe = pd.DataFrame([[
    7.2, 2.0, 300, 7.2, 192
]], columns=available_features)

sample_unsafe = pd.DataFrame([[
    5.8, 7.5, 600, 5.0, 384
]], columns=available_features)

print("Safe sample:", hybrid_predict(sample_safe))
print("Unsafe sample:", hybrid_predict(sample_unsafe))

# ======================================================
# 12. SAVE MODEL ARTIFACTS
# ======================================================

model_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(model_dir, "gb_water_model.pkl")
scaler_path = os.path.join(model_dir, "scaler.pkl")
features_path = os.path.join(model_dir, "model_features.pkl")

joblib.dump(gb_model, model_path)
joblib.dump(scaler, scaler_path)
joblib.dump(available_features, features_path)

print(f"\n✅ Model saved to: {model_path}")
print(f"✅ Scaler saved to: {scaler_path}")
print(f"✅ Features saved to: {features_path}")
