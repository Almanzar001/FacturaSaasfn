import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "badge",
        {
          "badge-default": variant === "default",
          "badge-secondary": variant === "secondary",
          "badge-destructive": variant === "destructive",
          "badge-outline": variant === "outline",
          "bg-success-100 text-success-700 hover:bg-success-100/80": variant === "success",
          "bg-warning-100 text-warning-700 hover:bg-warning-100/80": variant === "warning",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }