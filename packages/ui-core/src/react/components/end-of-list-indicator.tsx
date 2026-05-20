import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils.js";

export interface EndOfListIndicatorProps {
  message?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function EndOfListIndicator({
  message = "You've reached the end!",
  className,
  icon,
}: EndOfListIndicatorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 py-8 text-center text-muted-foreground",
        className,
      )}
    >
      {icon ?? <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}
