import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { EMAIL, PASSWORD, STUDENT_PROFILE, startHttp } from './httpHarness.js';
import { createAuthRouter } from '../../src/contexts/identity/infrastructure/http/authRoutes.js';
import { requireSession } from '../../src/contexts/identity/infrastructure/http/requireSession.js';
import { createCampusRouter } from '../../src/contexts/campus/infrastructure/http/campusRoutes.js';
import { GetCampusMap } from '../../src/contexts/campus/application/GetCampusMap.js';
import { SelectBuildingLevel } from '../../src/contexts/campus/application/SelectBuildingLevel.js';
import { InMemoryCampusCatalogRepository } from '../../src/contexts/campus/infrastructure/adapters/out/memory/InMemoryCampusCatalogRepository.js';
import { ClientRenderedMapProvider } from '../../src/contexts/campus/infrastructure/adapters/out/client/ClientRenderedMapProvider.js';
import { loadCampusCatalog } from '../../src/contexts/campus/infrastructure/config/JsonCampusCatalogLoader.js';
import { buildSessionHarness } from '../identity/sessionHarness.js';

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

const seed = loadCampusCatalog();

async function start() {
  const identity = buildSessionHarness();
  identity.provider.register({ username: EMAIL, password: PASSWORD, profile: STUDENT_PROFILE });
  const catalog = new InMemoryCampusCatalogRepository([seed]);
  const mapProvider = new ClientRenderedMapProvider();
  return startHttp(
    [
      createAuthRouter(identity.authenticate, { refresh: identity.refresh, logout: identity.logout }),
      createCampusRouter(
        {
          getMap: new GetCampusMap({ catalog, mapProvider }),
          selectLevel: new SelectBuildingLevel({ catalog, mapProvider })
        },
        requireSession(identity.verifyAccess)
      )
    ],
    (created) => {
      server = created;
    }
  );
}

describe('Mapa del campus por HTTP con sesión real (HU-25)', () => {
  it('exige sesión', async () => {
    const { call } = await start();
    expect((await call('GET', '/campus/map')).status).toBe(401);
    expect((await call('GET', '/campus/buildings/edificio-a')).status).toBe(401);
  });

  it('devuelve el campus con edificios, niveles y todos los puntos de interés', async () => {
    const { call, token } = await start();
    const res = await call('GET', '/campus/map', { token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, campusId: 'bucaramanga', center: seed.center });
    const buildings = (res.body['blocks'] as { buildings: { id: string }[] }[]).flatMap((b) => b.buildings);
    expect(buildings.map((b) => b.id)).toContain('edificio-a');
    expect(res.body['pointsOfInterest']).toHaveLength(seed.pointsOfInterest.length);
  });

  it('filtra por categorías y las vacías ocultan todo', async () => {
    const { call, token } = await start();
    const onlyParking = await call('GET', '/campus/map?categories=parqueadero', { token });
    expect(onlyParking.status).toBe(200);
    expect((onlyParking.body['pointsOfInterest'] as { category: string }[]).every((p) => p.category === 'parqueadero')).toBe(true);
    const none = await call('GET', '/campus/map?categories=', { token });
    expect(none.body['pointsOfInterest']).toEqual([]);
  });

  it('rechaza una categoría desconocida con 400', async () => {
    const { call, token } = await start();
    const res = await call('GET', '/campus/map?categories=cajero', { token });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: 'unknown-category' });
  });

  it('abre un edificio en el nivel pedido o en el más bajo', async () => {
    const { call, token } = await start();
    const lowest = await call('GET', '/campus/buildings/edificio-a', { token });
    expect(lowest.status).toBe(200);
    expect(lowest.body).toMatchObject({ ok: true, buildingId: 'edificio-a', level: { id: 'n0' }, canSwitchLevel: true });
    const second = await call('GET', '/campus/buildings/edificio-a?level=n2', { token });
    expect((second.body['pointsOfInterest'] as { levelId: string }[]).every((p) => p.levelId === 'n2')).toBe(true);
  });

  it('edificio o nivel inexistentes dan 404 y un identificador mal formado da 400', async () => {
    const { call, token } = await start();
    expect((await call('GET', '/campus/buildings/no-existe', { token })).status).toBe(404);
    expect((await call('GET', '/campus/buildings/edificio-a?level=n9', { token })).status).toBe(404);
    expect((await call('GET', '/campus/buildings/EDIFICIO_A', { token })).status).toBe(400);
    expect((await call('GET', '/campus/buildings/edificio-a?level=N%201', { token })).status).toBe(400);
  });
});
