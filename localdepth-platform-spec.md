# LocalDepth — Especificación de producto y arquitectura

> **Marca:** LocalDepth  
> **Dominio:** `localdepth.com`  
> **Tagline:** *Travel deeper.*  
> **Posicionamiento:** un blog de viajes que no solo informa, sino que convierte conocimiento local en planes personalizables.

---

## 1. Objetivo del producto

**LocalDepth** es un medio editorial de viajes para viajeros que quieren experiencias locales, comida auténtica, cultura y planes prácticos.

La propuesta central es:

> **Un blog de viajes que no solo informa, sino que convierte conocimiento local en planes personalizables.**

### Ejemplo de experiencia

El usuario escribe:

> “Quiero 2 días en Milán, presupuesto medio, me gusta la comida local y evitar multitudes.”

El sistema responde con:

- Itinerario día por día.
- Mapa con paradas.
- Presupuesto estimado.
- Recomendaciones para evitar multitudes.
- Alternativas si llueve.
- Artículos relacionados.
- Opción de guardar, editar y exportar.

---

## 2. Diferenciador: LocalDepth Travel Copilot

La innovación no es “tener IA”, sino convertir contenido editorial en planes accionables.

**LocalDepth Travel Copilot** permite:

1. Elegir destino, fechas, presupuesto e intereses.
2. Recibir un itinerario día por día.
3. Ver los lugares en un mapa interactivo.
4. Guardar, editar y exportar el plan.
5. Recibir recomendaciones basadas en preferencias.
6. Encontrar contenido relacionado.
7. Acceder a consejos para evitar multitudes.
8. Obtener alternativas según clima.
9. Recibir sugerencias de presupuesto.
10. Guardar lugares favoritos.

### Ejemplo de interacción

**Usuario:**

> “Quiero 3 días en Roma, presupuesto de 100 euros al día, me gusta la comida local y no quiero museos.”

**LocalDepth:**

- Día 1: barrio Trastevere, comida local y paseo al atardecer.
- Día 2: mercados, barrios menos turísticos y experiencias gastronómicas.
- Mapa con rutas y rutas alternativas.
- Presupuesto dinámico.
- Consejos para evitar multitudes.
- Artículos relacionados.
- Opción de guardar y exportar.

### Principio de IA

La IA no debe “inventar” recomendaciones. Debe seleccionar y ordenar lugares ya validados en la base editorial, citar fuentes y mostrar cuándo una información puede estar desactualizada.

---

## 3. Funciones innovadoras

### 3.1 Trip Planner con IA

Un asistente que convierte una petición en un itinerario real:

> “Tengo 3 días en Milán, presupuesto de 120 euros al día, me gusta la comida local y no quiero museos.”

El resultado debe ser:

- Itinerario día por día.
- Horarios.
- Rutas.
- Costes.
- Mapa.
- Alternativas si llueve.
- Enlaces guardados.
- Recomendaciones basadas en preferencias.

### 3.2 Mapas vivos con Leaflet

No hagas mapas decorativos. Conviértelos en una capa útil:

- Mapa por lugar con pin, foto, horario y botón “Get directions”.
- Mapa de barrio con restaurantes, cafeterías, miradores y paradas cercanas.
- Mapa de itinerario con ruta diaria y orden lógico de visitas.
- Filtros: “a pie”, “con vistas”, “barato”, “para desayunar”, “sin turistas”.
- Capas: comida, comida local, arte, naturaleza, transporte y experiencias.
- Ruta optimizada por proximidad, no solo una lista de lugares.

### 3.3 Perfil de viaje

Pide muy pocos datos y úsalos para personalizar:

- Días disponibles.
- Presupuesto.
- Intereses: comida, arte, naturaleza, arquitectura, vida nocturna.
- Ritmo: relajado, equilibrado o intenso.
- Restricciones: movilidad, dieta, viaje con niños.

Con eso puedes mostrar itinerarios distintos para la misma ciudad.

### 3.4 “Local Score”

Crea una métrica propia y reconocible:

- **Local Score:** qué tan local es una experiencia.
- **Value Score:** relación entre precio, tiempo y experiencia.
- **Crowd Level:** estimación de aglomeración.
- **Best time:** mejor hora para visitarlo.
- **Walkability:** si se puede hacer caminando.

Esto te diferencia de un blog genérico y te da un activo propio para SEO, newsletter y colaboraciones con destinos.

### 3.5 Guías interactivas

En lugar de un artículo largo y plano, cada guía puede tener:

- Mapa con itinerario.
- Presupuesto dinámico.
- Tiempo estimado.
- Lista de paradas.
- Alternativas por clima.
- “Copy to Google Maps”.
- PDF descargable.
- Versión para ahorrar o versión premium.

Esto convierte cada guía en un producto utilizable.

### 3.6 Contenido generado con IA, revisado por humanos

Puedes usar IA para acelerar producción:

- Convertir notas, fotos y videos en borradores.
- Generar FAQs, resúmenes y variantes SEO.
- Detectar huecos de contenido.
- Crear resúmenes para redes.
- Sugerir artículos relacionados.
- Traducir borradores, con revisión humana.

Pero publica contenido con autoría humana, revisión editorial y evidencia. Eso protege calidad y confianza.

---

## 4. Estructura del producto

```text
1. Contenido editorial de alta calidad
2. Páginas de destino y lugares
3. Mapas interactivos con Leaflet
4. Itinerarios descargables
5. Newsletter
6. Búsqueda
7. Recomendaciones basadas en preferencias
8. Panel de administración completo
```

---

## 5. Arquitectura general

```text
Usuario
  ↓
Frontend público (Astro)
  ↓
API Gateway
  ↓
Microservicios backend
  ├── Auth
  ├── Content
  ├── Media
  ├── Search
  ├── Recommendations
  ├── Newsletter
  ├── Analytics
  ├── Trips
  └── Workers
```

### Stack recomendado

```text
Frontend: Astro + TypeScript + Tailwind CSS
Admin: React + Vite + Tailwind
Backend: Node.js 22 + TypeScript
Base de datos: PostgreSQL
Cache y colas: Redis
Archivos: MinIO / S3 / Cloudflare R2
Mapas: Leaflet + OpenStreetMap / MapTiler
Búsqueda: Meilisearch
Email: Resend / Postmark / SES
Infraestructura: Docker + Docker Compose
```

---

## 6. Módulos obligatorios

### 6.1 Módulo de contenido

- Crear, editar y publicar destinos.
- Crear, editar y publicar guías.
- Crear, editar y publicar artículos.
- Crear y editar lugares.
- Crear itinerarios.
- Asignar imágenes.
- Gestionar SEO.
- Gestionar enlaces de afiliación.

### 6.2 Motor de recomendaciones

- Basado en intereses, presupuesto, duración y temporada.
- Recomendaciones de lugares, itinerarios y artículos.
- Explicación de por qué se recomienda.
- Filtros por presupuesto, tipo de experiencia y temporada.

### 6.3 Mapas con Leaflet

- Mapa por lugar.
- Mapa de barrio.
- Mapa de itinerario.
- Soporte para uno o varios pines.
- Ruta diaria.
- Enlaces externos.

### 6.4 Búsqueda

- Búsqueda de destinos, guías, guías, artículos y lugares.
- Sugerencias automáticas.
- Indexación de contenido.
- Filtros por tipo, presupuesto, duración y clima.

### 6.5 Email y newsletter

- Captación de leads.
- Lead magnets.
- Secuencias de bienvenida.
- Campañas.
- Analítica de emails.

### 6.6 Administración

- Gestión de usuarios.
- Gestión de roles.
- Gestión de permisos.
- Auditoría de acciones.

---

## 7. Estructura del monorepo

```text
localdepth/
├── apps/
│   ├── frontend/
│   └── admin/
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── content-service/
│   ├── media-service/
│   ├── search-service/
│   ├── recommendations-service/
│   ├── email-service/
│   ├── analytics-service/
│   └── worker-service/
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   ├── database/
│   ├── logger/
│   ├── validation/
│   └── ui/
├── infra/
│   ├── docker/
│   ├── nginx/
│   ├── traefik/
│   └── scripts/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── content-model.md
│   └── deployment.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 8. Modelo de datos

### 8.1 Destination

```ts
Destination {
  id: UUID
  slug: string
  name: string
  type: "country" | "region" | "city"
  parentId: UUID | null
  country: string
  description: string
  heroImageId: UUID
  bestTimeToVisit: string
  currency: string
  language: string
  averageDailyBudget: number
  latitude: number
  longitude: number
  status: "draft" | "published"
}
```

### 8.2 Guide

```ts
Guide {
  id: UUID
  slug: string
  title: string
  excerpt: string
  content: JSON
  destinationId: UUID
  guideType: "itinerary" | "day-trip" | "food" | "budget" | "budget" | "transport" | "general"
  durationDays: number
  estimatedBudget: number
  difficulty: "easy" | "moderate" | "hard"
  heroImageId: UUID
  images: UUID[]
  places: string[]
  faqs: FAQ[]
  related: string[]
  status: "draft" | "published"
}
```

### 8.3 Place

```ts
Place {
  id: UUID
  slug: string
  name: string
  destinationId: UUID
  category: "category"
  description: string
  address: string | null
  latitude: number | null
  longitude: number | null
  zoom: number | null
  googleMapsUrl: string | null
  appleMapsUrl: string | null
  openStreetMapUrl: string | null
  priceLevel: 1 | 2 | 3 | 4 | null
  openingHours: JSON | null
  images: string[]
  tags: string[]
  status: "draft" | "published"
}
```

### 8.4 Itinerary

```ts
Itinerary {
  id: UUID
  slug: string
  title: string
  destinationId: UUID
  totalDays: number
  totalBudget: number
  summary: string
  days: ItineraryDay[]
  guideId: string | null
  status: "draft" | "published"
}
```

### 8.5 Recommendation

```ts
Recommendation {
  id: UUID
  userId: string
  type: "place" | "guide" | "article"
  score: number
  reason: string
}
```

---

## 9. Ejemplos de recomendaciones

### Ejemplo 1: Milán

**Usuario:**

> “Tengo 3 días en Milán, presupuesto de 120 euros al día, me gusta la comida local y no quiero museos.”

**Respuesta:**

- Itinerario de 3 días.
- Mapa con rutas.
- Restaurantes locales.
- Barrios recomendados.
- Alternativas si llueve.
- Consejos para evitar multitudes.
- Artículos relacionados.

### Ejemplo 2: Roma

**Usuario:**

> “Quiero 2 días en Roma, presupuesto de 100 euros al día, me gusta la comida romana y evitar multitudes.”

**Sistema:**

- Itinerario día por día.
- Barrios menos turísticos.
- Restaurantes recomendados.
- Consejos para evitar multitudes.
- Mapa con rutas.
- Artículos relacionados.

### Ejemplo 3: Barcelona

**Usuario:**

> “Quiero 3 días en Barcelona, presupuesto medio, me gusta la comida catalana y evitar zonas muy turísticas.”

**Sistema:**

- Itinerario día por día.
- Mapa con rutas.
- Restaurantes locales.
- Consejos para evitar multitudes.
- Artículos relacionados.

---

## 10. Experiencia de usuario

### 10.1 Onboarding

El usuario introduce:

- Destino.
- Fechas.
- Presupuesto.
- Intereses.
- Ritmo.

### 10.2 Resultado

El sistema devuelve:

- Itinerario día por día.
- Mapa con paradas.
- Presupuesto estimado.
- Recomendaciones.
- Alternativas.
- Artículos relacionados.

### 10.3 Acciones

- Guardar itinerario.
- Editar itinerario.
- Exportar PDF.
- Compartir enlace.
- Guardar favoritos.

---

## 11. Diseño de interfaz

### 11.1 Home

- Hero con propuesta de valor.
- Buscador de destino.
- Destinos destacados.
- Guías populares.
- Guías recientes.
- Itinerarios destacados.
- CTA de newsletter.

### 11.2 Página de destino

- Hero con imagen.
- Datos clave.
- Guías relacionadas.
- Lugares destacados.
- Mapa.
- CTA de newsletter.

### 11.2 Página de lugar

- Imagen principal.
- Descripción.
- Mapa Leaflet.
- Precio aproximado.
- Horarios.
- Consejos.
- Botón “Get directions”.
- Lugares cercanos.
- Artículos relacionados.

---

## 12. Perfil de viaje

El usuario puede guardar:

- Destinos favoritos.
- Preferencias.
- Presupuesto.
- Itinerarios.
- Lugares favoritos.

---

## 13. Recomendaciones

El sistema puede recomendar:

- Destinos.
- Lugares.
- Guías.
- Artículos.
- Itinerarios.

### 13.2 Ejemplos

- “Si te gusta la comida local, te recomendamos…”
- “Si buscas experiencias menos turísticas, te sugerimos…”
- “Si tu presupuesto es bajo, te recomendamos…”
- “Si viajas con niños, te recomendamos…”
- “Si prefieres caminar, te recomendamos…”

---

## 14. Personalización

La personalización se basa en:

- Destino.
- Fechas.
- Presupuesto.
- Intereses.
- Ritmo.

---

## 15. Reglas de contenido

- La IA debe usar contenido ya validado.
- La IA debe citar fuentes.
- La IA debe indicar cuándo una información puede estar desactualizada.
- El contenido debe ser revisado por humanos.
- Cada guía debe tener al menos una recomendación.
- Cada guía debe tener un mapa.
- Cada guía debe tener un CTA.
- Cada guía debe tener alternativas por clima.

---

## 16. Criterios de éxito

El sistema se considera innovador si:

1. No solo informa, sino que convierte conocimiento en planes.
2. Usa datos editoriales validados.
3. Permite personalización real.
4. Genera ingresos por afiliación.
5. Mantiene confianza y transparencia.
6. Evita recomendaciones genéricas.
7. Es útil para planificar viajes.
8. Es difícil de copiar.

---

## 17. Diferenciador final

Tu innovación no debería ser “tener IA”, sino ofrecer:

> **Un blog de blogs que convierte conocimiento local en planes personalizables.**

Ejemplo:

> “Quiero 2 días en Milán, presupuesto medio, me gusta la comida local y evitar multitudes.”

El sistema responde con:

- Itinerario día por día.
- Mapa con paradas.
- Presupuesto estimado.
- Alternativas si llueve.
- Consejos para evitar multitudes.
- Artículos relacionados.
- Opción de guardar y descargar.

Eso es un sitio útil, innovador y difícil de copiar.

---

## 18. Instrucciones para Antigravity

Implementa LocalDepth como un proyecto con:

- Backend: microservicios Node.js/TypeScript.
- Frontend: Astro + Tailwind.
- Admin: panel para crear y gestionar contenido.
- Base de datos: PostgreSQL por microservicio.
- Infraestructura: Docker + Docker Compose.
- Mapas: Leaflet + OpenStreetMap/MapTiler.
- Búsqueda: Meilisearch.
- Email: Resend o Postmark.
- Automatización: n8n.

### 18.2 Ejemplo de petición

```text
“Tengo 3 días en Roma, presupuesto de 100 euros al día, me gusta la comida romana y evitar multitudes.”
```

### 18.3 Respuesta esperada

- Itinerario día por día.
- Mapa con paradas.
- Presupuesto estimado.
- Recomendaciones.
- Alternativas si llueve.
- Consejos para evitar multitudes.
- Artículos relacionados.
- Opción de guardar y descargar.

---

## 19. Criterios de aceptación del MVP

El proyecto se considera completo cuando:

1. `docker compose up -d` levanta todo el sistema.
2. El frontend público consume el API Gateway.
3. El admin permite crear destinos, guías, lugares y lugares.
4. El usuario puede crear itinerarios.
5. El sistema genera recomendaciones.
6. El usuario puede guardar y exportar.
7. Existe un admin con permisos.
8. El sistema puede desplegarse en un VPS con Docker.
