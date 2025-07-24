import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "btn",
          {
            "btn-primary": variant === "default",
            "btn-destructive": variant === "destructive",
            "btn-outline": variant === "outline",
            "btn-secondary": variant === "secondary",
            "btn-ghost": variant === "ghost",
            "underline-offset-4 hover:underline": variant === "link",
            "btn-sm": size === "sm",
            "btn-lg": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }