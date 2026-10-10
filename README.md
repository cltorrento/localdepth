# LocalDepth Platform

> **Travel deeper.**  
> Un medio editorial de viajes que convierte conocimiento local en planes interactivos y personalizables con el **LocalDepth Travel Copilot**.

---

## 🏛️ Arquitectura del Monorepo

```text
localdepth/
├── apps/
│   ├── frontend/                 → Portal público en Astro + Leaflet (Fase 4)
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
│   ├── docker/                   → Configuraciones Docker
│   └── scripts/                  → Script de arranque y pruebas
├── docker-compose.yml            → Postgres, Redis, MinIO y Meilisearch
├── docker-compose.prod.yml       → Configuración para producción
└── tests/                        → Suite de pruebas automáticas
```

---

## 🚀 Puesta en Marcha

### 1. Requisitos Previos
- Node.js 22+ (o Node 24)
- Docker y Docker Compose (opcional para desarrollo local con soporte en memoria)

### 2. Infraestructura Docker (PostgreSQL, Redis, MinIO, Meilisearch)
```bash
docker compose up -d
```

### 3. Ejecutar los Microservicios del Backend
```bash
npm run dev
# o
npm run start:services
```

Levanta concurrentemente:
- **API Gateway:** `http://localhost:4000`
- **Auth Service:** `http://localhost:4001`
- **Content Service:** `http://localhost:4002`
- **Media Service:** `http://localhost:4003`
- **Search Service:** `http://localhost:4004`
- **Recommendations Service:** `http://localhost:4005`

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
| `GET /api/content/places` | `content-service` | Lugares con cálculo automático de URLs Leaflet |
| `POST /api/content/places` | `content-service` | Creación de lugares con validación de coordenadas |
| `GET /api/content/itineraries` | `content-service` | Itinerarios estructurados |
| `GET /api/media` | `media-service` | Biblioteca multimedia |
| `POST /api/media/upload` | `media-service` | Subida de archivos / imágenes |
| `GET /api/search?q=...` | `search-service` | Búsqueda rápida multi-entidad |
| `POST /api/recommendations/plan` | `recommendations-service`| **Travel Copilot:** Generación de itinerarios |

---

## 🧪 Pruebas Automatizadas

Para validar las utilidades geográficas, validaciones, JWT, API Gateway y microservicios:
```bash
npm test
```

Para ver el informe detallado de las pruebas ejecutadas y casos validados, consulta [TESTING.md](file:///Users/cltorrento/sites/localdepth/TESTING.md).

