import os
import csv
import random
from datetime import datetime, timedelta

def generate_synthetic_data(output_path: str, num_days: int = 60):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    headers = [
        "user_id", "date", "mood_score", "stress_level", "energy_level", 
        "sleep_hours", "activity_minutes", "sentiment_score"
    ]
    
    user_id = "U001"
    start_date = datetime.now() - timedelta(days=num_days)
    
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        for i in range(num_days):
            current_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            
            # Base variables
            # Simulating some states: 
            # State 0: Normal/Balanced
            # State 1: High Stress / Poor Sleep
            # State 2: High Energy / Active
            state = random.choices([0, 1, 2], weights=[0.6, 0.25, 0.15])[0]
            
            if state == 1: # High Stress Period
                sleep_hours = round(random.uniform(4.5, 6.0), 1)
                stress_level = random.randint(7, 10)
                energy_level = random.randint(2, 5)
                # mood correlates negatively with stress
                mood_score = max(1, random.randint(3, 5))
                activity_minutes = random.choice([0, 0, 10, 15])
                sentiment_score = round(random.uniform(-0.8, -0.1), 2)
            elif state == 2: # Healthy / Productive Day
                sleep_hours = round(random.uniform(7.5, 9.0), 1)
                stress_level = random.randint(1, 3)
                energy_level = random.randint(8, 10)
                mood_score = random.randint(8, 10)
                activity_minutes = random.randint(30, 60)
                sentiment_score = round(random.uniform(0.5, 0.9), 2)
            else: # Normal / Balanced Day
                sleep_hours = round(random.uniform(6.5, 8.0), 1)
                stress_level = random.randint(3, 6)
                energy_level = random.randint(5, 7)
                mood_score = random.randint(6, 8)
                activity_minutes = random.randint(10, 30)
                sentiment_score = round(random.uniform(-0.1, 0.5), 2)
                
            writer.writerow([
                user_id,
                current_date,
                mood_score,
                stress_level,
                energy_level,
                sleep_hours,
                activity_minutes,
                sentiment_score
            ])

if __name__ == "__main__":
    target = os.path.join(os.path.dirname(__file__), "data", "synthetic", "synthetic_user_data.csv")
    generate_synthetic_data(target)
    print(f"Synthetic data generated at: {target}")
