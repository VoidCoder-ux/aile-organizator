# 🏠 Akıllı Aile Organizatörü

> Takvim, görevler, alışveriş listesi ve yemek planını tek uygulamada birleştiren, **çevrimdışı çalışabilen**, **gerçek zamanlı senkronize** aile PWA'sı.

**Demo:** `https://YOUR_GITHUB_USERNAME.github.io/aile-organizator/`

---

## Özellikler

| Özellik | Açıklama |
|---|---|
| 🗓️ **Takvim** | Renk kodlu kullanıcı katmanları, çakışma uyarısı, tekrarlı etkinlikler |
| ✅ **Görevler** | Atama, öncelik, puan sistemi, ebeveyn/çocuk görünüm |
| 🛒 **Alışveriş** | Kategori sıralama, anlık realtime sync, offline ekleme |
| 🍽️ **Yemek Planı** | Haftalık grid, tarif kitaplığı, malzemeleri listeye aktar |
| 🔔 **Offline Sync** | IndexedDB queue → bağlantı gelince otomatik sync |
| 👨‍👩‍👧 **Rol Sistemi** | Parent / Child / Guest yetki kademeleri |
| 📱 **PWA** | iOS/Android/Desktop'a kurulabilir, çevrimdışı çalışır |

---

## Hızlı Kurulum

### 1. Repoyu Klonla

```bash
git clone https://github.com/YOUR_USERNAME/aile-organizator.git
cd aile-organizator
```

### 2. Bağımlılıkları Yükle

```bash
npm install
```

### 3. Supabase Projesi Oluştur

1. [supabase.com](https://supabase.com) → **New Project**
2. Proje oluşturulduktan sonra **SQL Editor** → **New Query**
3. `supabase/migrations/001_initial_schema.sql` içeriğini yapıştır → **Run**
4. Tekrar **New Query** → `supabase/migrations/002_rls_policies.sql` → **Run**
5. **Settings → API** → Project URL ve anon key'i kopyala

### 4. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```
VITE_SUPABASE_URL=https://PROJE_IDINIZ.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
```

### 5. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

Tarayıcıda `http://localhost:5173/aile-organizator/` açılır.

---

## GitHub Pages Deploy

### A. GitHub Repo Oluştur

```bash
git init
git add .
git commit -m "feat: initialize smart family organizer PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aile-organizator.git
git push -u origin main
```

### B. GitHub Secrets Ekle

GitHub Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Adı | Değer |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

### C. GitHub Pages Aktif Et

Repo → **Settings → Pages → Source: GitHub Actions**

> Deploy sonrası `https://YOUR_USERNAME.github.io/aile-organizator/` adresinde yayında.

### D. Otomatik Deploy

`main` branch'e her push'ta GitHub Actions otomatik build + deploy yapar.

---

## PWA Kurulumu

### iOS (Safari)
1. Safari'de uygulama adresini aç
2. Paylaş butonu → **Ana Ekrana Ekle**
3. Uygulama adını onayla → **Ekle**

### Android (Chrome)
1. Chrome'da adresi aç
2. Adres çubuğundaki **Yükle** ikonuna tıkla
3. Veya: ⋮ menüsü → **Ana ekrana ekle**

### Desktop (Chrome/Edge)
1. Adres çubuğu sağındaki yükle ikonuna tıkla
2. **Yükle** butonuna bas

---

## Aile Davet Sistemi

1. İlk kullanıcı **Ebeveyn** olarak aile oluşturur
2. Ayarlar → **Aile Davet Kodu** görüntülenir (6 haneli)
3. Kodu aile üyeleriyle paylaşın (WhatsApp, SMS...)
4. Diğer kullanıcılar uygulamaya girip **Katıl** → kodu girer
5. Ebeveyn üye rollerini Ayarlar'dan yönetir

---

## Çevrimdışı Kullanım

- İnternet olmadan takvim, liste ve görevler **görüntülenebilir ve düzenlenebilir**
- Değişiklikler otomatik **IndexedDB kuyruğuna** alınır
- Bağlantı gelince **otomatik Supabase'e push edilir**
- Çakışma olursa **"Son değişiklik kaydedildi"** uyarısı gösterilir

---

## Veritabanı Şeması

```
profiles          ← auth.users ile 1:1
families          ← invite_code ile üye davet
family_members    ← role: parent|child|guest
events            ← takvim etkinlikleri (recurrence, assigned_to[])
tasks             ← görevler (priority, points, assigned_to)
shopping_items    ← alışveriş (category, is_checked)
recipes           ← tarifler (ingredients JSONB)
meals             ← haftalık yemek planı
notifications     ← bildirimler
```

---

## Güvenlik

- **Anon key** frontend'de kullanılabilir — RLS tüm erişimi filtreler
- **Service role key** ASLA frontend'e eklenmez
- Tüm tablolarda **Row Level Security (RLS) aktif**
- Her INSERT/UPDATE öncesi **family_id validasyonu** (trigger)
- Kullanıcı sadece **kendi family_id**'sine ait veriyi okur/yazar

---

## Geliştirme

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run preview      # Build önizleme
npm run type-check   # TypeScript kontrolü
npm run lint         # ESLint
node scripts/generate-icons.mjs  # PWA ikonlarını üret
```

---

## Troubleshooting

| Sorun | Çözüm |
|---|---|
| `Supabase credentials eksik` | `.env` dosyasını kontrol edin |
| Beyaz ekran | `vite.config.ts` içinde `base: "/aile-organizator/"` doğru mu? |
| Realtime çalışmıyor | Supabase → Settings → Realtime aktif mi? |
| PWA yüklenmiyor | HTTPS gereklidir. GitHub Pages kullanın |
| RLS hatası | SQL migrationları çalıştırıldı mı? |
| Icon eksik | `node scripts/generate-icons.mjs` çalıştırın |

---

## Teknoloji Yığını

- **Frontend:** Vite 5 + React 18 + TypeScript
- **Stil:** TailwindCSS + shadcn/ui komponentleri
- **State:** Zustand
- **Router:** React Router DOM 6 (Hash Router)
- **Backend:** Supabase (PostgreSQL + Realtime + Auth + RLS)
- **Offline:** IndexedDB (idb) + Background Sync Queue
- **PWA:** vite-plugin-pwa (Workbox)
- **Deploy:** GitHub Pages + GitHub Actions

---

## Lisans

MIT License — Özgürce kullanın, değiştirin ve dağıtın.
