import { safeErr } from "./safeErr.js";

let _lastError = "";

export function setLastError(e) {
  _lastError = safeErr(e);
}

export function getLastError() {
  return _lastError;
}

export function parseAdminIds(envValue) {
  const raw = String(envValue || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isAdmin(userId, adminIds) {
  const id = String(userId || "");
  if (!id) return false;
  return Array.isArray(adminIds) && adminIds.includes(id);
}
