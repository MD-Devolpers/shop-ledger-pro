/**
 * Inventory API hooks — direct fetch wrappers using React Query.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Company { id: number; userId: number; name: string; createdAt: string; updatedAt: string; }
export interface Category { id: number; userId: number; name: string; createdAt: string; updatedAt: string; }
export interface Collection { id: number; userId: number; name: string; createdAt: string; updatedAt: string; }
export interface MasterDeleteResult { deleted: true; transferredProducts: number; }

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(status: number, data: Record<string, unknown>) {
    super(typeof data.error === "string" ? data.error : `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export interface Product {
  id: number; userId: number; code: string; name: string;
  companyId: number | null; categoryId: number | null; collectionId: number | null;
  companyName: string | null; categoryName: string | null; collectionName: string | null;
  purchasePrice: number; salePrice: number; stockQty: number;
  availableStock: number; pendingReplacementQty: number;
  minStockAlert: number; isFavorite: boolean; minSalePrice: number | null;
  stockStatus: "ok" | "low" | "out";
  expiryDate: string | null; deletedAt: string | null; createdAt: string; updatedAt: string;
}

export interface PurchaseBillItem {
  id: number; billId: number; productId: number; productName: string | null; productCode: string | null;
  companyName: string | null; categoryName: string | null;
  quantity: number; purchaseRate: number; saleRate: number; discount: number; totalAmount: number; createdAt: string;
}
export interface PurchaseBill {
  id: number; userId: number; supplierName: string; companyId: number | null; companyName?: string | null; billNumber: string; billDate: string;
  totalAmount: number; paidAmount: number; notes: string | null; deletedAt: string | null; createdAt: string; updatedAt: string;
  items?: PurchaseBillItem[];
}

export interface ProductSaleItem {
  id: number; saleId: number; productId: number; productName: string | null; productCode: string | null;
  quantity: number; purchasePrice: number; salePrice: number; discount: number; discountType: string;
  lineTotal: number; profit: number;
}
export interface ProductSale {
  id: number; userId: number; entryId: number | null; creditId: number | null;
  customerName: string | null; contactNumber: string | null;
  paymentMethod: "cash" | "digital"; isCredit: boolean;
  totalAmount: number; totalProfit: number; discount: number; discountType: string;
  notes: string | null; saleDate: string; deletedAt: string | null; createdAt: string; updatedAt: string;
  items?: ProductSaleItem[];
}

export interface BillSettings { shopName: string; address: string; mobile: string; logo: string | null; footer: string; quickProductShortcut: string | null; }

export interface CompanyReplacement {
  id: number; userId: number; productId: number; productName: string | null; productCode: string | null;
  companyId: number | null; companyName: string;
  sentQty: number; receivedQty: number; pendingQty: number;
  dateSent: string; faultReason: string; customerName: string | null; referenceNo: string | null;
  status: "pending" | "partially_received" | "completed" | "rejected";
  notes: string | null; createdAt: string; updatedAt: string;
  receives?: ReplacementReceive[];
}

export interface ReplacementReceive {
  id: number; receivedQty: number; receiveDate: string; notes: string | null; createdAt: string;
}

export interface StockAdjustment {
  id: number; userId: number; productId: number; productName: string | null; productCode: string | null;
  adjustmentType: "damaged" | "lost" | "expired" | "broken" | "personal_use" | "manual_add" | "manual_remove";
  quantity: number; reason: string | null; adjustmentDate: string; createdAt: string;
}

export interface SupplierBalance {
  companyId: number; companyName: string;
  totalPurchase: number; paidAmount: number; remainingBalance: number;
}

export interface SupplierPayment {
  id: number; userId: number; companyId: number; companyName: string | null;
  amount: number; paymentDate: string; notes: string | null; createdAt: string;
}

export interface StockValue {
  totalPurchaseValue: number; totalSaleValue: number; expectedProfit: number;
}

export interface ProductHistoryEvent {
  type: "purchase" | "sale" | "return" | "replacement_sent" | "replacement_received" | "adjustment";
  date: string;
  qty: number;
  [key: string]: any;
}

export interface ProductHistory {
  productId: number; productName: string; productCode: string;
  events: ProductHistoryEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Companies ────────────────────────────────────────────────────────────────

export const COMPANIES_KEY = ["inventory", "companies"] as const;
export function useListCompanies() {
  return useQuery({ queryKey: COMPANIES_KEY, queryFn: () => apiFetch<Company[]>("/api/inventory/companies") });
}
export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<Company>("/api/inventory/companies", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES_KEY }),
  });
}
export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => apiFetch<Company>(`/api/inventory/companies/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES_KEY }),
  });
}
export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/inventory/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANIES_KEY }),
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const CATEGORIES_KEY = ["inventory", "categories"] as const;
export function useListCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: () => apiFetch<Category[]>("/api/inventory/categories") });
}
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<Category>("/api/inventory/categories", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => apiFetch<Category>(`/api/inventory/categories/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, replacementId }: { id: number; replacementId?: number }) =>
      apiFetch<MasterDeleteResult>(`/api/inventory/categories/${id}`, {
        method: "DELETE",
        body: replacementId ? JSON.stringify({ replacementId }) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

// ─── Collections ──────────────────────────────────────────────────────────────

export const COLLECTIONS_KEY = ["inventory", "collections"] as const;
export function useListCollections() {
  return useQuery({ queryKey: COLLECTIONS_KEY, queryFn: () => apiFetch<Collection[]>("/api/inventory/collections") });
}
export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<Collection>("/api/inventory/collections", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });
}
export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => apiFetch<Collection>(`/api/inventory/collections/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });
}
export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, replacementId }: { id: number; replacementId?: number }) =>
      apiFetch<MasterDeleteResult>(`/api/inventory/collections/${id}`, {
        method: "DELETE",
        body: replacementId ? JSON.stringify({ replacementId }) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const PRODUCTS_KEY = ["inventory", "products"] as const;
export function useListProducts(params?: { search?: string; companyId?: number; categoryId?: number; collectionId?: number; stockStatus?: string; favorites?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.companyId) qs.set("companyId", String(params.companyId));
  if (params?.categoryId) qs.set("categoryId", String(params.categoryId));
  if (params?.collectionId) qs.set("collectionId", String(params.collectionId));
  if (params?.stockStatus) qs.set("stockStatus", params.stockStatus);
  if (params?.favorites) qs.set("favorites", "true");
  const query = qs.toString();
  return useQuery({
    queryKey: [...PRODUCTS_KEY, params],
    queryFn: () => apiFetch<Product[]>(`/api/inventory/products${query ? `?${query}` : ""}`),
  });
}
export function useGetProduct(id: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, id],
    queryFn: () => apiFetch<Product>(`/api/inventory/products/${id}`),
    enabled: !!id,
  });
}
export function useGetProductHistory(id: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, id, "history"],
    queryFn: () => apiFetch<ProductHistory>(`/api/inventory/products/${id}/history`),
    enabled: !!id,
  });
}
export function useGetReorderList() {
  return useQuery({
    queryKey: ["inventory", "reorder"],
    queryFn: () => apiFetch<Product[]>("/api/inventory/products/reorder"),
  });
}
export function useGetStockValue() {
  return useQuery({
    queryKey: ["inventory", "stock-value"],
    queryFn: () => apiFetch<StockValue>("/api/inventory/stock-value"),
  });
}
export function useBulkAssignCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, productIds }: { companyId: number; productIds: number[] }) =>
      apiFetch<{ updated: number }>("/api/inventory/products/bulk-assign-company", {
        method: "POST",
        body: JSON.stringify({ companyId, productIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) => apiFetch<Product>("/api/inventory/products", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Product>) => apiFetch<Product>(`/api/inventory/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/inventory/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ id: number; isFavorite: boolean }>(`/api/inventory/products/${id}/favorite`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
export function useGetProductByCode() {
  return useMutation({
    mutationFn: (code: string) => apiFetch<Product>(`/api/inventory/products/by-code/${encodeURIComponent(code)}`),
  });
}
export function useGetPriceHistory(productId: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, productId, "price-history"],
    queryFn: () => apiFetch<Array<{ id: number; purchasePrice: number | null; salePrice: number | null; billId: number | null; billNumber: string | null; source: string; createdAt: string }>>(`/api/inventory/products/${productId}/price-history`),
    enabled: !!productId,
  });
}
export function useGetSupplierDues() {
  return useQuery({
    queryKey: ["inventory", "supplier-dues"],
    queryFn: () => apiFetch<Array<{ companyId: number; companyName: string; totalBilled: number; totalPaid: number; remaining: number }>>("/api/inventory/supplier-dues"),
  });
}
export function useCheckWarranty(saleId: number | null) {
  return useQuery({
    queryKey: ["inventory", "warranty-check", saleId],
    queryFn: () => apiFetch<{ saleId: number; saleDate: string; customerName: string | null; contactNumber: string | null; status: string; warrantyItems: any[]; totalItems: number; itemsWithWarranty: number }>(`/api/inventory/warranty-check/${saleId}`),
    enabled: !!saleId,
    retry: false,
  });
}

// ─── Purchase Bills ───────────────────────────────────────────────────────────

export const BILLS_KEY = ["inventory", "purchase-bills"] as const;
export function useListPurchaseBills(params?: { search?: string; supplierName?: string; dateFrom?: string; dateTo?: string; companyId?: number; productId?: number }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.supplierName) qs.set("supplierName", params.supplierName);
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.companyId) qs.set("companyId", String(params.companyId));
  if (params?.productId) qs.set("productId", String(params.productId));
  const query = qs.toString();
  return useQuery({
    queryKey: [...BILLS_KEY, params],
    queryFn: () => apiFetch<PurchaseBill[]>(`/api/inventory/purchase-bills${query ? `?${query}` : ""}`),
  });
}
export function useGetPurchaseBill(id: number | null) {
  return useQuery({
    queryKey: [...BILLS_KEY, id],
    queryFn: () => apiFetch<PurchaseBill>(`/api/inventory/purchase-bills/${id}`),
    enabled: !!id,
  });
}
export function useCreatePurchaseBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      supplierName: string; companyId?: number | string; billNumber: string; billDate?: string;
      notes?: string; updateProductPrices?: boolean;
      items: { productId: number; quantity: number; purchaseRate: number; saleRate?: number; discount?: number }[]
    }) =>
      apiFetch<PurchaseBill>("/api/inventory/purchase-bills", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BILLS_KEY });
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: ["inventory", "stock-value"] });
      qc.invalidateQueries({ queryKey: ["inventory", "reorder"] });
    },
  });
}
export function useDeletePurchaseBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/inventory/purchase-bills/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLS_KEY }),
  });
}

export interface BulkPurchaseRow {
  code: string; name: string; companyId: string; categoryId: string; collectionId: string;
  purchasePrice: string; salePrice: string; quantity: string;
  minStockAlert: string; expiryDate: string;
}
export function useBulkCreatePurchaseBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      companyId?: string | number; supplierName?: string; billNumber: string; billDate?: string;
      notes?: string; items: BulkPurchaseRow[]; updateProductCompany?: boolean;
    }) => {
      // API expects purchaseRate/saleRate; BulkPurchaseRow stores them as purchasePrice/salePrice
      const payload = {
        ...data,
        items: data.items.map(r => ({
          ...r,
          purchaseRate: r.purchasePrice,
          saleRate: r.salePrice,
        })),
      };
      return apiFetch<{ id: number; billNumber: string; totalAmount: number; itemCount: number; newProductCount: number }>(
        "/api/inventory/purchase-bills/bulk-create", { method: "POST", body: JSON.stringify(payload) }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BILLS_KEY });
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: ["inventory", "stock-value"] });
      qc.invalidateQueries({ queryKey: ["inventory", "reorder"] });
    },
  });
}

// ─── Product Sales ────────────────────────────────────────────────────────────

export const SALES_KEY = ["inventory", "product-sales"] as const;
export function useListProductSales(params?: { search?: string; dateFrom?: string; dateTo?: string; paymentMethod?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.paymentMethod) qs.set("paymentMethod", params.paymentMethod);
  const query = qs.toString();
  return useQuery({
    queryKey: [...SALES_KEY, params],
    queryFn: () => apiFetch<ProductSale[]>(`/api/inventory/product-sales${query ? `?${query}` : ""}`),
  });
}
export function useGetProductSale(id: number | null) {
  return useQuery({
    queryKey: [...SALES_KEY, id],
    queryFn: () => apiFetch<ProductSale>(`/api/inventory/product-sales/${id}`),
    enabled: !!id,
  });
}
export function useCreateProductSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch<ProductSale>("/api/inventory/product-sales", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: SALES_KEY }); qc.invalidateQueries({ queryKey: PRODUCTS_KEY }); },
  });
}
export function useCreateProductReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch<any>(
      data.saleId ? "/api/inventory/product-returns" : "/api/inventory/product-returns/bulk",
      { method: "POST", body: JSON.stringify(data) }
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: SALES_KEY });
      qc.invalidateQueries({ queryKey: ["inventory", "product-returns"] });
      qc.invalidateQueries({ predicate: query => {
        const key = query.queryKey?.[0];
        return typeof key === "string" && (key.startsWith("/api/entries") || key.startsWith("/api/reports"));
      }});
    },
  });
}
export function useListProductReturns() {
  return useQuery({
    queryKey: ["inventory", "product-returns"],
    queryFn: () => apiFetch<any[]>("/api/inventory/product-returns"),
  });
}

// ─── Bill Settings ────────────────────────────────────────────────────────────

export const BILL_SETTINGS_KEY = ["inventory", "bill-settings"] as const;
export function useGetBillSettings() {
  return useQuery({ queryKey: BILL_SETTINGS_KEY, queryFn: () => apiFetch<BillSettings>("/api/inventory/bill-settings") });
}
export function useUpdateBillSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BillSettings>) => apiFetch<BillSettings>("/api/inventory/bill-settings", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILL_SETTINGS_KEY }),
  });
}

// ─── Product Sales Report Summary ─────────────────────────────────────────────

export function useProductSalesSummary(params?: { dateFrom?: string; dateTo?: string }) {
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  const query = qs.toString();
  return useQuery({
    queryKey: ["inventory", "product-sales-summary", params],
    queryFn: () => apiFetch<{ totalRevenue: number; totalProfit: number; totalSales: number }>(`/api/inventory/product-sales/report/summary${query ? `?${query}` : ""}`),
  });
}

// ─── Company Replacements ─────────────────────────────────────────────────────

export const REPLACEMENTS_KEY = ["inventory", "company-replacements"] as const;

export function useListReplacements(params?: { companyId?: number; status?: string; dateFrom?: string; dateTo?: string }) {
  const qs = new URLSearchParams();
  if (params?.companyId) qs.set("companyId", String(params.companyId));
  if (params?.status) qs.set("status", params.status);
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  const query = qs.toString();
  return useQuery({
    queryKey: [...REPLACEMENTS_KEY, params],
    queryFn: () => apiFetch<CompanyReplacement[]>(`/api/inventory/company-replacements${query ? `?${query}` : ""}`),
  });
}

export function useGetReplacement(id: number | null) {
  return useQuery({
    queryKey: [...REPLACEMENTS_KEY, id],
    queryFn: () => apiFetch<CompanyReplacement>(`/api/inventory/company-replacements/${id}`),
    enabled: !!id,
  });
}

export function useCreateReplacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch<CompanyReplacement>("/api/inventory/company-replacements", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: REPLACEMENTS_KEY }); qc.invalidateQueries({ queryKey: PRODUCTS_KEY }); },
  });
}

export function useReceiveReplacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; receivedQty: number; receiveDate: string; notes?: string }) =>
      apiFetch<any>(`/api/inventory/company-replacements/${id}/receive`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: REPLACEMENTS_KEY }); qc.invalidateQueries({ queryKey: PRODUCTS_KEY }); },
  });
}

export function useUpdateReplacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<CompanyReplacement>) =>
      apiFetch<CompanyReplacement>(`/api/inventory/company-replacements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: REPLACEMENTS_KEY }),
  });
}

export function useBulkCreateReplacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      companyId?: string; companyName: string; dateSent: string; notes?: string;
      items: Array<{ code: string; productId?: number; sentQty: string; faultReason: string }>;
    }) => apiFetch<{ count: number }>("/api/inventory/company-replacements/bulk-create", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPLACEMENTS_KEY });
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export const ADJUSTMENTS_KEY = ["inventory", "stock-adjustments"] as const;

export function useListStockAdjustments(productId?: number) {
  return useQuery({
    queryKey: [...ADJUSTMENTS_KEY, productId],
    queryFn: () => apiFetch<StockAdjustment[]>(`/api/inventory/stock-adjustments${productId ? `?productId=${productId}` : ""}`),
  });
}

export function useCreateStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { productId: number; adjustmentType: string; quantity: number; reason?: string; adjustmentDate: string }) =>
      apiFetch<StockAdjustment>("/api/inventory/stock-adjustments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ADJUSTMENTS_KEY }); qc.invalidateQueries({ queryKey: PRODUCTS_KEY }); },
  });
}

// ─── Supplier Balance ─────────────────────────────────────────────────────────

export const SUPPLIER_BALANCE_KEY = ["inventory", "supplier-balance"] as const;
export const SUPPLIER_PAYMENTS_KEY = ["inventory", "supplier-payments"] as const;

export function useGetSupplierBalance() {
  return useQuery({ queryKey: SUPPLIER_BALANCE_KEY, queryFn: () => apiFetch<SupplierBalance[]>("/api/inventory/supplier-balance") });
}

export function useListSupplierPayments(companyId?: number) {
  return useQuery({
    queryKey: [...SUPPLIER_PAYMENTS_KEY, companyId],
    queryFn: () => apiFetch<SupplierPayment[]>(`/api/inventory/supplier-payments${companyId ? `?companyId=${companyId}` : ""}`),
  });
}

export function useCreateSupplierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { companyId: number; amount: number; paymentDate: string; notes?: string }) =>
      apiFetch<SupplierPayment>("/api/inventory/supplier-payments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: SUPPLIER_BALANCE_KEY }); qc.invalidateQueries({ queryKey: SUPPLIER_PAYMENTS_KEY }); },
  });
}

export function useDeleteSupplierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/inventory/supplier-payments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: SUPPLIER_BALANCE_KEY }); qc.invalidateQueries({ queryKey: SUPPLIER_PAYMENTS_KEY }); },
  });
}

// ─── Sale Cancel + History ────────────────────────────────────────────────────

export function useCancelProductSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      apiFetch<{ success: boolean; message: string }>(`/api/inventory/product-sales/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: SALES_KEY }); qc.invalidateQueries({ queryKey: PRODUCTS_KEY }); },
  });
}

export function useGetSaleHistory(saleId: number | null) {
  return useQuery({
    queryKey: ["inventory", "sale-history", saleId],
    queryFn: () => apiFetch<any[]>(`/api/inventory/product-sales/${saleId}/history`),
    enabled: !!saleId,
  });
}

// ─── Bill Attachments ─────────────────────────────────────────────────────────

export function useUploadBillAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, file }: { billId: number; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/inventory/purchase-bills/${billId}/attach`, { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      return res.json() as Promise<{ attachmentUrl: string }>;
    },
    onSuccess: (_data, vars) => { qc.invalidateQueries({ queryKey: [...BILLS_KEY, vars.billId] }); qc.invalidateQueries({ queryKey: BILLS_KEY }); },
  });
}

export function useDeleteBillAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (billId: number) => apiFetch<void>(`/api/inventory/purchase-bills/${billId}/attach`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILLS_KEY }),
  });
}

// ─── Mobile Purchases ─────────────────────────────────────────────────────────

export interface MobilePurchase {
  id: number; userId: number;
  sellerName: string; sellerPhone: string | null; sellerAddress: string | null;
  imei: string | null; imei2: string | null; mobileModel: string; company: string;
  color: string | null; storageCapacity: string | null;
  condition: "new" | "used" | "refurbished";
  purchaseSource: "company" | "person";
  purchasePrice: number; salePrice: number;
  status: "in_stock" | "sold";
  purchaseDate: string;
  soldAt: string | null; soldToName: string | null; soldToPhone: string | null;
  saleAmount: number | null; paymentMethod: "cash" | "digital" | null;
  creditId: number | null;
  notes: string | null; createdAt: string; updatedAt: string;
}

export const MOBILE_PURCHASES_KEY = ["inventory", "mobile-purchases"] as const;

export function useListMobilePurchases(params?: { search?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  const q = qs.toString();
  return useQuery({
    queryKey: [...MOBILE_PURCHASES_KEY, params],
    queryFn: () => apiFetch<MobilePurchase[]>(`/api/inventory/mobile-purchases${q ? `?${q}` : ""}`),
  });
}

export function useGetMobilePurchase(id: number) {
  return useQuery({
    queryKey: [...MOBILE_PURCHASES_KEY, id],
    queryFn: () => apiFetch<MobilePurchase>(`/api/inventory/mobile-purchases/${id}`),
    enabled: !!id,
  });
}

export function useCreateMobilePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch<MobilePurchase>("/api/inventory/mobile-purchases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MOBILE_PURCHASES_KEY }),
  });
}

export function useUpdateMobilePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiFetch<MobilePurchase>(`/api/inventory/mobile-purchases/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MOBILE_PURCHASES_KEY }),
  });
}

export function useSellMobile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { soldToName?: string; soldToPhone?: string; saleAmount: number; paymentMethod: string; saleDate?: string; isCredit?: boolean } }) =>
      apiFetch<MobilePurchase>(`/api/inventory/mobile-purchases/${id}/sell`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MOBILE_PURCHASES_KEY }),
  });
}

export function useReturnMobileToStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<MobilePurchase>(`/api/inventory/mobile-purchases/${id}/return-to-stock`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MOBILE_PURCHASES_KEY }),
  });
}

export function useDeleteMobilePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ success: boolean }>(`/api/inventory/mobile-purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MOBILE_PURCHASES_KEY }),
  });
}

export function useBulkCreateMobilePurchases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: any[]; purchaseDate?: string; isCredit?: boolean }) =>
      apiFetch<{ count: number; items: MobilePurchase[] }>("/api/inventory/mobile-purchases/bulk", {
        method: "POST", body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MOBILE_PURCHASES_KEY }),
  });
}

// ─── Inventory PIN Security ───────────────────────────────────────────────────

export const PIN_SETTINGS_KEY = ["inventory", "pin-settings"] as const;

export function useGetPinSettings() {
  return useQuery({
    queryKey: PIN_SETTINGS_KEY,
    queryFn: () => apiFetch<{ pinSet: boolean; protectedPages: string[]; unlockDuration: number }>("/api/inventory/pin-settings"),
  });
}

export function useUpdatePinSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { protectedPages?: string[]; unlockDuration?: number }) =>
      apiFetch<{ success: boolean; protectedPages: string[]; unlockDuration: number }>("/api/inventory/pin-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIN_SETTINGS_KEY }),
  });
}

export function useSetPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pin: string }) =>
      apiFetch<{ success: boolean; pinSet: boolean }>("/api/inventory/pin-set", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIN_SETTINGS_KEY }),
  });
}

export function useChangePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { currentPin: string; newPin: string }) =>
      apiFetch<{ success: boolean }>("/api/inventory/pin-change", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIN_SETTINGS_KEY }),
  });
}

export function useRemovePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { currentPin: string }) =>
      apiFetch<{ success: boolean }>("/api/inventory/pin-settings/pin", { method: "DELETE", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIN_SETTINGS_KEY }),
  });
}

export function usePinResetRequest() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message: string; _devCode?: string }>("/api/inventory/pin-reset-request", { method: "POST" }),
  });
}

export function usePinResetVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { otp: string; newPin: string }) =>
      apiFetch<{ success: boolean; message: string }>("/api/inventory/pin-reset-verify", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIN_SETTINGS_KEY }),
  });
}
