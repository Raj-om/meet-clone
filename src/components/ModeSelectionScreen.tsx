"use client";

import React, { useState, useEffect, useCallback } from "react";

type SessionMode = "office" | "classroom" | "interview" | "exam";

interface Props {
  meetingId: string;
  displayName: string;
  isHost: boolean;
  onSelectMode: (mode: SessionMode) => void;
  onSkip: () => void;
}

interface ModeConfig {
  id: SessionMode;
  icon: string;
  title: string;
  subtitle: string;
  features: string[];
  accentColor: string;
  accentRgb: string;
  bestFor: string;
  badge?: string;
}

const MODES: ModeConfig[] = [
  {
    id: "office",
    icon: "🏢",
    title: "Office Mode",
    subtitle: "Standard business meeting",
    features: ["Video calls", "Chat", "Screen share", "AI fraud detection", "Recording"],
    accentColor: "#3b82f6",
    accentRgb: "59,130,246",
    bestFor: "Team meetings, client calls",
  },
  {
    id: "classroom",
    icon: "🏫",
    title: "Classroom Mode",
    subtitle: "Virtual learning environment",
    features: ["Attention monitoring", "Live quizzes", "Engagement heatmap", "Lecture fact-check", "Student analytics"],
    accentColor: "#7c3aed",
    accentRgb: "124,58,237",
    bestFor: "Online classes, tutoring, workshops",
  },
  {
    id: "interview",
    icon: "🎤",
    title: "Interview Mode",
    subtitle: "Professional candidate assessment",
    features: ["Eye contact scoring", "Stress analysis", "Confidence AI", "Flag timeline", "Interviewer notes"],
    accentColor: "#0d9488",
    accentRgb: "13,148,136",
    bestFor: "HR interviews, technical screenings",
  },
  {
    id: "exam",
    icon: "📝",
    title: "Exam Mode",
    subtitle: "Secure proctored assessment",
    features: ["Full anti-cheat AI", "Tab switch detection", "Object detection", "AI auto-grading", "Violation log"],
    accentColor: "#dc2626",
    accentRgb: "220,38,38",
    bestFor: "Exams, certifications, assessments",
    badge: "HIGH SECURITY",
  },
];

interface ModeCardProps {
  config: ModeConfig;
  selected: boolean;
  isHost: boolean;
  hostSelectedMode: SessionMode | null;
  onSelect: (mode: SessionMode) => void;
}

const ModeCard: React.FC<ModeCardProps> = ({ config, selected, isHost, hostSelectedMode, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isHostSelected = hostSelectedMode === config.id;
  const isActive = selected || isHostSelected;

  if (!isMounted) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "280px",
        minHeight: "340px",
        borderRadius: "20px",
        background: isActive ? `rgba(${config.accentRgb},0.12)` : "rgba(14,14,24,0.65)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderWidth: "1px 1px 1px 4px",
        borderStyle: "solid",
        borderColor: isActive 
          ? config.accentColor 
          : `rgba(255,255,255,0.08) rgba(255,255,255,0.08) rgba(255,255,255,0.08) ${config.accentColor}`,
        boxShadow: isActive
          ? `0 0 0 2px ${config.accentColor}, 0 0 40px rgba(${config.accentRgb},0.35), 0 20px 60px rgba(0,0,0,0.5)`
          : hovered
          ? `0 0 0 1px rgba(${config.accentRgb},0.5), 0 0 30px rgba(${config.accentRgb},0.2), 0 20px 50px rgba(0,0,0,0.4)`
          : "0 8px 32px rgba(0,0,0,0.4)",
        transform: pressed
          ? "translateY(-4px) scale(1.005)"
          : hovered || isActive
          ? "translateY(-8px) scale(1.02)"
          : "translateY(0) scale(1)",
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease, border-color 0.3s ease, background 0.3s ease",
        cursor: isHost ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        padding: "28px 24px 24px",
        overflow: "hidden",
      }}
      onMouseEnter={() => isHost && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isHost && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => isHost && onSelect(config.id)}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "20px",
          background: `radial-gradient(ellipse at top left, rgba(${config.accentRgb},0.08) 0%, transparent 70%)`,
          pointerEvents: "none",
          opacity: hovered || isActive ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
      {config.badge && (
        <div
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            padding: "3px 8px",
            borderRadius: "20px",
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.4)",
            color: "#f87171",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.8px",
            textTransform: "uppercase" as const,
          }}
        >
          {config.badge}
        </div>
      )}
      <div
        style={{
          fontSize: "48px",
          lineHeight: 1,
          marginBottom: "14px",
          filter: isActive
            ? `drop-shadow(0 0 12px rgba(${config.accentRgb},0.8))`
            : hovered
            ? `drop-shadow(0 0 8px rgba(${config.accentRgb},0.5))`
            : "none",
          transition: "filter 0.3s ease",
          userSelect: "none" as const,
        }}
      >
        {config.icon}
      </div>
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: isActive ? config.accentColor : "#f1f5f9",
          marginBottom: "4px",
          letterSpacing: "-0.3px",
          transition: "color 0.3s ease",
        }}
      >
        {config.title}
      </div>
      <div style={{ fontSize: "12.5px", color: "rgba(148,163,184,0.85)", marginBottom: "16px", lineHeight: 1.4 }}>
        {config.subtitle}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", display: "flex", flexDirection: "column", gap: "7px", flex: 1 }}>
        {config.features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "rgba(203,213,225,0.9)" }}>
            <span
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: `rgba(${config.accentRgb},0.18)`,
                border: `1px solid rgba(${config.accentRgb},0.4)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "9px",
                color: config.accentColor,
                flexShrink: 0,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div
        style={{
          fontSize: "11px",
          color: `rgba(${config.accentRgb},0.85)`,
          fontWeight: 500,
          padding: "6px 10px",
          background: `rgba(${config.accentRgb},0.08)`,
          borderRadius: "8px",
          marginBottom: "18px",
          border: `1px solid rgba(${config.accentRgb},0.15)`,
        }}
      >
        <span style={{ opacity: 0.6, marginRight: 4 }}>Best for:</span>
        {config.bestFor}
      </div>
      {isHost && (
        <button
          style={{
            width: "100%",
            padding: "11px 20px",
            borderRadius: "12px",
            border: `1.5px solid ${isActive ? config.accentColor : `rgba(${config.accentRgb},0.35)`}`,
            background: isActive ? config.accentColor : hovered ? `rgba(${config.accentRgb},0.15)` : "rgba(255,255,255,0.04)",
            color: isActive ? "#ffffff" : config.accentColor,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.3px",
            transition: "all 0.25s ease",
            boxShadow: isActive ? `0 4px 20px rgba(${config.accentRgb},0.45)` : "none",
            fontFamily: "inherit",
          }}
          onClick={(e) => { e.stopPropagation(); onSelect(config.id); }}
        >
          {selected ? "✓ Selected" : "Select"}
        </button>
      )}
      {!isHost && isHostSelected && (
        <div style={{ fontSize: "10.5px", color: config.accentColor, fontWeight: 600, textAlign: "center" as const, marginTop: "8px" }}>
          ★ Host selected this mode
        </div>
      )}
    </div>
  );
};

const ParticipantWaiting: React.FC<{ onSkip: () => void }> = ({ onSkip }) => {
  const [dots, setDots] = useState(".");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const iv = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onSkip]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "40px 48px",
        borderRadius: "20px",
        background: "rgba(14,14,24,0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(99,102,241,0.25)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        textAlign: "center" as const,
        maxWidth: "420px",
      }}
    >
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          border: "3px solid rgba(99,102,241,0.15)",
          borderTop: "3px solid #6366f1",
          animation: "spinPulse 1.1s linear infinite",
        }}
      />
      <div style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", letterSpacing: "-0.2px" }}>
        Waiting for host to select session mode{dots}
      </div>
      <div style={{ fontSize: "12.5px", color: "rgba(148,163,184,0.8)", maxWidth: "340px", lineHeight: 1.6 }}>
        Your host is in the meeting. Auto-entering room in <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{countdown}s</span>...
      </div>
      <button
        onClick={onSkip}
        style={{
          marginTop: "8px",
          padding: "11px 32px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#ffffff",
          border: "none",
          fontSize: "14px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 25px rgba(99,102,241,0.5)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          letterSpacing: "0.2px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.boxShadow = "0 6px 30px rgba(99,102,241,0.7)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 25px rgba(99,102,241,0.5)";
        }}
      >
        Join Meeting Now →
      </button>
    </div>
  );
};

const ModeSelectionScreen: React.FC<Props> = ({ meetingId, displayName, isHost, onSelectMode, onSkip }) => {
  const [selectedMode, setSelectedMode] = useState<SessionMode | null>(null);
  const [hostSelectedMode] = useState<SessionMode | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [skipHovered, setSkipHovered] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSelect = useCallback((mode: SessionMode) => setSelectedMode(mode), []);

  const handleConfirm = useCallback(() => {
    if (!selectedMode) return;
    setConfirmed(true);
    setTimeout(() => onSelectMode(selectedMode), 350);
  }, [selectedMode, onSelectMode]);

  const selectedConfig = MODES.find((m) => m.id === selectedMode);

  const metaItems = [
    { icon: "👤", value: isMounted ? displayName : "Guest", accent: false },
    { icon: "🔑", value: meetingId, accent: false },
    ...(isHost ? [{ icon: "👑", value: "Host", accent: true }] : []),
  ];

  if (!isMounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes blobFloat {
          0%   { transform: translate(0px,0px)     scale(1)    rotate(0deg);   }
          20%  { transform: translate(40px,-60px)  scale(1.08) rotate(15deg);  }
          40%  { transform: translate(-30px,30px)  scale(0.94) rotate(-10deg); }
          60%  { transform: translate(60px,50px)   scale(1.05) rotate(20deg);  }
          80%  { transform: translate(-50px,-20px) scale(0.97) rotate(-5deg);  }
          100% { transform: translate(0px,0px)     scale(1)    rotate(0deg);   }
        }
        @keyframes blobFloat2 {
          0%   { transform: translate(0px,0px)    scale(1.1)  rotate(0deg);   }
          25%  { transform: translate(-70px,40px) scale(0.95) rotate(-18deg); }
          50%  { transform: translate(50px,-50px) scale(1.12) rotate(25deg);  }
          75%  { transform: translate(-20px,70px) scale(0.98) rotate(-12deg); }
          100% { transform: translate(0px,0px)    scale(1.1)  rotate(0deg);   }
        }
        @keyframes blobFloat3 {
          0%   { transform: translate(0px,0px)     scale(0.95) rotate(0deg);   }
          30%  { transform: translate(80px,-30px)  scale(1.1)  rotate(20deg);  }
          60%  { transform: translate(-60px,-60px) scale(0.92) rotate(-15deg); }
          100% { transform: translate(0px,0px)     scale(0.95) rotate(0deg);   }
        }
        @keyframes spinPulse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0    rgba(99,102,241,0.5); }
          70%  { box-shadow: 0 0 0 12px rgba(99,102,241,0);   }
          100% { box-shadow: 0 0 0 0    rgba(99,102,241,0);   }
        }
        .mss-content { animation: fadeSlideUp 0.65s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflowY: "auto",
          overflowX: "hidden",
          background: "#07070f",
          fontFamily: "'Inter','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif",
          padding: "40px 20px",
        }}
      >
        {/* Orb 1 */}
        <div style={{ position: "fixed", top: "-20%", left: "-15%", width: "700px", height: "700px", borderRadius: "50%", background: "radial-gradient(circle,rgba(55,48,163,0.55) 0%,rgba(29,27,103,0.3) 50%,transparent 70%)", filter: "blur(80px)", animation: "blobFloat 18s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
        {/* Orb 2 */}
        <div style={{ position: "fixed", bottom: "-25%", right: "-10%", width: "800px", height: "800px", borderRadius: "50%", background: "radial-gradient(circle,rgba(88,28,135,0.45) 0%,rgba(59,7,100,0.25) 50%,transparent 70%)", filter: "blur(80px)", animation: "blobFloat2 22s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
        {/* Orb 3 */}
        <div style={{ position: "fixed", top: "30%", right: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle,rgba(15,23,82,0.65) 0%,rgba(23,37,84,0.4) 50%,transparent 70%)", filter: "blur(80px)", animation: "blobFloat3 14s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
        {/* Grain */}
        <div style={{ position: "fixed", inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`, backgroundRepeat: "repeat", backgroundSize: "128px 128px", pointerEvents: "none", zIndex: 1 }} />

        {/* Content */}
        <div className="mss-content" style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "1200px" }}>

          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "48px", textAlign: "center" as const }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 14px", borderRadius: "30px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", fontSize: "11px", fontWeight: 600, color: "#a5b4fc", letterSpacing: "0.8px", textTransform: "uppercase" as const, marginBottom: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 6px rgba(99,102,241,0.8)", animation: "pulseRing 2s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
              Pre-Join Configuration
            </div>

            <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, letterSpacing: "-1.2px", background: "linear-gradient(135deg,#e2e8f0 0%,#a5b4fc 50%,#818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1.15 }}>
              📡 Select Session Mode
            </h1>

            <p style={{ margin: 0, fontSize: "15px", color: "rgba(148,163,184,0.8)", fontWeight: 400, marginTop: "2px" }}>
              Choose the right mode for your meeting experience
            </p>

            {/* Meta bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "18px", padding: "8px 18px", borderRadius: "40px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {metaItems.map((chip, i) => (
                <React.Fragment key={i}>
                  <span style={{ fontSize: "11.5px", color: chip.accent ? "#86efac" : "rgba(203,213,225,0.7)", fontWeight: chip.accent ? 600 : 400, display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ opacity: 0.6 }}>{chip.icon}</span>{chip.value}
                  </span>
                  {i < metaItems.length - 1 && <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.1)" }} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Main area */}
          {!isHost && hostSelectedMode === null ? (
            <ParticipantWaiting onSkip={onSkip} />
          ) : (
            <>
              {isHost && (
                <p style={{ fontSize: "13px", color: "rgba(148,163,184,0.6)", marginBottom: "24px", textAlign: "center" as const }}>
                  Click a card to select, then confirm your choice below
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: "20px", width: "100%", marginBottom: "36px" }}>
                {MODES.map((mode) => (
                  <ModeCard key={mode.id} config={mode} selected={selectedMode === mode.id} isHost={isHost} hostSelectedMode={hostSelectedMode} onSelect={handleSelect} />
                ))}
              </div>

              {isHost && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", opacity: confirmed ? 0 : 1, transition: "opacity 0.3s ease" }}>
                  <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.7)", display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedConfig ? (
                      <>
                        <span>Mode selected:</span>
                        <span style={{ fontWeight: 700, color: selectedConfig.accentColor }}>{selectedConfig.icon} {selectedConfig.title}</span>
                      </>
                    ) : (
                      <span style={{ color: "rgba(100,116,139,0.6)" }}>No mode selected yet</span>
                    )}
                  </div>
                  <button
                    disabled={selectedMode === null}
                    onClick={handleConfirm}
                    onMouseEnter={() => setConfirmHovered(true)}
                    onMouseLeave={() => setConfirmHovered(false)}
                    style={{
                      padding: "14px 52px",
                      borderRadius: "14px",
                      background: selectedMode ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
                      border: "none",
                      color: selectedMode ? "#ffffff" : "rgba(255,255,255,0.3)",
                      fontSize: "15px",
                      fontWeight: 700,
                      cursor: selectedMode ? "pointer" : "not-allowed",
                      letterSpacing: "0.2px",
                      boxShadow: selectedMode ? (confirmHovered ? "0 6px 40px rgba(99,102,241,0.65),0 0 0 1px rgba(139,92,246,0.4)" : "0 4px 30px rgba(99,102,241,0.5),0 0 0 1px rgba(139,92,246,0.3)") : "none",
                      transform: selectedMode ? (confirmHovered ? "scale(1.03)" : "scale(1)") : "scale(0.98)",
                      transition: "all 0.25s ease",
                      fontFamily: "inherit",
                    }}
                  >
                    {confirmed ? "✓ Launching..." : "Confirm & Enter Room →"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Skip */}
          <div style={{ marginTop: "28px" }}>
            <button
              style={{ fontSize: "13px", color: skipHovered ? "rgba(203,213,225,0.9)" : "rgba(100,116,139,0.8)", cursor: "pointer", textDecoration: skipHovered ? "underline" : "none", transition: "color 0.2s ease", background: "none", border: "none", padding: "4px 8px", fontFamily: "inherit" }}
              onMouseEnter={() => setSkipHovered(true)}
              onMouseLeave={() => setSkipHovered(false)}
              onClick={onSkip}
            >
              Skip → Continue without selecting
            </button>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "28px", display: "flex", alignItems: "center", gap: "20px", opacity: 0.35 }}>
            {["🔒 End-to-end encrypted", "🤖 AI-powered", "⚡ Ultra-low latency"].map((tag) => (
              <span key={tag} style={{ fontSize: "11px", color: "rgba(148,163,184,1)", fontWeight: 500 }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ModeSelectionScreen;
