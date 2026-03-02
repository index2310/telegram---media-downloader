import { MongoClient } from "mongodb";
import { safeErr } from "./safeErr.js";

let _client = null;
let _db = null;

export async function connectDb(mongoUri) {
  if (!mongoUri) return null;
  if (_db) return _db;

  try {
    _client = new MongoClient(mongoUri, { maxPoolSize: 5 });
    await _client.connect();
    _db = _client.db();

    // Safe, idempotent indexes (never touch _id)
    try {
      await _db.collection("memory_messages").createIndex({ platform: 1, userId: 1, ts: -1 });
    } catch (e) {
      console.warn("[db] createIndex failed (continuing)", {
        collection: "memory_messages",
        err: safeErr(e),
      });
    }

    return _db;
  } catch (e) {
    console.error("[db] connect error", { err: safeErr(e) });
    throw e;
  }
}

export async function getDb(mongoUri) {
  return connectDb(mongoUri);
}
