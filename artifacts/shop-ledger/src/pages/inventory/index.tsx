import { useState } from "react";
import { useListProducts, useGetReorderList, type Product } from "@/lib/inventory-api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Package, Search, Building2, Tag } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function StockBadge({ p }: { p: Product }) {
  const qty = p.availableStock ?? p.stockQty;
  if (p.stockStatus === "out") return <Badge variant="destructive">Out of Stock</Badge>;
  if (p.stockStatus === "low") return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" />Low: {qty}</Badge>;
  return <Badge className="bg-green-600 text-white hover:bg-green-700">{qty}</Badge>;
}

function ProductTable({ products }: { products: Product[] }) {
  const sorted = products.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-teal-50 dark:bg-teal-950/20">
            <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
            <th className="text-left py-2 px-2 border-b text-xs">Product</th>
            <th className="text-left py-2 px-2 border-b text-xs">Company</th>
            <th className="text-left py-2 px-2 border-b text-xs">Category</th>
            <th className="text-right py-2 px-2 border-b text-xs">Stock</th>
            <th className="text-right py-2 px-2 border-b text-xs">Purchase</th>
            <th className="text-right py-2 px-2 border-b text-xs">Sale</th>
            <th className="text-right py-2 px-2 border-b text-xs">Min Alert</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, idx) => {
            const isExpiringSoon = p.expiryDate && new Date(p.expiryDate) <= new Date(Date.now() + 30 * 86400000);
            return (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="text-center py-2 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                <td className="py-2 px-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">{p.code}</Badge>
                    {(p.pendingReplacementQty ?? 0) > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">🔄 {p.pendingReplacementQty}</Badge>
                    )}
                    {isExpiringSoon && (
                      <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />{format(new Date(p.expiryDate!), "dd MMM yy")}
                      </Badge>
                    )}
                  </div>
                  {p.collectionName && <div className="text-xs text-muted-foreground mt-0.5">📦 {p.collectionName}</div>}
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{p.companyName ?? "—"}</td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{p.categoryName ?? "—"}</td>
                <td className="text-right py-2 px-2"><StockBadge p={p} /></td>
                <td className="text-right py-2 px-2 font-medium">{formatCurrency(p.purchasePrice)}</td>
                <td className="text-right py-2 px-2 font-medium text-green-700">{formatCurrency(p.salePrice)}</td>
                <td className="text-right py-2 px-2">{p.minStockAlert}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductList({ products, emptyMsg }: { products: Product[]; emptyMsg: string }) {
  if (products.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{emptyMsg}</p>
    </div>
  );
  return <ProductTable products={products} />;
}

function GroupedList({ products, groupBy }: { products: Product[]; groupBy: "company" | "category" | "collection" }) {
  const grouped: Record<string, Product[]> = {};
  for (const p of products) {
    const key = groupBy === "company" ? (p.companyName ?? "No Company")
      : groupBy === "category" ? (p.categoryName ?? "No Category")
      : (p.collectionName ?? "No Collection");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }
  if (Object.keys(grouped).length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Package className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No products found</p>
    </div>
  );
  return (
    <div className="space-y-6">
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
        <div key={group}>
          <div className="flex items-center gap-2 mb-2">
            {groupBy === "company" ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <Tag className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-semibold text-sm">{group}</h3>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
          <ProductTable products={items} />
        </div>
      ))}
    </div>
  );
}

function ReorderList({ products }: { products: Product[] }) {
  if (products.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="font-medium text-green-600">No reorders needed! All stock is fine 👍</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {products.map(p => {
        const urgency = p.availableStock <= 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200";
        return (
          <div key={p.id} className={`border rounded-xl p-3 ${urgency}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{p.name}</span>
                <Badge variant="outline" className="text-xs font-mono ml-2">{p.code}</Badge>
              </div>
              <div className="text-right text-sm">
                <p className={`font-bold ${p.availableStock <= 0 ? "text-red-600" : "text-amber-600"}`}>
                  Stock: {p.availableStock}
                </p>
                <p className="text-xs text-muted-foreground">Min Alert: {p.minStockAlert}</p>
              </div>
            </div>
            {p.companyName && <p className="text-xs text-muted-foreground mt-1">🏭 {p.companyName}</p>}
          </div>
        );
      })}
    </div>
  );
}

function formatCurrencyPKR(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function Inventory() {
  const [search, setSearch] = useState("");

  const { data: allProducts = [], isLoading } = useListProducts({ search: search || undefined });
  const { data: lowStock = [] } = useListProducts({ stockStatus: "low" });
  const { data: outOfStock = [] } = useListProducts({ stockStatus: "out" });
  const { data: expirySoon = [] } = useListProducts({ stockStatus: "expiry" });
  const { data: reorderList = [] } = useGetReorderList();
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inventory / Stock</h1>
        <p className="text-muted-foreground text-sm">All stock and product details</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-xl p-4 bg-card text-center">
          <p className="text-2xl font-bold text-blue-600">{allProducts.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Products</p>
        </div>
        <div className="border rounded-xl p-4 bg-card text-center">
          <p className="text-2xl font-bold text-yellow-600">{lowStock.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Low Stock</p>
        </div>
        <div className="border rounded-xl p-4 bg-card text-center">
          <p className="text-2xl font-bold text-red-600">{outOfStock.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Out of Stock</p>
        </div>
        <div className="border rounded-xl p-4 bg-card text-center cursor-pointer" onClick={() => {}}>
          <p className={`text-2xl font-bold ${reorderList.length > 0 ? "text-amber-600" : "text-green-600"}`}>{reorderList.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Need Reorder</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by product name or code..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm text-center py-10">Loading...</p> : (
        <Tabs defaultValue="all">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="all">All ({allProducts.length})</TabsTrigger>
            <TabsTrigger value="reorder" className={reorderList.length > 0 ? "text-amber-600" : ""}>
              Reorder {reorderList.length > 0 && `(${reorderList.length})`}
            </TabsTrigger>
            <TabsTrigger value="low">Low Stock ({lowStock.length})</TabsTrigger>
            <TabsTrigger value="out">Out of Stock ({outOfStock.length})</TabsTrigger>
            <TabsTrigger value="expiry">Expiry ({expirySoon.length})</TabsTrigger>
            <TabsTrigger value="company">Company-wise</TabsTrigger>
            <TabsTrigger value="category">Category-wise</TabsTrigger>
            <TabsTrigger value="collection">Collection-wise</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4"><ProductList products={allProducts} emptyMsg="No products found" /></TabsContent>
          <TabsContent value="reorder" className="mt-4"><ReorderList products={reorderList} /></TabsContent>
          <TabsContent value="low" className="mt-4"><ProductList products={lowStock} emptyMsg="No low stock products 👍" /></TabsContent>
          <TabsContent value="out" className="mt-4"><ProductList products={outOfStock} emptyMsg="No out of stock products 👍" /></TabsContent>
          <TabsContent value="expiry" className="mt-4"><ProductList products={expirySoon} emptyMsg="No expiries in the next 30 days 👍" /></TabsContent>
          <TabsContent value="company" className="mt-4"><GroupedList products={allProducts} groupBy="company" /></TabsContent>
          <TabsContent value="category" className="mt-4"><GroupedList products={allProducts} groupBy="category" /></TabsContent>
          <TabsContent value="collection" className="mt-4"><GroupedList products={allProducts} groupBy="collection" /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
