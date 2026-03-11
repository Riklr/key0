import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-button text-sm font-medium transition-all duration-300 ease-out outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:translate-y-[0.5px]",
  {
    variants: {
      variant: {
        default:
          "bg-[#1a1a1a] text-white shadow-neu hover:-translate-y-px hover:shadow-neu-hover active:shadow-neu-inset",
        destructive:
          "bg-[#1a1a1a] text-white shadow-neu hover:-translate-y-px hover:shadow-neu-hover active:shadow-neu-inset",
        outline:
          "border border-black/[0.08] bg-surface text-foreground shadow-neu-sm hover:-translate-y-px hover:shadow-neu",
        secondary:
          "bg-surface text-foreground shadow-neu-sm hover:-translate-y-px hover:shadow-neu active:shadow-neu-inset",
        ghost: "text-foreground hover:bg-black/[0.04]",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
