import { useState } from "react";
import { useListCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany, useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useListCollections, useCreateCollection, useUpdateCollection, useDeleteCollection } from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Building2, Tag, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MasterItem { id: number; name: string; }

function MasterTab({
  title, icon: Icon, items, onCreate, onUpdate, onDelete, isLoading,
}: {
  title: string;
  icon: React.ElementType;
  items: MasterItem[];
  onCreate: (name: string) => void;
  onUpdate: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [editItem, setEditItem] = useState<MasterItem | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={`New ${title} name...`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim()); setNewName(""); } }}
        />
        <Button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(""); } }} disabled={!newName.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">No {title.toLowerCase()} added yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditItem(item); setEditName(item.name); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {title}</DialogTitle></DialogHeader>
          <Input value={editName} onChange={e => setEditName(e.target.value)} />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={() => { if (editItem && editName.trim()) { onUpdate(editItem.id, editName.trim()); setEditItem(null); } }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Masters() {
  const { toast } = useToast();

  const { data: companies = [], isLoading: cLoading } = useListCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const { data: categories = [], isLoading: catLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const { data: collections = [], isLoading: colLoading } = useListCollections();
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();

  const handle = (fn: () => void, successMsg: string) => {
    try { fn(); toast({ title: successMsg }); } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage companies, categories and collections</p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="companies"><Building2 className="h-4 w-4 mr-1" />Companies</TabsTrigger>
          <TabsTrigger value="categories"><Tag className="h-4 w-4 mr-1" />Categories</TabsTrigger>
          <TabsTrigger value="collections"><Package className="h-4 w-4 mr-1" />Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-4">
          <MasterTab
            title="Company" icon={Building2} items={companies} isLoading={cLoading}
            onCreate={name => createCompany.mutate(name)}
            onUpdate={(id, name) => updateCompany.mutate({ id, name })}
            onDelete={id => deleteCompany.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <MasterTab
            title="Category" icon={Tag} items={categories} isLoading={catLoading}
            onCreate={name => createCategory.mutate(name)}
            onUpdate={(id, name) => updateCategory.mutate({ id, name })}
            onDelete={id => deleteCategory.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <MasterTab
            title="Collection" icon={Package} items={collections} isLoading={colLoading}
            onCreate={name => createCollection.mutate(name)}
            onUpdate={(id, name) => updateCollection.mutate({ id, name })}
            onDelete={id => deleteCollection.mutate(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
