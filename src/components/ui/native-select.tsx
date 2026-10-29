import * as React from "react"
import { cn } from "cn"

// A plain <select> in the design tokens: keyboard and mobile friendly, shows labels, no popup library.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-11 w-full min-w-0 rounded-sm border border-input bg-surface px-2.5 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
