import { useState, useEffect } from "react";
import { useGetBillSettings, useUpdateBillSettings } from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Store, Save } from "lucide-react";

export default function BillSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetBillSettings();
  const updateSettings = useUpdateBillSettings();

  const [form, setForm] = useState({ shopName: "", address: "", mobile: "", logo: "", footer: "", quickProductShortcut: "" });

  useEffect(() => {
    if (settings) {
      setForm({ shopName: settings.shopName, address: settings.address, mobile: settings.mobile, logo: settings.logo ?? "", footer: settings.footer, quickProductShortcut: settings.quickProductShortcut ?? "" });
    }
  }, [settings]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { toast({ title: "Logo must be smaller than 200KB", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, logo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function handleSave() {
    updateSettings.mutate({
      shopName: form.shopName,
      address: form.address,
      mobile: form.mobile,
      logo: form.logo || null,
      footer: form.footer,
      quickProductShortcut: form.quickProductShortcut.trim() || null,
    }, {
      onSuccess: () => toast({ title: "✅ Bill settings saved" }),
      onError: e => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
    });
  }

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bill Settings</h1>
          <p className="text-muted-foreground text-sm">Configure your bill/receipt settings</p>
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div>
          <Label>Shop Name</Label>
          <Input value={form.shopName} onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))} placeholder="Your shop name" />
        </div>
        <div>
          <Label>Address</Label>
          <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Shop address" rows={2} />
        </div>
        <div>
          <Label>Mobile Number</Label>
          <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="03XX-XXXXXXX" />
        </div>
        <div>
          <Label>Logo (Optional, max 200KB)</Label>
          <Input type="file" accept="image/*" onChange={handleLogoUpload} className="cursor-pointer" />
          {form.logo && (
            <div className="mt-2 flex items-center gap-3">
              <img src={form.logo} alt="Logo preview" className="h-16 w-16 object-contain border rounded" />
              <Button size="sm" variant="outline" onClick={() => setForm(f => ({ ...f, logo: "" }))}>Remove</Button>
            </div>
          )}
        </div>
        <div>
          <Label>Footer Text (Optional)</Label>
          <Textarea value={form.footer} onChange={e => setForm(f => ({ ...f, footer: e.target.value }))} placeholder="e.g. Thank you! Please visit again." rows={2} />
        </div>
        <div>
          <Label>Quick Product Shortcut Code</Label>
          <Input
            value={form.quickProductShortcut}
            onChange={e => setForm(f => ({ ...f, quickProductShortcut: e.target.value }))}
            placeholder="e.g. QP or 99"
            className="mt-1 font-mono"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground mt-1">Search this code on the sale screen to show all ⭐ Quick Products at once</p>
        </div>

        <Button className="w-full" size="lg" onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Preview */}
      {(form.shopName || form.address || form.mobile) && (
        <div className="border rounded-xl p-5 bg-muted/30 space-y-1 text-center text-sm">
          <p className="text-xs text-muted-foreground mb-2">Bill Preview:</p>
          {form.logo && <img src={form.logo} alt="Logo" className="h-12 w-12 object-contain mx-auto mb-2" />}
          {form.shopName && <p className="font-bold text-lg">{form.shopName}</p>}
          {form.address && <p className="text-muted-foreground whitespace-pre-line">{form.address}</p>}
          {form.mobile && <p className="text-muted-foreground">📞 {form.mobile}</p>}
          {form.footer && <p className="text-muted-foreground italic mt-3 border-t pt-2">{form.footer}</p>}
        </div>
      )}
    </div>
  );
}
