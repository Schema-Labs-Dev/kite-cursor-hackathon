"use client";

import { ReactNode } from "react";

type Color = "titanium" | "black" | "natural";

type Props = {
  width?: number;
  color?: Color;
  time?: string;
  children?: ReactNode;
};

/**
 * iPhone 17 Pro-style mockup. Hand-built since no maintained npm package
 * ships modern Dynamic Island devices. Titanium frame, side buttons, signal
 * cutouts, status bar with time.
 *
 * Pass content as children — it renders inside the screen safe area.
 */
export function IPhone17({
  width = 280,
  color = "titanium",
  time = "9:41",
  children,
}: Props) {
  // base ratio derived from iPhone 17 Pro (≈ 2.16:1)
  const height = Math.round(width * 2.06);
  const radius = width * 0.155;
  const screenInset = width * 0.012;
  const innerRadius = radius - screenInset;
  const islandTop = width * 0.07;
  const islandWidth = width * 0.31;
  const islandHeight = width * 0.083;

  const frame = COLORS[color];

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width, height }}
      aria-hidden
    >
      {/* outer frame */}
      <div
        className="absolute inset-0"
        style={{
          background: frame.frame,
          borderRadius: radius,
          boxShadow: frame.shadow,
        }}
      />
      {/* highlight ring */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow: frame.ring,
        }}
      />

      {/* side buttons — left side: action + vol up + vol down */}
      <SideButton left={-1.5} top={width * 0.27} h={width * 0.085} color={frame.btn} />
      <SideButton left={-1.5} top={width * 0.42} h={width * 0.155} color={frame.btn} />
      <SideButton left={-1.5} top={width * 0.62} h={width * 0.155} color={frame.btn} />
      {/* right side: power */}
      <SideButton right={-1.5} top={width * 0.42} h={width * 0.27} color={frame.btn} />

      {/* screen */}
      <div
        className="absolute overflow-hidden bg-black"
        style={{
          inset: screenInset,
          borderRadius: innerRadius,
        }}
      >
        {children}

        {/* dynamic island */}
        <div
          className="absolute left-1/2 z-20 -translate-x-1/2"
          style={{
            top: islandTop,
            width: islandWidth,
            height: islandHeight,
            background: "#020202",
            borderRadius: islandHeight / 2,
          }}
        >
          {/* camera lens */}
          <div
            className="absolute rounded-full"
            style={{
              right: islandHeight * 0.32,
              top: islandHeight * 0.22,
              width: islandHeight * 0.55,
              height: islandHeight * 0.55,
              background:
                "radial-gradient(circle at 32% 32%, #1f1a3a 0%, #0a0816 60%, #050310 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: "22%",
                background: "#0b0d22",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                inset: "42%",
                background: "rgba(255,255,255,0.06)",
              }}
            />
          </div>
        </div>

        {/* status bar */}
        <div
          className="absolute inset-x-0 z-10 flex items-center justify-between text-white"
          style={{
            top: islandTop + islandHeight * 0.05,
            paddingInline: width * 0.085,
            fontSize: width * 0.05,
            lineHeight: 1,
            height: islandHeight * 0.95,
          }}
        >
          <span style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>{time}</span>
          <StatusIcons size={width * 0.05} />
        </div>
      </div>
    </div>
  );
}

const COLORS: Record<
  Color,
  { frame: string; ring: string; btn: string; shadow: string }
> = {
  titanium: {
    frame:
      "linear-gradient(135deg, #e7e3bf 0%, #cfc7a4 35%, #b1aa86 70%, #e7e3bf 100%)",
    ring: "inset 0 0 0 1.2px #514a40, inset 0 0 0 3px rgba(255,255,255,0.45)",
    btn: "#f0ecd5",
    shadow:
      "0 30px 80px -20px rgba(0,0,0,0.35), 0 8px 24px -8px rgba(0,0,0,0.25)",
  },
  black: {
    frame:
      "linear-gradient(135deg, #2a2a2a 0%, #141414 40%, #050505 70%, #2a2a2a 100%)",
    ring: "inset 0 0 0 1.2px #000, inset 0 0 0 3px rgba(255,255,255,0.06)",
    btn: "#1a1a1a",
    shadow:
      "0 30px 80px -20px rgba(0,0,0,0.6), 0 8px 24px -8px rgba(0,0,0,0.4)",
  },
  natural: {
    frame:
      "linear-gradient(135deg, #c4c0b2 0%, #a8a395 40%, #7b7669 70%, #c4c0b2 100%)",
    ring: "inset 0 0 0 1.2px #3e382e, inset 0 0 0 3px rgba(255,255,255,0.35)",
    btn: "#b3aea0",
    shadow:
      "0 30px 80px -20px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.3)",
  },
};

function SideButton({
  left,
  right,
  top,
  h,
  color,
}: {
  left?: number;
  right?: number;
  top: number;
  h: number;
  color: string;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: left ?? undefined,
        right: right ?? undefined,
        top,
        width: 3,
        height: h,
        background: color,
        borderRadius: 1,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    />
  );
}

function StatusIcons({ size }: { size: number }) {
  const stroke = Math.max(1, size * 0.18);
  return (
    <span className="flex items-center" style={{ gap: size * 0.4 }}>
      {/* signal */}
      <svg
        viewBox="0 0 18 12"
        width={size * 1.55}
        height={size * 0.9}
        aria-hidden
      >
        {[3, 6, 10, 14].map((x, i) => (
          <rect
            key={i}
            x={x}
            y={9 - i * 2}
            width={2.5}
            height={3 + i * 2}
            rx={0.6}
            fill="white"
          />
        ))}
      </svg>
      {/* wifi */}
      <svg viewBox="0 0 16 12" width={size * 1.4} height={size * 0.95} aria-hidden>
        <path d="M1 5 C 5 1, 11 1, 15 5" stroke="white" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <path d="M3.5 7.5 C 6 5, 10 5, 12.5 7.5" stroke="white" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <circle cx={8} cy={10} r={1.1} fill="white" />
      </svg>
      {/* battery */}
      <span
        className="relative inline-block"
        style={{
          width: size * 1.7,
          height: size * 0.95,
          border: `${Math.max(1, stroke * 0.9)}px solid rgba(255,255,255,0.95)`,
          borderRadius: size * 0.18,
        }}
      >
        <span
          className="absolute"
          style={{
            inset: size * 0.1,
            width: `calc(100% - ${size * 0.2}px)`,
            height: `calc(100% - ${size * 0.2}px)`,
            background: "white",
            borderRadius: size * 0.08,
          }}
        />
        <span
          className="absolute"
          style={{
            right: -size * 0.22,
            top: "30%",
            width: size * 0.16,
            height: "40%",
            background: "rgba(255,255,255,0.7)",
            borderTopRightRadius: size * 0.06,
            borderBottomRightRadius: size * 0.06,
          }}
        />
      </span>
    </span>
  );
}
