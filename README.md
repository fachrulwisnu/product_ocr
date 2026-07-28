# Nanonets ATM Receipt OCR & Instant Learning Platform

Platform OCR dan Instant Learning khusus struk ATM (ATM Receipt Ingestion, Review Queue, Annotations, Spatial AI Extraction LayoutLMv3, dan Continuous Training Studio).

---

## 🚀 Cara Menjalankan Project (Local / Development)

Aplikasi ini dibangun menggunakan arsitektur **Full-Stack Express.js + Vite (React + TypeScript)**. Seluruh backend API, OCR engine, dan frontend UI disatukan dalam satu runtime Node.js.

> ⚠️ **Catatan Penting:** Anda **TIDAK** membutuhkan Python, Uvicorn, Docker, atau Redis tambahan untuk menjalankan project ini. Semua REST API dan OCR processing berjalan di server Node.js / Express.

### Langkah-langkah Run Local:

1. **Pastikan Prasyarat Terinstall:**
   - Node.js version `18.x`, `20.x`, atau `22.x` (LTS)
   - npm (terinstall bersama Node.js)

2. **Clone / Buka Folder Project:**
   ```bash
   cd atm-ocr-platform
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Konfigurasi Environment Variable (`.env`):**
   Buat file `.env` di root project (salin dari `.env.example`):
   ```env
   # API Keys (Opsional untuk fitur live NVIDIA OCR & Supabase)
   NVIDIA_API_KEY="nvapi-your-key"
   
   # Supabase Database
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```

5. **Jalankan Application Server:**
   ```bash
   npm run dev
   ```
   Aplikasi dan REST API langsung aktif di:
   👉 **http://localhost:3000**

---

## 🗄️ Skema Database Supabase

Gunakan skema SQL DDL berikut di Supabase SQL Editor untuk membuat tabel database `projects`, `images`, `ocr_results`, `ocr_blocks`, dan `labels`:

```sql
-- 1. Tabel Projects
create table projects (
    id uuid primary key default gen_random_uuid(),
    name varchar(200) not null,
    description text,
    document_type varchar(100),
    status varchar(30) default 'ACTIVE',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Tabel Images
create table images (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references projects(id) on delete cascade,
    filename text,
    original_filename text,
    storage_path text,
    image_width integer,
    image_height integer,
    file_size bigint,
    mime_type varchar(100),
    upload_status varchar(30) default 'UPLOADED',
    uploaded_at timestamptz default now()
);

-- 3. Tabel OCR Results
create table ocr_results (
    id uuid primary key default gen_random_uuid(),
    image_id uuid references images(id) on delete cascade,
    provider varchar(50),
    raw_text text,
    raw_json jsonb,
    confidence numeric(5,2),
    processing_time_ms integer,
    created_at timestamptz default now()
);

-- 4. Tabel OCR Blocks (Bounding Box Spatial Coordinates)
create table ocr_blocks (
    id uuid primary key default gen_random_uuid(),
    ocr_result_id uuid references ocr_results(id) on delete cascade,
    page integer default 1,
    text text,
    confidence numeric(5,2),
    x1 numeric,
    y1 numeric,
    x2 numeric,
    y2 numeric,
    x3 numeric,
    y3 numeric,
    x4 numeric,
    y4 numeric
);

-- 5. Tabel Labels
create table labels (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references projects(id) on delete cascade,
    name varchar(100),
    color varchar(20),
    created_at timestamptz default now()
);
```

---

## 🛠️ Fitur Utama Platform

1. **Dashboard & Metrics Fleet:** Ringkasan performa akurasi model LayoutLMv3, status pelatihan instant learning, serta queue review struk ATM.
2. **Receipt Ingestion & NVIDIA NIM OCR:** Ingesti gambar struk (penarikan tunai, cek saldo, setoran, laporan kaset) dengan NVIDIA NIM OCR API.
3. **Interactive Visual Bounding Box Annotator:** Koreksi langsung posisi bounding box spatial OCR dan label field secara presisi.
4. **Nanonets Instant Learning Studio:** Pelatihan model spatial layout hanya dengan 3-5 sampel koreksi manusia untuk mendongkrak akurasi hingga 95%+.
5. **Dataset Manager:** Export dataset berlabel ke format **JSON**, **CSV**, atau **Excel**.
6. **REST API & Live Console:** Endpoint API publik (`/api/upload`, `/api/ocr`, `/api/predict`, `/api/train`, `/api/export`).

---

## ⚡ Build Produk Production

Untuk memproduksi bundle production:

```bash
# Build frontend Vite & Express server
npm run build

# Jalankan production server
npm run start
```
