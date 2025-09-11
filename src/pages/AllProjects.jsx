// src/frontend/components/Projects.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import useRealtime from "../hooks/useRealtime"; // add this import

import { FiCheckCircle, FiEdit2, FiTrash2 } from "react-icons/fi";
const buildAvatarSrc = (val) => {
  const v = (val || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/uploads/")) return `${API_BASE}${v}`;
  return `${API_BASE}/uploads/${v}`; // bare filename -> assume uploads
};
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

/* optional actor headers for server-side auditing/notifications */
const getActorHeaders = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    const id = u?._id || u?.id;
    const name = u?.name || u?.email;
    const h = {};
    if (id) h["X-Actor-Id"] = String(id);
    if (name) h["X-Actor-Name"] = String(name);
    return h;
  } catch {
    return {};
  }
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
const Avatars = ({ members = [], fallbackCount = 0 }) => {
  const hasMembers = Array.isArray(members) && members.length > 0;
  if (!hasMembers && !fallbackCount) return null;
  const shownMembers = hasMembers ? members.slice(0, 3) : [];
  const remainder = hasMembers ? Math.max(0, members.length - 3) : Math.max(0, fallbackCount - 3);

  return (
    <div className="relative group flex -space-x-2 items-center">
      {hasMembers
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
        <div className="w-8 h-8 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold" aria-label={`+${remainder} more`}>
          +{remainder}
        </div>
      )}
      {hasMembers && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
          <div className="max-w-[260px] max-h-56 overflow-auto whitespace-normal text-xs bg-white text-slate-700 border border-slate-200 shadow-lg rounded-md px-3 py-2">
            {members.map((m, idx) => (
              <div key={idx} className="truncate">
                {m?.name || m?.email || "Member"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- Project Card ---------------- */
const ProjectCard = ({ project, onToggleConfirm, onEdit, onDelete }) => {
  const pct = clampPct(project.progress);
  const dleft = daysLeft(project.end_at);
  const tones = barToneFor(pct);
  const badge = badgeToneFor(dleft);
  const customColor = "#AA405B";

  const isConfirmed =
    project.confirm === 1 ||
    project.confirm === "1" ||
    project.confirm === true;

  return (
    <div className="rounded-2xl text-white shadow-lg p-5 relative overflow-hidden" style={{ backgroundColor: customColor }}>
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
          onClick={() => onToggleConfirm(project, !isConfirmed)}
          title={isConfirmed ? "Unconfirm" : "Confirm"}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition
            ${isConfirmed
              ? "bg-emerald-200 text-emerald-800 border-emerald-300"
              : "bg-blue-500 text-white hover:bg-blue-600 border-blue-600"}`}
        >
          <FiCheckCircle className="text-sm" />
          <span className="text-sm font-medium">{isConfirmed ? "Unconfirm" : "Confirm"}</span>
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

      {/* Small ribbon showing confirm state */}
      <div className="absolute left-0 top-0">
        {isConfirmed && (
          <div className="m-3 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">
            Confirmed
          </div>
        )}
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

  const fetchMembersByIds = async (ids = []) => {
    if (!ENABLE_USER_LOOKUP || !ids.length) return [];
    try {
      const url = new URL(`${API_BASE}/users`);
      url.searchParams.set("ids", ids.join(","));
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json().catch(() => []);
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  };
const sockRef = useRealtime(null, {
    onProjectProgress: (msg) => {
      const { project_id, progress } = msg || {};
      if (!project_id) return;
      setItems((prev) =>
        prev.map((p) => {
          const id = p._id?.$oid || p._id;
          return id === project_id ? { ...p, progress: Number(progress) || 0 } : p;
        })
      );
    },
      });
  // Toggle confirm -> PATCH { confirm: 1 | 0 }
  const toggleConfirm = async (project, next) => {
    const id = project._id?.$oid || project._id;
    if (!id) return;

    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getActorHeaders(), // optional; helps backend show actor in admin notifications
        },
        body: JSON.stringify({ confirm: next ? 1 : 0 }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(`Failed to ${next ? "confirm" : "unconfirm"}: ${res.status} ${t}`);
        return;
      }
      setItems((prev) =>
        prev.map((p) =>
          (p._id?.$oid || p._id) === id ? { ...p, confirm: next ? 1 : 0 } : p
        )
      );
    } catch (e) {
      alert(`Failed to ${next ? "confirm" : "unconfirm"}: ${e.message}`);
    }
  };

  const goEdit = (project) => {
    const id = project._id?.$oid || project._id;
    if (!id) return;
    navigate(`/project-create?projectId=${encodeURIComponent(id)}`);
  };

  const deleteProject = async (project) => {
    const id = project._id?.$oid || project._id;
    if (!id) return;
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getActorHeaders(),
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

  const resolveProjectMembers = async (projects) => {
  const idSet = new Set();
  if (ENABLE_USER_LOOKUP) {
    projects.forEach((p) => {
      const hasMembers = Array.isArray(p.members) && p.members.length > 0;
      const hasEmails  = Array.isArray(p.member_emails) && p.member_emails.length > 0;
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
    profiles.map((u) => {
      const raw =
        u.profileImage ||      // ✅ NEW: uploaded profile path
        u.picture ||           // legacy fields kept
        u.avatar_url ||
        u.avatar ||
        (u.profile?.photo || "");
      const finalUrl = buildAvatarSrc(raw);
      return [
        String(u._id?.$oid || u._id || ""),
        {
          email: u.email,
          name:  u.name,
          picture: finalUrl,   // ✅ feed resolved URL into Avatar
          avatar: ""           // we won't use this now
        },
      ];
    })
  );

  return projects.map((p) => {
    if (Array.isArray(p.members) && p.members.length > 0) {
      return {
        ...p,
        _membersResolved: p.members.map((m) => {
          const raw = m.profileImage || m.picture || m.avatar_url || m.avatar || (m.profile?.photo || "");
          return {
            email: m.email,
            name:  m.name,
            picture: buildAvatarSrc(raw),
            avatar: ""
          };
        }),
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
    let mounted = true;
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
const s = sockRef.current;
        if (s && Array.isArray(withMembers)) {
          for (const p of withMembers) {
            const id = p._id?.$oid || p._id;
            if (id) s.emit("join", { projectId: String(id) });
          }
        }

      } catch (e) {
        setError(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
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
                onToggleConfirm={toggleConfirm}
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
