"use client"

import React from "react"

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  showValue?: boolean
  formatValue?: (v: number) => string
  colorClass?: string
  className?: string
}

export default function Slider({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  label,
  showValue = true,
  formatValue,
  colorClass = "accent-soul-purple",
  className = "",
}: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-foreground">{label}</label>
          )}
          {showValue && (
            <span className="text-sm font-bold text-soul-purple tabular-nums">
              {formatValue ? formatValue(value) : `${value}/${max}`}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <div className="absolute inset-0 h-2 rounded-full bg-muted top-1/2 -translate-y-1/2" />
        <div
          className="absolute h-2 rounded-full bg-gradient-to-r from-soul-purple to-soul-teal top-1/2 -translate-y-1/2 transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`
            relative w-full h-2 appearance-none bg-transparent cursor-pointer z-10
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-soul-purple
            [&::-webkit-slider-thumb]:shadow-glow-sm
            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-soul-purple
            ${colorClass}
          `}
        />
      </div>
    </div>
  )
}
