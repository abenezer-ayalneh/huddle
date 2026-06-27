import type { LucideIcon } from 'lucide-react';
import { type AnchorHTMLAttributes, forwardRef } from 'react';
import { iconButtonClass, type IconButtonStyle } from './IconButton';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> &
  IconButtonStyle & {
    icon: LucideIcon;
    label: string;
  };

// An anchor styled exactly like an IconButton, for actions that must be a real
// link rather than a click handler — e.g. a native browser download via
// `<a href download>` (docs/adr/0022), which a <button> can't do.
const IconLink = forwardRef<HTMLAnchorElement, Props>(({ icon: Icon, variant, size, label, className, ...rest }, ref) => (
  <a ref={ref} title={label} aria-label={label} className={iconButtonClass({ variant, size, className })} {...rest}>
    <Icon />
  </a>
));

IconLink.displayName = 'IconLink';
export default IconLink;
