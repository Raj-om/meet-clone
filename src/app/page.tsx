"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import "./globals.css";

const Scene3D = dynamic(() => import("@/components/HomeScene3D"), { ssr: false });

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type IconProps = SVGProps<SVGSVGElement>;

const VideoIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="2.5" y="5.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="m15.5 10 5-2.7v9.4l-5-2.7v-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const ArrowIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ShieldIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path d="M12 2.8 20 6v5.7c0 4.7-3.2 8.2-8 9.8-4.8-1.6-8-5.1-8-9.8V6l8-3.2Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="m8.6 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SparkIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path d="M12 2c.6 5.2 3.2 7.8 8 8.5-4.8.7-7.4 3.3-8 8.5-.6-5.2-3.2-7.8-8-8.5C8.8 9.8 11.4 7.2 12 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M19 16c.2 1.9 1.2 2.9 3 3.2-1.8.3-2.8 1.3-3 3.2-.2-1.9-1.2-2.9-3-3.2 1.8-.3 2.8-1.3 3-3.2Z" fill="currentColor" />
  </svg>
);

const CaptionIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M6.5 10h4m3 0h4m-11 4h3m3 0h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const LockIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="4" y="10" width="16" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const FEATURES: Array<{ Icon: ComponentType<IconProps>; title: string; copy: string; tone: string }> = [
  { Icon: ShieldIcon, title: "Deepfake defense", copy: "Continuous face and voice authenticity signals during every call.", tone: "violet" },
  { Icon: CaptionIcon, title: "Live intelligence", copy: "Captions, summaries and action items produced while you meet.", tone: "cyan" },
  { Icon: LockIcon, title: "Privacy first", copy: "Sensitive analysis stays close to your meeting—not in an ad profile.", tone: "emerald" },
];

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [meetingCode, setMeetingCode] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  const startNewMeeting = () => {
    const code = Math.floor(100000000 + Math.random() * 900000000).toString();
    sessionStorage.setItem(`meet-host-${code}`, "true");
    router.push(`/meet/${code}/lobby`);
  };

  const joinMeeting = () => {
    const code = meetingCode.trim().replace(/[^a-zA-Z0-9]/g, "");
    if (code) router.push(`/meet/${code}/lobby`);
  };

  const installApp = async () => {
    if (!installPrompt) {
      router.push("/install");
      return;
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || "Account";
  const initial = firstName.charAt(0).toUpperCase();

  if (!mounted) return null; // Avoid hydration mismatch on server vs client

  return (
    <div className="landing-shell">
      <div className="scene-layer" aria-hidden="true"><Scene3D /></div>
      <div className="noise-layer" aria-hidden="true" />

      <header className="premium-nav">
        <button className="brand" onClick={() => router.push("/")} aria-label="MeetAI home">
          <span className="brand-mark"><VideoIcon /></span>
          <span className="brand-copy">
            <strong>MeetAI</strong>
            <small>Secure intelligence</small>
          </span>
        </button>

        <div className="nav-actions">
          <button className="nav-install" onClick={installApp}>
            <DownloadIcon />
            <span>{installPrompt ? "Install" : "Get app"}</span>
          </button>
          {session?.user ? (
            <button className="profile-button" onClick={() => signOut()} title="Sign out">
              <span className="profile-initial">{initial}</span>
              <span>{firstName}</span>
            </button>
          ) : (
            <button className="sign-in-button" onClick={() => router.push("/login")}>Sign in</button>
          )}
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-copy">
          <div className="eyebrow"><span /> AI-protected video collaboration</div>
          <h1>
            Meet naturally.
            <span>AI watches the risks.</span>
          </h1>
          <p className="hero-description">
            Premium video meetings with real-time deepfake defense, intelligent captions,
            meeting summaries and purpose-built AI dashboards.
          </p>

          <div className="meeting-actions">
            <button className="new-meeting" onClick={startNewMeeting}>
              <VideoIcon />
              New meeting
              <span className="button-shine" aria-hidden="true" />
            </button>
            <div className="join-control">
              <input
                aria-label="Meeting code"
                placeholder="Enter meeting code"
                value={meetingCode}
                onChange={(event) => setMeetingCode(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && joinMeeting()}
              />
              <button onClick={joinMeeting} disabled={!meetingCode.trim()} aria-label="Join meeting">
                Join <ArrowIcon />
              </button>
            </div>
          </div>

          <div className="trust-row">
            <span><ShieldIcon /> Live authenticity checks</span>
            <span><LockIcon /> Privacy-focused AI</span>
          </div>
        </section>

        <section className="intelligence-visual" aria-label="AI protection dashboard preview">
          <div className="visual-glow" aria-hidden="true" />
          <div className="dashboard-frame">
            <div className="frame-topbar">
              <div className="frame-dots"><i /><i /><i /></div>
              <span>LIVE MEETING · 09:42</span>
              <div className="secure-chip"><LockIcon /> Encrypted</div>
            </div>

            <div className="video-stage">
              <div className="identity-ring ring-one" />
              <div className="identity-ring ring-two" />
              <div className="face-grid" aria-hidden="true">
                <span className="face-head" />
                <span className="face-body" />
                <span className="scan-line" />
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              </div>
              <div className="auth-badge"><ShieldIcon /><span><strong>AUTHENTIC</strong><small>98.7% confidence</small></span></div>
              <div className="voice-wave" aria-label="Voice signal">
                {[16, 28, 40, 22, 34, 48, 30, 18, 42, 26, 38, 20].map((height, index) => (
                  <i key={index} style={{ height, animationDelay: `${index * 70}ms` }} />
                ))}
              </div>
            </div>

            <div className="signal-grid">
              <div><span>Face integrity</span><strong>99.2%</strong><i><b style={{ width: "99.2%" }} /></i></div>
              <div><span>Voice integrity</span><strong>97.8%</strong><i><b style={{ width: "97.8%" }} /></i></div>
              <div><span>Network trust</span><strong>Secure</strong><i><b style={{ width: "94%" }} /></i></div>
            </div>

            <div className="ai-ticker"><SparkIcon /> AI monitoring active <span>•</span> No anomalies detected</div>
          </div>
          <div className="floating-card card-left"><span className="status-orb" /><div><small>Deepfake shield</small><strong>Active</strong></div></div>
          <div className="floating-card card-right"><CaptionIcon /><div><small>Live captions</small><strong>Listening…</strong></div></div>
        </section>
      </main>

      <section className="feature-section" aria-label="Core features">
        <div className="feature-heading">
          <span>Built for trust</span>
          <h2>Everything important. Nothing noisy.</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ Icon, title, copy, tone }) => (
            <article className={`feature-card ${tone}`} key={title}>
              <div className="feature-icon"><Icon /></div>
              <div><h3>{title}</h3><p>{copy}</p></div>
              <span className="card-index">0{FEATURES.findIndex((item) => item.title === title) + 1}</span>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span>MeetAI · Secure video intelligence</span>
        <span>Made for meaningful meetings</span>
      </footer>

      <style jsx>{`
        .landing-shell { min-height: 100vh; width: 100%; overflow: hidden; position: relative; color: #f8f7ff; background: #05050a; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        .scene-layer { position: fixed; inset: 0; z-index: 0; opacity: .38; pointer-events: none; }
        .aurora { position: fixed; border-radius: 999px; filter: blur(100px); pointer-events: none; z-index: 1; opacity: .28; }
        .aurora-one { width: 620px; height: 620px; background: #6d28d9; top: -300px; right: -90px; animation: drift 13s ease-in-out infinite alternate; }
        .aurora-two { width: 500px; height: 500px; background: #0369a1; bottom: -330px; left: -180px; animation: drift 16s ease-in-out infinite alternate-reverse; }
        .noise-layer { position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: .055; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E"); }
        .premium-nav { position: relative; z-index: 20; height: 84px; max-width: 1400px; margin: 0 auto; padding: 0 42px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.07); }
        .brand, .nav-actions, .brand-copy, .profile-button, .nav-install { display: flex; align-items: center; }
        .brand { gap: 12px; color: white; text-align: left; }
        .brand-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; color: white; background: linear-gradient(145deg,#8b5cf6,#4f46e5); box-shadow: 0 10px 40px rgba(109,40,217,.35), inset 0 1px rgba(255,255,255,.35); }
        .brand-mark svg { width: 23px; }
        .brand-copy { flex-direction: column; align-items: flex-start; line-height: 1.05; }
        .brand-copy strong { font-size: 17px; letter-spacing: -.35px; }
        .brand-copy small { margin-top: 5px; font-size: 9px; color: #8f8da0; text-transform: uppercase; letter-spacing: 1.7px; }
        .nav-actions { gap: 10px; }
        .nav-install, .sign-in-button, .profile-button { height: 42px; border-radius: 12px; color: #e8e7ef; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.045); backdrop-filter: blur(18px); transition: .25s ease; }
        .nav-install { gap: 7px; padding: 0 15px; }
        .nav-install svg { width: 16px; }
        .sign-in-button { padding: 0 18px; font-weight: 700; }
        .nav-install:hover, .sign-in-button:hover, .profile-button:hover { border-color: rgba(167,139,250,.5); background: rgba(124,58,237,.14); transform: translateY(-1px); }
        .profile-button { gap: 9px; padding: 4px 13px 4px 5px; }
        .profile-initial { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 9px; font-weight: 800; background: linear-gradient(145deg,#7c3aed,#2563eb); }
        .landing-main { position: relative; z-index: 10; max-width: 1320px; min-height: 670px; margin: 0 auto; padding: 76px 42px 68px; display: grid; grid-template-columns: minmax(0,1fr) minmax(460px,.9fr); gap: 76px; align-items: center; }
        .hero-copy { animation: reveal .8s cubic-bezier(.2,.8,.2,1) both; }
        .eyebrow { width: max-content; display: flex; align-items: center; gap: 9px; padding: 7px 12px; border: 1px solid rgba(167,139,250,.18); border-radius: 999px; background: rgba(124,58,237,.07); color: #b9a6f9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; }
        .eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: #5eead4; box-shadow: 0 0 12px #2dd4bf; animation: softPulse 1.7s infinite; }
        h1 { margin: 25px 0 22px; font-size: clamp(3.7rem,6.2vw,6.4rem); line-height: .94; letter-spacing: -.068em; font-weight: 820; }
        h1 span { display: block; color: transparent; background: linear-gradient(100deg,#a78bfa 5%,#6ee7f9 62%,#5eead4); background-clip: text; -webkit-background-clip: text; filter: drop-shadow(0 10px 32px rgba(99,102,241,.18)); }
        .hero-description { max-width: 610px; margin: 0; color: #9b99aa; font-size: 17px; line-height: 1.75; }
        .meeting-actions { margin-top: 34px; display: flex; gap: 12px; align-items: stretch; }
        .new-meeting { min-height: 58px; position: relative; overflow: hidden; display: flex; align-items: center; gap: 10px; padding: 0 24px; border-radius: 15px; color: white; font-size: 15px; font-weight: 800; background: linear-gradient(120deg,#7c3aed,#4f46e5 72%,#2563eb); box-shadow: 0 16px 45px rgba(79,70,229,.32), inset 0 1px rgba(255,255,255,.25); transition: .25s ease; }
        .new-meeting svg { width: 21px; }
        .new-meeting:hover { transform: translateY(-3px); box-shadow: 0 22px 60px rgba(79,70,229,.45), inset 0 1px rgba(255,255,255,.3); }
        .button-shine { position: absolute; inset: 0; transform: translateX(-130%) skewX(-20deg); background: linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent); animation: buttonShine 4s ease-in-out infinite; }
        .join-control { min-height: 58px; flex: 1; max-width: 360px; display: flex; align-items: center; border-radius: 15px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.045); backdrop-filter: blur(20px); transition: .2s; }
        .join-control:focus-within { border-color: rgba(139,92,246,.62); box-shadow: 0 0 0 4px rgba(124,58,237,.09); }
        .join-control input { width: 100%; min-width: 0; padding: 0 17px; color: white; border: 0; outline: 0; background: transparent; font-size: 14px; }
        .join-control input::placeholder { color: #666477; }
        .join-control button { height: 42px; margin-right: 7px; padding: 0 12px; display: flex; align-items: center; gap: 5px; border-radius: 10px; color: #dcd8ee; font-weight: 800; transition: .2s; }
        .join-control button svg { width: 16px; }
        .join-control button:not(:disabled):hover { color: white; background: rgba(139,92,246,.2); }
        .join-control button:disabled { color: #4e4c59; cursor: not-allowed; }
        .trust-row { margin-top: 22px; display: flex; gap: 22px; color: #777586; font-size: 12px; }
        .trust-row span { display: flex; align-items: center; gap: 7px; }
        .trust-row svg { width: 15px; color: #8b5cf6; }
        .intelligence-visual { position: relative; min-height: 520px; display: grid; place-items: center; animation: reveal .9s .12s cubic-bezier(.2,.8,.2,1) both; perspective: 1200px; }
        .visual-glow { position: absolute; width: 70%; height: 70%; border-radius: 50%; background: #6d28d9; filter: blur(110px); opacity: .22; }
        .dashboard-frame { width: min(100%,500px); position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,.12); border-radius: 25px; background: linear-gradient(145deg,rgba(18,17,29,.93),rgba(7,8,15,.9)); box-shadow: 0 45px 100px rgba(0,0,0,.55), 0 0 0 1px rgba(139,92,246,.06) inset; backdrop-filter: blur(30px); transform: rotateY(-4deg) rotateX(2deg); }
        .dashboard-frame::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(120deg,rgba(255,255,255,.07),transparent 23%); }
        .frame-topbar { height: 53px; padding: 0 15px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 1px solid rgba(255,255,255,.07); color: #696777; font-size: 9px; letter-spacing: 1.3px; }
        .frame-dots { display: flex; gap: 5px; }
        .frame-dots i { width: 6px; height: 6px; border-radius: 50%; background: #353342; }
        .secure-chip { justify-self: end; display: flex; gap: 5px; align-items: center; color: #6ee7b7; letter-spacing: 0; }
        .secure-chip svg { width: 12px; }
        .video-stage { height: 260px; position: relative; overflow: hidden; display: grid; place-items: center; background: radial-gradient(circle at 50% 42%,rgba(79,70,229,.2),transparent 42%), linear-gradient(145deg,#0c0d17,#080910); }
        .video-stage::before { content: ''; position: absolute; inset: 0; opacity: .22; background-image: linear-gradient(rgba(139,92,246,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.15) 1px,transparent 1px); background-size: 30px 30px; mask-image: radial-gradient(circle,black,transparent 72%); }
        .identity-ring { position: absolute; width: 180px; height: 180px; border: 1px solid rgba(45,212,191,.13); border-radius: 50%; animation: spin 16s linear infinite; }
        .ring-one::after, .ring-two::after { content: ''; position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #5eead4; box-shadow: 0 0 13px #2dd4bf; top: 19px; left: 22px; }
        .ring-two { width: 220px; height: 220px; border-style: dashed; border-color: rgba(139,92,246,.14); animation-direction: reverse; animation-duration: 25s; }
        .face-grid { width: 120px; height: 146px; position: relative; overflow: hidden; border: 1px solid rgba(94,234,212,.34); border-radius: 28px 28px 20px 20px; background: linear-gradient(180deg,rgba(139,92,246,.13),rgba(45,212,191,.04)); box-shadow: 0 0 35px rgba(45,212,191,.08); }
        .face-head { position: absolute; width: 59px; height: 72px; top: 21px; left: 30px; border-radius: 45% 45% 48% 48%; border: 1px solid rgba(216,211,255,.36); background: radial-gradient(circle at 50% 35%,rgba(255,255,255,.12),rgba(139,92,246,.08)); }
        .face-body { position: absolute; width: 96px; height: 65px; left: 11px; bottom: -25px; border-radius: 50% 50% 0 0; border: 1px solid rgba(216,211,255,.25); }
        .scan-line { position: absolute; left: 4px; right: 4px; height: 1px; background: #5eead4; box-shadow: 0 0 12px #2dd4bf; animation: scan 2.7s ease-in-out infinite; }
        .corner { position: absolute; width: 13px; height: 13px; border-color: #a78bfa; }
        .tl { top: 7px; left: 7px; border-left: 2px solid; border-top: 2px solid; }.tr { top: 7px; right: 7px; border-right: 2px solid; border-top: 2px solid; }.bl { bottom: 7px; left: 7px; border-left: 2px solid; border-bottom: 2px solid; }.br { bottom: 7px; right: 7px; border-right: 2px solid; border-bottom: 2px solid; }
        .auth-badge { position: absolute; right: 17px; top: 18px; display: flex; align-items: center; gap: 7px; padding: 7px 9px; border: 1px solid rgba(52,211,153,.19); border-radius: 10px; background: rgba(6,78,59,.16); }
        .auth-badge svg { width: 19px; color: #34d399; }.auth-badge span { display: flex; flex-direction: column; }.auth-badge strong { color: #6ee7b7; font-size: 8px; letter-spacing: 1px; }.auth-badge small { color: #5f8378; font-size: 7px; }
        .voice-wave { position: absolute; left: 18px; bottom: 18px; height: 49px; display: flex; align-items: center; gap: 3px; }
        .voice-wave i { width: 2px; border-radius: 3px; background: linear-gradient(#a78bfa,#5eead4); animation: wave 1.3s ease-in-out infinite alternate; }
        .signal-grid { padding: 17px 18px 11px; display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .signal-grid > div { min-width: 0; }.signal-grid span { display: block; color: #686677; font-size: 8px; text-transform: uppercase; letter-spacing: .7px; }.signal-grid strong { display: block; margin-top: 4px; color: #d9d7e3; font-size: 12px; }.signal-grid i { display: block; height: 3px; margin-top: 8px; overflow: hidden; border-radius: 4px; background: #252430; }.signal-grid b { display: block; height: 100%; background: linear-gradient(90deg,#7c3aed,#2dd4bf); box-shadow: 0 0 8px #7c3aed; }
        .ai-ticker { margin: 4px 18px 17px; padding: 10px 12px; display: flex; align-items: center; gap: 7px; border-radius: 9px; color: #898697; background: rgba(255,255,255,.035); font-size: 9px; }.ai-ticker svg { width: 13px; color: #a78bfa; }.ai-ticker span { color: #4b4859; }
        .floating-card { position: absolute; display: flex; align-items: center; gap: 9px; padding: 10px 13px; border: 1px solid rgba(255,255,255,.1); border-radius: 13px; background: rgba(13,13,23,.82); box-shadow: 0 18px 50px rgba(0,0,0,.35); backdrop-filter: blur(22px); animation: float 4.5s ease-in-out infinite; }
        .floating-card div { display: flex; flex-direction: column; }.floating-card small { color: #777486; font-size: 8px; text-transform: uppercase; letter-spacing: .7px; }.floating-card strong { margin-top: 2px; color: #e8e6ef; font-size: 11px; }.floating-card > svg { width: 22px; color: #67e8f9; }
        .card-left { left: -22px; top: 126px; }.card-right { right: -18px; bottom: 80px; animation-delay: -2.2s; }
        .status-orb { width: 10px; height: 10px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 5px rgba(52,211,153,.08),0 0 18px #10b981; }
        .feature-section { position: relative; z-index: 10; max-width: 1320px; margin: 0 auto; padding: 72px 42px 82px; border-top: 1px solid rgba(255,255,255,.07); }
        .feature-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; margin-bottom: 28px; }.feature-heading span { color: #8b7fae; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.8px; }.feature-heading h2 { max-width: 520px; margin: 0; color: #e9e7ef; font-size: clamp(1.7rem,3vw,2.5rem); line-height: 1.15; letter-spacing: -.04em; text-align: right; }
        .feature-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 13px; }.feature-card { min-height: 180px; position: relative; overflow: hidden; padding: 25px; display: flex; align-items: flex-start; gap: 16px; border: 1px solid rgba(255,255,255,.075); border-radius: 19px; background: linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018)); transition: .28s ease; }.feature-card::after { content: ''; position: absolute; width: 160px; height: 160px; right: -90px; bottom: -100px; border-radius: 50%; filter: blur(45px); opacity: .16; transition: .3s; }.feature-card.violet::after { background: #8b5cf6; }.feature-card.cyan::after { background: #22d3ee; }.feature-card.emerald::after { background: #34d399; }.feature-card:hover { transform: translateY(-5px); border-color: rgba(167,139,250,.22); background: linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025)); }.feature-card:hover::after { opacity: .3; }
        .feature-icon { flex: 0 0 auto; width: 43px; height: 43px; display: grid; place-items: center; border-radius: 12px; color: #a78bfa; background: rgba(139,92,246,.11); border: 1px solid rgba(167,139,250,.14); }.feature-card.cyan .feature-icon { color: #67e8f9; background: rgba(6,182,212,.09); }.feature-card.emerald .feature-icon { color: #6ee7b7; background: rgba(16,185,129,.09); }.feature-icon svg { width: 22px; }.feature-card h3 { margin: 1px 0 9px; color: #e5e3eb; font-size: 15px; }.feature-card p { margin: 0; max-width: 270px; color: #777586; font-size: 12px; line-height: 1.65; }.card-index { position: absolute; right: 18px; top: 16px; color: rgba(255,255,255,.12); font-size: 9px; letter-spacing: 1px; }
        .landing-footer { position: relative; z-index: 10; max-width: 1320px; margin: 0 auto; padding: 24px 42px 34px; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,.06); color: #4d4b58; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
        @keyframes reveal { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes drift { to { transform: translate(70px,50px) scale(1.1); } }
        @keyframes softPulse { 50% { opacity: .45; transform: scale(.75); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scan { 0%,100% { top: 8%; opacity: .2; } 50% { top: 90%; opacity: 1; } }
        @keyframes wave { to { transform: scaleY(.48); opacity: .55; } }
        @keyframes float { 50% { transform: translateY(-10px); } }
        @keyframes buttonShine { 0%,55% { transform: translateX(-130%) skewX(-20deg); } 85%,100% { transform: translateX(130%) skewX(-20deg); } }
        @media (max-width: 1040px) { .landing-main { grid-template-columns: 1fr; gap: 45px; padding-top: 60px; }.hero-copy { text-align: center; }.eyebrow { margin: 0 auto; }.hero-description { margin-inline: auto; }.meeting-actions,.trust-row { justify-content: center; }.intelligence-visual { min-height: 500px; }.feature-heading { align-items: flex-start; flex-direction: column; }.feature-heading h2 { text-align: left; }.feature-grid { grid-template-columns: 1fr; }.feature-card { min-height: 135px; } }
        @media (max-width: 680px) { .premium-nav { height: 72px; padding: 0 18px; }.brand-copy small { display: none; }.nav-install span { display: none; }.nav-install { width: 42px; padding: 0; justify-content: center; }.profile-button > span:last-child { display: none; }.profile-button { padding-right: 5px; }.landing-main { padding: 52px 18px 48px; }.hero-copy h1 { font-size: clamp(3.1rem,15vw,4.7rem); }.hero-description { font-size: 15px; }.meeting-actions { flex-direction: column; }.new-meeting,.join-control { width: 100%; max-width: none; }.new-meeting { justify-content: center; }.trust-row { gap: 12px; flex-wrap: wrap; }.intelligence-visual { min-height: 420px; }.dashboard-frame { transform: none; }.floating-card { display: none; }.video-stage { height: 225px; }.feature-section { padding: 55px 18px 62px; }.feature-card { padding: 21px; }.landing-footer { margin: 0 18px; padding: 22px 0 30px; flex-direction: column; gap: 8px; }.frame-topbar { grid-template-columns: 1fr 1fr; }.frame-topbar > span { display: none; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; } }
      `}</style>
    </div>
  );
}
