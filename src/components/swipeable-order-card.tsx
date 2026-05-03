"use client";

import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";

export function SwipeableOrderCard({
  children,
  action,
  orderId,
  station,
  nextStatus,
  className = "",
  cardClassName = "",
}: {
  children: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  orderId: string;
  station: string;
  nextStatus: string;
  className?: string;
  cardClassName?: string;
}) {
  const [isSwiped, setIsSwiped] = useState(false);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const backgroundOpacity = useTransform(x, [0, 100], [0, 1]);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset state if props change (e.g., when the order is updated)
  useEffect(() => {
    setIsSwiped(false);
    controls.set({ x: 0, opacity: 1 });
  }, [nextStatus, controls]);

  const handleDragEnd = async (event: any, info: any) => {
    if (info.offset.x > 100) {
      setIsSwiped(true);
      await controls.start({ x: 300, opacity: 0, transition: { duration: 0.2 } });
      formRef.current?.requestSubmit();
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background that reveals on swipe */}
      <motion.div 
        style={{ opacity: backgroundOpacity }}
        className="absolute inset-0 flex items-center justify-start bg-emerald-500 px-6 rounded-[22px]"
      >
        <span className="text-white font-bold text-lg tracking-wide">✓ Sonraki Aşama</span>
      </motion.div>
      
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x, touchAction: "pan-y" }}
        className={`relative z-10 w-full h-full rounded-[22px] bg-white border shadow-sm ${cardClassName}`}
      >
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none opacity-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </div>
        <form ref={formRef} action={action} className="hidden">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="station" value={station} />
          <input type="hidden" name="nextStatus" value={nextStatus} />
        </form>
        {children}
      </motion.div>
    </div>
  );
}
