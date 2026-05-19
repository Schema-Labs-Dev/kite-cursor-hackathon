"use client";

import { ReactNode } from "react";
import { IPhone17 } from "./iphone-17";

type Props = {
  children?: ReactNode;
  width?: number;
  color?: "titanium" | "black" | "natural";
};

/**
 * iPhone 17 mockup with placeholder content. We'll swap the children for
 * real app screenshots once the mobile build is photogenic.
 */
export function PhoneScreen({ children, width = 280, color = "titanium" }: Props) {
  return (
    <IPhone17 width={width} color={color}>
      <div className="h-full w-full bg-black text-white">
        {children ?? <PlaceholderScreen />}
      </div>
    </IPhone17>
  );
}

export function PlaceholderScreen({ label = "balance" }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col px-6 pt-[18%]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/50">
        <span>{label}</span>
        <span className="font-mono">live</span>
      </div>
      <div className="mt-3 font-display text-[44px] leading-none tracking-tight">
        $0<span className="text-white/40">.00</span>
      </div>
      <div className="mt-1 font-mono text-[10px] text-white/40">usdc · base</div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {["hold", "send", "spend"].map((k) => (
          <div
            key={k}
            className="rounded-md border border-white/10 px-2 py-3 text-center text-[9px] uppercase tracking-[0.18em] text-white/60"
          >
            {k}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {[60, 84, 48, 72].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-white/10" />
            <div className="flex-1">
              <div className="h-2 rounded-sm bg-white/15" style={{ width: `${w}%` }} />
              <div
                className="mt-1 h-1.5 rounded-sm bg-white/10"
                style={{ width: `${w - 20}%` }}
              />
            </div>
            <div className="h-2 w-10 rounded-sm bg-white/10" />
          </div>
        ))}
      </div>

      <div className="mt-auto pb-6 text-center text-[9px] uppercase tracking-[0.25em] text-white/30">
        screen coming soon
      </div>
    </div>
  );
}
