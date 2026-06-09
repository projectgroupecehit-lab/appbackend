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

def who_rule_check(sample):
    """
    WHO Rule-Based Hard Fail
    """
    ph = sample.get('ph', 7.0)
    turbidity = sample.get('turbidity', 1.0)
    conductivity = sample.get('conductivity', 300)
    dissolved_oxygen = sample.get('dissolved_oxygen') or sample.get('disolved_oxygen', 7.0)
    tds = sample.get('tds', 200)

    if ph < 6.5 or ph > 8.5:
        return 0
    if turbidity >= 5:
        return 0
    if conductivity >= 400:
        return 0
    if dissolved_oxygen < 6.5 or dissolved_oxygen > 8:
        return 0
    if tds >= 400:
        return 0
    return None

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
        if who_rule_check(sample_data) == 0:
            return {
                "who_status": "Unsafe (WHO Rule Violation)",
                "ml_prediction": "Not Potable",
                "ml_probability": 0.0,
                "reason": "WHO safety thresholds exceeded"
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
            value = sample_data.get(feature) or sample_data.get('dissolved_oxygen') if feature == 'dissolved_oxygen' and 'dissolved_oxygen' not in sample_data else sample_data.get(feature, 0)
            # Handle typo variant
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
