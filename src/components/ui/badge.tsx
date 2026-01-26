import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        rent: "border-transparent bg-info text-info-foreground",
        sale: "border-transparent bg-primary text-primary-foreground",
        new: "border-transparent bg-success text-success-foreground",
        featured: "border-transparent bg-accent text-accent-foreground",
        olx: "border-transparent bg-amber-500 text-white",
        imovelweb: "border-transparent bg-navy-600 text-white",
        pending: "border-transparent bg-warning text-warning-foreground",
        approved: "border-transparent bg-success text-success-foreground",
        rejected: "border-transparent bg-destructive text-destructive-foreground",
        analyzing: "border-transparent bg-info text-info-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
