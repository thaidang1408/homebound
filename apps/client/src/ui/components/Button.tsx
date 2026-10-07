import type { ButtonHTMLAttributes } from 'react';
import { playUiClick } from '../../audio/sounds';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  onClick,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
      onClick={(e) => {
        playUiClick();
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
