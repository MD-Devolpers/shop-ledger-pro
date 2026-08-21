import { useState } from "react";
import {
  ApiError,
  useListCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useListCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Building2, Tag, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MasterItem {
  id: number;
  name: string;
}

interface DeleteResult {
  transferredProducts?: number;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function MasterTab({
  title,
  icon: Icon,
  items,
  onCreate,
  onUpdate,
  onDelete,
  isLoading,
  supportsTransfer = false,
}: {
  title: string;
  icon: React.ElementType;
  items: MasterItem[];
  onCreate: (name: string) => Promise<unknown>;
  onUpdate: (id: number, name: string) => Promise<unknown>;
  onDelete: (id: number, replacementId?: number) => Promise<DeleteResult>;
  isLoading: boolean;
  supportsTransfer?: boolean;
}) {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [editItem, setEditItem] = useState<MasterItem | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteItem, setDeleteItem] = useState<MasterItem | null>(null);
  const [requiresTransfer, setRequiresTransfer] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [replacementId, setReplacementId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const duplicateExists = (name: string, exceptId?: number) => {
    const normalized = normalizeName(name);
    return items.some(item => item.id !== exceptId && normalizeName(item.name) === normalized);
  };

  const showError = (error: unknown) => {
    toast({
      title: "Could not save changes",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });
  };

  const createItem = async () => {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (duplicateExists(name)) {
      toast({ title: `${title} already exists`, description: "Use a different name.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await onCreate(name);
      setNewName("");
      toast({ title: `${title} added` });
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateItem = async () => {
    if (!editItem) return;
    const name = editName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (duplicateExists(name, editItem.id)) {
      toast({ title: `${title} already exists`, description: "Use a different name.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(editItem.id, name);
      setEditItem(null);
      toast({ title: `${title} updated` });
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteItem(null);
    setRequiresTransfer(false);
    setUsageCount(0);
    setReplacementId("");
  };

  const confirmDelete = async () => {
    if (!deleteItem || (requiresTransfer && !replacementId)) return;
    setIsDeleting(true);
    try {
      const result = await onDelete(
        deleteItem.id,
        requiresTransfer ? Number(replacementId) : undefined,
      );
      const transferred = result.transferredProducts ?? 0;
      toast({
        title: `${title} deleted`,
        description: transferred
          ? `${transferred} product${transferred === 1 ? "" : "s"} moved to the selected ${title.toLowerCase()}.`
          : undefined,
      });
      closeDeleteDialog();
    } catch (error) {
      if (
        supportsTransfer &&
        error instanceof ApiError &&
        error.data.code === "MASTER_IN_USE"
      ) {
        const count = Number(error.data.usageCount);
        setUsageCount(Number.isFinite(count) ? count : 0);
        setRequiresTransfer(true);
        return;
      }
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const replacementOptions = deleteItem
    ? items.filter(item => item.id !== deleteItem.id)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={`New ${title} name...`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void createItem(); }}
        />
        <Button onClick={() => void createItem()} disabled={!newName.trim() || isSaving}>
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
                <Button size="icon" variant="ghost" aria-label={`Edit ${item.name}`} onClick={() => { setEditItem(item); setEditName(item.name); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${item.name}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteItem(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {title}</DialogTitle></DialogHeader>
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void updateItem(); }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={() => void updateItem()} disabled={!editName.trim() || isSaving}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={open => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {requiresTransfer ? `Move products before deleting ${title.toLowerCase()}` : `Delete ${title.toLowerCase()}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {requiresTransfer
                ? `${usageCount} product${usageCount === 1 ? "" : "s"} currently use “${deleteItem?.name}”. Select where to move them before deleting it.`
                : `Are you sure you want to delete “${deleteItem?.name}”? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {requiresTransfer && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Move products to</label>
              {replacementOptions.length > 0 ? (
                <Select value={replacementId} onValueChange={setReplacementId}>
                  <SelectTrigger><SelectValue placeholder={`Choose another ${title.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>
                    {replacementOptions.map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-destructive">
                  Create another {title.toLowerCase()} first, then come back to transfer these products.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={isDeleting || (requiresTransfer && (!replacementId || replacementOptions.length === 0))}
            >
              {isDeleting ? "Saving..." : requiresTransfer ? "Move & delete" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Masters() {
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
            title="Company"
            icon={Building2}
            items={companies}
            isLoading={cLoading}
            onCreate={name => createCompany.mutateAsync(name)}
            onUpdate={(id, name) => updateCompany.mutateAsync({ id, name })}
            onDelete={async id => {
              await deleteCompany.mutateAsync(id);
              return {};
            }}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <MasterTab
            title="Category"
            icon={Tag}
            items={categories}
            isLoading={catLoading}
            supportsTransfer
            onCreate={name => createCategory.mutateAsync(name)}
            onUpdate={(id, name) => updateCategory.mutateAsync({ id, name })}
            onDelete={(id, replacementId) => deleteCategory.mutateAsync({ id, replacementId })}
          />
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <MasterTab
            title="Collection"
            icon={Package}
            items={collections}
            isLoading={colLoading}
            supportsTransfer
            onCreate={name => createCollection.mutateAsync(name)}
            onUpdate={(id, name) => updateCollection.mutateAsync({ id, name })}
            onDelete={(id, replacementId) => deleteCollection.mutateAsync({ id, replacementId })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}