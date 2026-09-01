import React, { useEffect, useState, useRef } from "react";
import { motion, useSpring, useInView } from "framer-motion";

export function NumberTicker({
  value,
  duration = 2000,
  className,
  formatter = (v) => Math.round(v),
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });

  useEffect(() => {
    if (isInView) {
      springValue.set(value);
    }
  }, [isInView, value, springValue]);

  useEffect(() => {
    return springValue.onChange((latest) => {
      setDisplayValue(formatter(latest));
    });
  }, [springValue, formatter]);

  return (
    <span ref={ref} className={className}>
      {displayValue}
    </span>
  );
}
