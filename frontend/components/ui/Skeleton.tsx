"use client"

import React from "react"

interface SkeletonProps {
  className?: string
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  lines?: number
}

export default function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClass = "bg-muted animate-shimmer rounded"

  const variantStyles: Record<string, string> = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  }

  const style: React.CSSProperties = {
    width: width || (variant === "circular" ? height || 40 : "100%"),
    height: height || (variant === "text" ? 16 : variant === "circular" ? width || 40 : 48),
  }

  if (lines > 1 && variant === "text") {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClass} ${variantStyles.text}`}
            style={{
              ...style,
              width: i === lines - 1 ? "60%" : "100%",
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`${baseClass} ${variantStyles[variant]} ${className}`}
      style={style}
    />
  )
}

// Pre-built skeleton patterns
export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <Skeleton variant="text" width="30%" />
      <Skeleton variant="rectangular" height={200} />
    </div>
  )
}
