import { useEffect, useState } from "react";
import { X, Download, Share, Plus } from "lucide-react";

// Extend Window type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISSED_EXPIRY_DAYS = 14; // re-show after 14 days

function isAlreadyInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return daysSince < DISMISSED_EXPIRY_DAYS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isAlreadyInstalled() || wasDismissedRecently()) return;

    const ios = isIOS();
    // Only show iOS sheet in Safari (not Chrome/Firefox on iOS)
    const isSafari = ios && /safari/i.test(navigator.userAgent) && !/crios|fxios|opios/i.test(navigator.userAgent);

    if (isSafari) {
      // iOS Safari: show manual instructions after a short delay
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }

    if (!ios) {
      // Android / Chrome / Edge: check for pre-captured event first
      const preCapture = (window as Window & { __pwaInstallPrompt?: Event }).__pwaInstallPrompt;
      if (preCapture) {
        setDeferredPrompt(preCapture as BeforeInstallPromptEvent);
        const t = setTimeout(() => setVisible(true), 3000);
        return () => clearTimeout(t);
      }
      // Fallback: listen for the event if not yet fired
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (isIOS()) {
      setShowIOSSheet(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    markDismissed();
    setVisible(false);
    setShowIOSSheet(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* ── Install Banner ── */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
          left: "12px",
          right: "12px",
          zIndex: 9000,
          borderRadius: "16px",
          backgroundColor: "#1a3a0d",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            backgroundColor: "rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img
            src="/manus-storage/rc-logo_35809274.webp"
            alt=""
            style={{ width: "28px", height: "28px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
            Install Training Hub
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
            Add to your home screen for quick access
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#fff",
            color: "#1a3a0d",
            border: "none",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Download size={14} />
          Install
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            padding: "4px",
            cursor: "pointer",
            color: "rgba(255,255,255,0.5)",
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── iOS Instructions Sheet ── */}
      {showIOSSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9100,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={dismiss}
        >
          <div
            style={{
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
              animation: "slideUp 0.3s ease-out forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div style={{ width: "40px", height: "4px", borderRadius: "2px", backgroundColor: "#e5e7eb", margin: "0 auto 20px" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <img
                src="/manus-storage/rc-logo_35809274.webp"
                alt=""
                style={{ width: "48px", height: "48px", objectFit: "contain" }}
              />
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1a3a0d" }}>Install Training Hub</p>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>Add to your iPhone home screen</p>
              </div>
            </div>

            {/* Steps */}
            {[
              { icon: <Share size={20} color="#1a3a0d" />, text: <>Tap the <strong>Share</strong> button in Safari's toolbar</> },
              { icon: <Plus size={20} color="#1a3a0d" />, text: <>Scroll down and tap <strong>"Add to Home Screen"</strong></> },
              { icon: <Download size={20} color="#1a3a0d" />, text: <>Tap <strong>"Add"</strong> in the top right corner</> },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px",
                  backgroundColor: "rgba(26,58,13,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {step.icon}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#374151", lineHeight: 1.5 }}>{step.text}</p>
              </div>
            ))}

            <button
              onClick={dismiss}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "14px",
                backgroundColor: "#1a3a0d",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
