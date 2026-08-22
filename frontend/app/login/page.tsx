"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { authenticate } from "../../lib/api";
import "../globals.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reason") === "session-expired") {
      setError("Your session expired. Sign in again to continue.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authenticate(mode === "login" ? "/auth/login" : "/auth/register", {
        email,
        password,
        ...(mode === "register" ? { organization_name: organizationName } : {}),
      });
      window.localStorage.setItem("aether_access_token", result.access_token);
      window.location.assign("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Autonomous Topology Engine</span></div></div>
        <div className="auth-heading"><span className="eyebrow">VPS OPERATIONS CONSOLE</span><h1>{mode === "login" ? "Welcome back" : "Create your workspace"}</h1><p>Secure access to your infrastructure digital twin.</p></div>
        <form onSubmit={submit}>
          {mode === "register" && <label><span>Organization</span><div className="auth-input"><ShieldCheck size={15} /><input required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Your company name" /></div></label>}
          <label><span>Email address</span><div className="auth-input"><Mail size={15} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@example.com" /></div></label>
          <label><span>Password</span><div className="auth-input"><KeyRound size={15} /><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" /></div></label>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" disabled={loading}>{loading ? "Connecting..." : mode === "login" ? "Enter console" : "Create workspace"}<ArrowRight size={16} /></button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "New organization? Create an account" : "Already have access? Sign in"}</button>
      </section>
      <div className="auth-foot"><span><span className="pulse" /> VPS ENGINE READY</span><span>ENCRYPTED SESSION</span><span>AETHER-IT v1.0.0</span></div>
    </main>
  );
}