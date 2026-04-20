/**
 * TaskBoard — Görev Yönetimi
 * Atama, hatırlatma, ilerleme çubuğu, tamamlanma animasyonu,
 * çocuk/ebeveyn görünüm switchi, priorite renkleri.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, CheckCircle2, Circle, Loader2, Star } from 'lucide-react';
import { cn, formatRelativeDate, generateId, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabaseClient';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import type { Task, TaskStatus, TaskPriority, FamilyMember, FamilyRole } from '@/types';

interface TaskBoardProps {
  familyId: string;
  userId: string;
  userRole: FamilyRole;
  members: FamilyMember[];
}

const STATUS_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'Yapılacak', color: 'bg-slate-100' },
  { status: 'in_progress', label: 'Devam Ediyor', color: 'bg-blue-50' },
  { status: 'done', label: 'Tamamlandı', color: 'bg-green-50' },
];

interface TaskFormData {
  title: string;
  description: string;
  assigned_to: string;
  priority: TaskPriority;
  due_date: string;
  points: number;
}

export default function TaskBoard({ familyId, userId, userRole, members }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [childView, setChildView] = useState(userRole === 'child');
  const [form, setForm] = useState<TaskFormData>({
    title: '',
    description: '',
    assigned_to: userId,
    priority: 'medium',
    due_date: '',
    points: 10,
  });

  const { writeOfflineFirst } = useOfflineSync();

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLES.TASKS)
      .select('*, profiles:assigned_to(id, full_name, color, avatar_url)')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const typed = data as unknown as Task[];
      // child: sadece kendine atananları gör
      if (userRole === 'child') {
        setTasks(typed.filter((t) => t.assigned_to === userId || t.created_by === userId));
      } else {
        setTasks(typed);
      }
    }
  }, [familyId, userId, userRole]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useRealtimeSync<Task>({
    table: TABLES.TASKS,
    familyId,
    onInsert: (record) => setTasks((prev) => [record, ...prev]),
    onUpdate: (record) => setTasks((prev) => prev.map((t) => (t.id === record.id ? { ...t, ...record } : t))),
    onDelete: (record) => setTasks((prev) => prev.filter((t) => t.id !== record.id)),
  });

  // İlerleme hesabı
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Görev tamamla/aç
  const toggleTask = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    setCompletingId(task.id);

    if (newStatus === 'done') {
      // Animasyon için kısa gecikme
      await new Promise((r) => setTimeout(r, 300));
    }

    await writeOfflineFirst(TABLES.TASKS, 'UPDATE', {
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    });

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
          : t
      )
    );
    setCompletingId(null);
  };

  // Durum değiştir (drag-free: select dropdown)
  const changeStatus = async (taskId: string, status: TaskStatus) => {
    await writeOfflineFirst(TABLES.TASKS, 'UPDATE', {
      id: taskId,
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm({ title: '', description: '', assigned_to: userId, priority: 'medium', due_date: '', points: 10 });
    setShowModal(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      assigned_to: task.assigned_to ?? userId,
      priority: task.priority,
      due_date: task.due_date?.slice(0, 10) ?? '',
      points: task.points,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sadece dolu alanları gönder — PostgREST şema önbellek tutarsızlıklarını atlat.
    const payload: Record<string, unknown> = {
      id: editingTask?.id ?? generateId(),
      family_id: familyId,
      created_by: userId,
      title: form.title,
      priority: form.priority,
      status: editingTask?.status ?? ('todo' as TaskStatus),
      points: form.points,
    };
    if (form.description) payload.description = form.description;
    if (form.assigned_to) payload.assigned_to = form.assigned_to;
    if (form.due_date) payload.due_date = form.due_date;

    const { queued, error: writeError } = await writeOfflineFirst(
      TABLES.TASKS,
      editingTask ? 'UPDATE' : 'INSERT',
      payload
    );

    if (queued && writeError) {
      alert(`Görev kaydedilemedi: ${writeError}`);
      return;
    }

    // Optimistic UI: yeni/güncel görevi hemen listeye yansıt
    const optimistic: Task = {
      id: payload.id as string,
      family_id: familyId,
      created_by: userId,
      assigned_to: form.assigned_to || null,
      title: form.title,
      description: form.description || null,
      status: editingTask?.status ?? 'todo',
      priority: form.priority,
      due_date: form.due_date || null,
      completed_at: null,
      points: form.points,
      created_at: editingTask?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (editingTask) {
      setTasks((prev) => prev.map((t) => (t.id === optimistic.id ? { ...t, ...optimistic } : t)));
    } else {
      setTasks((prev) => [optimistic, ...prev.filter((t) => t.id !== optimistic.id)]);
    }

    setShowModal(false);
    fetchTasks();
  };

  const handleDelete = async (taskId: string) => {
    await writeOfflineFirst(TABLES.TASKS, 'DELETE', { id: taskId });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setShowModal(false);
  };

  const visibleTasks = childView
    ? tasks.filter((t) => t.assigned_to === userId)
    : tasks;

  return (
    <div className="space-y-4">
      {/* ── Başlık & İlerleme ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-xl">Görevler</h2>
        {userRole === 'parent' && (
          <button
            onClick={() => setChildView(!childView)}
            className="text-xs text-muted-foreground border rounded-full px-3 py-1 hover:bg-accent transition-colors"
            aria-pressed={childView}
          >
            {childView ? '👨‍👩‍👧 Tüm Aile' : '🧒 Benim Görevlerim'}
          </button>
        )}
      </div>

      {/* İlerleme çubuğu */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{doneTasks}/{totalTasks} tamamlandı</span>
          <span>%{progressPct}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Görev ilerleme durumu"
          className="h-2 rounded-full bg-muted overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Kolonlar ── */}
      <div className="space-y-4">
        {STATUS_COLUMNS.map(({ status, label, color }) => {
          const colTasks = visibleTasks.filter((t) => t.status === status);
          return (
            <div key={status} className={cn('rounded-xl p-4', color)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">
                  {label}
                  <span className="ml-2 text-muted-foreground font-normal">({colTasks.length})</span>
                </h3>
              </div>

              <div className="space-y-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isCompleting={completingId === task.id}
                    canEdit={userRole === 'parent' || task.assigned_to === userId || task.created_by === userId}
                    onToggle={() => toggleTask(task)}
                    onEdit={() => openEdit(task)}
                    onStatusChange={(s) => changeStatus(task.id, s)}
                    members={members}
                  />
                ))}

                {colTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">Görev yok</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── FAB ── */}
      {(userRole === 'parent' || userRole === 'child') && (
        <button
          onClick={openCreate}
          className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Yeni görev ekle"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 id="task-modal-title" className="font-bold text-lg">
                {editingTask ? 'Görevi Düzenle' : 'Yeni Görev'}
              </h3>
              <button onClick={() => setShowModal(false)} aria-label="Kapat" className="rounded-full p-1.5 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-sm font-medium mb-1">Görev *</label>
                <input
                  id="task-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  placeholder="Görev adı"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {userRole === 'parent' && (
                <div>
                  <label htmlFor="task-assign" className="block text-sm font-medium mb-1">Atanan Kişi</label>
                  <select
                    id="task-assign"
                    value={form.assigned_to}
                    onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name ?? m.user_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-priority" className="block text-sm font-medium mb-1">Öncelik</label>
                  <select
                    id="task-priority"
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-due" className="block text-sm font-medium mb-1">Son Tarih</label>
                  <input
                    id="task-due"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {userRole === 'parent' && (
                <div>
                  <label htmlFor="task-points" className="block text-sm font-medium mb-1">
                    Puan <span className="text-muted-foreground font-normal">(çocuk ödülü)</span>
                  </label>
                  <input
                    id="task-points"
                    type="number"
                    min={0}
                    max={100}
                    value={form.points}
                    onChange={(e) => setForm((p) => ({ ...p, points: Number(e.target.value) }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {editingTask && userRole === 'parent' && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingTask.id)}
                    className="flex-1 rounded-lg border border-destructive py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    Sil
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Card Alt Bileşeni ────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isCompleting: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onStatusChange: (status: TaskStatus) => void;
  members: FamilyMember[];
}

function TaskCard({ task, isCompleting, canEdit, onToggle, onEdit, onStatusChange, members }: TaskCardProps) {
  const assignee = members.find((m) => m.user_id === task.assigned_to);
  const isDone = task.status === 'done';

  return (
    <div
      className={cn(
        'rounded-lg bg-white border p-3 space-y-2 transition-all',
        isDone && 'opacity-60',
        isCompleting && 'animate-task-complete',
        canEdit && 'cursor-pointer hover:shadow-sm'
      )}
      onClick={canEdit ? onEdit : undefined}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) onEdit(); }}
      aria-label={`Görev: ${task.title}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-label={isDone ? 'Görevi geri al' : 'Görevi tamamla'}
          className="mt-0.5 shrink-0"
          disabled={isCompleting}
        >
          {isCompleting ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : isDone ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium truncate', isDone && 'line-through text-muted-foreground')}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[task.priority])}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            {task.due_date && (
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(task.due_date)}
              </span>
            )}
            {task.points > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <Star className="h-3 w-3" /> {task.points} puan
              </span>
            )}
          </div>
        </div>

        {assignee && (
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: assignee.profiles?.color ?? '#6366f1' }}
            title={assignee.profiles?.full_name}
            aria-label={`Atanan: ${assignee.profiles?.full_name}`}
          >
            {(assignee.profiles?.full_name ?? '?').charAt(0)}
          </div>
        )}
      </div>

      {/* Hızlı durum değiştirici */}
      {canEdit && (
        <select
          value={task.status}
          onChange={(e) => { e.stopPropagation(); onStatusChange(e.target.value as TaskStatus); }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Görev durumunu değiştir"
          className="w-full text-xs border rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="todo">Yapılacak</option>
          <option value="in_progress">Devam Ediyor</option>
          <option value="done">Tamamlandı</option>
        </select>
      )}
    </div>
  );
}
