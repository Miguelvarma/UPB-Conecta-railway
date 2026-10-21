# Contexto de campus (HU-25)

> Documentación específica de este contexto acotado. Para la visión general del proyecto y la arquitectura, ver el [README raíz](../../../README.md).

**HU-25 (SCRUM-37): mapa interactivo del campus de Bucaramanga con puntos de interés categorizados.** Trazabilidad: RF-37, RF-41, RNF-06, RNF-42. Épica EP-06.

## Alcance

Se entregan el catálogo de espacios, los casos de uso que el módulo de mapa invoca, el puerto del proveedor de cartografía y la capa HTTP de solo lectura que consume la app Android.

| Pieza | Capa | Rol |
|---|---|---|
| `CampusCatalog` (campus, bloques, edificios, niveles, puntos de interés) | Dominio | Agregado propio con coordenadas |
| `PoiCategory` | Dominio | Cafetería, biblioteca, bienestar, coordinación, punto de atención, parqueadero, servicio sanitario |
| `assertValidCampusCatalog` | Dominio (servicio) | Integridad: ids únicos, coordenadas válidas, referencias a edificio y nivel |
| `filterPointsOfInterest` | Dominio (servicio) | Filtro por categoría, edificio y nivel |
| `CampusCatalogRepositoryPort`, `MapProviderPort` | Puertos | |
| `GetCampusMap`, `FilterPointsOfInterest`, `SelectBuildingLevel` | Aplicación | Criterios 1, 3 y 4 |
| `InMemoryCampusCatalogRepository`, `InMemoryMapProvider`, `loadCampusCatalog` | Infraestructura | Repositorio y doble del proveedor; carga de `config/campus-catalog.json` |
| `ClientRenderedMapProvider` | Infraestructura | Proveedor del servidor HTTP: no dibuja nada porque el mapa lo pinta la app |
| `createCampusRouter` | Infraestructura (HTTP) | `GET /campus/map` y `GET /campus/buildings/:buildingId`, con sesión |

## Decisiones

1. **El catálogo es del dominio, no una capa del proveedor.** `MapProviderPort.render(scene)` recibe una escena con tipos del dominio (centro, marcadores, foco en un nivel) y no devuelve datos. Sustituir el proveedor implica escribir otro adaptador de ese puerto; ni el catálogo ni los casos de uso cambian (criterio 5).
2. **Datos semilla como configuración.** `config/campus-catalog.json` se valida al cargarse. Los edificios A a L, el templo y los parqueaderos son los del campus de Floridablanca con las coordenadas del centro de cada contorno en la cartografía abierta (exportación de octubre de 2026). **El número de niveles de cada edificio y la ubicación de cafeterías, biblioteca, coordinaciones y baños son provisionales**: deben confirmarse con la Universidad.
3. **Puntos de interés en un edificio llevan nivel; al aire libre no** (por ejemplo, parqueaderos). La validación lo exige.
4. **Sin `MongoCampusCatalogRepository`.** El catálogo se lee del archivo de configuración; una colección solo haría falta si se edita en línea (historia futura).

## API HTTP

| Método y ruta | Respuesta |
|---|---|
| `GET /campus/map?categories=a,b` | Campus, bloques, edificios (con coordenadas y niveles) y puntos de interés de las categorías visibles. Sin `categories`, todas; con `categories=` vacío, ninguna |
| `GET /campus/buildings/:buildingId?level=n1&categories=a,b` | Un edificio en un nivel (el más bajo si no se indica), sus niveles y sus puntos de interés |

Ambas exigen sesión (`401` sin token). Una categoría desconocida da `400`; un edificio o nivel inexistente, `404`.

## Autorización (HU-46)

Los casos de uso son de solo lectura para cualquier estudiante autenticado; sus nombres no coinciden con verbos administrativos, por lo que no requieren entrada en `config/protected-operations.json`.

## Criterios de aceptación y pruebas

Todas en `tests/campus/CampusMap.test.ts`.

| # | Criterio | Estado |
|---|---|---|
| 1 | Campus con bloques, edificios y niveles | Datos y caso de uso cubiertos (› criterio 1). El dibujo en pantalla es del cliente Android: diferido |
| 2 | Desplazamiento y zoom en menos de 2 s | Diferido: es rendimiento de renderizado en el cliente (`Frontend/`, Compose) |
| 3 | Filtrar siete categorías | Cubierto (› criterio 3) |
| 4 | Alternar niveles de un edificio | Cubierto (› criterio 4) |
| 5 | Cambiar de proveedor sin tocar catálogo ni dominio | Cubierto (› criterio 5: dos proveedores, misma respuesta, catálogo intacto y sin vocabulario de proveedor) |

## Pendientes

- **Cliente Android:** renderizado del mapa y medición del criterio 2 (RNF-06).
- **Coordenadas y niveles definitivos** del catálogo (ver decisión 2).
- **HU-15 criterio 5** depende de este catálogo de espacios (ubicación de una convocatoria en el campus): debe consultar `CampusCatalogRepositoryPort`.
