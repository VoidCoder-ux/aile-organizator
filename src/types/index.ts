// ─────────────────────────────────────────────────────────────────────────────
// Akıllı Aile Organizatörü — Merkezi Tip Tanımları
// Supabase DB şemasıyla birebir uyumlu
// ─────────────────────────────────────────────────────────────────────────────

// ── Kullanıcı & Aile Rolleri ──────────────────────────────────────────────────

export type FamilyRole = 'parent' | 'child' | 'guest';

export interface Profile {
  id: string;               // auth.users.id ile aynı
  email: string;
  full_name: string;
  avatar_url: string | null;
  color: string;            // Takvimde kullanıcı rengi (#hex)
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  invite_code: string;      // 6 haneli aile davet kodu
  created_by: string;       // profiles.id
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  nickname: string | null;
  joined_at: string;
  // İlişkili profil (join ile gelir)
  profiles?: Profile;
}

// ── Takvim Etkinlikleri ───────────────────────────────────────────────────────

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarEvent {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  start_at: string;           // ISO 8601
  end_at: string;             // ISO 8601
  all_day: boolean;
  color: string;              // #hex
  recurrence: RecurrenceType;
  recurrence_end_date: string | null;
  assigned_to: string[];      // profiles.id dizisi
  location: string | null;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
}

// ── Görevler ──────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  family_id: string;
  created_by: string;
  assigned_to: string | null;   // profiles.id
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  points: number;               // Çocuk gamification puanları
  created_at: string;
  updated_at: string;
  // İlişkili profil
  assignee?: Profile;
}

// ── Alışveriş Listesi ─────────────────────────────────────────────────────────

export type ShoppingCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'frozen'
  | 'beverages'
  | 'snacks'
  | 'household'
  | 'personal_care'
  | 'other';

export interface ShoppingItem {
  id: string;
  family_id: string;
  added_by: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: ShoppingCategory;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  note: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Yemek Planlayıcı ─────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Recipe {
  id: string;
  family_id: string;
  created_by: string;
  name: string;
  description: string | null;
  ingredients: RecipeIngredient[];
  instructions: string | null;
  prep_time_minutes: number | null;
  servings: number | null;
  image_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Meal {
  id: string;
  family_id: string;
  created_by: string;
  recipe_id: string | null;
  meal_date: string;            // YYYY-MM-DD
  meal_type: MealType;
  custom_name: string | null;   // Tarif yoksa özel ad
  notes: string | null;
  created_at: string;
  updated_at: string;
  // İlişkili tarif
  recipes?: Recipe;
}

// ── Bildirimler ───────────────────────────────────────────────────────────────

export type NotificationType = 'task_assigned' | 'task_due' | 'event_reminder' | 'shopping_added' | 'member_joined';

export interface AppNotification {
  id: string;
  user_id: string;
  family_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ── Offline Queue ─────────────────────────────────────────────────────────────

export type OfflineOperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OfflineQueueItem {
  id: string;               // UUID (client-side)
  table: string;
  operation: OfflineOperationType;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  conflictDetected?: boolean;
}

// ── UI State ──────────────────────────────────────────────────────────────────

export interface AppSettings {
  largeFontMode: boolean;
  highContrast: boolean;
  colorBlindMode: boolean;
  notifications: boolean;
  language: 'tr' | 'en';
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  conflictCount: number;
}

// ── Zustand Store Tipleri ─────────────────────────────────────────────────────

export interface AuthState {
  user: Profile | null;
  family: Family | null;
  familyMembers: FamilyMember[];
  role: FamilyRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface CalendarState {
  events: CalendarEvent[];
  selectedDate: string;
  viewMode: 'month' | 'week' | 'day';
  isLoading: boolean;
}

export interface TaskState {
  tasks: Task[];
  filter: { status: TaskStatus | 'all'; assignee: string | 'all' };
  isLoading: boolean;
}

export interface ShoppingState {
  items: ShoppingItem[];
  filter: ShoppingCategory | 'all';
  isLoading: boolean;
}

export interface MealState {
  meals: Meal[];
  recipes: Recipe[];
  weekStart: string;
  isLoading: boolean;
}
