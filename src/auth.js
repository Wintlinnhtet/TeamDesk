// src/auth.js
export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
}
