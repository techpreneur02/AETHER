"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ShieldCheck, Sparkles, Users } from "lucide-react";
import { listMembers, updateMemberRole, type Membership } from "../../lib/api";
import "../globals.css";

export default function MembersPage() {
  const [members, setMembers] = useState<Membership[]>([]);
  const [status, setStatus] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("aether_access_token");
    if (token) listMembers(token).then(setMembers).catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load members"));
  }, []);

  async function changeRole(memberId: string, role: Membership["role"]) {
    const token = window.localStorage.getItem("aether_access_token");
    if (!token) return;
    setSavingId(memberId);
    setStatus("");
    try {
      const updated = await updateMemberRole(token, memberId, role);
      setMembers((current) => current.map((member) => member.id === updated.id ? updated : member));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update role");
    } finally {
      setSavingId("");
    }
  }

  return <main className="members-shell"><header className="floorplan-header"><a href="/"><ArrowLeft size={16} /> Console</a><div className="auth-brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>AETHER-IT</strong><span>Organization access</span></div></div><span className="floorplan-status"><span className="pulse" /> VPS CONNECTED</span></header><section className="members-workspace"><span className="eyebrow">ADMINISTRATION / MEMBERS</span><h1>Who can change the twin?</h1><p>Manage access without crossing organization boundaries.</p><section className="members-card panel"><div className="panel-heading"><b>ORGANIZATION MEMBERS</b><Users size={14} /></div>{members.map((member) => <div className="member-row" key={member.id}><div className="member-identity"><span className="member-avatar"><ShieldCheck size={14} /></span><div><b>{member.email}</b><small>{member.id}</small></div></div><select value={member.role} disabled={savingId === member.id} onChange={(event) => changeRole(member.id, event.target.value as Membership["role"])}><option value="admin">Admin</option><option value="tech">Tech</option><option value="viewer">Viewer</option></select>{savingId === member.id && <Check size={14} className="saving-icon" />}</div>)}{!members.length && <div className="empty-members"><Users size={32} /><span>No members loaded.</span></div>}{status && <p className="upload-status error">{status}</p>}</section></section><footer className="statusbar"><span><Sparkles size={12} /> AI ENGINE: Gemini 3 Flash</span><span>ROLE-BASED ACCESS</span><span>VPS CONNECTED</span></footer></main>;
}