import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Pencil, 
  Trash2,
  TrendingUp,
  TrendingDown,
  Tag,
  Check,
  ChevronRight,
  CornerDownRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Category, CategoryType } from '@/types/finance';

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1'
];

export default function Categories() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<CategoryType>('expense');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [categoryType, setCategoryType] = useState<CategoryType>('expense');
  const [parentId, setParentId] = useState<string>('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('categories').insert({
        user_id: user!.id,
        name,
        color,
        category_type: categoryType,
        is_system: false,
        parent_id: parentId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría creada', description: 'Se agregó la categoría correctamente.' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear la categoría.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCategory) return;
      const { error } = await supabase
        .from('categories')
        .update({ name, color, parent_id: parentId || null })
        .eq('id', editingCategory.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría actualizada', description: 'Los cambios se guardaron.' });
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar la categoría.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoría eliminada', description: 'Se eliminó la categoría.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar. Puede tener movimientos asociados.', variant: 'destructive' });
    },
  });

  const openCreateDialog = (asSubcategoryOf?: string) => {
    setEditingCategory(null);
    setName('');
    setColor(COLORS[0]);
    setCategoryType(activeTab);
    setParentId(asSubcategoryOf || '');
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color || COLORS[0]);
    setCategoryType(category.category_type);
    setParentId(category.parent_id || '');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setName('');
    setParentId('');
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido.', variant: 'destructive' });
      return;
    }
    if (editingCategory) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const allOfType = (type: CategoryType) => categories?.filter(c => c.category_type === type) || [];
  const parentCategories = (type: CategoryType) => allOfType(type).filter(c => !c.parent_id);
  const childCategories = (parentIdVal: string) => categories?.filter(c => c.parent_id === parentIdVal) || [];

  const expenseParents = parentCategories('expense');
  const incomeParents = parentCategories('income');

  // Available parents for the select (exclude self and own children)
  const availableParents = allOfType(editingCategory?.category_type || categoryType).filter(c => {
    if (!c.parent_id && c.id !== editingCategory?.id) return true;
    return false;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const renderCategoryList = (parents: Category[]) => (
    <div className="grid gap-2">
      {parents.map((category) => {
        const children = childCategories(category.id);
        return (
          <div key={category.id}>
            <Card 
              className="glass border-border/50"
              style={{ borderLeftColor: category.color || '#6366f1', borderLeftWidth: '3px' }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color || '#6366f1' }}
                  />
                  <span className="font-medium text-foreground">{category.name}</span>
                  {category.is_system && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Sistema
                    </span>
                  )}
                  {children.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({children.length} sub)
                    </span>
                  )}
                </div>
                
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    title="Agregar subcategoría"
                    onClick={() => openCreateDialog(category.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {!category.is_system && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(category.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Subcategories */}
            {children.length > 0 && (
              <div className="ml-6 mt-1 space-y-1">
                {children.map((child) => (
                  <Card 
                    key={child.id}
                    className="glass border-border/50"
                    style={{ borderLeftColor: child.color || category.color || '#6366f1', borderLeftWidth: '2px' }}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CornerDownRight className="h-3 w-3 text-muted-foreground" />
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: child.color || '#6366f1' }} />
                        <span className="text-sm text-foreground">{child.name}</span>
                      </div>
                      {!child.is_system && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(child)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(child.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Categorías" 
        subtitle="Organiza tus movimientos"
        action={
          <Button size="icon" className="rounded-full" onClick={() => openCreateDialog()}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CategoryType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expense" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Egresos ({allOfType('expense').length})
            </TabsTrigger>
            <TabsTrigger value="income" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Ingresos ({allOfType('income').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expense" className="mt-4">
            {expenseParents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay categorías de egreso</p>
              </div>
            ) : (
              renderCategoryList(expenseParents)
            )}
          </TabsContent>

          <TabsContent value="income" className="mt-4">
            {incomeParents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay categorías de ingreso</p>
              </div>
            ) : (
              renderCategoryList(incomeParents)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar categoría' : parentId ? 'Nueva subcategoría' : 'Nueva categoría'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Transporte, Freelance..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {!editingCategory && !parentId && (
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={categoryType} onValueChange={(v) => setCategoryType(v as CategoryType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Egreso</SelectItem>
                    <SelectItem value="income">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Parent category selector (for non-subcreation) */}
            {!parentId && (
              <div className="space-y-2">
                <Label>Categoría padre (opcional)</Label>
                <Select value={parentId || 'none'} onValueChange={(v) => setParentId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Ninguna (categoría raíz)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna (categoría raíz)</SelectItem>
                    {availableParents.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {parentId && !editingCategory && (
              <p className="text-sm text-muted-foreground">
                Subcategoría de: <strong>{categories?.find(c => c.id === parentId)?.name}</strong>
              </p>
            )}

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) 
                ? <LoadingSpinner size="sm" /> 
                : 'Guardar'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los movimientos asociados quedarán sin categoría.
              {childCategories(deleteId || '').length > 0 && ' Las subcategorías también quedarán huérfanas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
