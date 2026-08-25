import { useState, useEffect } from "react";

/**
 * Custom hook to debounce a value.
 * @param {any} value - The value to debounce
 * @param {number} [delay=500] - Delay in milliseconds (default: 500ms)
 * @returns {any} The debounced value
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
