import os
import pandas as pd
from typing import Optional

def map_studentlife_to_soulsync(
    student_activity_csv: Optional[str] = None,
    student_ema_stress_csv: Optional[str] = None,
    output_csv: Optional[str] = None
) -> pd.DataFrame:
    """
    Parses and maps StudentLife raw inputs to SoulSync's unified CSV schema.
    If no source files are provided, it generates a demo output mapping.
    """
    if student_activity_csv and os.path.exists(student_activity_csv) and student_ema_stress_csv and os.path.exists(student_ema_stress_csv):
        # Read raw StudentLife tables
        activity_df = pd.read_csv(student_activity_csv)
        stress_df = pd.read_csv(student_ema_stress_csv)
        
        # Merge on user_id and date
        merged = pd.merge(activity_df, stress_df, on=["user_id", "date"], how="inner")
        
        # Mapping rules:
        # sleep_duration_minutes -> sleep_hours = sleep_duration_minutes / 60
        # stress_ema_rating -> stress_score (1-5 or 1-10 mapping)
        mapped = pd.DataFrame()
        mapped["user_id"] = merged["user_id"]
        mapped["date"] = merged["date"]
        mapped["sleep_hours"] = merged["sleep_duration_minutes"] / 60.0
        mapped["activity_level"] = merged["active_time_ratio"]
        mapped["stress_score"] = merged["stress_level"]
        mapped["mood_score"] = merged["mood_level"]
    else:
        # Provide mapping pipeline template with sample DataFrame
        print("Source files not found or not provided. Generating template pipeline DataFrame.")
        sample_data = [
            {"user_id": "stud_01", "date": "2026-05-01", "sleep_duration_minutes": 450, "active_time_ratio": 0.65, "stress_level": 4, "mood_level": 7},
            {"user_id": "stud_01", "date": "2026-05-02", "sleep_duration_minutes": 320, "active_time_ratio": 0.22, "stress_level": 8, "mood_level": 4},
            {"user_id": "stud_02", "date": "2026-05-01", "sleep_duration_minutes": 480, "active_time_ratio": 0.75, "stress_level": 2, "mood_level": 8}
        ]
        merged = pd.DataFrame(sample_data)
        mapped = pd.DataFrame()
        mapped["user_id"] = merged["user_id"]
        mapped["date"] = merged["date"]
        mapped["sleep_hours"] = round(merged["sleep_duration_minutes"] / 60.0, 2)
        mapped["activity_level"] = merged["active_time_ratio"]
        # StudentLife stress range is typically 1-5, normalize to 1-10
        mapped["stress_score"] = merged["stress_level"] * 2
        mapped["mood_score"] = merged["mood_level"]
        
    if output_csv:
        os.makedirs(os.path.dirname(output_csv), exist_ok=True)
        mapped.to_csv(output_csv, index=False)
        print(f"Mapped StudentLife template to SoulSync CSV: {output_csv}")
        
    return mapped

if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    output_target = os.path.join(base_dir, "data", "processed", "studentlife_mapped.csv")
    map_studentlife_to_soulsync(output_csv=output_target)
