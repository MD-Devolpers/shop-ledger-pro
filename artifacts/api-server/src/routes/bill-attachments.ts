import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { db, purchaseBillsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { createRequire } from "module";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only images (JPEG, PNG, WebP) and PDF allowed"));
  },
});

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';
let _storageClient: any = null;

async function getStorageClient() {
  if (_storageClient) return _storageClient;
  try {
    const _require = createRequire(import.meta.url);
    const { Storage } = _require('@google-cloud/storage');
    _storageClient = new Storage({
      credentials: {
        audience: 'replit',
        subject_token_type: 'access_token',
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: 'external_account',
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: 'json', subject_token_field_name: 'access_token' },
        },
        universe_domain: 'googleapis.com',
      },
      projectId: '',
    });
    return _storageClient;
  } catch {
    throw new Error('Object storage is not available on this server.');
  }
}

async function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const client = await getStorageClient();
  return client.bucket(bucketId);
}

// Upload file attachment to a purchase bill
router.post("/inventory/purchase-bills/:id/attach", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const billId = parseInt(req.params.id);

  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const [bill] = await db.select({ id: purchaseBillsTable.id, attachmentUrl: purchaseBillsTable.attachmentUrl })
    .from(purchaseBillsTable)
    .where(and(eq(purchaseBillsTable.id, billId), eq(purchaseBillsTable.userId, userId)));

  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  try {
    const bucket = await getBucket();

    // Delete old attachment if exists
    if (bill.attachmentUrl) {
      try { await bucket.file(bill.attachmentUrl).delete(); } catch {}
    }

    const ext = (req.file.originalname.split(".").pop() ?? "bin").toLowerCase();
    const objectPath = `purchase-bills/${userId}/${billId}-${Date.now()}.${ext}`;

    await bucket.file(objectPath).save(req.file.buffer, {
      contentType: req.file.mimetype,
      resumable: false,
    });

    await db.update(purchaseBillsTable)
      .set({ attachmentUrl: objectPath })
      .where(eq(purchaseBillsTable.id, billId));

    const originalName = req.file.originalname;
    res.json({ attachmentUrl: objectPath, originalName });
  } catch (err: any) {
    console.error("File upload failed:", err);
    res.status(500).json({ error: "File upload failed: " + err.message });
  }
});

// Stream the attachment file to the client (auth-protected)
router.get("/inventory/purchase-bills/:id/attachment", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const billId = parseInt(req.params.id);

  const [bill] = await db.select({ attachmentUrl: purchaseBillsTable.attachmentUrl })
    .from(purchaseBillsTable)
    .where(and(eq(purchaseBillsTable.id, billId), eq(purchaseBillsTable.userId, userId)));

  if (!bill || !bill.attachmentUrl) {
    res.status(404).json({ error: "No attachment found" }); return;
  }

  try {
    const bucket = await getBucket();
    const file = bucket.file(bill.attachmentUrl);
    const [metadata] = await file.getMetadata();
    const contentType = (metadata as any).contentType ?? "application/octet-stream";
    const fileName = bill.attachmentUrl.split("/").pop() ?? "attachment";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    file.createReadStream().pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: "Could not retrieve file" });
  }
});

// Delete attachment
router.delete("/inventory/purchase-bills/:id/attach", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const billId = parseInt(req.params.id);

  const [bill] = await db.select({ attachmentUrl: purchaseBillsTable.attachmentUrl })
    .from(purchaseBillsTable)
    .where(and(eq(purchaseBillsTable.id, billId), eq(purchaseBillsTable.userId, userId)));

  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  if (bill.attachmentUrl) {
    try { await (await getBucket()).file(bill.attachmentUrl).delete(); } catch {}
  }

  await db.update(purchaseBillsTable)
    .set({ attachmentUrl: null })
    .where(eq(purchaseBillsTable.id, billId));

  res.sendStatus(204);
});

export default router;
