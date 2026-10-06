export interface WeatherData {
  temperature_c: number
  feels_like_c: number
  humidity_percent: number
  weather_code: number
  weather_description: string
  wind_speed_kmh: number
  is_day: boolean
  uv_index: number | null
}

export interface AirQualityData {
  aqi: number
  aqi_label: string
  pm25: number | null
  pm10: number | null
}

export interface EnvironmentSnapshot {
  id: number
  user_id: number
  captured_at: string
  weather: WeatherData | null
  air_quality: AirQualityData | null
  city: string | null
  country_code: string | null
  sunrise: string | null
  sunset: string | null
  day_length_hours: number | null
  is_holiday: boolean
  holiday_name: string | null
}

export interface EnvironmentCurrent {
  weather: WeatherData
  air_quality: AirQualityData
  city: string
  country_code: string
  captured_at: string
}
