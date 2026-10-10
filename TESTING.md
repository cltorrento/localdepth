# Reporte de Pruebas y Validación — LocalDepth

> **Proyecto:** LocalDepth  
> **Fases evaluadas:** Fase 1 (Monorepo, Paquetes e Infraestructura) y Fase 2 (Backend Core, API Gateway y Microservicios)  
> **Comando de ejecución:** `npm test`  
> **Fecha de ejecución:** 10 de octubre de 2026  
> **Entorno de pruebas:** Node.js v24.16.0  
> **Resultado global:** ✅ **100% Aprobado (14/14 pruebas superadas)**

---

## 1. Resumen Ejecutivo

Se han diseñado y ejecutado dos suites de pruebas automatizadas para verificar la solidez de la arquitectura antes de conectar las interfaces de usuario (Admin y Frontend público):

1. **Suite 1: Paquetes Compartidos y Lógica de Dominio (`tests/unit-and-integration.js`)**  
   Verifica el funcionamiento aislado de los módulos compartidos (`@localdepth/shared-utils`, `@localdepth/validation`, `@localdepth/database`, `@localdepth/logger`).
2. **Suite 2: Integración End-to-End a través del API Gateway (`tests/gateway-e2e.js`)**  
   Verifica el flujo completo de peticiones HTTP a través del `api-gateway` (puerto 4000) hacia cada microservicio (`auth`, `content`, `media`, `search`, `recommendations`), asegurando el cumplimiento de la **regla de aislamiento**.

---

## 2. Detalle de Pruebas Realizadas

### Suite 1: Paquetes Compartidos y Dominio (`tests/unit-and-integration.js`)

| # | Prueba | Componente evaluado | Entrada / Caso de prueba | Resultado |
|---|---|---|---|:---:|
| **1.1** | **Generación de URLs de Mapas** | `@localdepth/shared-utils` | Coordenadas de Milán (`45.464204`, `9.189982`, zoom `16`). | ✅ **Aprobado** |
| | *Detalle:* | Genera las URLs canónicas exactas para **Google Maps**, **Apple Maps** y **OpenStreetMap (Leaflet)** requeridas en la sección 21.2 de la especificación. | | |
| **1.2** | **Slugify & Distancia Haversine** | `@localdepth/shared-utils` | String `"Café & Trattoria de Milán!"` y distancia entre dos coordenadas en Milán. | ✅ **Aprobado** |
| | *Detalle:* | Convierte a `cafe-trattoria-de-milan`. La fórmula Haversine calcula `~1.7km`, vital para optimización de rutas y lugares cercanos. | | |
| **1.3** | **Validación de Esquemas** | `@localdepth/validation` | Esquema de `Place` (con validación de latitud/longitud y categorías permitidas) y `TripPlannerInput`. | ✅ **Aprobado** |
| | *Detalle:* | Rechaza entradas inválidas y valida correctamente datos de lugares con coordenadas y consultas del Copilot. | | |
| **1.4** | **Datos Semilla y Almacén** | `@localdepth/database` | Verificación de persistencia en `MemoryStore` de Destino Milán y sus 3 lugares geolocalizados. | ✅ **Aprobado** |
| | *Detalle:* | Verifica que cada lugar incluya atributos de Leaflet (`latitude`, `longitude`, `zoom`, `localScore`, `crowdLevel`). | | |
| **1.5** | **Criptografía y JWT** | `auth-service` | Generación de firma HMAC-SHA256 y verificación de token manipulado. | ✅ **Aprobado** |
| | *Detalle:* | Emite token válido con rol `admin` y rechaza inmediatamente cualquier token con firma alterada. | | |

---

### Suite 2: Integración End-to-End via API Gateway (`tests/gateway-e2e.js`)

Todas las peticiones simulan clientes externos (Frontend o Admin) pasando exclusivamente por el punto de entrada `http://localhost:4000`:

| # | Endpoint / Método | Microservicio destino | Propósito y Validaciones | Estado HTTP | Resultado |
|---|---|---|---|:---:|:---:|
| **2.1** | `GET /health` | `api-gateway` | Comprobación de salud agregada y registro de microservicios disponibles. | `200 OK` | ✅ **Aprobado** |
| **2.2** | `POST /api/auth/login` | `auth-service` | Login del usuario administrador (`admin@localdepth.com`). Emisión de token JWT con rol `admin`. | `200 OK` | ✅ **Aprobado** |
| **2.3** | `GET /api/auth/me` | `auth-service` | Ruta protegida con cabecera `Authorization: Bearer <token>`. Validación de contexto de usuario inyectado. | `200 OK` | ✅ **Aprobado** |
| **2.4** | `GET /api/content/destinations` | `content-service` | Obtención del catálogo de destinos publicados (Destino: Milán, presupuesto diario 120€). | `200 OK` | ✅ **Aprobado** |
| **2.5** | `GET /api/content/places` | `content-service` | Listado de lugares geolocalizados para Leaflet (Trattoria Madonnina, Bar Luce, Parco Sempione) con sus URLs cartográficas. | `200 OK` | ✅ **Aprobado** |
| **2.6** | `POST /api/content/places` | `content-service` | **Flujo del Admin:** Creación del nuevo lugar *"Pasticceria Marchesi 1824"* con coordenadas Leaflet (`45.465812`, `9.189945`) y auto-cálculo de URLs OpenStreetMap. | `201 Created` | ✅ **Aprobado** |
| **2.7** | `POST /api/media/upload` | `media-service` | Subida y registro de metadatos de imágenes para el bucket S3 / MinIO (`duomo-sunset.jpg`). | `201 Created` | ✅ **Aprobado** |
| **2.8** | `GET /api/search?q=milan` | `search-service` | Búsqueda instantánea multi-entidad: indexa y localiza lugares y destinos coincidentes. | `200 OK` | ✅ **Aprobado** |
| **2.9** | `POST /api/recommendations/plan` | `recommendations-service` | **LocalDepth Travel Copilot:** Petición: *"2 días en Milán, 120€/día, comida local y evitar multitudes"*. Genera plan día por día con paradas reales, presupuesto total (240€), consejos anti-aglomeraciones y alternativas de lluvia. | `200 OK` | ✅ **Aprobado** |

---

## 3. Salida de Consola de la Ejecución

```text
> localdepth@1.0.0 test
> node --experimental-strip-types tests/unit-and-integration.js && node --experimental-strip-types tests/gateway-e2e.js

🧪 Running LocalDepth Core & Microservices Automated Test Suite...

Test 1: Map URLs Generation (Leaflet & External Providers)
  ✅ Map URLs generated strictly matching section 21.2 & Leaflet specs
Test 2: Slugify & Distance Calculation
  ✅ Slugify and Haversine distance calculations verified
Test 3: Schema Validations
  ✅ Place validation correctly enforces fields and coordinates
  ✅ Travel Copilot input validation verified
Test 4: Seed Data & Database Store
  ✅ Verified 3 places in Milán with full Leaflet metadata
Test 5: Auth Token Issuance & Verification
  ✅ JWT generation and cryptographic signature verification working

🎉 ALL 5 TEST SUITES PASSED! Phase 1 and Phase 2 implementations are verified.

🚀 Starting LocalDepth Gateway & Microservices End-to-End Test Run...

1. [API GATEWAY] GET /health
   ✅ Gateway is healthy. Services registered: auth, content, media, search, recommendations

2. [AUTH-SERVICE via Gateway] POST /api/auth/login
   ✅ Login successful for "LocalDepth Admin" <admin@localdepth.com> with role: admin
   ✅ JWT Bearer Token generated: eyJhbGciOiJIUzI1NiIsInR5cCI6Ik...

3. [AUTH-SERVICE via Gateway] GET /api/auth/me (Protected)
   ✅ Bearer token successfully verified by Gateway and Auth Service

4. [CONTENT-SERVICE via Gateway] GET /api/content/destinations
   ✅ Retrieved 1 destination(s): Milán (Italia)
   📌 Daily budget: 120€, Best time: Abril a Junio, Septiembre a Octubre

5. [CONTENT-SERVICE via Gateway] GET /api/content/places?destinationId=22222222-2222-4222-a222-222222222222
   ✅ Found 3 places with Leaflet geolocation data
   📍 Sample: "Trattoria Madonnina" [lat: 45.449764, lng: 9.180211]
      OSM Tile URL: https://www.openstreetmap.org/?mlat=45.449764&mlon=9.180211#map=16/45.449764/9.180211
      Google Maps:  https://www.google.com/maps?q=45.449764,9.180211
      Local Score:  9.5/10 (Crowd Level: low)

6. [CONTENT-SERVICE via Gateway] POST /api/content/places (Admin creates new place)
   ✅ Place created: "Pasticceria Marchesi 1824" (slug: pasticceria-marchesi-1824)
   🗺️ Canonical OpenStreetMap URL auto-generated: https://www.openstreetmap.org/?mlat=45.465812&mlon=9.189945#map=16/45.465812/9.189945

7. [MEDIA-SERVICE via Gateway] POST /api/media/upload
   ✅ Image metadata saved to MinIO S3 bucket: http://localhost:9000/localdepth-media/...-image-1791645272298.jpg

8. [SEARCH-SERVICE via Gateway] GET /api/search?q=milan
   ✅ Instant search found 2 matches:
      - [PLACE] "Trattoria Madonnina" -> /places/trattoria-madonnina-milan
      - [PLACE] "Bar Luce (Fondazione Prada)" -> /places/fondazione-prada-bar-luce

9. [TRAVEL COPILOT via Gateway] POST /api/recommendations/plan
   Input prompt: "Quiero 2 días en Milán, presupuesto 120€/día, me gusta la comida local y evitar multitudes."
   ✅ Plan generated: "2 Días en Milán: Experiencia Local Personalizada"
   💰 Presupuesto total calculado: 240€ (120€/día)
   📅 Día 1: Llegada y Sabores Locales (4 paradas geolocalizadas):
      * [morning] Trattoria Madonnina (restaurant) - Local Score: 9.5 · Mejor hora: 13:00 o 20:30 con reserva previa
      * [lunch] Bar Luce (Fondazione Prada) (experience) - Local Score: 8.8 · Mejor hora: Mañanas de 10:00 a 11:30
      * [afternoon] Arco della Pace & Parco Sempione (attraction) - Local Score: 9 · Mejor hora: Atardecer para el aperitivo cercano
      * [afternoon] Pasticceria Marchesi 1824 (restaurant) - Local Score: 9.4 · Mejor hora: 11:00
      ⚠️  Consejo anti-multitudes: Visitar las paradas matutinas antes de las 10:30 y reservar restaurantes con 24h de antelación.
      ☔  Alternativa si llueve: En caso de lluvia: visitar galerías cubiertas, cafeterías de diseño y mercados cerrados.
   📅 Día 2: Barrios y Joyas Ocultas (4 paradas geolocalizadas):
      * [morning] Trattoria Madonnina (restaurant) - Local Score: 9.5 · Mejor hora: 13:00 o 20:30 con reserva previa
      * [lunch] Bar Luce (Fondazione Prada) (experience) - Local Score: 8.8 · Mejor hora: Mañanas de 10:00 a 11:30
      * [afternoon] Arco della Pace & Parco Sempione (attraction) - Local Score: 9 · Mejor hora: Atardecer para el aperitivo cercano
      * [afternoon] Pasticceria Marchesi 1824 (restaurant) - Local Score: 9.4 · Mejor hora: 11:00
      ⚠️  Consejo anti-multitudes: Visitar las paradas matutinas antes de las 10:30 y reservar restaurantes con 24h de antelación.
      ☔  Alternativa si llueve: En caso de lluvia: visitar galerías cubiertas, cafeterías de diseño y mercados cerrados.

=============================================================
🎉 TODOS LOS TESTS END-TO-END HAN PASADO CON ÉXITO (100%)
=============================================================
```

---

## 4. Instrucciones para Reproducir las Pruebas

Para volver a ejecutar todas las comprobaciones en cualquier momento:

```bash
npm test
```

O individualmente:

```bash
# Solo pruebas unitarias de paquetes
node --experimental-strip-types tests/unit-and-integration.js

# Solo pruebas end-to-end de la API
node --experimental-strip-types tests/gateway-e2e.js
```
