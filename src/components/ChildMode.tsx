/**
 * ChildMode — Çocuk Odaklı Görünüm
 * Büyük ikonlar, basit dil, puan sistemi, gökkuşağı animasyonlar.
 */

import React, { useState, useEffect } from 'react';
import { Star, CheckCircle2, Circle, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabaseClient';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import type { Task, ShoppingItem } from '@/types';

interface ChildModeProps {
  familyId: string;
  userId: string;
  userName: string;
  userColor: string;
}

export default function ChildMode({ familyId, userId, userName, userColor }: ChildModeProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const { writeOfflineFirst } = useOfflineSync();

  useEffect(() => {
    const fetchData = async () => {
      const [tasksRes, shoppingRes] = await Promise.all([
        supabase
          .from(TABLES.TASKS)
          .select('*')
          .eq('family_id', familyId)
          .eq('assigned_to', userId)
          .order('status'),
        supabase
          .from(TABLES.SHOPPING_ITEMS)
          .select('*')
          .eq('family_id', familyId)
          .eq('is_checked', false)
          .order('category'),
      ]);

      if (!tasksRes.error && tasksRes.data) {
        const typed = tasksRes.data as Task[];
        setTasks(typed);
        const pts = typed
          .filter((t) => t.status === 'done')
          .reduce((acc, t) => acc + t.points, 0);
        setTotalPoints(pts);
      }

      if (!shoppingRes.error && shoppingRes.data) {
        setShoppingItems((shoppingRes.data as ShoppingItem[]).slice(0, 5));
      }
    };

    fetchData();
  }, [familyId, userId]);

  const completeTask = async (task: Task) => {
    if (task.status === 'done') return;

    setRecentlyCompleted(task.id);
    setShowCelebration(true);
    setTimeout(() => {
      setShowCelebration(false);
      setRecentlyCompleted(null);
    }, 2000);

    await writeOfflineFirst(TABLES.TASKS, 'UPDATE', {
      id: task.id,
      status: 'done',
      completed_at: new Date().toISOString(),
    });

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'done' as const } : t))
    );
    setTotalPoints((prev) => prev + task.points);
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 p-4 pb-24">
      {/* ── Kutlama Animasyonu ── */}
      {showCelebration && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center animate-bounce">
            <div className="text-8xl">🎉</div>
            <div className="text-2xl font-bold text-primary mt-2">Harika!</div>
            <div className="flex justify-center mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Sparkles key={i} className="h-6 w-6 text-yellow-400 animate-spin" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Karşılama ── */}
      <div className="text-center mb-6">
        <div
          className="inline-flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white shadow-lg mb-3"
          style={{ backgroundColor: userColor }}
          aria-label={`${userName}'in avatarı`}
        >
          {userName.charAt(0)}
        </div>
        <h1 className="text-2xl font-bold">Merhaba, {userName}! 👋</h1>
      </div>

      {/* ── Puan Kartı ── */}
      <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 p-5 text-white text-center shadow-lg mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Trophy className="h-6 w-6" aria-hidden="true" />
          <span className="text-lg font-bold">Toplam Puanın</span>
        </div>
        <div className="text-5xl font-black">{totalPoints}</div>
        <div className="flex justify-center mt-2">
          {Array.from({ length: Math.min(5, Math.floor(totalPoints / 10)) }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-white text-white" aria-hidden="true" />
          ))}
        </div>
        <p className="text-sm mt-2 opacity-90">
          {doneTasks.length}/{tasks.length} görev tamamlandı
        </p>
      </div>

      {/* ── Görevlerim ── */}
      <section aria-labelledby="my-tasks-heading" className="mb-6">
        <h2 id="my-tasks-heading" className="text-lg font-bold mb-3">
          📋 Bugünkü Görevlerim
        </h2>

        {pendingTasks.length === 0 && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
            <div className="text-4xl mb-2">🌟</div>
            <p className="font-semibold text-green-700">Tüm görevleri tamamladın!</p>
          </div>
        )}

        <div className="space-y-3">
          {pendingTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => completeTask(task)}
              disabled={recentlyCompleted === task.id}
              className={cn(
                'w-full flex items-center gap-4 rounded-2xl bg-white border-2 border-transparent p-4 text-left shadow-sm',
                'hover:border-primary hover:shadow-md transition-all active:scale-95',
                recentlyCompleted === task.id && 'animate-task-complete border-green-400 bg-green-50'
              )}
              aria-label={`${task.title} görevi tamamla, ${task.points} puan kazanırsın`}
            >
              <div className="shrink-0">
                {recentlyCompleted === task.id ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : (
                  <Circle className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">{task.title}</p>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
              </div>
              {task.points > 0 && (
                <div className="shrink-0 flex items-center gap-1 bg-yellow-100 rounded-full px-3 py-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" aria-hidden="true" />
                  <span className="text-sm font-bold text-yellow-700">{task.points}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Tamamlananlar */}
        {doneTasks.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Tamamlananlar ✅</p>
            {doneTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-3 opacity-70"
              >
                <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" aria-hidden="true" />
                <span className="text-sm line-through text-muted-foreground">{task.title}</span>
                <span className="ml-auto text-xs text-green-600">+{task.points} puan</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Alışveriş Hatırlatması ── */}
      {shoppingItems.length > 0 && (
        <section aria-labelledby="shopping-reminder-heading">
          <h2 id="shopping-reminder-heading" className="text-lg font-bold mb-3">
            🛒 Alışveriş Listesi
          </h2>
          <div className="rounded-2xl bg-white border shadow-sm p-4 space-y-2">
            {shoppingItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                <span>{item.name}</span>
                {item.quantity > 1 && (
                  <span className="text-muted-foreground text-xs ml-auto">{item.quantity} {item.unit}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
