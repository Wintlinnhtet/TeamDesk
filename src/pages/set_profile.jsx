// src/frontend/components/Profile.jsx  (drop-in replacement for your set_profile.jsx)
import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";

/* Get current user id from local/session storage */
function getCurrentUserId() {
  try {
    const ls = JSON.parse(localStorage.getItem("user") || "null");
    const ss = JSON.parse(sessionStorage.getItem("user") || "null");
    const raw = ls?.user || ls || ss?.user || ss || null;
    return raw?._id ? String(raw._id) : null;
  } catch {
    return null;
  }
}

export default function Profile() {
  const customColor = "#AA405B";
  const userId = getCurrentUserId();

  // ---- state (ALL hooks live inside the component) ----
  const [profile, setProfile] = useState({
    name: "",
    position: "",
    email: "",
    address: "",
    phone: "",
    profileImage: "/uploads/pic.png", // fallback
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [imgBust, setImgBust] = useState(0); // cache-buster for <img> after upload

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Build the correct <img src> for DB/path/URL values
  const getImageSrc = () => {
    if (previewImage) return previewImage;

    const v = profile.profileImage || "/uploads/pic.png";
    // Full URL (http/https) — use as is
    if (/^https?:\/\//i.test(v)) return v;
    // Server-stored upload: “/uploads/…”
    if (v.startsWith("/uploads/")) return `${API_BASE}${v}?t=${imgBust}`;
    // Fallback to public asset (e.g. cat2.jpg in /public)
    return v;
  };

  // ---- load profile from backend ----
  useEffect(() => {
    (async () => {
      if (!userId) {
        setErr("Please sign in again.");
        return;
      }
      try {
        setLoading(true);
        setErr("");
        const r = await fetch(
          `${API_BASE}/api/profile?user_id=${encodeURIComponent(userId)}`,
          { credentials: "include" }
        );
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);

        setProfile({
          name: j.name || "",
          position: j.position || "",
          email: j.email || "",
          address: j.address || "",
          phone: j.phone || "",
          profileImage: j.profileImage || "/uploads/pic.png",
        });
      } catch (e) {
        setErr(e.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ---- form handlers ----
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((p) => ({ ...p, [name]: value }));
  };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErr("File size too large. Max 5MB.");
      return;
    }
    setSelectedFile(f);
    setErr("");
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(f);
  };

  // ---- upload image (creates/updates profileImage in DB) ----
  const uploadProfileImage = async () => {
    if (!selectedFile || !userId) return;
    const fd = new FormData();
fd.append("profileImage", selectedFile);
await fetch(`${API_BASE}/api/upload-profile-image?user_id=${userId}`, { method: "POST", body: fd, credentials: "include" });


    try {
      setLoading(true);
      setErr("");
      const r = await fetch(
        `${API_BASE}/api/upload-profile-image?user_id=${encodeURIComponent(
          userId
        )}`,
        {
          method: "POST",
          body: fd,
          credentials: "include",
        }
      );
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);

      const newPath = j.profileImage || j.imageUrl;
      if (newPath) {
        setProfile((p) => ({ ...p, profileImage: newPath }));
        setImgBust(Date.now()); // force <img> refresh
      }
      setSelectedFile(null);
      setPreviewImage(null);
      alert("Profile image updated!");
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // ---- save profile fields ----
  const saveProfile = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setErr("");
      const body = {
        name: profile.name?.trim() || "",
        position: profile.position?.trim() || "",
        email: profile.email?.trim() || "",
        address: profile.address?.trim() || "",
        phone: profile.phone?.trim() || "",
      };
      const r = await fetch(`${API_BASE}/api/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);

      setProfile((p) => ({
        ...p,
        name: j.user?.name ?? p.name,
        position: j.user?.position ?? p.position,
        email: j.user?.email ?? p.email,
        address: j.user?.address ?? p.address,
        phone: j.user?.phone ?? p.phone,
        profileImage: j.user?.profileImage ?? p.profileImage,
      }));
      setIsEditing(false);
      alert("Profile saved!");
    } catch (e) {
      setErr(e.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  // ---- change password (current + new + confirm) ----
  const changePassword = async () => {
    if (!userId) return;
    if (!curPw || !newPw) {
      setErr("Enter current and new password.");
      return;
    }
    if (newPw !== newPw2) {
      setErr("New passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      setErr("");
      const r = await fetch(`${API_BASE}/api/profile/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        credentials: "include",
        body: JSON.stringify({
          current_password: curPw,
          new_password: newPw,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      alert("Password changed!");
    } catch (e) {
      setErr(e.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile.name) {
    return (
      <div
        className="max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2 flex justify-center items-center h-64"
        style={{ borderColor: customColor }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderColor: customColor }}
          />
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border-2"
      style={{ borderColor: customColor }}
    >
      {err && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 mb-4">
          {err}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: customColor }}>
            Account Settings
          </h2>
          <p className="text-sm text-gray-600">
            Manage your profile and account settings
          </p>
        </div>
        <img
          src={getImageSrc()}
          alt="profile"
          className="w-16 h-16 rounded-full object-cover border-2"
          style={{ borderColor: customColor }}
          onError={(e) => (e.currentTarget.src = "/uploads/pic.png")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-4">
          {/* Profile section */}
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3
              className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1"
              style={{ color: customColor }}
            >
              My Profile
            </h3>
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0 relative">
                <img
                  src={getImageSrc()}
                  alt="profile"
                  className="w-24 h-24 rounded-full object-cover border-2"
                  style={{ borderColor: customColor }}
                  onError={(e) => (e.currentTarget.src = "/uploads/pic.png")}
                />
                {isEditing && (
                  <>
                    <label
                      htmlFor="profile-upload"
                      className="absolute bottom-0 right-0 bg-[#AA405B] text-white p-1 rounded-full cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </label>
                    <input
                      id="profile-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {selectedFile && (
                      <button
                        onClick={uploadProfileImage}
                        className="mt-2 px-4 py-1 bg-[#AA405B] text-white rounded text-sm"
                      >
                        Upload Image
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex-grow">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Position
                      </label>
                      <input
                        type="text"
                        name="position"
                        value={profile.position}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-xl font-bold">
                      {profile.name || "—"}
                    </h4>
                    <p className="text-gray-600">{profile.position || "—"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3
                className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1"
                style={{ color: customColor }}
              >
                Personal Information
              </h3>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={profile.email}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>

                    {/* Change Password */}
                    <div className="mt-6 p-4 bg-white rounded-lg border">
                      <h4 className="font-semibold mb-3" style={{ color: customColor }}>
                        Change Password
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="password"
                          placeholder="Current password"
                          value={curPw}
                          onChange={(e) => setCurPw(e.target.value)}
                          className="w-full p-2 border rounded"
                        />
                        <input
                          type="password"
                          placeholder="New password"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          className="w-full p-2 border rounded"
                        />
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          value={newPw2}
                          onChange={(e) => setNewPw2(e.target.value)}
                          className="w-full p-2 border rounded"
                        />
                        <button
                          onClick={changePassword}
                          className="px-4 py-2 rounded bg-[#AA405B] text-white"
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium break-all">
                        {profile.email || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Password</p>
                      <p className="font-medium">••••••••</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3
                className="text-lg font-semibold mb-4 border-b-4 border-[#AA405B] inline-block pb-1"
                style={{ color: customColor }}
              >
                Address
              </h3>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        name="phone"
                        value={profile.phone}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={profile.address}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{profile.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-medium break-words">
                        {profile.address || "—"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Save / Edit */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => (isEditing ? saveProfile() : setIsEditing(true))}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-[#AA405B] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Processing..." : isEditing ? "Save Profile" : "Edit Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
