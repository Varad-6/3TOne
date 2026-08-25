import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [&_a:hover]:underline",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [&_a:hover]:underline",
        destructive:
          "border-transparent bg-destructive text-white [&_a:hover]:bg-destructive/90",
        outline:
          "text-foreground border border-input [&_a:hover]:bg-accent [&_a:hover]:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
