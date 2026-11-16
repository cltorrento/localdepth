# LocalDepth Platform

> **Travel deeper.**  
> Un medio editorial de viajes que convierte conocimiento local en planes interactivos y personalizables con el **LocalDepth Travel Copilot**.

---

## 🏛️ Arquitectura del Monorepo

```text
localdepth/
├── apps/
│   ├── frontend/                 → Guías de destino y portal público en Astro
│   └── admin/                    → Panel de control privado en React + Leaflet Picker (Fase 3)
├── services/                     → Backend de microservicios (Fase 2)
│   ├── api-gateway/              → Reverse proxy, JWT y CORS (Puerto 4000)
│   ├── auth-service/             → Usuarios, roles (admin/editor/author/brand) y JWT (Puerto 4001)
│   ├── content-service/          → Destinos, Lugares geolocalizados, Guías e Itinerarios (Puerto 4002)
│   ├── media-service/            → Gestión de imágenes y MinIO/S3 (Puerto 4003)
│   ├── search-service/           → Búsqueda multi-entidad y Meilisearch (Puerto 4004)
│   └── recommendations-service/  → Motor del Travel Copilot con IA (Puerto 4005)
├── packages/                     → Código compartido (Fase 1)
│   ├── shared-types/             → Definiciones TypeScript de entidades y contratos
│   ├── shared-utils/             → Generador de URLs Leaflet/Mapas, Haversine y slugify
│   ├── validation/               → Validadores de esquemas Zod-ready
│   ├── logger/                   → Logger estructurado JSON
│   └── database/                 → Migración PostgreSQL y repositorio persistente/en memoria
├── infra/
│   └── scripts/                  → Script de arranque y pruebas
├── api/                          → Función serverless de Vercel (gateway + servicios en un solo proceso)
├── supabase/                     → Migraciones SQL (se ejecutan a mano en el SQL Editor de Supabase)
├── vercel.json                   → Configuración de Vercel para el backend
└── tests/                        → Suite de pruebas automáticas
```

---

## 🚀 Puesta en Marcha

### 1. Requisitos Previos
- Node.js 22+ (o Node 24)
- Un proyecto de Supabase (opcional en local; sin `DATABASE_URL` se usa el almacenamiento en memoria)

### 2. Iniciar LocalDepth
```bash
npm start
```

El comando instala las dependencias con `npm install` si faltan y arranca el backend, el frontend y el panel admin. Pulsa `Ctrl+C` para detener todos los procesos.

### Traducciones del sitio

El selector de idioma ofrece español, inglés, italiano y alemán. Para traducir las guías con DeepL, crea una cuenta de DeepL API Free y copia `.env.example` a `.env` en la raíz del proyecto. Añade tu clave privada:

```dotenv
DEEPL_API_KEY=tu_clave_de_deepl
```

Reinicia `npm start` después de guardar el archivo. La clave solo se usa en el servidor; no la incluyas en el frontend ni la compartas. Las traducciones de destinos se guardan en el registro del destino; las guías de muestra se traducen y se mantienen en caché mientras el frontend está en ejecución.

### Planificador de viajes por correo

El botón «Planifica tu viaje» abre el formulario localizado. Las solicitudes se guardan en PostgreSQL y se eliminan al cumplir 12 meses. El envío usa Resend: configura `RESEND_API_KEY` y sustituye `EMAIL_FROM` en el `.env` raíz por una dirección verificada en tu cuenta de Resend. La tabla `trip_leads` se crea de forma idempotente; el backend limpia las solicitudes vencidas a diario y al recibir nuevas solicitudes. Si PostgreSQL, DeepL o Resend no están disponibles, el formulario informa del error en lugar de confirmar un envío inexistente.

La casilla para recibir sugerencias es opcional e independiente del consentimiento necesario para generar y enviar el itinerario. La preferencia se guarda junto con la solicitud para gestionar futuras comunicaciones.

Para iniciar únicamente los microservicios del backend:
```bash
npm run start:services
```

El backend expone:
- **API Gateway:** `http://localhost:4000`
- **Auth Service:** `http://localhost:4001`
- **Content Service:** `http://localhost:4002`
- **Media Service:** `http://localhost:4003`
- **Search Service:** `http://localhost:4004`
- **Recommendations Service:** `http://localhost:4005`

### Guías de ciudad

Las tarjetas del cuaderno enlazan a guías con diez lugares destacados, mapa y seis platos típicos con fotos e ingredientes,
transporte, consejos y preguntas frecuentes. Cada guía incluye enlaces para compartir en Facebook y WhatsApp,
copiar el enlace para Instagram y abrir las opciones nativas de compartir. La ficha lateral muestra la moneda y el presupuesto
diario. Las guías de ejemplo están en `apps/frontend/src/data/posts.ts`.
Las ciudades publicadas desde el panel de administración aparecen en el cuaderno y en su propia
URL sin reconstruir el frontend. Para publicar una ciudad, el formulario solicita portada,
coordenadas, temporada, presupuesto, idioma, transporte, diez lugares geolocalizados, comida
típica con foto y al menos dos ingredientes por plato (se requieren seis), consejos y preguntas frecuentes.
Las guías públicas también se pueden abrir directamente desde cada destino publicado en el panel.
El almacenamiento local incluye guías de muestra para Milán, Ciudad de México y San Salvador.

---

## 📡 Endpoints del API Gateway (`http://localhost:4000`)

Todos los clientes (Frontend y Admin) pasan **exclusivamente** por el API Gateway:

| Prefijo | Servicio Destino | Descripción |
|---|---|---|
| `GET /health` | API Gateway | Estado general de salud |
| `POST /api/auth/login` | `auth-service` | Login y obtención de token JWT |
| `POST /api/auth/register` | `auth-service` | Registro de nuevos usuarios |
| `GET /api/auth/me` | `auth-service` | Perfil del usuario autenticado |
| `GET /api/content/destinations` | `content-service` | Listado y filtro de destinos |
| `GET /api/content/destinations/top-rated?limit=100` | `content-service` | Destinos publicados ordenados por valoración media (límite configurable, máximo 100) |
| `GET /api/content/destinations/:slug/engagement` | `content-service` | Valoración media, total de votos y últimos 50 comentarios |
| `POST /api/content/destinations/:slug/comments` | `content-service` | Publica un comentario (nombre hasta 50 y texto hasta 1000 caracteres) |
| `POST /api/content/destinations/:slug/ratings` | `content-service` | Guarda o actualiza una valoración de 1 a 5 por identificador de navegador |
| `GET /api/content/places` | `content-service` | Lugares con cálculo automático de URLs Leaflet |
| `POST /api/content/places` | `content-service` | Creación de lugares con validación de coordenadas |
| `GET /api/content/itineraries` | `content-service` | Itinerarios estructurados |
| `GET /api/media` | `media-service` | Biblioteca multimedia |
| `POST /api/media/upload` | `media-service` | Subida de archivos / imágenes |
| `GET /api/search?q=...` | `search-service` | Búsqueda rápida multi-entidad |
| `POST /api/recommendations/plan` | `recommendations-service`| **Travel Copilot:** Generación de itinerarios |
| `POST /api/recommendations/plan-and-send` | `recommendations-service` | Validación, almacenamiento consentido y envío del itinerario por correo |

Los comentarios de destinos publicados se muestran inmediatamente. Comentarios y valoraciones se guardan en PostgreSQL; una persona puede cambiar su puntuación desde el mismo navegador. El enlace de Instagram copia la URL de la guía para pegarla en una publicación o historia.

---

## 🧪 Pruebas Automatizadas

Para validar las utilidades geográficas, validaciones, JWT, API Gateway y microservicios:
```bash
npm test
```

Para ver el informe detallado de las pruebas ejecutadas y casos validados, consulta [TESTING.md](file:///Users/cltorrento/sites/localdepth/TESTING.md).

---

## 🗄️ Base de datos: Supabase

1. Crea un proyecto en Supabase.
2. En el **SQL Editor** ejecuta, en orden, los archivos de `supabase/` (`001` a `006`; el `006_rls.sql` activa Row Level Security).
3. Copia la cadena **Transaction pooler** (puerto 6543) de *Project Settings → Database* y ponla en `DATABASE_URL` (`.env` en local, variables de entorno en Vercel).

El backend se conecta con `pg` usando esa URL; no hay `docker compose`.

## ▲ Despliegue en Vercel

Tres proyectos de Vercel, cada uno con su *Root Directory*:

| Proyecto | Root Directory | Variables |
|---|---|---|
| API (`api/[...path].ts`) | `.` (raíz) | `DATABASE_URL`, `JWT_SECRET`, `DEEPL_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` |
| Frontend (Astro) | `apps/frontend` | `LOCALDEPTH_API_URL` = `https://<api>.vercel.app/api` |
| Admin (Vite) | `apps/admin` | `VITE_API_URL` = `https://<api>.vercel.app/api` |

```bash
npx vercel deploy --prod --yes
```
