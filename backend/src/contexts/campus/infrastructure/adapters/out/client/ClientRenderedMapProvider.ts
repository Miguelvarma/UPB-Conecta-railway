import type { MapProviderPort, MapScene } from '../../../../domain/ports/out/MapProviderPort.js';

/**
 * Proveedor de cartografia del servidor HTTP. El mapa lo dibuja la app
 * Android con la escena que devuelve la API, asi que en el servidor no hay
 * nada que pintar. A diferencia de `InMemoryMapProvider` no guarda las
 * escenas, para no acumular memoria en produccion.
 */
export class ClientRenderedMapProvider implements MapProviderPort {
  readonly providerName = 'client-rendered';

  async render(_scene: MapScene): Promise<void> {
    // El cliente dibuja la escena a partir de la respuesta HTTP.
  }
}
