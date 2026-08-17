import Dexie, { type Table } from "dexie";

export interface SyncQueueItem {
  id?: number;
  method: string;
  url: string;
  body: string | null;
  headers: string;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  retries: number;
}

export class OfflineDatabase extends Dexie {
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super("ShopLedgerOfflineDB");
    this.version(1).stores({
      syncQueue: "++id, status, createdAt",
    });
  }
}

export const offlineDb = new OfflineDatabase();
