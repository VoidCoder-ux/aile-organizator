/**
 * ShoppingList — Alışveriş Listesi
 * Kategori otomatik sıralama, anlık realtime sync,
 * offline ekleme, fotoğraf/ses input placeholder.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Camera, Mic, Check, Trash2 } from 'lucide-react';
import { cn, generateId, SHOPPING_CATEGORY_LABELS, SHOPPING_CATEGORY_ICONS } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabaseClient';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import type { ShoppingItem, ShoppingCategory } from '@/types';

interface ShoppingListProps {
  familyId: string;
  userId: string;
  canEdit?: boolean;
}

// Kategori sıralama önceliği
const CATEGORY_ORDER: ShoppingCategory[] = [
  'produce', 'dairy', 'meat', 'bakery', 'frozen',
  'beverages', 'snacks', 'household', 'personal_care', 'other',
];

export default function ShoppingList({ familyId, userId, canEdit = true }: ShoppingListProps) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [filter, setFilter] = useState<ShoppingCategory | 'all'>('all');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ShoppingCategory>('other');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { writeOfflineFirst } = useOfflineSync();

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLES.SHOPPING_ITEMS)
      .select('*')
      .eq('family_id', familyId)
      .order('is_checked', { ascending: true })
      .order('category')
      .order('created_at', { ascending: false });

    if (!error && data) setItems(data as ShoppingItem[]);
  }, [familyId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime: alışveriş listesi anlık güncelleme
  useRealtimeSync<ShoppingItem>({
    table: TABLES.SHOPPING_ITEMS,
    familyId,
    onInsert: (record) => setItems((prev) => [record, ...prev.filter((i) => i.id !== record.id)]),
    onUpdate: (record) => setItems((prev) => prev.map((i) => (i.id === record.id ? record : i))),
    onDelete: (record) => setItems((prev) => prev.filter((i) => i.id !== record.id)),
  });

  // Öğe ekle
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setIsSubmitting(true);

    const payload: Partial<ShoppingItem> = {
      id: generateId(),
      family_id: familyId,
      added_by: userId,
      name: newItemName.trim(),
      quantity: newItemQuantity,
      unit: newItemUnit || null,
      category: newItemCategory,
      is_checked: false,
      checked_by: null,
      checked_at: null,
      note: null,
      image_url: null,
    };

    await writeOfflineFirst(TABLES.SHOPPING_ITEMS, 'INSERT', payload as Record<string, unknown>);
    setItems((prev) => [payload as ShoppingItem, ...prev]);

    // Formu sıfırla, cursor'ı geri getir
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemUnit('');
    setIsSubmitting(false);
    inputRef.current?.focus();
  };

  // Çek/çekme toggle
  const toggleCheck = async (item: ShoppingItem) => {
    const newChecked = !item.is_checked;
    const update = {
      id: item.id,
      is_checked: newChecked,
      checked_by: newChecked ? userId : null,
      checked_at: newChecked ? new Date().toISOString() : null,
    };

    await writeOfflineFirst(TABLES.SHOPPING_ITEMS, 'UPDATE', update);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...update } : i)));
  };

  // Sil
  const deleteItem = async (itemId: string) => {
    await writeOfflineFirst(TABLES.SHOPPING_ITEMS, 'DELETE', { id: itemId });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Tamamlananları temizle
  const clearChecked = async () => {
    const checked = items.filter((i) => i.is_checked);
    for (const item of checked) {
      await writeOfflineFirst(TABLES.SHOPPING_ITEMS, 'DELETE', { id: item.id });
    }
    setItems((prev) => prev.filter((i) => !i.is_checked));
  };

  // Kategori otomatik tahmin
  const guessCategoryFromName = (name: string): ShoppingCategory => {
    const n = name.toLowerCase();
    if (/süt|yoğurt|peynir|tereyağ|krema/.test(n)) return 'dairy';
    if (/et|tavuk|balık|sucuk|salam/.test(n)) return 'meat';
    if (/ekmek|çörek|poğaça|simit/.test(n)) return 'bakery';
    if (/elma|armut|muz|domates|salatalık|sebze|meyve/.test(n)) return 'produce';
    if (/su|çay|kahve|meyve suyu|kola/.test(n)) return 'beverages';
    if (/çikolata|bisküvi|cips|gofret/.test(n)) return 'snacks';
    if (/deterjan|sabun|şampuan|tuvalet/.test(n)) return 'household';
    return 'other';
  };

  const handleNameChange = (value: string) => {
    setNewItemName(value);
    if (value.length > 2) {
      setNewItemCategory(guessCategoryFromName(value));
    }
  };

  // Filtre & gruplama
  const filteredItems = filter === 'all'
    ? items
    : items.filter((i) => i.category === filter);

  // Kategoriye göre grupla ve sırala
  const groupedItems = CATEGORY_ORDER.reduce<Record<ShoppingCategory, ShoppingItem[]>>(
    (acc, cat) => {
      const catItems = filteredItems.filter((i) => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    },
    {} as Record<ShoppingCategory, ShoppingItem[]>
  );

  const uncheckedCount = items.filter((i) => !i.is_checked).length;
  const checkedCount = items.filter((i) => i.is_checked).length;

  return (
    <div className="space-y-4">
      {/* ── Başlık ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl">Alışveriş</h2>
          <p className="text-xs text-muted-foreground">
            {uncheckedCount} kalan • {checkedCount} alındı
          </p>
        </div>
        {checkedCount > 0 && canEdit && (
          <button
            onClick={clearChecked}
            className="flex items-center gap-1 text-xs text-destructive border border-destructive/30 rounded-full px-3 py-1 hover:bg-destructive/10 transition-colors"
            aria-label="Alınanları listeden kaldır"
          >
            <Trash2 className="h-3 w-3" /> Alınanları Temizle
          </button>
        )}
      </div>

      {/* ── Ekle Formu ── */}
      {canEdit && (
        <form onSubmit={addItem} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newItemName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ürün ekle..."
            className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Yeni ürün adı"
          />
          <button
            type="submit"
            disabled={!newItemName.trim() || isSubmitting}
            aria-label="Ürün ekle"
            className="rounded-xl bg-primary px-4 py-3 text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      )}

      {/* Gelişmiş ekleme seçenekleri */}
      {canEdit && newItemName && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as ShoppingCategory)}
            aria-label="Kategori seç"
            className="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {SHOPPING_CATEGORY_ICONS[cat]} {SHOPPING_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(Number(e.target.value))}
              aria-label="Miktar"
              className="w-16 rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              placeholder="kg, adet..."
              aria-label="Birim"
              className="w-20 rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* Fotoğraf/ses placeholder */}
          <button
            type="button"
            title="Fotoğraf ekle (yakında)"
            aria-label="Fotoğraf ekle (yakında)"
            className="rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => alert('Fotoğraf ekleme özelliği yakında!')}
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Sesli ekle (yakında)"
            aria-label="Sesli ekle (yakında)"
            className="rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => alert('Sesli giriş özelliği yakında!')}
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Kategori Filtresi ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Kategori filtresi">
        <button
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            filter === 'all' ? 'bg-primary text-white' : 'bg-muted hover:bg-accent'
          )}
        >
          Tümü ({items.length})
        </button>
        {CATEGORY_ORDER.filter((cat) => items.some((i) => i.category === cat)).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            aria-pressed={filter === cat}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === cat ? 'bg-primary text-white' : 'bg-muted hover:bg-accent'
            )}
          >
            {SHOPPING_CATEGORY_ICONS[cat]} {SHOPPING_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* ── Liste ── */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([cat, catItems]) => (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {SHOPPING_CATEGORY_ICONS[cat as ShoppingCategory]} {SHOPPING_CATEGORY_LABELS[cat as ShoppingCategory]}
            </h3>
            <div className="space-y-1">
              {catItems
                .sort((a, b) => Number(a.is_checked) - Number(b.is_checked))
                .map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onToggle={() => toggleCheck(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Liste boş. Ürün ekleyin!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ShoppingItemRow ───────────────────────────────────────────────────────────

function ShoppingCart({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4m1.6 8L5.4 5M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  );
}

interface ShoppingItemRowProps {
  item: ShoppingItem;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function ShoppingItemRow({ item, canEdit, onToggle, onDelete }: ShoppingItemRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-all',
        item.is_checked && 'opacity-50 bg-muted/50'
      )}
    >
      <button
        onClick={onToggle}
        aria-label={item.is_checked ? `${item.name} işaretini kaldır` : `${item.name} alındı olarak işaretle`}
        aria-pressed={item.is_checked}
        className={cn(
          'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
          item.is_checked ? 'bg-green-500 border-green-500' : 'border-muted-foreground hover:border-primary'
        )}
        disabled={!canEdit}
      >
        {item.is_checked && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={cn('text-sm', item.is_checked && 'line-through text-muted-foreground')}>
          {item.name}
        </span>
        {(item.quantity > 1 || item.unit) && (
          <span className="ml-2 text-xs text-muted-foreground">
            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
          </span>
        )}
      </div>

      {canEdit && (
        <button
          onClick={onDelete}
          aria-label={`${item.name} sil`}
          className="rounded-full p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
