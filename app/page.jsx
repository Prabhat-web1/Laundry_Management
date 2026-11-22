"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Droplets,
  FileWarning,
  Menu,
  PackageCheck,
  ShieldCheck,
  Shirt,
  Sparkles,
  WashingMachine,
  X,
} from "lucide-react";
import LaundryDashboard from "@/components/laundry-dashboard";

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=82",
  machines: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=1000&q=82",
  folded: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=1000&q=82",
};

const STAGES = ["Requested", "Collected", "Washing", "Drying", "Ready", "Delivered"];
const JOURNEY = [
  { icon: ClipboardList, title: "Create one clear request", text: "Add every item, quantity, care note, and collection time in a single request.", stage: 0, hint: "Your collection is scheduled." },
  { icon: Shirt, title: "Receive one batch tag", text: "Your bag gets a unique tag, making it easy for the laundry desk to find and update.", stage: 1, hint: "Your tagged bag is at the laundry desk." },
  { icon: WashingMachine, title: "Follow every wash stage", text: "See when your batch is washing, drying, ready, or already handed back.", stage: 3, hint: "Freshly washed and drying now." },
  { icon: PackageCheck, title: "Pick up with confidence", text: "Know the expected return time before you walk to the laundry desk.", stage: 4, hint: "All set. Pick up at the laundry desk." },
];
const SERVICES = [
  { icon: ClipboardList, title: "Collection requests", text: "Plan a collection with itemised quantities, care notes, and a clear drop-off window.", accent: "mint" },
  { icon: WashingMachine, title: "Live batch tracking", text: "Follow one tagged batch through the laundry room without asking at the desk.", accent: "gold" },
  { icon: FileWarning, title: "Issue resolution", text: "Report a missing or damaged item against the right batch and follow the update.", accent: "blue" },
];
const FEATURES = [
  [Clock3, "Clear return estimates", "See when your clothes are expected back instead of guessing."],
  [ShieldCheck, "Private by role", "Students see their own laundry while staff manage the full queue."],
  [PackageCheck, "One tag per batch", "A unique tag keeps every collection easy to identify."],
  [Sparkles, "Made for hostels", "Room, hostel, and contact details stay attached to every request."],
  [Shirt, "Itemised requests", "T-shirts, jeans, bedsheets, and more can travel in one request."],
  [Droplets, "Less desk waiting", "Get the useful status update before you make the walk downstairs."],
];
const FAQS = [
  ["Do I need an account to use Washday?", "You can explore the full landing page without an account. Sign in or get started when you are ready to create a collection request or access your laundry records."],
  ["How do I track my clothes?", "After a collection is created, the laundry desk attaches a unique batch tag. Your dashboard then shows the current stage from request through delivery."],
  ["Can I add several types of clothing?", "Yes. Each request supports multiple item types and quantities, plus optional care notes for the laundry team."],
  ["What if something is missing or damaged?", "Open Reports & help from your student dashboard and submit an issue linked to the relevant batch. Staff can investigate and record the resolution there."],
  ["Who can manage the laundry queue?", "Staff accounts see the operations queue and dispute desk. Student accounts only see their own requests and reports."],
];

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Reveal({ as: Tag = "div", className = "", delay = 0, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!("IntersectionObserver" in window) || prefersReducedMotion()) { element.classList.add("lp-in"); return undefined; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { element.classList.add("lp-in"); observer.disconnect(); } }, { threshold: 0.14 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <Tag ref={ref} className={`lp-reveal ${className}`} style={{ "--delay": `${delay}ms` }}>{children}</Tag>;
}

function CountUp({ to }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!("IntersectionObserver" in window) || prefersReducedMotion()) { setValue(to); return undefined; }
    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const startedAt = performance.now();
      const tick = (now) => { const progress = Math.min((now - startedAt) / 800, 1); setValue(Math.round(to * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.7 });
    observer.observe(element);
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [to]);
  return <span ref={ref}>{value}</span>;
}

function Photo({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  return <div className={`lp-photo ${className}`}><span className="lp-photo-art" aria-hidden="true"><i /><i /><i /></span>{!failed && <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}</div>;
}

function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }); }

function WashdayLanding({ onGetStarted, onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const goToAuth = (handler) => () => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: "auto" }); handler?.(); };
  const jumpTo = (id) => () => { setMenuOpen(false); scrollToId(id); };

  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 10); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  useEffect(() => { if (paused || prefersReducedMotion()) return undefined; const timer = setInterval(() => setStep((current) => (current + 1) % JOURNEY.length), 3600); return () => clearInterval(timer); }, [paused]);
  const current = JOURNEY[step];

  return <div className="lp-root" id="top">
    <header className={`lp-nav ${scrolled ? "lp-nav-scrolled" : ""}`}><div className="lp-wrap lp-nav-inner">
      <a className="brand lp-brand" href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="brand-mark"><Droplets size={19} /></span>Washday<span className="brand-dot">.</span></a>
      <nav id="primary-navigation" className={`lp-links ${menuOpen ? "lp-links-open" : ""}`} aria-label="Primary navigation"><button type="button" onClick={jumpTo("services")}>Services</button><button type="button" onClick={jumpTo("how")}>How it works</button><button type="button" onClick={jumpTo("features")}>Features</button><button type="button" onClick={jumpTo("faq")}>FAQ</button><button type="button" className="lp-btn lp-btn-ghost lp-links-login" onClick={goToAuth(onLogin)}>Sign in</button></nav>
      <div className="lp-nav-actions"><button type="button" className="lp-btn lp-btn-ghost lp-hide-sm" onClick={goToAuth(onLogin)}>Sign in</button><button type="button" className="lp-btn lp-btn-solid" onClick={goToAuth(onGetStarted)}>Get started <ArrowRight size={15} /></button><button type="button" className="lp-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-controls="primary-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
    </div></header>

    <main>
      <section className="lp-hero"><div className="lp-blob lp-blob-a" aria-hidden="true" /><div className="lp-blob lp-blob-b" aria-hidden="true" /><div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy"><span className="lp-pill lp-fade" style={{ "--delay": "0ms" }}><i /> Hostel laundry, simplified</span><h1 className="lp-fade" style={{ "--delay": "80ms" }}>Laundry day, <span>without the guesswork.</span></h1><p className="lp-lead lp-fade" style={{ "--delay": "160ms" }}>Request a collection, follow your tagged batch from wash to pickup, and report an issue in one calm, clear place.</p><div className="lp-cta-row lp-fade" style={{ "--delay": "240ms" }}><button type="button" className="lp-btn lp-btn-solid lp-btn-lg" onClick={goToAuth(onGetStarted)}>Get started <ArrowRight size={17} /></button><button type="button" className="lp-btn lp-btn-outline lp-btn-lg" onClick={goToAuth(onLogin)}>Log in</button></div><ul className="lp-ticks lp-fade" style={{ "--delay": "320ms" }}><li><Check size={14} /> One request, many items</li><li><Check size={14} /> One tag per batch</li><li><Check size={14} /> Clear return times</li></ul></div>
        <div className="lp-hero-visual lp-fade" style={{ "--delay": "180ms" }}><Photo src={IMAGES.hero} alt="Clean folded laundry ready for collection" className="lp-hero-photo" /><div className="lp-machine" aria-hidden="true"><div className="lp-machine-top"><i /><i /><b /></div><div className="lp-door"><div className="lp-drum"><span /><span /><span /><span /></div></div><em className="lp-bubble lp-b1" /><em className="lp-bubble lp-b2" /><em className="lp-bubble lp-b3" /></div><div className="lp-chip lp-chip-tag"><span className="lp-dot" /><div><small>Batch</small><strong>MA-2601</strong></div><b>Washing</b></div><div className="lp-chip lp-chip-eta"><Clock3 size={15} /><div><small>Expected back</small><strong>Tomorrow, 6 PM</strong></div><span className="lp-bar"><i /></span></div></div>
      </div></section>

      <section className="lp-stats" aria-label="Washday at a glance"><div className="lp-wrap lp-stats-grid"><Reveal className="lp-stat"><strong><CountUp to={6} /></strong><span>tracked processing stages</span></Reveal><Reveal className="lp-stat" delay={90}><strong><CountUp to={1} /></strong><span>unique tag per collection</span></Reveal><Reveal className="lp-stat" delay={180}><strong><CountUp to={2} /></strong><span>roles: students &amp; staff</span></Reveal></div></section>

      <section className="lp-section lp-section-tint" id="services"><div className="lp-wrap"><Reveal className="lp-head"><span className="lp-eyebrow">WHAT WASHDAY HANDLES</span><h2>The laundry desk, made easier</h2><p>Everything you need to move from a full laundry bag to a clear, trackable handover.</p></Reveal><div className="lp-service-grid">{SERVICES.map((service, index) => { const Icon = service.icon; return <Reveal className={`lp-service lp-service-${service.accent}`} key={service.title} delay={index * 90}><span className="lp-service-icon"><Icon size={21} /></span><span className="lp-service-number">0{index + 1}</span><h3>{service.title}</h3><p>{service.text}</p><button type="button" className="lp-text-link" onClick={jumpTo("how")}>See how it works <ArrowRight size={14} /></button></Reveal>; })}</div></div></section>

      <section className="lp-section" id="how"><div className="lp-wrap"><Reveal className="lp-head"><span className="lp-eyebrow">HOW IT WORKS</span><h2>From dirty bag to fresh pickup</h2><p>Four simple steps. Tap a step to preview the journey, or let it play automatically.</p></Reveal><div className="lp-journey" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}><ol className="lp-steps">{JOURNEY.map((item, index) => { const Icon = item.icon; return <li key={item.title}><button type="button" className={`lp-step ${index === step ? "lp-step-active" : ""}`} aria-pressed={index === step} onClick={() => setStep(index)}><span className="lp-step-icon"><Icon size={18} /></span><span className="lp-step-copy"><small>STEP {index + 1}</small><strong>{item.title}</strong><span>{item.text}</span></span></button></li>; })}</ol><div className="lp-preview" aria-live="polite"><div className="lp-preview-top"><div><small>YOUR BATCH</small><strong>MA-2601</strong></div><span className="lp-preview-badge">{STAGES[current.stage]}</span></div><div className="lp-track" style={{ "--progress": (current.stage / (STAGES.length - 1)) * 84 }}><span className="lp-track-fill" />{STAGES.map((label, index) => <span key={label} className={`lp-track-step ${index < current.stage ? "lp-done" : ""} ${index === current.stage ? "lp-now" : ""}`}><i /><small>{label}</small></span>)}</div><p className="lp-preview-hint"><span className="lp-dot" />{current.hint}</p><div className="lp-items"><span>T-shirts <b>4</b></span><span>Jeans <b>2</b></span><span>Bedsheet <b>1</b></span></div><Photo src={IMAGES.machines} alt="Washing machines in a laundry room" className="lp-preview-photo" /></div></div></div></section>

      <section className="lp-section lp-section-tint" id="features"><div className="lp-wrap"><Reveal className="lp-head"><span className="lp-eyebrow">BUILT FOR HOSTEL LIFE</span><h2>Small details that save a lot of time</h2><p>A better laundry experience for students, and a clearer operating picture for staff.</p></Reveal><div className="lp-feature-grid">{FEATURES.map(([Icon, title, text], index) => <Reveal className="lp-feature" key={title} delay={(index % 3) * 80}><span className="lp-feature-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></Reveal>)}</div></div></section>

      <section className="lp-section lp-faq-section" id="faq"><div className="lp-wrap lp-faq-layout"><Reveal className="lp-faq-intro"><span className="lp-eyebrow">GOOD TO KNOW</span><h2>Questions, answered.</h2><p>Everything important before you hand over the bag.</p><div className="lp-faq-callout"><Sparkles size={18} /><span><strong>Still need a hand?</strong><small>The laundry desk can follow up on your batch report.</small></span></div></Reveal><Reveal className="lp-faq-list" delay={120}>{FAQS.map(([question, answer], index) => <div className={`lp-faq-item ${faqOpen === index ? "lp-faq-open" : ""}`} key={question}><button type="button" aria-expanded={faqOpen === index} onClick={() => setFaqOpen(faqOpen === index ? -1 : index)}><span>{question}</span><ChevronDown size={18} /></button>{faqOpen === index && <p>{answer}</p>}</div>)}</Reveal></div></section>

      <section className="lp-final"><Reveal className="lp-wrap lp-final-card"><div><span className="lp-eyebrow lp-eyebrow-light">READY WHEN YOU ARE</span><h2>Make laundry day one less thing to think about.</h2><p>Sign in to create your first collection request.</p></div><div className="lp-cta-row"><button type="button" className="lp-btn lp-btn-light lp-btn-lg" onClick={goToAuth(onGetStarted)}>Get started <ArrowRight size={17} /></button><button type="button" className="lp-btn lp-btn-line lp-btn-lg" onClick={goToAuth(onLogin)}>Log in</button></div></Reveal></section>
    </main>
    <footer className="lp-footer"><div className="lp-wrap lp-footer-inner"><span className="brand lp-brand"><span className="brand-mark"><Droplets size={17} /></span>Washday<span className="brand-dot">.</span></span><span>Hostel laundry, without the guesswork.</span></div></footer>
  </div>;
}

export default function Home() {
  return <LaundryDashboard landing={WashdayLanding} />;
}
