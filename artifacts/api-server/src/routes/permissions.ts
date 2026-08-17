/**
 * Staff Permissions API
 * Admin-only endpoints to manage staff user permissions.
 */
import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import { db, usersTable, staffPermissionsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function formatPerms(p: typeof staffPermissionsTable.$inferSelect) {
  return {
    id: p.id,
    userId: p.userId,
    canSeePurchasePrice: p.canSeePurchasePrice,
    canSeeProfit: p.canSeeProfit,
    canSeePurchaseBills: p.canSeePurchaseBills,
    canEditDeleteSale: p.canEditDeleteSale,
  };
}

// List all non-admin users with their permissions
router.get("/inventory/staff-permissions", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, role: usersTable.role, storeName: usersTable.storeName, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(ne(usersTable.role, "admin"))
    .orderBy(usersTable.username);

  const permsRows = await db.select().from(staffPermissionsTable);
  const permsMap = new Map(permsRows.map(p => [p.userId, p]));

  const result = users.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    permissions: permsMap.has(u.id) ? formatPerms(permsMap.get(u.id)!) : {
      id: null, userId: u.id,
      canSeePurchasePrice: false, canSeeProfit: false,
      canSeePurchaseBills: false, canEditDeleteSale: false,
    },
  }));

  res.json(result);
});

// Get permissions for a specific user
router.get("/inventory/staff-permissions/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const [user] = await db.select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [perms] = await db.select().from(staffPermissionsTable).where(eq(staffPermissionsTable.userId, userId));
  res.json({
    user,
    permissions: perms ? formatPerms(perms) : {
      id: null, userId,
      canSeePurchasePrice: false, canSeeProfit: false,
      canSeePurchaseBills: false, canEditDeleteSale: false,
    },
  });
});

// Update permissions (and optionally role) for a user
router.put("/inventory/staff-permissions/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const { role, canSeePurchasePrice, canSeeProfit, canSeePurchaseBills, canEditDeleteSale } = req.body;

  const [user] = await db.select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(403).json({ error: "Cannot modify admin user" }); return; }

  // Update role if provided
  if (role && ["user", "staff"].includes(role)) {
    await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId));
  }

  // Upsert permissions
  const [existing] = await db.select({ id: staffPermissionsTable.id })
    .from(staffPermissionsTable).where(eq(staffPermissionsTable.userId, userId));

  const permData = {
    canSeePurchasePrice: !!canSeePurchasePrice,
    canSeeProfit: !!canSeeProfit,
    canSeePurchaseBills: !!canSeePurchaseBills,
    canEditDeleteSale: !!canEditDeleteSale,
  };

  let perms;
  if (existing) {
    [perms] = await db.update(staffPermissionsTable)
      .set(permData).where(eq(staffPermissionsTable.userId, userId)).returning();
  } else {
    [perms] = await db.insert(staffPermissionsTable)
      .values({ userId, ...permData }).returning();
  }

  res.json({ permissions: formatPerms(perms) });
});

export default router;
