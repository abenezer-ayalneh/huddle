import type { LucideIcon } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'ghost' | 'subtle' | 'solid' | 'danger';

const base =
  'inline-flex items-center justify-center rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/30 disabled:opacity-50 disabled:pointer-events-none';

const sizes = {
  sm: 'h-7 w-7 [&>svg]:h-3.5 [&>svg]:w-3.5',
  md: 'h-8 w-8 [&>svg]:h-4 [&>svg]:w-4',
  lg: 'h-9 w-9 [&>svg]:h-5 [&>svg]:w-5',
} as const;

const variants: Record<Variant, string> = {
  ghost: 'hover:bg-white/15',
  subtle: 'bg-white/10 hover:bg-white/20',
  solid: 'bg-magenta text-black hover:brightness-110',
  danger: 'bg-destructive text-black hover:brightness-110',
};

// Shared styling so a non-button element (e.g. the IconLink anchor) can look
// identical to an IconButton without duplicating these class tables.
export type IconButtonStyle = { variant?: Variant; size?: keyof typeof sizes; className?: string };

export function iconButtonClass({ variant = 'ghost', size = 'md', className = '' }: IconButtonStyle = {}): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  IconButtonStyle & {
    icon: LucideIcon;
    label: string;
  };

const IconButton = forwardRef<HTMLButtonElement, Props>(({ icon: Icon, variant, size, label, className, ...rest }, ref) => (
  <button ref={ref} type="button" title={label} aria-label={label} className={iconButtonClass({ variant, size, className })} {...rest}>
    <Icon />
  </button>
));

IconButton.displayName = 'IconButton';
export default IconButton;
