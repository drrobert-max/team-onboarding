import { useEffect, useRef, useState } from "react";

interface SplashScreenProps {
  /** When true, the splash will start fading out (after minimum display time) */
  isReady: boolean;
  onDone: () => void;
}

const MIN_DISPLAY_MS = 1200; // always show at least this long

export default function SplashScreen({ isReady, onDone }: SplashScreenProps) {
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);
  const mountTime = useRef(Date.now());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!isReady) return;

    const elapsed = Date.now() - mountTime.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, remaining);

    const doneTimer = setTimeout(() => {
      setVisible(false);
      doneRef.current();
    }, remaining + 600); // fade duration 600ms

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [isReady]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#1a3a0d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease-in-out",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          animation: "splashPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <img
          src="/manus-storage/rc-logo_35809274.webp"
          alt="Reformation Chiropractic"
          style={{
            height: "80px",
            width: "auto",
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.65)",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          Training Hub
        </span>
      </div>

      {/* Loading dots */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(48px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.45)",
              animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashPop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splashDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
