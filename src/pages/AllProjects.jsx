import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { FiCheckCircle, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

// ▶ You can keep this true; the helper below will silently no-op if the endpoint isn't there.
const ENABLE_USER_LOOKUP = true;

/* ---------------- helpers ---------------- */
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const daysLeft = (endAt) => {
  if (!endAt) return null;
  const now = new Date();
  const end = new Date(endAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
};

const clampPct = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

const barToneFor = (pct) => {
  if (pct >= 70) return { track: "bg-rose-200", fill: "bg-violet-600" };
  if (pct >= 40) return { track: "bg-slate-200", fill: "bg-sky-500" };
  return { track: "bg-slate-200", fill: "bg-orange-500" };
};

const badgeToneFor = (dleft) => {
  if (dleft == null) return { text: "—", cls: "bg-gray-100 text-gray-500" };
  if (dleft === 0) return { text: "Due today", cls: "bg-orange-100 text-orange-700" };
  if (dleft <= 3) return { text: `${dleft} day${dleft === 1 ? "" : "s"} left`, cls: "bg-[#E7D4D8] text-[#AA405B]" };
  if (dleft <= 7) return { text: `${dleft} days left`, cls: "bg-orange-100 text-orange-700" };
  return { text: `${dleft} days left`, cls: "bg-indigo-100 text-indigo-700" };
};

/* --------------- Avatar helpers --------------- */
const initialFrom = ({ email = "", name = "" }) => {
  const local = (email || "").trim();
  if (local.length > 0) return local[0].toUpperCase();
  const nm = (name || "").trim();
  if (nm.length > 0) return nm[0].toUpperCase();
  return "?";
};

const Avatar = ({ email, name, picture, avatar }) => {
  const initial = initialFrom({ email, name });
  const src = picture || avatar || "";
  return src ? (
    <img
      src={src}
      alt={name || email}
      className="w-8 h-8 rounded-full ring-2 ring-white object-cover"
      title={name || email}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      className="w-8 h-8 rounded-full ring-2 ring-white bg-slate-300 flex items-center justify-center text-slate-700 text-xs font-semibold"
      title={name || email || "Member"}
    >
      {initial}
    </div>
  );
};

// Renders up to 3 avatars + “+n”
const Avatars = ({ members = [], fallbackCount = 0 }) => {
  if ((!members || members.length === 0) && !fallbackCount) return null;

  const shownMembers = (members || []).slice(0, 3);
  const remainder = members.length > 0 ? Math.max(0, members.length - 3) : Math.max(0, fallbackCount - 3);

  return (
    <div className="flex -space-x-2">
      {shownMembers.length > 0
        ? shownMembers.map((m, idx) => (
            <Avatar key={idx} email={m.email} name={m.name} picture={m.picture} avatar={m.avatar} />
          ))
        : [...Array(Math.min(3, fallbackCount))].map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full ring-2 ring-white bg-slate-300 flex items-center justify-center text-slate-700 text-xs font-semibold"
              title="Member"
            >
              ?
            </div>
          ))}
      {remainder > 0 && (
        <div className="w-8 h-8 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
          +{remainder}
        </div>
      )}
    </div>
  );
};

/* ---------------- Small UI helpers ---------------- */
const ActionBtn = ({ children, onClick, title, disabled, variant = "neutral" }) => {
  const base =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl shadow transition text-sm font-semibold border";
  const styles = {
    neutral: "bg-white/90 hover:bg-white text-slate-800 border-slate-200",
    success:
      "bg-green-500 hover:bg-green-600 text-white border-green-600 disabled:bg-emerald-200 disabled:text-emerald-800 disabled:cursor-not-allowed",
    danger: "bg-white/90 hover:bg-red-50 text-red-600 border-red-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
  );
};

/* ---------------- Project Card ---------------- */
const ProjectCard = ({ project, onComplete, onEdit, onDelete }) => {
  const pct = clampPct(project.progress);
  const dleft = daysLeft(project.end_at);
  const tones = barToneFor(pct);
  const badge = badgeToneFor(dleft);
  const customColor = "#AA405B";
  const isComplete = (project.status || "").toLowerCase() === "complete";

  return (
    <div
      className="rounded-2xl text-white shadow-lg p-5 relative overflow-hidden"
      style={{ backgroundColor: customColor }}
    >
      {/* Top-right actions */}
      <div className="absolute top-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(project)}
          title="Edit project"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-slate-800 border border-gray-300 hover:bg-slate-100 transition"
        >
          <FiEdit2 className="text-sm" />
          <span className="text-sm font-medium">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onComplete(project)}
          disabled={isComplete}
          title={isComplete ? "Already complete" : "Mark as complete"}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition 
            ${isComplete 
              ? "bg-emerald-200 text-emerald-800 border-emerald-300 cursor-not-allowed" 
              : "bg-green-500 text-white hover:bg-green-600 border-green-600"
            }`}
        >
          <FiCheckCircle className="text-sm" />
          <span className="text-sm font-medium">{isComplete ? "Completed" : "Complete"}</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(project)}
          title="Delete project"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white border border-red-600 hover:bg-red-600 transition"
        >
          <FiTrash2 className="text-sm" />
          <span className="text-sm font-medium">Delete</span>
        </button>
      </div>

      <div className="mt-7 text-sm/5 text-rose-100">{fmtDate(project.start_at)}</div>
      <div className="mt-3 text-xl font-semibold">{project.name}</div>

      <div className="mt-4 text-rose-100">Progress</div>
      <div className={`mt-2 h-3 w-full rounded-full ${tones.track} relative`}>
        <div className={`absolute left-0 top-0 h-3 rounded-full ${tones.fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-right text-rose-100">{pct}%</div>

      <div className="mt-4 flex items-center justify-between">
        <Avatars members={project._membersResolved} fallbackCount={(project.member_ids || []).length} />
        <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${badge.cls}`}>{badge.text}</div>
      </div>
    </div>
  );
};

/* ---------------- Main ---------------- */
function AllProjects({ forUserId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // helper: batch fetch members by ids (SILENT—returns [] on any failure)
  const fetchMembersByIds = async (ids = []) => {
    if (!ENABLE_USER_LOOKUP || !ids.length) return [];
    try {
      const url = new URL(`${API_BASE}/users`);
      url.searchParams.set("ids", ids.join(","));
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) {
        return [];
      }
      const json = await res.json().catch(() => []);
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  };

  // PATCH project -> complete
  const completeProject = async (project) => {
    const id = project._id?.$oid || project._id;
    if (!id) return;
    if (!window.confirm(`Mark "${project.name}" as complete?`)) return;

    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete", progress: 100 }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(`Failed to complete: ${res.status} ${t}`);
        return;
      }
      setItems((prev) =>
        prev.map((p) => ((p._id?.$oid || p._id) === id ? { ...p, status: "complete", progress: 100 } : p))
      );
    } catch (e) {
      alert(`Failed to complete: ${e.message}`);
    }
  };

  // Navigate to edit page
  const goEdit = (project) => {
    const id = project._id?.$oid || project._id;
    if (!id) return;
    navigate(`/project-create?projectId=${encodeURIComponent(id)}`);
  };

  // DELETE project
  const deleteProject = async (project) => {
    const id = project._id?.$oid || project._id;
    if (!id) return;
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(`Failed to delete: ${res.status} ${t}`);
        return;
      }
      setItems((prev) => prev.filter((p) => (p._id?.$oid || p._id) !== id));
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  // Resolve members for each project (SILENT if /users is missing)
  const resolveProjectMembers = async (projects) => {
    const idSet = new Set();
    if (ENABLE_USER_LOOKUP) {
      projects.forEach((p) => {
        const hasMembers = Array.isArray(p.members) && p.members.length > 0;
        const hasEmails = Array.isArray(p.member_emails) && p.member_emails.length > 0;
        if (!hasMembers && !hasEmails && Array.isArray(p.member_ids) && p.member_ids.length > 0) {
          p.member_ids.forEach((oid) => {
            const id = typeof oid === "object" && oid?.$oid ? oid.$oid : oid;
            if (id) idSet.add(id);
          });
        }
      });
    }

    const profiles = idSet.size > 0 ? await fetchMembersByIds(Array.from(idSet)) : [];

    const byId = new Map(
      profiles.map((u) => [
        String(u._id?.$oid || u._id || ""),
        {
          email: u.email,
          name: u.name,
          picture: u.picture || u.profile?.photo || u.avatar_url || u.avatar || "",
          avatar: u.avatar || u.avatar_url || "",
        },
      ])
    );

    return projects.map((p) => {
      if (Array.isArray(p.members) && p.members.length > 0) {
        return {
          ...p,
          _membersResolved: p.members.map((m) => ({
            email: m.email,
            name: m.name,
            picture: m.picture || m.profile?.photo || m.avatar_url || m.avatar || "",
            avatar: m.avatar || m.avatar_url || "",
          })),
        };
      }
      if (Array.isArray(p.member_emails) && p.member_emails.length > 0) {
        return {
          ...p,
          _membersResolved: p.member_emails.map((em) => ({ email: em, name: "", picture: "", avatar: "" })),
        };
      }
      if (Array.isArray(p.member_ids) && p.member_ids.length > 0 && byId.size > 0) {
        const members = p.member_ids
          .map((oid) => String(typeof oid === "object" && oid?.$oid ? oid.$oid : oid))
          .map((id) => byId.get(id))
          .filter(Boolean);
        return { ...p, _membersResolved: members };
      }
      return { ...p, _membersResolved: [] };
    });
  };

  useEffect(() => {
    let mounted = true; // <-- FIX: lowercase
    const url = new URL(`${API_BASE}/projects`);
    if (forUserId) url.searchParams.set("for_user", forUserId);

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(url.toString(), { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        const list = Array.isArray(data) ? data : data.projects || [];

        const withMembers = await resolveProjectMembers(list);
        if (!mounted) return;
        setItems(withMembers);
      } catch (e) {
        // keep UI quiet
        setError(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false; // <-- FIX: lowercase
    };
  }, [forUserId]);

  const empty = !loading && !error && items.length === 0;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">All Projects</h2>
        <div className="text-sm text-slate-500">{items.length} total</div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>}

      {empty && <div className="text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">No projects yet.</div>}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map((p) => (
            <div key={p._id?.$oid || p._id || p.name} className="relative">
              <ProjectCard
                project={p}
                onComplete={completeProject}
                onEdit={goEdit}
                onDelete={deleteProject}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AllProjects;
