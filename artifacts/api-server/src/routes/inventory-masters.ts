import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, companiesTable, categoriesTable, productCollectionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Companies ────────────────────────────────────────────────────────────────

router.get("/inventory/companies", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const rows = await db.select().from(companiesTable).where(eq(companiesTable.userId, userId)).orderBy(companiesTable.name);
  res.json(rows);
});

router.post("/inventory/companies", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  // Duplicate check (case-insensitive): return the existing company instead of creating a copy
  const [existing] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.userId, userId), ilike(companiesTable.name, name.trim())));
  if (existing) { res.status(200).json(existing); return; }
  const [row] = await db.insert(companiesTable).values({ userId, name: name.trim() }).returning();
  res.status(201).json(row);
});

router.patch("/inventory/companies/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.update(companiesTable).set({ name: name.trim() }).where(and(eq(companiesTable.id, id), eq(companiesTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/inventory/companies/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.delete(companiesTable).where(and(eq(companiesTable.id, id), eq(companiesTable.userId, userId)));
  res.sendStatus(204);
});

// ─── Categories ───────────────────────────────────────────────────────────────

router.get("/inventory/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const rows = await db.select().from(categoriesTable).where(eq(categoriesTable.userId, userId)).orderBy(categoriesTable.name);
  res.json(rows);
});

router.post("/inventory/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.insert(categoriesTable).values({ userId, name: name.trim() }).returning();
  res.status(201).json(row);
});

router.patch("/inventory/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.update(categoriesTable).set({ name: name.trim() }).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/inventory/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)));
  res.sendStatus(204);
});

// ─── Product Collections ──────────────────────────────────────────────────────

router.get("/inventory/collections", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const rows = await db.select().from(productCollectionsTable).where(eq(productCollectionsTable.userId, userId)).orderBy(productCollectionsTable.name);
  res.json(rows);
});

router.post("/inventory/collections", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.insert(productCollectionsTable).values({ userId, name: name.trim() }).returning();
  res.status(201).json(row);
});

router.patch("/inventory/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const [row] = await db.update(productCollectionsTable).set({ name: name.trim() }).where(and(eq(productCollectionsTable.id, id), eq(productCollectionsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/inventory/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.delete(productCollectionsTable).where(and(eq(productCollectionsTable.id, id), eq(productCollectionsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
