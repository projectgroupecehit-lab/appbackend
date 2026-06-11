# -*- coding: utf-8 -*-
"""
Predict Water Quality using Trained ML Model
Accepts: JSON sample data via command line argument
Returns: JSON prediction result
"""

import json
import sys
import os
import joblib
import pandas as pd
import numpy as np

def get_float(sample, key, fallback):
    try:
        value = sample.get(key, fallback)
        return float(value) if value is not None else fallback
    except (TypeError, ValueError):
        return fallback

def who_rule_check(sample):
    """
    WHO-based hard fail using the dashboard thresholds.
    Best and acceptable ranges are not hard failures; only unsafe ranges fail.
    """
    ph = get_float(sample, 'ph', 7.0)
    turbidity = get_float(sample, 'turbidity', 1.0)
    conductivity = get_float(sample, 'conductivity', 300.0)
    dissolved_oxygen = sample.get('dissolved_oxygen')
    if dissolved_oxygen is None:
        dissolved_oxygen = sample.get('disolved_oxygen', 7.0)
    try:
        dissolved_oxygen = float(dissolved_oxygen)
    except (TypeError, ValueError):
        dissolved_oxygen = 7.0
    tds = get_float(sample, 'tds', 200.0)
    violations = []

    if ph < 6.5 or ph > 8.5:
        violations.append("pH outside 6.5-8.5")
    if turbidity > 5:
        violations.append("turbidity above 5 NTU")
    if conductivity > 1500:
        violations.append("conductivity above 1500 uS/cm")
    if dissolved_oxygen < 4.0:
        violations.append("dissolved oxygen below 4.0 mg/L")
    if tds > 1000:
        violations.append("TDS above 1000 mg/L")

    return violations

def predict_water_quality(sample_data):
    """
    Make water quality prediction using trained ML model
    """
    try:
        # Get model directory (same as this script)
        model_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(model_dir, "gb_water_model.pkl")
        scaler_path = os.path.join(model_dir, "scaler.pkl")
        features_path = os.path.join(model_dir, "model_features.pkl")

        # Check if model files exist
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            return {
                "who_status": "Model Not Found",
                "ml_prediction": "Error",
                "ml_probability": 0.0,
                "reason": "ML model files not found. Run: python train_ml_model.py"
            }

        # WHO hard rule check
        who_violations = who_rule_check(sample_data)
        if who_violations:
            return {
                "who_status": "Unsafe (WHO Rule Violation)",
                "ml_prediction": "Non-Potable Water",
                "ml_probability": 0.0,
                "reason": "; ".join(who_violations)
            }

        # Load model and scaler
        gb_model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        
        # Load features if available
        if os.path.exists(features_path):
            model_features = joblib.load(features_path)
        else:
            model_features = ['ph', 'turbidity', 'conductivity', 'dissolved_oxygen', 'tds']

        # Prepare features
        feature_values = []
        for feature in model_features:
            value = sample_data.get(feature)
            if feature == 'dissolved_oxygen' and value is None:
                value = sample_data.get('disolved_oxygen', 0)
            feature_values.append(float(value) if value is not None else 0.0)

        # Create DataFrame and scale
        sample_df = pd.DataFrame([feature_values], columns=model_features)
        scaled_data = scaler.transform(sample_df)

        # Make prediction
        probabilities = gb_model.predict_proba(scaled_data)
        prob = probabilities[0][1]  # Probability of class 1 (safe)

        # Determine safety
        threshold = 0.5
        is_safe = prob >= threshold

        return {
            "who_status": "Safe (Potable)" if is_safe else "Unsafe / Needs Treatment",
            "ml_prediction": "Potable Water" if is_safe else "Non-Potable Water",
            "ml_probability": round(float(prob), 3),
            "reason": "ML confidence model"
        }

    except Exception as e:
        return {
            "who_status": "Prediction Error",
            "ml_prediction": "Error",
            "ml_probability": 0.0,
            "reason": str(e)
        }

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print(json.dumps({
                "who_status": "Missing Input",
                "ml_prediction": "Error",
                "ml_probability": 0.0,
                "reason": "No sample data provided"
            }))
            sys.exit(1)

        # Parse input JSON
        sample_data = json.loads(sys.argv[1])
        
        # Make prediction
        result = predict_water_quality(sample_data)
        
        # Output JSON
        print(json.dumps(result))
        sys.exit(0)

    except json.JSONDecodeError as e:
        print(json.dumps({
            "who_status": "JSON Error",
            "ml_prediction": "Error",
            "ml_probability": 0.0,
            "reason": f"Invalid JSON input: {str(e)}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "who_status": "Error",
            "ml_prediction": "Error",
            "ml_probability": 0.0,
            "reason": str(e)
        }))
        sys.exit(1)
