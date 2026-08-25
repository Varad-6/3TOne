"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Avatar = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium",
        className
      )}
      {...props}
    />
  );
});
Avatar.displayName = "Avatar";

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center text-foreground/70",
        className
      )}
      {...props}
    />
  );
});
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarFallback };
