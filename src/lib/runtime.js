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

export function markLastUpdateReceived(runtimeInfo, ctx) {
  if (!runtimeInfo) return;
  runtimeInfo.lastUpdateAt = new Date().toISOString();

  // Keep a safe summary of the last update sender
  const chatId = String(ctx?.chat?.id || "");
  const userId = String(ctx?.from?.id || "");
  if (chatId) runtimeInfo.lastHandledChatId = chatId;
  if (userId) runtimeInfo.lastHandledUserId = userId;
}

export function markLastHandledMessage(runtimeInfo, ctx) {
  if (!runtimeInfo) return;
  runtimeInfo.lastHandledAt = new Date().toISOString();

  const chatId = String(ctx?.chat?.id || "");
  const userId = String(ctx?.from?.id || "");
  if (chatId) runtimeInfo.lastHandledChatId = chatId;
  if (userId) runtimeInfo.lastHandledUserId = userId;
}
