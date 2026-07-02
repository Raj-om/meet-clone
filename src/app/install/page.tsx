"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── SVG Icons ─── */
const IconAndroid = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18V9a6 6 0 0 1 12 0v9M6 18H4m14 0h2m-8 4v-4m-4 4v-4m-2-5H2m20 0h-2"/>
    <circle cx="9" cy="11" r="1"/>
    <circle cx="15" cy="11" r="1"/>
  </svg>
);
const IconApple = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/>
    <path d="M10 2c1 .5 2 2 2 5"/>
  </svg>
);
const IconLaptop = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);
const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const steps = {
  android: [
    { num: "1", text: 'Open the share link in', highlight: 'Google Chrome' },
    { num: "2", text: 'Tap the', highlight: 'three-dot menu', suffix: 'at the top right' },
    { num: "3", text: 'Tap', highlight: '"Add to Home screen"', suffix: 'or "Install app"' },
    { num: "4", text: 'Tap', highlight: '"Install"', suffix: '— Done!' },
  ],
  ios: [
    { num: "1", text: 'Open the share link in', highlight: 'Safari (must be Safari!)' },
    { num: "2", text: 'Tap the', highlight: 'Share button', suffix: 'at the bottom' },
    { num: "3", text: 'Scroll down and tap', highlight: '"Add to Home Screen"' },
    { num: "4", text: 'Tap', highlight: '"Add"', suffix: '— Done!' },
  ],
  desktop: [
    { num: "1", text: 'Open the share link in', highlight: 'Google Chrome or Edge' },
    { num: "2", text: 'Look for the', highlight: 'Install icon', suffix: 'in the address bar (top right)' },
    { num: "3", text: 'Click it and select', highlight: '"Install"' },
    { num: "4", text: 'App opens as a', highlight: 'standalone native app!' },
  ],
};

export default function InstallPage() {
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "desktop">("android");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") { setInstalled(true); setInstallPrompt(null); }
    }
  };

  const tabs: { key: "android" | "ios" | "desktop"; label: string; Icon: ComponentType }[] = [
    { key: "android", label: "Android", Icon: IconAndroid },
    { key: "ios", label: "iPhone / iPad", Icon: IconApple },
    { key: "desktop", label: "PC / Laptop", Icon: IconLaptop },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #06030f 0%, #0d0520 40%, #050d1a 100%)",
      color: "white",
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>

      {/* Decorative gradient blob */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)" }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "480px" }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "18px",
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
            margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 10px 30px rgba(124,58,237,0.4), inset 0 2px 0 rgba(255,255,255,0.2)"
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="14" height="12" rx="2.5" fill="white"/>
              <path d="M16 10.5L21 8v8l-5-2.5V10.5Z" fill="white"/>
              <circle cx="9" cy="12" r="2.5" fill="#7c3aed"/>
            </svg>
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.5px" }}>Install MeetAI</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", margin: 0 }}>
            Install our secure app directly to your device. No app store required.
          </p>
        </div>

        {/* Browser Auto-Install Button */}
        {installPrompt && !installed && (
          <div style={{ marginBottom: "32px" }}>
            <button onClick={handleInstall} style={{
              width: "100%", padding: "18px", borderRadius: "16px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none", color: "white", fontSize: "16px", fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              boxShadow: "0 8px 24px rgba(16,185,129,0.4), inset 0 2px 0 rgba(255,255,255,0.2)",
              transition: "transform 0.1s"
            }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Install App Automatically
            </button>
            <div style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
              Supported on your current browser
            </div>
          </div>
        )}

        {installed && (
          <div style={{
            background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: "16px", padding: "24px", textAlign: "center", marginBottom: "32px",
            color: "#34d399"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px" }}>Successfully Installed!</h3>
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>Check your home screen or app drawer for the MeetAI app.</p>
          </div>
        )}

        {/* Manual Install Instructions */}
        {!installed && (
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px", overflow: "hidden", backdropFilter: "blur(20px)"
          }}>
            <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "8px" }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  flex: 1, padding: "10px 0", borderRadius: "12px", border: "none",
                  background: activeTab === t.key ? "rgba(124,58,237,0.2)" : "transparent",
                  color: activeTab === t.key ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  fontSize: "12px", fontWeight: 600, transition: "all 0.2s"
                }}>
                  <t.Icon />
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "24px" }}>
              {steps[activeTab].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", marginBottom: i === 3 ? 0 : "20px", alignItems: "flex-start" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: 700, color: "#c4b5fd", flexShrink: 0
                  }}>
                    {step.num}
                  </div>
                  <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5, paddingTop: "3px" }}>
                    {step.text}{' '}
                    <strong style={{ color: "white" }}>{step.highlight}</strong>
                    {step.suffix && ` ${step.suffix}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            color: "#c4b5fd", textDecoration: "none", fontSize: "14px", fontWeight: 600
          }}>
            <IconArrow /> Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
}
