"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, Droplets, FileWarning, LayoutDashboard, LogOut, Menu, PackageCheck, Plus, Search, ShieldCheck, Shirt, Sparkles, WashingMachine, X, } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMemo, useState } from "react";

import {

  disputeSchema,

  loginSchema,

  requestSchema,

  registerSchema,

} from "@/lib/validation";

const stages = ["REQUESTED", "COLLECTED", "WASHING", "DRYING", "READY", "DELIVERED"];

const stageLabels = {

  REQUESTED: "Request placed", COLLECTED: "Collected", WASHING: "Washing", DRYING: "Drying", READY: "Ready for pickup", DELIVERED: "Delivered",

};

const stageHints = {

  REQUESTED: "Your collection is scheduled.", COLLECTED: "Your tagged bag is at the laundry desk.", WASHING: "Your clothes are in the wash.",

  DRYING: "Freshly washed and drying now.", READY: "All set. Pick up at the laundry desk.", DELIVERED: "Handed back to you.",

};


async function api(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const responseText = await response.text();

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Server returned an invalid response (${response.status}).`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed with status ${response.status}.`
    );
  }

  return data ?? {};
}


function dateLabel(value, withTime = false) {

  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(value));

}

function itemList(value) {
  try {

    return JSON.parse(value);

  }

  catch {

    return [];

  }
}

function quantityLabel(request) {

  return itemList(request.items).reduce((total, item) => total + item.quantity, 0);

}

function displayDateTimeOffset(hours) {

  const date = new Date(Date.now() + hours * 60 * 60 * 1000);

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);

}

function statusTone(status) {

  if (status === "READY" || status === "DELIVERED" || status === "RESOLVED")

    return "green";

  if (status === "OPEN" || status === "REQUESTED")

    return "amber";

  return "blue";

}

function Badge({ children, tone = "blue" }) {

  return <span className={`badge badge-${tone}`}><i />{children}</span>;

}

export default function LaundryDashboard() {

  const queryClient = useQueryClient();

  const [tab, setTab] = useState("overview");

  const [modal, setModal] = useState(null);

  const [detailRequest, setDetailRequest] = useState(null);

  const [notice, setNotice] = useState("");

  const [mobileNav, setMobileNav] = useState(false);

  const session = useQuery({ queryKey: ["session"], queryFn: () => api("/api/auth/session"), retry: false });

  const user = session.data?.user ?? null;

  const requestsQuery = useQuery({ queryKey: ["requests", user?.id], queryFn: () => api("/api/requests"), enabled: !!user });

  const requests = requestsQuery.data ?? [];

  const disputes = useMemo(() => requests.flatMap((request) => request.disputes.map((dispute) => ({ ...dispute, request }))), [requests]);

  const isStaff = user?.role === "STAFF";

  const loginMutation = useMutation({

    mutationFn: (details) => api("/api/auth/login", { method: "POST", body: JSON.stringify(details) }),

    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["session"] }); setNotice("Welcome back. You’re signed in."); },

  });

  const logout = async () => { await api("/api/auth/logout", { method: "POST" }); queryClient.removeQueries({ queryKey: ["requests"] }); setMobileNav(false); await session.refetch(); setTab("overview"); };

  const updateRequest = useMutation({

    mutationFn: ({ id, status }) => api(`/api/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requests"] }),

  });

  const updateDispute = useMutation({

    mutationFn: ({ id, status, resolution }) => api(`/api/disputes/${id}`, { method: "PATCH", body: JSON.stringify({ status, resolution }) }),

    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requests"] }),

  });

  const activeRequests = requests.filter((request) => request.status !== "DELIVERED");

  const readyCount = requests.filter((request) => request.status === "READY").length;

  const openDisputes = disputes.filter(({ status }) => status !== "RESOLVED").length;

  const latestRequest = activeRequests[0] ?? requests[0];

  const titleMap = {

    overview: isStaff ? "Operations overview" : "Your laundry, sorted",

    laundry: isStaff ? "All laundry" : "My laundry",

    help: "Reports & resolutions",

    operations: "Laundry operations",

    disputes: "Dispute desk",

  };

  const currentDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date()).toUpperCase();

  if (session.isLoading)

    return <div className="boot-screen"><div className="brand-mark"><Droplets size={21} /></div><span>Getting your laundry desk ready…</span></div>;

  if (session.error)

    return <div className="boot-screen"><div className="load-error"><CircleHelp size={22} /><strong>We couldn’t reach Washday.</strong><span>Check the app server and reload this page.</span><button className="button button-primary" onClick={() => session.refetch()}>Try again</button></div></div>;

  if (!user)

    return <LoginScreen onSuccess={() => queryClient.invalidateQueries({ queryKey: ["session"] })} />;

  const navItems = isStaff

    ? [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "operations", label: "Laundry operations", icon: WashingMachine }, { id: "disputes", label: "Dispute desk", icon: FileWarning, count: openDisputes }]

    : [{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "laundry", label: "My laundry", icon: Shirt }, { id: "help", label: "Reports & help", icon: CircleHelp, count: openDisputes }];

  return <div className="app-shell">

    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>

      <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setTab("overview"); }}><span className="brand-mark"><Droplets size={21} strokeWidth={2.6} /></span><span>washday<span className="brand-dot">.</span></span></a>

      <div className="sidebar-section-label">WORKSPACE</div>

      <nav className="side-nav" aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon, count }) => <button key={id} className={`nav-item ${tab === id ? "nav-active" : ""}`} onClick={() => { setTab(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}</button>)}</nav>

      <div className="sidebar-bottom">

        <div className="service-note"><span className="service-note-icon"><ShieldCheck size={15} /></span><div><strong>Every bag gets a tag</strong><p>Track it from pickup to handover.</p></div></div>

        <div className="profile-row"><div className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="profile-text"><strong>{user.name}</strong><span>{isStaff ? "Laundry team" : `${user.studentId} · Room ${user.room}`}</span></div><button className="icon-button profile-logout" title="Sign out" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button></div>

      </div>

    </aside>



    <main className="main-shell">

      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="breadcrumb"><span>{user.hostel || "Maple House"}</span><ChevronRight size={14} /><strong>{titleMap[tab]}</strong></div><div className="topbar-actions"><span className="today-label">{currentDate}</span><button className="icon-button notification-button" title="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">{user.name.charAt(0)}</div></div></header>

      {notice && <div className="toast-note"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}

      <div className="page-content">

        <div className="page-heading"><div><div className="eyebrow">{isStaff ? "LAUNDRY DESK · MAPLE HOUSE" : `GOOD MORNING, ${user.name.split(" ")[0].toUpperCase()}`}</div><h1>{titleMap[tab]}</h1><p>{isStaff ? "A clear view of every bag moving through the laundry room." : "A fresh start, and a clearer view of laundry day."}</p></div>

          {!isStaff && <button className="button button-primary create-button" onClick={() => setModal("request")}><Plus size={17} />New laundry request</button>}

          {isStaff && tab === "overview" && <button className="button button-secondary" onClick={() => setTab("operations")}><ClipboardList size={16} />Open laundry queue</button>}

        </div>

        {requestsQuery.isLoading ? <div className="content-loading"><span className="spinner" />Loading laundry records…</div> : requestsQuery.error ? <div className="inline-error"><CircleHelp size={17} />{requestsQuery.error.message}<button onClick={() => requestsQuery.refetch()}>Retry</button></div> : <>

          {tab === "overview" && <Overview user={user} requests={requests} disputes={disputes} activeRequests={activeRequests} readyCount={readyCount} openDisputes={openDisputes} latestRequest={latestRequest} isStaff={!!isStaff} onTab={setTab} onModal={setModal} onAdvance={(request) => {
            const index = stages.indexOf(request.status); if (index < stages.length - 1)

              updateRequest.mutate({ id: request.id, status: stages[index + 1] });
          }} busy={updateRequest.isPending} />}

          {(tab === "laundry" || tab === "operations") && <LaundryList requests={requests} isStaff={!!isStaff} onSelect={setDetailRequest} onAdvance={(request) => {
            const index = stages.indexOf(request.status); if (index < stages.length - 1)

              updateRequest.mutate({ id: request.id, status: stages[index + 1] });
          }} busy={updateRequest.isPending} />}

          {(tab === "help" || tab === "disputes") && <DisputeDesk disputes={disputes} isStaff={!!isStaff} onModal={() => setModal("dispute")} onUpdate={(id, status, resolution) => updateDispute.mutate({ id, status, resolution })} busy={updateDispute.isPending} />}

          <footer className="page-footer"><span>Made for Maple House</span><span><span className="footer-dot" />Your laundry stays in view.</span></footer>

        </>}

      </div>

    </main>

    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

    {modal === "request" && <RequestModal user={user} onClose={() => setModal(null)} onCreated={() => { setModal(null); setTab("laundry"); queryClient.invalidateQueries({ queryKey: ["requests"] }); setNotice("Your request is in. Its batch tag is ready to track."); }} />}

    {modal === "dispute" && <DisputeModal requests={requests} onClose={() => setModal(null)} onCreated={() => { setModal(null); queryClient.invalidateQueries({ queryKey: ["requests"] }); setNotice("Your report is with the laundry team now."); }} />}

    {detailRequest && <RequestDetailsModal request={detailRequest} onClose={() => setDetailRequest(null)} />}

  </div>;

}



function LoginScreen({ onSuccess }) {

  const [mode, setMode] = useState("login");

  const [role, setRole] = useState("STUDENT");

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [studentId, setStudentId] = useState("");

  const [hostel, setHostel] = useState("");

  const [room, setRoom] = useState("");

  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");

  const [validationError, setValidationError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");



  const loginMutation = useMutation({

    mutationFn: (details) =>

      api("/api/auth/login", {

        method: "POST",

        body: JSON.stringify(details),

      }),

    onSuccess,

  });



  const registerMutation = useMutation({

    mutationFn: (details) =>

      api("/api/auth/register", {

        method: "POST",

        body: JSON.stringify(details),

      }),

    onSuccess: (data) => {

      setEmail(data.user.email);

      setPassword("");

      setMode("login");

      setSuccessMessage("Account created successfully! Please sign in.");

      setValidationError("");

    },

  });



  const login = (event) => {

    event.preventDefault();

    setValidationError("");

    setSuccessMessage("");



    const parsed = loginSchema.safeParse({ email, password });



    if (!parsed.success) {

      setValidationError(

        parsed.error.issues[0]?.message ?? "Review your login details."

      );

      return;

    }



    loginMutation.mutate({ ...parsed.data, role });

  };



  const register = (event) => {

    event.preventDefault();

    setValidationError("");

    setSuccessMessage("");



    const parsed = registerSchema.safeParse({

      name,

      email,

      studentId,

      hostel,

      room,

      phone,

      password,

    });



    if (!parsed.success) {

      setValidationError(

        parsed.error.issues[0]?.message ?? "Review your registration details."

      );

      return;

    }



    registerMutation.mutate(parsed.data);

  };



  const switchMode = (nextMode) => {

    if (role === "STAFF" && nextMode === "register") return;

    setMode(nextMode);

    setValidationError("");

    setSuccessMessage("");

    loginMutation.reset();

    registerMutation.reset();

  };



  return (

    <main className="login-screen">

      <div className="login-card">

        <a className="brand login-brand" href="#">

          <span className="brand-mark">

            <Droplets size={21} strokeWidth={2.6} />

          </span>

          <span>

            washday<span className="brand-dot">.</span>

          </span>

        </a>



        <div className="login-art">

          <div className="sun-shape" />

          <div className="laundry-basket">

            <span />

            <span />

            <span />

            <span />

          </div>

          <div className="art-sparkle sparkle-one">✳</div>

          <div className="art-sparkle sparkle-two">✦</div>

          <span className="art-caption">A softer kind of laundry day</span>

        </div>



        <div className="login-copy">

          <div className="eyebrow">HOSTEL LAUNDRY, WITHOUT THE GUESSWORK</div>

          <h1>

            {role === "STAFF"
              ? "Welcome back, laundry team."
              : mode === "login"
                ? "Good laundry days start right here."
                : "Create your Washday account."}

          </h1>

          <p>

            {role === "STAFF"
              ? "Sign in with your staff account to manage laundry operations."
              : mode === "login"
                ? "Sign in using the email and password you registered with."
                : "Register with your details to start managing your laundry."}

          </p>

        </div>



        <div className="login-role-section">
          <span className="login-role-label">CONTINUE AS</span>
          <div className="login-role-options" role="group" aria-label="Choose account type">
            <button type="button" className={`login-role-card ${role === "STUDENT" ? "login-role-active" : ""}`} aria-pressed={role === "STUDENT"}
              onClick={() => { setRole("STUDENT"); setMode("login"); setValidationError(""); setSuccessMessage(""); loginMutation.reset(); registerMutation.reset(); }}>
              <span className="login-role-icon" aria-hidden="true">S</span>
              <span className="login-role-copy"><strong>Student</strong><small>Register or sign in</small></span>
              <span className="login-role-indicator" aria-hidden="true" />
            </button>
            <button type="button" className={`login-role-card ${role === "STAFF" ? "login-role-active" : ""}`} aria-pressed={role === "STAFF"}
              onClick={() => { setRole("STAFF"); setMode("login"); setValidationError(""); setSuccessMessage(""); loginMutation.reset(); registerMutation.reset(); }}>
              <span className="login-role-icon" aria-hidden="true">W</span>
              <span className="login-role-copy"><strong>Staff</strong><small>Staff account sign in</small></span>
              <span className="login-role-indicator" aria-hidden="true" />
            </button>
          </div>
        </div>

        {role === "STUDENT" && (
          <div className="auth-switch">

            <button

              type="button"

              className={mode === "login" ? "auth-active" : ""}

              onClick={() => switchMode("login")}

            >

              Sign in

            </button>

            <button

              type="button"

              className={mode === "register" ? "auth-active" : ""}

              onClick={() => switchMode("register")}

            >

              Register

            </button>

          </div>
        )}



        <form

          className="login-form"

          onSubmit={mode === "login" ? login : register}

        >

          {mode === "register" && (

            <>

              <label>

                Full name

                <input

                  type="text"

                  value={name}

                  onChange={(e) => setName(e.target.value)}

                  required

                  minLength={2}

                  maxLength={80}

                  autoComplete="name"

                  placeholder="Enter your full name"

                />

              </label>



              <label>

                Student ID

                <input

                  type="text"

                  value={studentId}

                  onChange={(e) => setStudentId(e.target.value)}

                  required

                  placeholder="Enter your student ID"

                />

              </label>



              <label>

                Hostel name

                <input

                  type="text"

                  value={hostel}

                  onChange={(e) => setHostel(e.target.value)}

                  required

                  placeholder="Enter your hostel"

                />

              </label>



              <label>

                Room number

                <input

                  type="text"

                  value={room}

                  onChange={(e) => setRoom(e.target.value)}

                  required

                  placeholder="Enter your room number"

                />

              </label>



              <label>

                Phone number

                <input

                  type="tel"

                  value={phone}

                  onChange={(e) => setPhone(e.target.value)}

                  required

                  placeholder="Enter your phone number"

                />

              </label>

            </>

          )}



          <label>

            Email address

            <input

              type="email"

              value={email}

              onChange={(e) => setEmail(e.target.value)}

              required

              autoComplete="email"

              placeholder="Enter your email"

            />

          </label>



          <label>

            Password

            <input

              type="password"

              value={password}

              onChange={(e) => setPassword(e.target.value)}

              required

              minLength={mode === "register" ? 8 : 1}

              maxLength={72}

              autoComplete={

                mode === "login" ? "current-password" : "new-password"

              }

              placeholder={

                mode === "register"

                  ? "Create a password (8+ characters)"

                  : "Enter your password"

              }

            />

          </label>



          {successMessage && (

            <div className="form-success">{successMessage}</div>

          )}



          {(validationError ||

            loginMutation.error ||

            registerMutation.error) && (

              <div className="form-error">

                <CircleHelp size={15} />

                {validationError ||

                  loginMutation.error?.message ||

                  registerMutation.error?.message}

              </div>

            )}



          <button

            className="button button-primary login-submit"

            disabled={loginMutation.isPending || registerMutation.isPending}

          >

            {loginMutation.isPending || registerMutation.isPending ? (

              <span className="spinner spinner-light" />

            ) : mode === "login" ? (

              <>Sign in <ArrowRight size={16} /></>

            ) : (

              <>Create account <ArrowRight size={16} /></>

            )}

          </button>

        </form>



        <div className="login-foot">

          <span>

            <ShieldCheck size={14} />

            Private student & staff workspaces

          </span>

          <span>© Washday 2026</span>

        </div>

      </div>

    </main>

  );

}



function Overview({ user, requests, disputes, activeRequests, readyCount, openDisputes, latestRequest, isStaff, onTab, onModal, onAdvance, busy }) {

  const inProgress = requests.filter((request) => !["DELIVERED", "READY"].includes(request.status)).length;

  const metrics = isStaff ? [

    { label: "Bags in progress", number: inProgress, note: "Across all hostels", icon: WashingMachine, tone: "metric-blue", change: "Live queue" },

    { label: "Ready for handover", number: readyCount, note: "Waiting at the desk", icon: PackageCheck, tone: "metric-green", change: "Needs pickup" },

    { label: "Open reports", number: openDisputes, note: "Awaiting a resolution", icon: FileWarning, tone: "metric-amber", change: "View reports" },

  ] : [

    { label: "In the laundry", number: activeRequests.filter((request) => !["READY"].includes(request.status)).length, note: "Moving through the wash", icon: WashingMachine, tone: "metric-blue", change: "On the way" },

    { label: "Ready to collect", number: readyCount, note: "At the laundry desk", icon: PackageCheck, tone: "metric-green", change: "Pick it up" },

    { label: "Reports in progress", number: openDisputes, note: "Your issue has a trail", icon: FileWarning, tone: "metric-amber", change: "See updates" },

  ];

  const latestDispute = disputes[0];

  return <>

    <section className="metrics-grid">{metrics.map(({ label, number, note, icon: Icon, tone, change }, index) => <button key={label} className={`metric-card ${tone}`} onClick={() => onTab(isStaff ? index === 2 ? "disputes" : "operations" : index === 2 ? "help" : "laundry")}><div className="metric-top"><span>{label}</span><Icon size={18} /></div><div className="metric-value">{number}<span className="metric-note">{note}</span></div><div className="metric-bottom"><span className="metric-sparkline">{index === 0 ? "⌁⌁⌁⌁⌁" : index === 1 ? "⌁⌁⌁" : "⌁⌁⌁⌁"}</span><span>{change}<ArrowUpRight size={13} /></span></div></button>)}</section>

    <section className="home-grid">

      <div className="panel current-panel"><div className="panel-header"><div><div className="panel-kicker">{isStaff ? "NEXT UP IN THE QUEUE" : "YOUR LATEST BAG"}</div><h2>{latestRequest ? `${latestRequest.batchTag} is ${latestRequest.status === "READY" ? "ready" : latestRequest.status === "DELIVERED" ? "back with you" : "on the move"}` : "Your laundry journey starts here"}</h2></div>{latestRequest && <Badge tone={statusTone(latestRequest.status)}>{stageLabels[latestRequest.status]}</Badge>}</div>

        {latestRequest ? <><div className="request-summary"><div className="laundry-glyph"><Shirt size={22} /></div><div className="request-summary-copy"><strong>{latestRequest.studentName} <span>· {latestRequest.room}</span></strong><span>{latestRequest.batchTag} <i /> {quantityLabel(latestRequest)} items <i /> {latestRequest.hostel}</span></div><button className="icon-button arrow-link" aria-label="View laundry details" onClick={() => onTab(isStaff ? "operations" : "laundry")}><ArrowRight size={18} /></button></div><LaundryTimeline status={latestRequest.status} expectedAt={latestRequest.expectedAt} />{isStaff && <button className="button button-secondary full-width" disabled={busy || latestRequest.status === "DELIVERED"} onClick={() => onAdvance(latestRequest)}>{latestRequest.status === "DELIVERED" ? "Completed" : `Move to ${stageLabels[stages[stages.indexOf(latestRequest.status) + 1]]}`}<ArrowRight size={15} /></button>}</> : <div className="empty-card"><span className="empty-illustration"><Shirt size={25} /></span><strong>No bags in the wash yet</strong><span>Book a collection and keep track from the first pickup.</span>{!isStaff && <button className="text-button" onClick={() => onModal("request")}>Schedule a collection <ArrowRight size={14} /></button>}</div>}

      </div>

      <div className="panel side-panel"><div className="panel-header"><div><div className="panel-kicker">{isStaff ? "TODAY AT THE DESK" : "THE LITTLE DETAILS"}</div><h2>{isStaff ? "Laundry desk" : "Pickup & drop-off"}</h2></div><span className="panel-soft-icon"><Clock3 size={18} /></span></div>

        <div className="schedule-card"><div className="schedule-date"><span>{latestRequest ? dateLabel(latestRequest.pickupAt).split(" ")[0] : "—"}</span><small>{latestRequest ? dateLabel(latestRequest.pickupAt).split(" ").slice(1).join(" ").toUpperCase() : "NO PICKUP"}</small></div><div className="schedule-info"><strong>{latestRequest ? "Collection window" : "Collection window"}</strong><span>{latestRequest ? dateLabel(latestRequest.pickupAt, true) : "Choose a time that works for you"}</span><Badge tone={latestRequest ? "green" : "neutral"}>{latestRequest ? "Scheduled" : "Not booked"}</Badge></div></div>

        <div className="schedule-row"><span className="schedule-icon"><PackageCheck size={16} /></span><div><strong>{latestRequest ? "Expected back" : "Clear return times"}</strong><span>{latestRequest ? dateLabel(latestRequest.expectedAt, true) : "See an ETA before clothes leave your hands."}</span></div><span className="schedule-arrow"><ArrowRight size={15} /></span></div>

        <div className="assurance"><div className="assurance-check"><Check size={14} /></div><span><strong>A tag stays with your bag</strong>Each batch has its own tracking ID.</span></div>

        {!isStaff && <button className="button button-primary full-width schedule-cta" onClick={() => onModal("request")}><Plus size={16} />Plan a collection</button>}

      </div>

    </section>

    <section className="lower-grid"><div className="panel history-panel"><div className="panel-header"><div><div className="panel-kicker">{isStaff ? "THE LATEST MOVEMENT" : "A LITTLE HISTORY"}</div><h2>{isStaff ? "Recently updated" : "Recent laundry"}</h2></div><button className="text-button" onClick={() => onTab(isStaff ? "operations" : "laundry")}>See all <ArrowRight size={14} /></button></div>

      {requests.length ? <div className="compact-list">{requests.slice(0, 3).map((request) => <div className="compact-row" key={request.id}><span className="compact-icon"><Shirt size={17} /></span><div className="compact-info"><strong>{request.batchTag}<span> · {quantityLabel(request)} items</span></strong><span>{isStaff ? `${request.studentName} · Room ${request.room}` : `${dateLabel(request.createdAt)} · ${request.hostel}`}</span></div><Badge tone={statusTone(request.status)}>{stageLabels[request.status]}</Badge></div>)}</div> : <div className="quiet-empty">Your past collections will appear here.</div>}

    </div><div className="panel update-panel"><div className="panel-header"><div><div className="panel-kicker">{isStaff ? "NEEDS A HUMAN TOUCH" : "WE’RE HERE IF YOU NEED US"}</div><h2>{isStaff ? "Latest report" : "Reports & resolution"}</h2></div><span className="panel-soft-icon"><CircleHelp size={18} /></span></div>

        {latestDispute ? <div className="latest-report"><div className="report-title"><span className="report-bullet" />{latestDispute.issueType}<Badge tone={statusTone(latestDispute.status)}>{latestDispute.status.toLowerCase()}</Badge></div><p>{latestDispute.itemName} · {latestDispute.request.batchTag}</p><span className="report-date">Opened {dateLabel(latestDispute.createdAt)}</span><button className="text-button" onClick={() => onTab(isStaff ? "disputes" : "help")}>View investigation <ArrowRight size={14} /></button></div> : <div className="no-reports"><span className="no-report-check"><CheckCircle2 size={19} /></span><strong>Nothing to report</strong><p>If something’s missing or damaged, tell us here and we’ll follow it through.</p><button className="text-button" onClick={() => onModal("dispute")}>Report an issue <ArrowRight size={14} /></button></div>}

      </div></section>

    <div className="hint-strip"><Sparkles size={15} /><span>{isStaff ? "A clear batch tag helps keep every item with its owner." : "A little more certainty for a day that already has enough surprises."}</span><span className="hint-sticker">WASH · RINSE · RETURN</span></div>

  </>;

}

function LaundryTimeline({ status, expectedAt }) {

  const current = stages.indexOf(status);

  return <div className="timeline-wrap"><div className="timeline-head"><span>PROCESSING JOURNEY</span><span>{status === "DELIVERED" ? "Finished" : `Expected ${dateLabel(expectedAt, true)}`}</span></div><div className="timeline">{stages.map((stage, index) => <div key={stage} className={`timeline-step ${index < current ? "step-done" : ""} ${index === current ? "step-current" : ""}`}><span className="timeline-node">{index < current ? <Check size={11} /> : <i />}</span><span className="timeline-label">{stageLabels[stage]}</span></div>)}</div><div className="timeline-hint"><span className="timeline-hint-dot" />{stageHints[status]} <span className="timeline-tag">Tagged · in view</span></div></div>;

}

function LaundryList({ requests, isStaff, onSelect, onAdvance, busy }) {

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState("ALL");

  const filtered = requests.filter((request) => {

    const query = search.toLowerCase();

    const matchesSearch = `${request.batchTag} ${request.studentName} ${request.room} ${request.hostel}`.toLowerCase().includes(query);

    return matchesSearch && (filter === "ALL" || request.status === filter);

  });

  return <section className="panel table-panel"><div className="table-toolbar"><div><div className="panel-kicker">{isStaff ? "ALL HOSTELS · EVERY ACTIVE BATCH" : "YOUR COLLECTIONS · EVERY ITEM ACCOUNTED FOR"}</div><h2>{isStaff ? "Batch tracker" : "Laundry requests"}</h2></div><div className="table-controls"><label className="search-box"><Search size={15} /><input placeholder={isStaff ? "Search batch or student" : "Search your laundry"} value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="select-wrap"><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter laundry by status"><option value="ALL">All stages</option>{stages.map((stage) => <option value={stage} key={stage}>{stageLabels[stage]}</option>)}</select><ChevronDown size={14} /></div></div></div>

    {filtered.length ? <div className="request-table-wrap"><table className="request-table"><thead><tr><th>BATCH / STUDENT</th><th>ITEMS</th><th>COLLECTED</th><th>EXPECTED BACK</th><th>STAGE</th><th>{isStaff ? "UPDATE" : ""}</th></tr></thead><tbody>{filtered.map((request) => <tr key={request.id}><td><div className="batch-cell"><span className="table-icon"><Shirt size={16} /></span><div><strong>{request.batchTag}</strong><span>{isStaff ? `${request.studentName} · Room ${request.room}` : request.hostel}</span></div></div></td><td><strong>{quantityLabel(request)} pieces</strong><small>{itemList(request.items).map((item) => item.name).join(", ")}</small></td><td>{dateLabel(request.pickupAt)}</td><td><strong>{dateLabel(request.expectedAt)}</strong><small>{dateLabel(request.expectedAt, true).split(", ").slice(-1)}</small></td><td><Badge tone={statusTone(request.status)}>{stageLabels[request.status]}</Badge></td><td>{isStaff && request.status !== "DELIVERED" ? <button className="advance-button" disabled={busy} onClick={() => onAdvance(request)}>{stages[stages.indexOf(request.status) + 1] === "DELIVERED" ? "Deliver" : "Advance"}<ArrowRight size={13} /></button> : isStaff ? <span className="delivered-mark"><CheckCircle2 size={16} />Done</span> : <button className="icon-button row-open" title="View this batch" aria-label={`View batch ${request.batchTag}`} onClick={() => onSelect(request)}><ChevronRight size={17} /></button>}</td></tr>)}</tbody></table></div> : <div className="empty-table"><span className="empty-illustration"><Search size={22} /></span><strong>No laundry found</strong><span>Try another name or stage.</span></div>}

    <div className="table-foot"><span>Showing {filtered.length} of {requests.length} batches</span><span>{isStaff ? "Advance a batch as it moves through the laundry." : "Batch tags and return times stay attached to each request."}</span></div>

  </section>;

}

function DisputeDesk({ disputes, isStaff, onModal, onUpdate, busy }) {

  const [resolutionText, setResolutionText] = useState({});

  return <section className="dispute-layout"><div className="dispute-main"><div className="panel dispute-panel"><div className="table-toolbar"><div><div className="panel-kicker">{isStaff ? "FOLLOW EACH REPORT THROUGH" : "YOUR CONCERNS HAVE A PAPER TRAIL"}</div><h2>{isStaff ? "Investigation queue" : "Your reports"}</h2></div>{!isStaff && <button className="button button-primary" onClick={onModal}><Plus size={16} />Report an issue</button>}</div>

    {disputes.length ? <div className="case-list">{disputes.map(({ id, status, issueType, itemName, description, resolution, createdAt, request }) => <article className="case-card" key={id}><div className="case-top"><span className="case-symbol"><FileWarning size={18} /></span><div className="case-title"><strong>{issueType}<span> · {itemName}</span></strong><small>{request.batchTag} <i /> {request.studentName} · Room {request.room}</small></div><Badge tone={statusTone(status)}>{status.toLowerCase()}</Badge></div><p className="case-description">{description}</p>{resolution && <div className="resolution-note"><span><Sparkles size={14} />Staff update</span><p>{resolution}</p></div>}<div className="case-bottom"><span>Opened {dateLabel(createdAt, true)}</span>{isStaff && status !== "RESOLVED" && <div className="case-actions"><input aria-label="Investigation note" placeholder="Add an update or resolution…" value={resolutionText[id] ?? resolution} onChange={(event) => setResolutionText({ ...resolutionText, [id]: event.target.value })} /><select aria-label="Update report status" value={status} onChange={(event) => onUpdate(id, event.target.value, resolutionText[id] ?? resolution)}><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolve</option></select><button className="icon-button save-case" disabled={busy} title="Save investigation update" onClick={() => onUpdate(id, status, resolutionText[id] ?? resolution)}><Check size={16} /></button></div>}{isStaff && status === "RESOLVED" && <span className="resolved-label"><CheckCircle2 size={15} />Resolution recorded</span>}</div></article>)}</div> : <div className="empty-table"><span className="empty-illustration"><CheckCircle2 size={22} /></span><strong>No open laundry reports</strong><span>{isStaff ? "New missing or damaged item reports will appear here." : "If something comes back missing or damaged, report it here."}</span>{!isStaff && <button className="text-button" onClick={onModal}>Start a report <ArrowRight size={14} /></button>}</div>}

  </div></div><aside className="panel resolution-sidebar"><span className="resolution-art"><span /><span /><span /></span><div className="panel-kicker">A FAIR FOLLOW-THROUGH</div><h2>{isStaff ? "Make the next step clear." : "Something not quite right?"}</h2><p>{isStaff ? "Keep updates attached to the report. Students can follow the investigation without chasing the laundry desk." : "Tell us which item and what happened. The laundry team will investigate and leave updates right here."}</p><div className="resolution-steps"><span><i>01</i>{isStaff ? "Check the batch" : "Choose your batch"}</span><span><i>02</i>{isStaff ? "Investigate & update" : "Describe the issue"}</span><span><i>03</i>{isStaff ? "Record a resolution" : "Follow the resolution"}</span></div>{!isStaff && <button className="button button-secondary full-width" onClick={onModal}><FileWarning size={15} />Start a missing or damage report</button>}</aside></section>;

}

function RequestDetailsModal({ request, onClose }) {

  const items = itemList(request.items);

  return <Modal title={request.batchTag} eyebrow="BATCH DETAILS · TRACKING" onClose={onClose}><div className="details-content"><div className="details-status"><div><Badge tone={statusTone(request.status)}>{stageLabels[request.status]}</Badge><p>{stageHints[request.status]}</p></div><div className="details-tag"><PackageCheck size={19} /><span>Tagged batch</span></div></div><LaundryTimeline status={request.status} expectedAt={request.expectedAt} /><div className="details-section"><div className="panel-kicker">ITEMS IN THIS BATCH · {quantityLabel(request)} TOTAL</div>{items.map((item, index) => <div className="detail-item" key={`${item.name}-${index}`}><span className="detail-item-icon"><Shirt size={15} /></span><strong>{item.name}</strong><span>× {item.quantity}</span></div>)}</div><div className="details-grid"><div><span>Collection window</span><strong>{dateLabel(request.pickupAt, true)}</strong></div><div><span>Drop-off at laundry</span><strong>{dateLabel(request.dropOffAt, true)}</strong></div><div><span>Expected completion</span><strong>{dateLabel(request.expectedAt, true)}</strong></div><div><span>Return location</span><strong>{request.hostel} · Room {request.room}</strong></div></div>{request.notes && <div className="details-notes"><strong>Care notes</strong><p>{request.notes}</p></div>}<div className="details-created">Request opened {dateLabel(request.createdAt, true)} <span>·</span> tag stays with your laundry through handover</div><div className="modal-actions"><button className="button button-primary" onClick={onClose}>Done</button></div></div></Modal>;

}

function RequestModal({ user, onClose, onCreated }) {

  const [items, setItems] = useState([{ name: "", quantity: 1 }]);

  const [pickupAt, setPickupAt] = useState(displayDateTimeOffset(2));

  const [dropOffAt, setDropOffAt] = useState(displayDateTimeOffset(4));

  const [expectedAt, setExpectedAt] = useState(displayDateTimeOffset(30));

  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");

  const mutation = useMutation({ mutationFn: (body) => api("/api/requests", { method: "POST", body: JSON.stringify(body) }), onSuccess: onCreated, onError: (e) => setError(e.message) });

  const submit = (event) => {

    event.preventDefault();

    setError("");

    const payload = { items, pickupAt: new Date(pickupAt).toISOString(), dropOffAt: new Date(dropOffAt).toISOString(), expectedAt: new Date(expectedAt).toISOString(), notes };

    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {

      setError(parsed.error.issues[0]?.message ?? "Review the collection details.");

      return;

    }

    mutation.mutate(parsed.data);

  };

  return <Modal title="Plan a laundry collection" eyebrow="NEW LAUNDRY REQUEST" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="profile-recap"><span className="avatar">{user.name.charAt(0)}</span><div><strong>{user.name}</strong><span>{user.hostel} · Room {user.room} · {user.studentId}</span></div><span className="verified-chip"><ShieldCheck size={13} />Verified profile</span></div><fieldset className="form-fieldset"><legend>What’s going in the wash?</legend><p className="field-hint">Add every clothing type to this one collection. Choose a suggestion or type a custom item name, then set its quantity.</p><datalist id="laundry-item-suggestions"><option value="T-shirt" /><option value="Shirt" /><option value="Pants" /><option value="Shorts" /><option value="Jeans" /><option value="Socks" /><option value="Bedsheet" /><option value="Pillowcase" /><option value="Towel" /><option value="Hoodie" /><option value="Jacket" /><option value="Kurta" /></datalist><div className="item-form-list">{items.map((item, index) => <div className="item-form-row" key={index}><label className="field-grow">Item name<input list="laundry-item-suggestions" placeholder="Select or type e.g. T-shirt" value={item.name} onChange={(event) => setItems(items.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} required maxLength={60} /></label><label className="quantity-field">Qty<input aria-label={`Quantity for ${item.name || ("item " + (index + 1))}`} type="number" min="1" max="99" value={item.quantity} onChange={(event) => setItems(items.map((entry, i) => i === index ? { ...entry, quantity: Number(event.target.value) } : entry))} required /></label>{items.length > 1 && <button className="icon-button remove-item" type="button" aria-label={`Remove ${item.name || ("item " + (index + 1))}`} onClick={() => setItems(items.filter((_, i) => i !== index))}><X size={15} /></button>}</div>)}</div><button className="add-item" type="button" onClick={() => setItems([...items, { name: "", quantity: 1 }])}><Plus size={14} />Add another item</button></fieldset><div className="form-two"><label>Collection window<input type="datetime-local" value={pickupAt} onChange={(event) => setPickupAt(event.target.value)} required /></label><label>Drop-off to laundry<input type="datetime-local" value={dropOffAt} onChange={(event) => setDropOffAt(event.target.value)} required /></label></div><label>Expected completion<input type="datetime-local" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} required /><span className="field-hint">We’ll use this as your expected return time.</span></label><label>Care notes <span className="optional-label">Optional</span><textarea placeholder="Delicates, separate darks, stain to check…" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="form-info"><PackageCheck size={15} />A unique batch tag will be added as soon as you submit.</div>{error && <div className="form-error"><CircleHelp size={15} />{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? <span className="spinner spinner-light" /> : <>Create laundry request <ArrowRight size={15} /></>}</button></div></form></Modal>;

}

function DisputeModal({ requests, onClose, onCreated }) {

  const eligible = requests.filter((request) => request.status === "DELIVERED" || request.status === "READY");

  const [requestId, setRequestId] = useState(eligible[0]?.id ?? requests[0]?.id ?? "");

  const [itemName, setItemName] = useState("");

  const [issueType, setIssueType] = useState("Missing item");

  const [description, setDescription] = useState("");

  const [error, setError] = useState("");

  const mutation = useMutation({ mutationFn: (body) => api("/api/disputes", { method: "POST", body: JSON.stringify(body) }), onSuccess: onCreated, onError: (e) => setError(e.message) });

  const selected = requests.find((request) => request.id === requestId);

  const submit = (event) => {
    event.preventDefault(); const parsed = disputeSchema.safeParse({ requestId, itemName, issueType, description }); if (!parsed.success) {

      setError(parsed.error.issues[0]?.message ?? "Review the report.");

      return;

    } mutation.mutate(parsed.data);
  };

  return <Modal title="Let’s make this right" eyebrow="REPORT AN ISSUE" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="report-intro"><div className="report-intro-icon"><FileWarning size={20} /></div><p>Tell us what came back differently. Your report will stay linked to its batch while we investigate.</p></div>{requests.length === 0 ? <div className="empty-report-message">You’ll need a laundry request before you can report an item. Create a request first.</div> : <><label>Which laundry batch?<select value={requestId} onChange={(event) => setRequestId(event.target.value)} required>{requests.map((request) => <option value={request.id} key={request.id}>{request.batchTag} · {request.hostel} · {stageLabels[request.status]}</option>)}</select></label><label>Item affected<input placeholder="e.g. White T-shirt" value={itemName} onChange={(event) => setItemName(event.target.value)} required maxLength={80} />{selected && <span className="field-hint">Items in this batch: {itemList(selected.items).map((item) => item.name).join(", ")}</span>}</label><label>What happened?<select value={issueType} onChange={(event) => setIssueType(event.target.value)}><option>Missing item</option><option>Damaged item</option><option>Other</option></select></label><label>Tell us a little more<textarea rows={4} placeholder="Which item is missing or what damage did you notice?" value={description} onChange={(event) => setDescription(event.target.value)} required minLength={8} maxLength={1000} /></label></>}{error && <div className="form-error"><CircleHelp size={15} />{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={mutation.isPending || requests.length === 0}>{mutation.isPending ? <span className="spinner spinner-light" /> : <>Send report <ArrowRight size={15} /></>}</button></div></form></Modal>;

}

function Modal({ title, eyebrow, onClose, children }) {

  return <div className="modal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget)

      onClose();
  }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><div className="panel-kicker">{eyebrow}</div><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></header>{children}</section></div>;

}
