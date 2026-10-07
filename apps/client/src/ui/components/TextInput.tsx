import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextInput.module.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextInput({ label, className, ...rest }: Props) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <input id={id} className={[styles.input, className].filter(Boolean).join(' ')} {...rest} />
    </label>
  );
}
