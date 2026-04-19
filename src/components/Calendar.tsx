/**
 * Calendar — Aile Takvimi
 * Aylık/haftalık görünüm, renk kodlu kullanıcı katmanları,
 * çakışma uyarısı, tekrarlı etkinlikler, drag-drop sıralama.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  isWithinInterval,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, AlertTriangle } from 'lucide-react';
import { cn, formatTime, generateId } from '@/lib/utils';
import { supabase, TABLES } from '@/lib/supabaseClient';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import type { CalendarEvent, FamilyMember } from '@/types';

interface CalendarProps {
  familyId: string;
  userId: string;
  members: FamilyMember[];
  canCreate?: boolean;
}

// ── Etkinlik Formu ───────────────────────────────────────────────────────────

interface EventFormData {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  location: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
}

const DEFAULT_FORM: EventFormData = {
  title: '',
  description: '',
  start_at: new Date().toISOString().slice(0, 16),
  end_at: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
  all_day: false,
  color: '#6366f1',
  location: '',
  recurrence: 'none',
};

const COLOR_PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function Calendar({ familyId, userId, members, canCreate = true }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(
    new Set(members.map((m) => m.user_id))
  );

  // members değişince visibleUsers'ı senkronla (RPC sonrası yüklenen üyeleri kapsa)
  useEffect(() => {
    setVisibleUsers((prev) => {
      const next = new Set(prev);
      for (const m of members) {
        if (!next.has(m.user_id)) next.add(m.user_id);
      }
      return next;
    });
  }, [members]);

  const { writeOfflineFirst } = useOfflineSync();

  // Etkinlikleri yükle
  const fetchEvents = useCallback(async () => {
    const start = startOfMonth(currentDate).toISOString();
    const end = endOfMonth(currentDate).toISOString();

    const { data, error } = await supabase
      .from(TABLES.EVENTS)
      .select('*')
      .eq('family_id', familyId)
      .gte('start_at', start)
      .lte('end_at', end)
      .order('start_at');

    if (!error && data) setEvents(data as CalendarEvent[]);
  }, [familyId, currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime sync
  useRealtimeSync<CalendarEvent>({
    table: TABLES.EVENTS,
    familyId,
    onInsert: (record) => setEvents((prev) => [...prev, record]),
    onUpdate: (record) => setEvents((prev) => prev.map((e) => (e.id === record.id ? record : e))),
    onDelete: (record) => setEvents((prev) => prev.filter((e) => e.id !== record.id)),
  });

  // Takvim grid günleri
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Belirli bir güne ait etkinlikleri getir
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((e) => {
      const start = parseISO(e.start_at);
      const end = parseISO(e.end_at);
      return (
        isSameDay(day, start) ||
        (isWithinInterval(day, { start, end }) && !isSameDay(day, end))
      );
    }).filter((e) => {
      // Görünür kullanıcı filtresi (assigned_to boş/null ise tüm aileye açık)
      const assigned = e.assigned_to ?? [];
      if (assigned.length === 0) return true;
      return assigned.some((uid) => visibleUsers.has(uid));
    });
  };

  // Çakışma kontrolü
  const checkConflicts = (startAt: string, endAt: string, excludeId?: string): boolean => {
    const newStart = parseISO(startAt);
    const newEnd = parseISO(endAt);
    return events.some((e) => {
      if (e.id === excludeId) return false;
      const eStart = parseISO(e.start_at);
      const eEnd = parseISO(e.end_at);
      return newStart < eEnd && newEnd > eStart;
    });
  };

  // Modal aç
  const openCreateModal = (date?: Date) => {
    setEditingEvent(null);
    const base = date ? format(date, "yyyy-MM-dd'T'09:00") : DEFAULT_FORM.start_at;
    setForm({
      ...DEFAULT_FORM,
      start_at: base,
      end_at: date ? format(date, "yyyy-MM-dd'T'10:00") : DEFAULT_FORM.end_at,
    });
    setConflictWarning(null);
    setShowModal(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? '',
      start_at: event.start_at.slice(0, 16),
      end_at: event.end_at.slice(0, 16),
      all_day: event.all_day,
      color: event.color,
      location: event.location ?? '',
      recurrence: event.recurrence === 'yearly' ? 'none' : event.recurrence,
    });
    setConflictWarning(null);
    setShowModal(true);
  };

  // Form değişikliği
  const handleFormChange = (field: keyof EventFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'start_at' || field === 'end_at') {
      const start = field === 'start_at' ? value as string : form.start_at;
      const end = field === 'end_at' ? value as string : form.end_at;
      if (checkConflicts(start, end, editingEvent?.id)) {
        setConflictWarning('Bu zaman diliminde başka bir etkinlik var!');
      } else {
        setConflictWarning(null);
      }
    }
  };

  // Kaydet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      id: editingEvent?.id ?? generateId(),
      family_id: familyId,
      created_by: userId,
      title: form.title,
      description: form.description || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      all_day: form.all_day,
      color: form.color,
      location: form.location || null,
      recurrence: form.recurrence,
      recurrence_end_date: null,
      assigned_to: [],
      reminder_minutes: null,
    };

    const { queued, error: writeError } = await writeOfflineFirst(
      TABLES.EVENTS,
      editingEvent ? 'UPDATE' : 'INSERT',
      payload as Record<string, unknown>
    );

    setIsSubmitting(false);

    if (queued && writeError) {
      // Online'sa ama Supabase reddettiyse: kullanıcıya bildir
      alert(`Etkinlik kaydedilemedi: ${writeError}`);
      return;
    }

    // Optimistic UI: tarih aralığında ise listeye ekle
    const optimistic = payload as unknown as CalendarEvent;
    if (editingEvent) {
      setEvents((prev) => prev.map((ev) => (ev.id === optimistic.id ? optimistic : ev)));
    } else {
      setEvents((prev) => [...prev.filter((ev) => ev.id !== optimistic.id), optimistic]);
    }

    setShowModal(false);
    // Sunucudan tekrar çekerek doğrula (offline ise zaten optimistic UI kullanılır)
    fetchEvents();
  };

  // Sil
  const handleDelete = async (eventId: string) => {
    await writeOfflineFirst(TABLES.EVENTS, 'DELETE', { id: eventId });
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setShowModal(false);
  };

  const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div className="space-y-4">
      {/* ── Başlık & Navigasyon ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          aria-label="Önceki ay"
          className="rounded-full p-2 hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <h2 className="font-bold text-lg capitalize" aria-live="polite">
          {format(currentDate, 'MMMM yyyy', { locale: tr })}
        </h2>

        <button
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          aria-label="Sonraki ay"
          className="rounded-full p-2 hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* ── Kullanıcı Renk Filtreleri ── */}
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const profile = m.profiles;
          const color = profile?.color ?? '#6366f1';
          const name = profile?.full_name ?? 'Üye';
          const isVisible = visibleUsers.has(m.user_id);
          return (
            <button
              key={m.user_id}
              onClick={() => {
                setVisibleUsers((prev) => {
                  const next = new Set(prev);
                  if (next.has(m.user_id)) next.delete(m.user_id);
                  else next.add(m.user_id);
                  return next;
                });
              }}
              aria-pressed={isVisible}
              aria-label={`${name} etkinliklerini ${isVisible ? 'gizle' : 'göster'}`}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-opacity',
                !isVisible && 'opacity-40'
              )}
              style={{ borderColor: color, color: isVisible ? color : undefined }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* ── Grid ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Gün başlıkları */}
        <div className="grid grid-cols-7 bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Günler */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day);
                  if (canCreate) openCreateModal(day);
                }}
                aria-label={`${format(day, 'd MMMM', { locale: tr })}, ${dayEvents.length} etkinlik`}
                className={cn(
                  'relative min-h-[64px] p-1 text-left border-b border-r text-sm transition-colors hover:bg-accent/50',
                  !isCurrentMonth && 'opacity-40',
                  isSelected && 'bg-accent',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday && 'bg-primary text-primary-foreground font-bold'
                  )}
                >
                  {format(day, 'd')}
                </span>

                {/* Etkinlik çizgileri (max 3) */}
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); openEditModal(event); }}
                      className="rounded px-1 text-xs truncate cursor-pointer"
                      style={{
                        backgroundColor: event.color + '33',
                        borderLeft: `2px solid ${event.color}`,
                        color: event.color,
                      }}
                      title={event.title}
                    >
                      {event.all_day ? event.title : `${formatTime(event.start_at)} ${event.title}`}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayEvents.length - 3} daha
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Yeni Etkinlik Butonu ── */}
      {canCreate && (
        <button
          onClick={() => openCreateModal()}
          className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Yeni etkinlik ekle"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 id="event-modal-title" className="font-bold text-lg">
                {editingEvent ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Kapat"
                className="rounded-full p-1.5 hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="event-title" className="block text-sm font-medium mb-1">Başlık *</label>
                <input
                  id="event-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  required
                  placeholder="Etkinlik adı"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="event-start" className="block text-sm font-medium mb-1">Başlangıç</label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => handleFormChange('start_at', e.target.value)}
                    required
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="event-end" className="block text-sm font-medium mb-1">Bitiş</label>
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => handleFormChange('end_at', e.target.value)}
                    required
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {conflictWarning && (
                <div role="alert" className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {conflictWarning}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Renk</label>
                <div className="flex gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleFormChange('color', c)}
                      aria-label={`Renk: ${c}`}
                      aria-pressed={form.color === c}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform',
                        form.color === c && 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="event-recurrence" className="block text-sm font-medium mb-1">Tekrarlama</label>
                <select
                  id="event-recurrence"
                  value={form.recurrence}
                  onChange={(e) => handleFormChange('recurrence', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="none">Tekrarlanmaz</option>
                  <option value="daily">Her gün</option>
                  <option value="weekly">Her hafta</option>
                  <option value="monthly">Her ay</option>
                </select>
              </div>

              <div>
                <label htmlFor="event-location" className="block text-sm font-medium mb-1">Konum</label>
                <input
                  id="event-location"
                  type="text"
                  value={form.location}
                  onChange={(e) => handleFormChange('location', e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {editingEvent && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEvent.id)}
                    className="flex-1 rounded-lg border border-destructive py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Sil
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
