import { Router, type IRouter } from "express";
import { eq, and, ilike, ne, sql } from "drizzle-orm";
import { db, companiesTable, categoriesTable, productCollectionsTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function normalizedName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function sameMasterName(column: any, value: string) {
  return sql`lower(trim(${column})) = lower(${value})`;
}

function parseReplacementId(body: unknown): number | null {
  if (!body || typeof body !== "object" || !("replacementId" in body)) return null;
  const value = Number((body as { replacementId?: unknown }).replacementId);
  return Number.isInteger(value) && value > 0 ? value : NaN;
}

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
  const name = normalizedName(req.body?.name);
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [existing] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(and(eq(categoriesTable.userId, userId), sameMasterName(categoriesTable.name, name)));
  if (existing) {
    res.status(409).json({ code: "DUPLICATE_MASTER_NAME", error: "A category with this name already exists." });
    return;
  }
  const [row] = await db.insert(categoriesTable).values({ userId, name }).returning();
  res.status(201).json(row);
});

router.patch("/inventory/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const name = normalizedName(req.body?.name);
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [existing] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(and(eq(categoriesTable.userId, userId), ne(categoriesTable.id, id), sameMasterName(categoriesTable.name, name)));
  if (existing) {
    res.status(409).json({ code: "DUPLICATE_MASTER_NAME", error: "A category with this name already exists." });
    return;
  }
  const [row] = await db.update(categoriesTable).set({ name }).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/inventory/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const replacementId = parseReplacementId(req.body);
  if (Number.isNaN(replacementId)) {
    res.status(400).json({ error: "replacementId must be a positive integer." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [source] = await tx.select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(categoriesTable)
      .where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)));
    if (!source) return { kind: "not_found" as const };

    const affectedProducts = await tx.select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), eq(productsTable.categoryId, id)));

    if (affectedProducts.length > 0 && replacementId === null) {
      return { kind: "in_use" as const, name: source.name, usageCount: affectedProducts.length };
    }

    if (replacementId !== null) {
      const [replacement] = await tx.select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(and(eq(categoriesTable.id, replacementId), eq(categoriesTable.userId, userId), ne(categoriesTable.id, id)));
      if (!replacement) return { kind: "invalid_replacement" as const };
      await tx.update(productsTable)
        .set({ categoryId: replacementId })
        .where(and(eq(productsTable.userId, userId), eq(productsTable.categoryId, id)));
    }

    await tx.delete(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.userId, userId)));
    return { kind: "deleted" as const, transferredProducts: affectedProducts.length };
  });

  if (result.kind === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (result.kind === "invalid_replacement") {
    res.status(400).json({ error: "Choose another category from your account." });
    return;
  }
  if (result.kind === "in_use") {
    res.status(409).json({
      code: "MASTER_IN_USE",
      error: `This category is assigned to ${result.usageCount} product${result.usageCount === 1 ? "" : "s"}. Choose another category to transfer them to.`,
      itemName: result.name,
      usageCount: result.usageCount,
    });
    return;
  }
  res.json({ deleted: true, transferredProducts: result.transferredProducts });
});

// ─── Product Collections ──────────────────────────────────────────────────────

router.get("/inventory/collections", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const rows = await db.select().from(productCollectionsTable).where(eq(productCollectionsTable.userId, userId)).orderBy(productCollectionsTable.name);
  res.json(rows);
});

router.post("/inventory/collections", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const name = normalizedName(req.body?.name);
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [existing] = await db.select({ id: productCollectionsTable.id }).from(productCollectionsTable)
    .where(and(eq(productCollectionsTable.userId, userId), sameMasterName(productCollectionsTable.name, name)));
  if (existing) {
    res.status(409).json({ code: "DUPLICATE_MASTER_NAME", error: "A collection with this name already exists." });
    return;
  }
  const [row] = await db.insert(productCollectionsTable).values({ userId, name }).returning();
  res.status(201).json(row);
});

router.patch("/inventory/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const name = normalizedName(req.body?.name);
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [existing] = await db.select({ id: productCollectionsTable.id }).from(productCollectionsTable)
    .where(and(eq(productCollectionsTable.userId, userId), ne(productCollectionsTable.id, id), sameMasterName(productCollectionsTable.name, name)));
  if (existing) {
    res.status(409).json({ code: "DUPLICATE_MASTER_NAME", error: "A collection with this name already exists." });
    return;
  }
  const [row] = await db.update(productCollectionsTable).set({ name }).where(and(eq(productCollectionsTable.id, id), eq(productCollectionsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/inventory/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const replacementId = parseReplacementId(req.body);
  if (Number.isNaN(replacementId)) {
    res.status(400).json({ error: "replacementId must be a positive integer." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [source] = await tx.select({ id: productCollectionsTable.id, name: productCollectionsTable.name })
      .from(productCollectionsTable)
      .where(and(eq(productCollectionsTable.id, id), eq(productCollectionsTable.userId, userId)));
    if (!source) return { kind: "not_found" as const };

    const affectedProducts = await tx.select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), eq(productsTable.collectionId, id)));

    if (affectedProducts.length > 0 && replacementId === null) {
      return { kind: "in_use" as const, name: source.name, usageCount: affectedProducts.length };
    }

    if (replacementId !== null) {
      const [replacement] = await tx.select({ id: productCollectionsTable.id })
        .from(productCollectionsTable)
        .where(and(eq(productCollectionsTable.id, replacementId), eq(productCollectionsTable.userId, userId), ne(productCollectionsTable.id, id)));
      if (!replacement) return { kind: "invalid_replacement" as const };
      await tx.update(productsTable)
        .set({ collectionId: replacementId })
        .where(and(eq(productsTable.userId, userId), eq(productsTable.collectionId, id)));
    }

    await tx.delete(productCollectionsTable).where(and(eq(productCollectionsTable.id, id), eq(productCollectionsTable.userId, userId)));
    return { kind: "deleted" as const, transferredProducts: affectedProducts.length };
  });

  if (result.kind === "not_found") { res.status(404).json({ error: "Not found" }); return; }
  if (result.kind === "invalid_replacement") {
    res.status(400).json({ error: "Choose another collection from your account." });
    return;
  }
  if (result.kind === "in_use") {
    res.status(409).json({
      code: "MASTER_IN_USE",
      error: `This collection is assigned to ${result.usageCount} product${result.usageCount === 1 ? "" : "s"}. Choose another collection to transfer them to.`,
      itemName: result.name,
      usageCount: result.usageCount,
    });
    return;
  }
  res.json({ deleted: true, transferredProducts: result.transferredProducts });
});

export default router;
