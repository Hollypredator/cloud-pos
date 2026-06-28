"use client";

import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";

export function SwipeableActionCard({
  children,
  action,
  actionLabel = "✓ Tamamlandı",
  actionBgClass = "bg-emerald-600",
  className = "",
  cardClassName = "",
  hiddenInputs,
}: {
  children: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  actionLabel?: string;
  actionBgClass?: string;
  className?: string;
  cardClassName?: string;
  hiddenInputs?: Record<string, string>;
}) {
  const [isSwiped, setIsSwiped] = useState(false);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const backgroundOpacity = useTransform(x, [0, 100], [0, 1]);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset if inputs change
  useEffect(() => {
    setIsSwiped(false);
    controls.set({ x: 0, opacity: 1 });
  }, [hiddenInputs, controls]);

  const handleDragEnd = async (event: any, info: any) => {
    if (info.offset.x > 110) {
      setIsSwiped(true);
      await controls.start({ x: 320, opacity: 0, transition: { duration: 0.18 } });
      formRef.current?.requestSubmit();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 350, damping: 22 } });
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-[18px] ${className}`}>
      {/* Background that reveals on swipe */}
      <motion.div 
        style={{ opacity: backgroundOpacity }}
        className={`absolute inset-0 flex items-center justify-start px-6 rounded-[18px] ${actionBgClass}`}
      >
        <span className="text-white font-bold text-sm uppercase tracking-wider">{actionLabel}</span>
      </motion.div>
      
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x, touchAction: "pan-y" }}
        className={`relative z-10 w-full h-full rounded-[18px] ${cardClassName}`}
      >
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none opacity-45">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </div>
        <form ref={formRef} action={action} className="hidden">
          {hiddenInputs && Object.entries(hiddenInputs).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
        {children}
      </motion.div>
    </div>
  );
}
