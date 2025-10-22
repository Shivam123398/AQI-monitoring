"""
AeroGuard AI - ML Training Pipeline
Trains LSTM for 24-hour AQI forecasting and Random Forest for health risk classification
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# DATABASE CONNECTION
# ============================================================================
def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def fetch_training_data(days=90):
    """Fetch last N days of measurements for training"""
    conn = get_db_connection()
    query = """
        SELECT 
            m.measured_at,
            m.device_id,
            m.iaq_score,
            m.co2_equiv,
            m.temperature,
            m.humidity,
            m.pressure_hpa,
            m.pm25_api,
            m.aqi_calculated,
            m.aqi_category,
            d.latitude,
            d.longitude,
            EXTRACT(HOUR FROM m.measured_at) as hour_of_day,
            EXTRACT(DOW FROM m.measured_at) as day_of_week
        FROM measurements m
        JOIN devices d ON m.device_id = d.id
        WHERE m.measured_at >= NOW() - INTERVAL '%s days'
          AND m.aqi_calculated IS NOT NULL
        ORDER BY m.device_id, m.measured_at
    """
    df = pd.read_sql(query, conn, params=(days,))
    conn.close()
    return df

# ============================================================================
# AQI FORECASTING MODEL (LSTM)
# ============================================================================
def prepare_lstm_data(df, lookback=24, forecast_horizon=24):
    """
    Prepare sequences for LSTM: Use last 24 hours to predict next 24 hours
    """
    # Sort by device and time
    df = df.sort_values(['device_id', 'measured_at'])
    
    # Features
    feature_cols = ['aqi_calculated', 'iaq_score', 'temperature', 'humidity', 
                    'pressure_hpa', 'hour_of_day', 'day_of_week']
    
    # Normalize
    scaler = MinMaxScaler()
    df[feature_cols] = scaler.fit_transform(df[feature_cols].fillna(0))
    
    # Save scaler params for inference
    scaler_params = {
        'min': scaler.data_min_.tolist(),
        'max': scaler.data_max_.tolist(),
        'feature_cols': feature_cols
    }
    with open('models/scaler_params.json', 'w') as f:
        json.dump(scaler_params, f)
    
    X, y = [], []
    
    # Create sequences per device
    for device_id in df['device_id'].unique():
        device_data = df[df['device_id'] == device_id][feature_cols].values
        
        for i in range(len(device_data) - lookback - forecast_horizon):
            X.append(device_data[i:i+lookback])
            # Predict AQI only (first column)
            y.append(device_data[i+lookback:i+lookback+forecast_horizon, 0])
    
    return np.array(X), np.array(y), scaler

def build_lstm_model(lookback, n_features, forecast_horizon):
    """Build LSTM architecture"""
    model = keras.Sequential([
        layers.LSTM(128, return_sequences=True, input_shape=(lookback, n_features)),
        layers.Dropout(0.3),
        layers.LSTM(64, return_sequences=False),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu'),
        layers.Dense(forecast_horizon)  # Output: 24-hour forecast
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae']
    )
    
    return model

def train_aqi_forecaster():
    """Train LSTM for AQI forecasting"""
    print("\n=== Training AQI Forecaster (LSTM) ===\n")
    
    df = fetch_training_data(days=90)
    print(f"Loaded {len(df)} measurements from {df['device_id'].nunique()} devices")
    
    X, y, scaler = prepare_lstm_data(df, lookback=24, forecast_horizon=24)
    print(f"Prepared {len(X)} sequences")
    
    # Split
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Build and train
    model = build_lstm_model(lookback=24, n_features=X.shape[2], forecast_horizon=24)
    
    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True
    )
    
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=32,
        callbacks=[early_stop],
        verbose=1
    )
    
    # Evaluate
    val_loss, val_mae = model.evaluate(X_val, y_val)
    print(f"\nValidation MAE: {val_mae:.2f} AQI points")
    
    # Save model
    os.makedirs('models/aqi_lstm_model', exist_ok=True)
    model.save('models/aqi_lstm_model')
    print("Model saved to models/aqi_lstm_model/")
    
    return model

# ============================================================================
# HEALTH RISK CLASSIFICATION MODEL
# ============================================================================
def prepare_health_risk_data(df):
    """
    Prepare data for health risk prediction
    Labels based on exposure levels:
    - Low risk: Avg AQI < 50
    - Moderate risk: 50-100
    - High risk: 100-150
    - Very high risk: >150
    """
    # Aggregate by device and day
    df['date'] = pd.to_datetime(df['measured_at']).dt.date
    
    daily_agg = df.groupby(['device_id', 'date']).agg({
        'aqi_calculated': ['mean', 'max', 'std'],
        'iaq_score': 'mean',
        'temperature': 'mean',
        'humidity': 'mean',
        'pressure_hpa': 'mean'
    }).reset_index()
    
    daily_agg.columns = ['device_id', 'date', 'avg_aqi', 'max_aqi', 'std_aqi',
                         'avg_iaq', 'avg_temp', 'avg_hum', 'avg_pressure']
    
    # Create risk labels
    def assign_risk(row):
        if row['avg_aqi'] < 50:
            return 0  # Low
        elif row['avg_aqi'] < 100:
            return 1  # Moderate
        elif row['avg_aqi'] < 150:
            return 2  # High
        else:
            return 3  # Very High
    
    daily_agg['risk_level'] = daily_agg.apply(assign_risk, axis=1)
    
    # Features
    feature_cols = ['avg_aqi', 'max_aqi', 'std_aqi', 'avg_iaq', 
                    'avg_temp', 'avg_hum', 'avg_pressure']
    
    X = daily_agg[feature_cols].fillna(0).values
    y = daily_agg['risk_level'].values
    
    return X, y, feature_cols

def train_health_risk_model():
    """Train Random Forest for health risk classification"""
    print("\n=== Training Health Risk Classifier (Random Forest) ===\n")
    
    df = fetch_training_data(days=90)
    X, y, feature_cols = prepare_health_risk_data(df)
    
    print(f"Prepared {len(X)} daily aggregates")
    print(f"Risk distribution: {np.bincount(y)}")
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Train
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        random_state=42,
        class_weight='balanced'
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, 
                                target_names=['Low', 'Moderate', 'High', 'Very High']))
    
    # Feature importance
    importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    print("\nFeature Importance:")
    print(importance)
    
    # Save model (as sklearn model - convert to JSON for JS inference if needed)
    import pickle
    os.makedirs('models', exist_ok=True)
    with open('models/health_risk_model.pkl', 'wb') as f:
        pickle.dump(model, f)
    
    # Save metadata
    metadata = {
        'feature_cols': feature_cols,
        'classes': ['low', 'moderate', 'high', 'very_high'],
        'feature_importance': importance.to_dict('records')
    }
    with open('models/health_risk_metadata.json', 'w') as f:
        json.dump(metadata, f)
    
    print("Model saved to models/health_risk_model.pkl")
    
    return model

# ============================================================================
# DISEASE RISK SCORING (Rule-based + ML hybrid)
# ============================================================================
def calculate_disease_probabilities(exposure_data):
    """
    Calculate disease risk probabilities based on exposure
    Uses WHO epidemiological data correlations
    
    exposure_data: {
        'avg_pm25': float,
        'peak_pm25': float,
        'hours_unhealthy': int,
        'duration_days': int
    }
    
    Returns: {
        'asthma_risk': float (0-100),
        'copd_risk': float,
        'cardiovascular_risk': float,
        'allergy_risk': float
    }
    """
    pm25 = exposure_data['avg_pm25']
    peak = exposure_data['peak_pm25']
    hours = exposure_data['hours_unhealthy']
    
    # Baseline risk (WHO correlations - simplified)
    # Real implementation should use cohort study data
    
    # Asthma: Strong correlation with PM2.5
    asthma_base = min(100, (pm25 / 35.0) * 50)  # 35 µg/m³ = 50% risk
    asthma_peak_factor = 1 + (peak / 100.0) * 0.5
    asthma_risk = min(100, asthma_base * asthma_peak_factor)
    
    # COPD: Long-term exposure
    copd_risk = min(100, (pm25 / 50.0) * 40 + (hours / 720.0) * 30)  # 720h = 30 days
    
    # Cardiovascular: Acute + chronic
    cvd_risk = min(100, (pm25 / 40.0) * 35 + (peak / 150.0) * 40)
    
    # Allergy: Moderate correlation
    allergy_risk = min(100, (pm25 / 30.0) * 30)
    
    return {
        'asthma_risk': round(asthma_risk, 2),
        'copd_risk': round(copd_risk, 2),
        'cardiovascular_risk': round(cvd_risk, 2),
        'allergy_risk': round(allergy_risk, 2)
    }

# ============================================================================
# MAIN TRAINING PIPELINE
# ============================================================================
if __name__ == '__main__':
    print("="*60)
    print("AEROGUARD AI - ML TRAINING PIPELINE")
    print("="*60)
    
    # Ensure models directory
    os.makedirs('models', exist_ok=True)
    
    # Train AQI forecaster
    lstm_model = train_aqi_forecaster()
    
    # Train health risk classifier
    health_model = train_health_risk_model()
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("1. Copy models/ directory to backend deployment")
    print("2. Restart backend to load new models")
    print("3. Test predictions via /api/v1/predictions endpoint")