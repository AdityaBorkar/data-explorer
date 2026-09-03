import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "#/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium outline-none transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		defaultVariants: { size: "default", variant: "default" },
		variants: {
			size: {
				default: "h-7 px-2 text-xs",
				icon: "size-7",
				lg: "h-8 px-2.5 text-xs",
				sm: "h-6 px-2 text-xs",
				xs: "h-5 rounded-sm px-2 text-[0.625rem]",
			},
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/80",
				destructive:
					"bg-destructive/10 text-destructive hover:bg-destructive/20",
				ghost: "hover:bg-muted hover:text-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				outline: "border-border hover:bg-input/50 hover:text-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
			},
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	type = "button",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants>) {
	return (
		<button
			className={cn(buttonVariants({ className, size, variant }))}
			data-slot="button"
			type={type}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
