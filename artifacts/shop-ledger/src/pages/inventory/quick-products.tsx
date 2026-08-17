import { useState } from "react";
import { useListProducts, useToggleFavorite, type Product } from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Star, Search, Package, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function fmt(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function QuickProducts() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: allProducts = [], isLoading } = useListProducts({ search: search || undefined });
  const { data: quickProducts = [] } = useListProducts({ favorites: true });
  const toggleFavorite = useToggleFavorite();

  function toggle(p: Product) {
    toggleFavorite.mutate(p.id, {
      onSuccess: (r) => {
        toast({ title: r.isFavorite ? "⭐ Added to Quick Products" : "Removed from Quick Products" });
      },
    });
  }

  const quickIds = new Set(quickProducts.map(p => p.id));

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 fill-yellow-400 text-yellow-500" />
            Quick Products
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Product Sale screen par ye products direct show honge
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/inventory/product-sale")} className="gap-1.5">
          <ShoppingCart className="h-4 w-4" />Go to Sale
        </Button>
      </div>

      {/* Current Quick Products */}
      {quickProducts.length > 0 && (
        <div className="border-2 border-yellow-200 rounded-xl bg-yellow-50/40">
          <div className="px-4 py-2.5 border-b border-yellow-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-yellow-800 flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
              Current Quick Products ({quickProducts.length})
            </span>
          </div>
          <div className="divide-y divide-yellow-100">
            {quickProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">{p.code}</Badge>
                    <Badge className={`text-xs ${p.stockQty <= 0 ? "bg-red-500" : "bg-green-600"} text-white`}>
                      Stock: {p.stockQty}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>Sale: <strong className="text-teal-700">{fmt(p.salePrice)}</strong></span>
                    <span>Cost: {fmt(p.purchasePrice)}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-yellow-600 hover:text-red-500 hover:bg-red-50 shrink-0 gap-1 text-xs"
                  onClick={() => toggle(p)}
                  disabled={toggleFavorite.isPending}
                >
                  <Star className="h-3.5 w-3.5 fill-yellow-400" />Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {quickProducts.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-xl text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No Quick Products set</p>
          <p className="text-sm mt-1">Star ⭐ products below to add them to the Quick list</p>
        </div>
      )}

      {/* Search & add */}
      <div>
        <p className="text-sm font-semibold mb-2">Add from Products</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Product name ya code search karo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-sm text-center text-muted-foreground py-6">Loading...</p>
        ) : allProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No product found</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-teal-50 dark:bg-teal-950/20">
                  <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
                  <th className="text-left py-2 px-2 border-b text-xs">Product</th>
                  <th className="text-left py-2 px-2 border-b text-xs">Company</th>
                  <th className="text-right py-2 px-2 border-b text-xs">Stock</th>
                  <th className="text-right py-2 px-2 border-b text-xs">Sale Price</th>
                  <th className="text-right py-2 px-2 border-b text-xs">Quick</th>
                </tr>
              </thead>
              <tbody>
                {allProducts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p, idx) => {
                  const isQuick = quickIds.has(p.id);
                  return (
                    <tr key={p.id} className={`border-b last:border-b-0 ${isQuick ? "bg-yellow-50" : "hover:bg-muted/20"}`}>
                      <td className="text-center py-2 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{p.name}</span>
                          <Badge variant="outline" className="text-xs font-mono">{p.code}</Badge>
                          {isQuick && (
                            <Badge className="text-xs bg-yellow-500 text-white gap-1">
                              <Star className="h-2.5 w-2.5 fill-white" />Quick
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{p.companyName ?? "—"}</td>
                      <td className="text-right py-2 px-2">
                        <Badge className={`text-xs ${p.stockQty <= 0 ? "bg-red-500" : p.stockStatus === "low" ? "bg-yellow-500" : "bg-green-600"} text-white`}>
                          {p.stockQty}
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-2 font-medium text-teal-700">{fmt(p.salePrice)}</td>
                      <td className="py-2 px-2">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={isQuick ? "secondary" : "outline"}
                            className={`h-7 gap-1.5 ${isQuick ? "text-yellow-700 border-yellow-300 bg-yellow-100 hover:bg-red-50 hover:text-red-600" : ""}`}
                            onClick={() => toggle(p)}
                            disabled={toggleFavorite.isPending}
                          >
                            <Star className={`h-3.5 w-3.5 ${isQuick ? "fill-yellow-400 text-yellow-500" : ""}`} />
                            {isQuick ? "Remove" : "Add"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
