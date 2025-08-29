import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

// ▶ Turn this on only if your backend supports GET /users?ids=...
const ENABLE_USER_LOOKUP = true;

// ------- helpers -------
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const daysLeft = (endAt) => {
  if (!endAt) return null;
  const now = new Date();
  const end = new Date(endAt);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
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
  if (dleft <= 3) return { text: `${dleft} day${dleft === 1 ? "" : "s"} left`, cls: "bg-[#E7D4D8] text-[#AA405B]" };
  if (dleft <= 7) return { text: `${dleft} days left`, cls: "bg-orange-100 text-orange-700" };
  return { text: `${dleft} days left`, cls: "bg-indigo-100 text-indigo-700" };
};

// ---------- Avatar helpers ----------
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
            <Avatar
              key={idx}
              email={m.email}
              name={m.name}
              picture={m.picture}
              avatar={m.avatar}
            />
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

// ---- Card component ----
const ProjectCard = ({ project }) => {
  const pct = clampPct(project.progress);
  const dleft = daysLeft(project.end_at);
  const tones = barToneFor(pct);
  const badge = badgeToneFor(dleft);
  const customColor = "#AA405B";

  return (
    <div className="rounded-2xl text-white shadow-lg p-5 relative overflow-hidden" style={{ backgroundColor: customColor }}>
      <div className="text-sm/5 text-rose-100">{fmtDate(project.start_at)}</div>
      <div className="mt-1 text-xl font-semibold">{project.name}</div>

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

// ---- Main Component ----
function AllProjects({ forUserId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // helper: batch fetch members by ids (optional; only if backend supports it)
  const fetchMembersByIds = async (ids = []) => {
    if (!ENABLE_USER_LOOKUP || !ids.length) return [];
    const url = new URL(`${API_BASE}/users`);
    url.searchParams.set("ids", ids.join(","));
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error(`Users HTTP ${res.status}`);
    return res.json();
  };

  // Resolve members for each project:
  // - prefer project.members (embedded)
  // - else use member_emails (for initials)
  // - else (optionally) hydrate by member_ids via /users if enabled
  const resolveProjectMembers = async (projects) => {
    // Collect unresolved ids only if lookup is enabled
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

    let profiles = [];
    if (ENABLE_USER_LOOKUP && idSet.size > 0) {
      try {
        profiles = await fetchMembersByIds(Array.from(idSet));
      } catch (e) {
        console.warn("Member fetch failed:", e);
      }
    }

    // Build a lookup for quick mapping (prefer 'picture'; accept 'avatar'/'avatar_url')
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

    // Attach _membersResolved to each project
    return projects.map((p) => {
      // 1) Embedded full members
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
      // 2) Emails only → good enough for first-letter avatars
      if (Array.isArray(p.member_emails) && p.member_emails.length > 0) {
        return {
          ...p,
          _membersResolved: p.member_emails.map((em) => ({ email: em, name: "", picture: "", avatar: "" })),
        };
      }
      // 3) IDs only → try lookup if enabled; else leave empty (UI will show '?' placeholders via fallbackCount)
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

        // resolve members
        const withMembers = await resolveProjectMembers(list);
        if (!mounted) return;
        setItems(withMembers);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
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

      {empty && (
        <div className="text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">No projects yet.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map((p) => (
            <ProjectCard key={p._id?.$oid || p._id || p.name} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AllProjects;
