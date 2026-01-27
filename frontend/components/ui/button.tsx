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
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    {
                        "border-slate-700 bg-white text-slate-800 hover:bg-slate-50": variant === "default",
                        "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
                        "border-slate-700 bg-white text-slate-800 hover:bg-slate-50": variant === "outline",
                        "border-slate-700 bg-white text-slate-800 hover:bg-slate-50": variant === "secondary",
                        "border-slate-700 bg-white text-slate-800 hover:bg-slate-50": variant === "ghost",
                        "border-transparent bg-transparent text-slate-800 underline-offset-4 hover:underline": variant === "link",
                        "h-11 px-6 py-2.5": size === "default",
                        "h-9 px-4": size === "sm",
                        "h-12 px-8": size === "lg",
                        "h-10 w-10": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
