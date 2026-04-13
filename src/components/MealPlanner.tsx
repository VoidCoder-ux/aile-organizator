/**
 * MealPlanner — Yemek Planlayıcı
 * Haftalık grid, tarif kaydetme, "malzemeleri alışveriş listesine aktar".
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, ShoppingCart, BookOpen } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabaseClient';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import type { Meal, Recipe, MealType, ShoppingItem, ShoppingCategory } from '@/types';

interface MealPlannerProps {
  familyId: string;
  userId: string;
  canEdit?: boolean;
}

const MEAL_TYPES: { type: MealType; label: string; emoji: string }[] = [
  { type: 'breakfast', label: 'Kahvaltı', emoji: '🍳' },
  { type: 'lunch', label: 'Öğle', emoji: '🍱' },
  { type: 'dinner', label: 'Akşam', emoji: '🍽️' },
  { type: 'snack', label: 'Atıştırma', emoji: '🍎' },
];

const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function MealPlanner({ familyId, userId, canEdit = true }: MealPlannerProps) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [meals, setMeals] = useState<Meal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('dinner');
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [mealForm, setMealForm] = useState({ custom_name: '', recipe_id: '', notes: '' });
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    description: '',
    ingredients: [{ name: '', quantity: 1, unit: 'adet' }],
    instructions: '',
    prep_time_minutes: 30,
    servings: 4,
  });
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const { writeOfflineFirst } = useOfflineSync();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    const weekEnd = addDays(weekStart, 6);
    const [mealsRes, recipesRes] = await Promise.all([
      supabase
        .from(TABLES.MEALS)
        .select('*, recipes(*)')
        .eq('family_id', familyId)
        .gte('meal_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('meal_date', format(weekEnd, 'yyyy-MM-dd')),
      supabase.from(TABLES.RECIPES).select('*').eq('family_id', familyId),
    ]);

    if (!mealsRes.error && mealsRes.data) setMeals(mealsRes.data as Meal[]);
    if (!recipesRes.error && recipesRes.data) setRecipes(recipesRes.data as Recipe[]);
  }, [familyId, weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getMealsForDayAndType = (day: Date, type: MealType): Meal[] =>
    meals.filter(
      (m) => m.meal_date === format(day, 'yyyy-MM-dd') && m.meal_type === type
    );

  const openAddMeal = (day: Date, type: MealType) => {
    setSelectedDay(day);
    setSelectedMealType(type);
    setEditingMeal(null);
    setMealForm({ custom_name: '', recipe_id: '', notes: '' });
    setShowMealModal(true);
  };

  const openEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setSelectedDay(parseISO(meal.meal_date));
    setSelectedMealType(meal.meal_type);
    setMealForm({
      custom_name: meal.custom_name ?? '',
      recipe_id: meal.recipe_id ?? '',
      notes: meal.notes ?? '',
    });
    setShowMealModal(true);
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    const payload = {
      id: editingMeal?.id ?? generateId(),
      family_id: familyId,
      created_by: userId,
      meal_date: format(selectedDay, 'yyyy-MM-dd'),
      meal_type: selectedMealType,
      recipe_id: mealForm.recipe_id || null,
      custom_name: mealForm.custom_name || null,
      notes: mealForm.notes || null,
    };

    await writeOfflineFirst(TABLES.MEALS, editingMeal ? 'UPDATE' : 'INSERT', payload);
    setShowMealModal(false);
    fetchData();
  };

  const handleDeleteMeal = async (mealId: string) => {
    await writeOfflineFirst(TABLES.MEALS, 'DELETE', { id: mealId });
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
    setShowMealModal(false);
  };

  // Tarif kaydet
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: generateId(),
      family_id: familyId,
      created_by: userId,
      name: recipeForm.name,
      description: recipeForm.description || null,
      ingredients: recipeForm.ingredients,
      instructions: recipeForm.instructions || null,
      prep_time_minutes: recipeForm.prep_time_minutes,
      servings: recipeForm.servings,
      image_url: null,
      tags: [],
    };

    await writeOfflineFirst(TABLES.RECIPES, 'INSERT', payload);
    setShowRecipeModal(false);
    fetchData();
  };

  // Malzemeleri alışveriş listesine aktar
  const exportIngredientsToShopping = async (recipe: Recipe) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      setExportStatus('Bu tarifin malzeme listesi boş.');
      setTimeout(() => setExportStatus(null), 3000);
      return;
    }

    let count = 0;
    for (const ing of recipe.ingredients) {
      const item: Partial<ShoppingItem> = {
        id: generateId(),
        family_id: familyId,
        added_by: userId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: 'other' as ShoppingCategory,
        is_checked: false,
        checked_by: null,
        checked_at: null,
        note: `Tarif: ${recipe.name}`,
        image_url: null,
      };
      await writeOfflineFirst(TABLES.SHOPPING_ITEMS, 'INSERT', item as Record<string, unknown>);
      count++;
    }

    setExportStatus(`✅ ${count} malzeme alışveriş listesine eklendi!`);
    setTimeout(() => setExportStatus(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* ── Başlık & Navigasyon ── */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart((d) => subWeeks(d, 1))} aria-label="Önceki hafta" className="rounded-full p-2 hover:bg-accent">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h2 className="font-bold">Yemek Planı</h2>
          <p className="text-xs text-muted-foreground">
            {format(weekStart, 'd MMM', { locale: tr })} – {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: tr })}
          </p>
        </div>
        <button onClick={() => setWeekStart((d) => addWeeks(d, 1))} aria-label="Sonraki hafta" className="rounded-full p-2 hover:bg-accent">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Export durumu */}
      {exportStatus && (
        <div role="status" aria-live="polite" className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 text-center">
          {exportStatus}
        </div>
      )}

      {/* ── Haftalık Grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse" role="grid" aria-label="Haftalık yemek planı">
          <thead>
            <tr>
              <th className="w-20 p-2 text-xs font-medium text-muted-foreground text-left">Öğün</th>
              {weekDays.map((day, i) => (
                <th key={day.toISOString()} className="p-2 text-center" scope="col">
                  <div className="text-xs font-medium text-muted-foreground">{WEEKDAYS_SHORT[i]}</div>
                  <div className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold mx-auto',
                    format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && 'bg-primary text-primary-foreground'
                  )}>
                    {format(day, 'd')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map(({ type, label, emoji }) => (
              <tr key={type} className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <span aria-hidden="true">{emoji}</span>
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const dayMeals = getMealsForDayAndType(day, type);
                  return (
                    <td key={day.toISOString()} className="p-1 align-top min-w-[90px]">
                      <div className="space-y-1">
                        {dayMeals.map((meal) => {
                          const recipeName = meal.recipes?.name;
                          const displayName = recipeName ?? meal.custom_name ?? '—';
                          return (
                            <button
                              key={meal.id}
                              onClick={() => openEditMeal(meal)}
                              className="w-full text-left rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-xs hover:bg-primary/20 transition-colors"
                              aria-label={`${displayName} düzenle`}
                            >
                              <span className="truncate block">{displayName}</span>
                              {meal.recipes && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); exportIngredientsToShopping(meal.recipes!); }}
                                  className="mt-0.5 flex items-center gap-0.5 text-primary/70 hover:text-primary"
                                  aria-label="Malzemeleri listeye aktar"
                                  title="Malzemeleri alışveriş listesine ekle"
                                >
                                  <ShoppingCart className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </button>
                          );
                        })}
                        {canEdit && (
                          <button
                            onClick={() => openAddMeal(day, type)}
                            className="w-full rounded-lg border border-dashed border-muted-foreground/30 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                            aria-label={`${format(day, 'EEEE', { locale: tr })} ${label} ekle`}
                          >
                            <Plus className="h-3 w-3 mx-auto" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Tarif Kitaplığı ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Tarifler ({recipes.length})
          </h3>
          {canEdit && (
            <button
              onClick={() => setShowRecipeModal(true)}
              className="flex items-center gap-1 text-xs bg-primary text-white rounded-full px-3 py-1 hover:bg-primary/90 transition-colors"
              aria-label="Yeni tarif ekle"
            >
              <Plus className="h-3 w-3" /> Tarif Ekle
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-sm">{recipe.name}</h4>
                  {recipe.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{recipe.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {recipe.prep_time_minutes && <span>⏱ {recipe.prep_time_minutes} dk</span>}
                {recipe.servings && <span>👥 {recipe.servings} kişilik</span>}
                <span>📋 {recipe.ingredients?.length ?? 0} malzeme</span>
              </div>
              <button
                onClick={() => exportIngredientsToShopping(recipe)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border py-2 text-xs hover:bg-accent transition-colors"
                aria-label={`${recipe.name} malzemelerini alışveriş listesine ekle`}
              >
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                Malzemeleri Listeye Aktar
              </button>
            </div>
          ))}
          {recipes.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
              Henüz tarif yok. İlk tarifinizi ekleyin!
            </p>
          )}
        </div>
      </div>

      {/* ── Yemek Modal ── */}
      {showMealModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="meal-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMealModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 id="meal-modal-title" className="font-bold">
                {editingMeal ? 'Öğünü Düzenle' : 'Yeni Öğün'}
              </h3>
              <button onClick={() => setShowMealModal(false)} aria-label="Kapat" className="rounded-full p-1.5 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedDay && (
              <p className="text-sm text-muted-foreground mb-4">
                {format(selectedDay, 'd MMMM EEEE', { locale: tr })} •{' '}
                {MEAL_TYPES.find((t) => t.type === selectedMealType)?.label}
              </p>
            )}

            <form onSubmit={handleSaveMeal} className="space-y-4">
              <div>
                <label htmlFor="meal-recipe" className="block text-sm font-medium mb-1">Tarif Seç</label>
                <select
                  id="meal-recipe"
                  value={mealForm.recipe_id}
                  onChange={(e) => setMealForm((p) => ({ ...p, recipe_id: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Tarif yok —</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {!mealForm.recipe_id && (
                <div>
                  <label htmlFor="meal-name" className="block text-sm font-medium mb-1">Veya Özel Yemek Adı</label>
                  <input
                    id="meal-name"
                    type="text"
                    value={mealForm.custom_name}
                    onChange={(e) => setMealForm((p) => ({ ...p, custom_name: e.target.value }))}
                    placeholder="Yemek adı"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {editingMeal && (
                  <button type="button" onClick={() => handleDeleteMeal(editingMeal.id)}
                    className="flex-1 rounded-lg border border-destructive py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
                    Sil
                  </button>
                )}
                <button type="submit" className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tarif Modal ── */}
      {showRecipeModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRecipeModal(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 id="recipe-modal-title" className="font-bold">Yeni Tarif</h3>
              <button onClick={() => setShowRecipeModal(false)} aria-label="Kapat" className="rounded-full p-1.5 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div>
                <label htmlFor="recipe-name" className="block text-sm font-medium mb-1">Tarif Adı *</label>
                <input
                  id="recipe-name"
                  type="text"
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="Tavuk Çorbası"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Malzemeler</label>
                  <button
                    type="button"
                    onClick={() => setRecipeForm((p) => ({
                      ...p,
                      ingredients: [...p.ingredients, { name: '', quantity: 1, unit: 'adet' }],
                    }))}
                    className="text-xs text-primary hover:underline"
                  >
                    + Ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {recipeForm.ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => {
                          const newIngs = [...recipeForm.ingredients];
                          newIngs[i] = { ...newIngs[i], name: e.target.value };
                          setRecipeForm((p) => ({ ...p, ingredients: newIngs }));
                        }}
                        placeholder="Malzeme adı"
                        aria-label={`Malzeme ${i + 1} adı`}
                        className="flex-1 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="number"
                        min={0}
                        value={ing.quantity}
                        onChange={(e) => {
                          const newIngs = [...recipeForm.ingredients];
                          newIngs[i] = { ...newIngs[i], quantity: Number(e.target.value) };
                          setRecipeForm((p) => ({ ...p, ingredients: newIngs }));
                        }}
                        aria-label={`Malzeme ${i + 1} miktarı`}
                        className="w-16 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        value={ing.unit}
                        onChange={(e) => {
                          const newIngs = [...recipeForm.ingredients];
                          newIngs[i] = { ...newIngs[i], unit: e.target.value };
                          setRecipeForm((p) => ({ ...p, ingredients: newIngs }));
                        }}
                        placeholder="birim"
                        aria-label={`Malzeme ${i + 1} birimi`}
                        className="w-16 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recipe-time" className="block text-sm font-medium mb-1">Süre (dk)</label>
                  <input
                    id="recipe-time"
                    type="number"
                    value={recipeForm.prep_time_minutes}
                    onChange={(e) => setRecipeForm((p) => ({ ...p, prep_time_minutes: Number(e.target.value) }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="recipe-servings" className="block text-sm font-medium mb-1">Kişi sayısı</label>
                  <input
                    id="recipe-servings"
                    type="number"
                    value={recipeForm.servings}
                    onChange={(e) => setRecipeForm((p) => ({ ...p, servings: Number(e.target.value) }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button type="submit" className="w-full rounded-lg bg-primary py-3 text-white font-medium hover:bg-primary/90 transition-colors">
                Tarifi Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
