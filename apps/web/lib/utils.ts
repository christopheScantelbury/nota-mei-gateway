import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names using clsx and merges Tailwind conflicts with twMerge.
 * Use this instead of manual string concatenation for all className props.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
