import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split

def train_and_save_models():
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, "data", "synthetic", "synthetic_user_data.csv")
    
    if not os.path.exists(data_path):
        print(f"Data file not found at {data_path}. Running generator first...")
        from generate_synthetic import generate_synthetic_data
        generate_synthetic_data(data_path)
        
    df = pd.read_csv(data_path)
    
    # 1. Feature engineering for trend prediction
    # Feature inputs: avg_mood_3d, avg_mood_7d, mood_trend, avg_stress_3d, avg_stress_7d, stress_trend
    df['avg_mood_3d'] = df['mood_score'].rolling(window=3, min_periods=1).mean()
    df['avg_mood_7d'] = df['mood_score'].rolling(window=7, min_periods=1).mean()
    df['mood_trend'] = df['avg_mood_3d'] - df['avg_mood_7d']
    
    df['avg_stress_3d'] = df['stress_level'].rolling(window=3, min_periods=1).mean()
    df['avg_stress_7d'] = df['stress_level'].rolling(window=7, min_periods=1).mean()
    df['stress_trend'] = df['avg_stress_3d'] - df['avg_stress_7d']
    
    # Target: mood of the NEXT day relative to today
    # Target values: Improving, Stable, Declining
    df['next_day_mood'] = df['mood_score'].shift(-1)
    
    def label_trend(row):
        if pd.isna(row['next_day_mood']):
            return None
        diff = row['next_day_mood'] - row['mood_score']
        if diff > 0.5:
            return "Improving"
        elif diff < -0.5:
            return "Declining"
        else:
            return "Stable"
            
    df['target'] = df.apply(label_trend, axis=1)
    
    # Drop rows without targets
    train_df = df.dropna(subset=['target'])
    
    feature_cols = ['avg_mood_3d', 'avg_mood_7d', 'mood_trend', 'avg_stress_3d', 'avg_stress_7d', 'stress_trend']
    X = train_df[feature_cols]
    y = train_df['target']
    
    # Train Trend Classifier
    model = RandomForestClassifier(n_estimators=50, random_state=42)
    model.fit(X, y)
    
    # 2. Train Clustering (KMeans)
    # Features: mood, stress, energy, sleep
    X_cluster = df[['mood_score', 'stress_level', 'energy_level', 'sleep_hours']].values
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    kmeans.fit(X_cluster)
    
    # 3. Train Anomaly Detection (Isolation Forest)
    iso_forest = IsolationForest(contamination=0.1, random_state=42)
    iso_forest.fit(X_cluster)
    
    # Save all models
    models_dir = os.path.join(base_dir, "saved_models")
    os.makedirs(models_dir, exist_ok=True)
    
    joblib.dump(model, os.path.join(models_dir, "trend_predictor.joblib"))
    joblib.dump(kmeans, os.path.join(models_dir, "kmeans_clustering.joblib"))
    joblib.dump(iso_forest, os.path.join(models_dir, "isolation_forest.joblib"))
    
    print(f"Models successfully trained and saved to: {models_dir}")

if __name__ == "__main__":
    train_and_save_models()
