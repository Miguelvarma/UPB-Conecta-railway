import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import type { GetCampusMap } from '../../application/GetCampusMap.js';
import type { SelectBuildingLevel } from '../../application/SelectBuildingLevel.js';
import { CampusFailureKind, type CampusFailure } from '../../application/CampusResults.js';

export interface CampusUseCases {
  readonly getMap: Pick<GetCampusMap, 'execute'>;
  readonly selectLevel: Pick<SelectBuildingLevel, 'execute'>;
}

const DEFAULT_CAMPUS_ID = 'bucaramanga';
const ID_PATTERN = /^[a-z0-9-]{1,64}$/;

/**
 * Contrato REST del mapa del campus (HU-25: RF-37, RF-41). Exige sesion y es
 * de solo lectura.
 *
 * - `GET /campus/map?categories=a,b`: campus, bloques, edificios con niveles
 *   y puntos de interes de las categorias visibles (todas si no se indica;
 *   `categories=` vacio las oculta todas).
 * - `GET /campus/buildings/:buildingId?level=n1&categories=a,b`: un edificio
 *   en un nivel (el mas bajo si no se indica) con sus puntos de interes.
 *
 * Las coordenadas son WGS84; la app las pinta sobre la cartografia que use.
 */
export function createCampusRouter(useCases: CampusUseCases, requireSession: RequestHandler): Router {
  const router = Router();
  router.use('/campus', requireSession);

  router.get('/campus/map', (req: Request, res: Response, next: NextFunction) => {
    const categories = parseCategoryList(req.query['categories']);
    if (!categories.ok) return badRequest(res, 'invalid-category', 'categories debe ser una lista separada por comas.');
    useCases.getMap
      .execute({
        campusId: DEFAULT_CAMPUS_ID,
        ...(categories.value === undefined ? {} : { visibleCategories: categories.value })
      })
      .then((result) => {
        if (!result.ok) return sendFailure(res, result);
        res.status(200).json(result);
      })
      .catch(next);
  });

  router.get('/campus/buildings/:buildingId', (req: Request, res: Response, next: NextFunction) => {
    const buildingId = req.params['buildingId'] ?? '';
    const level = req.query['level'];
    const categories = parseCategoryList(req.query['categories']);
    if (!ID_PATTERN.test(buildingId)) return badRequest(res, 'invalid-building', 'El identificador del edificio no es valido.');
    if (level !== undefined && (typeof level !== 'string' || !ID_PATTERN.test(level))) {
      return badRequest(res, 'invalid-level', 'level debe ser el identificador de un nivel.');
    }
    if (!categories.ok) return badRequest(res, 'invalid-category', 'categories debe ser una lista separada por comas.');
    useCases.selectLevel
      .execute({
        campusId: DEFAULT_CAMPUS_ID,
        buildingId,
        ...(level === undefined ? {} : { levelId: level }),
        ...(categories.value === undefined ? {} : { visibleCategories: categories.value })
      })
      .then((result) => {
        if (!result.ok) return sendFailure(res, result);
        res.status(200).json(result);
      })
      .catch(next);
  });

  return router;
}

type ParsedCategories = { readonly ok: true; readonly value: readonly string[] | undefined } | { readonly ok: false };

function parseCategoryList(raw: unknown): ParsedCategories {
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== 'string' || raw.length > 500) return { ok: false };
  const value = raw.split(',').map((c) => c.trim()).filter((c) => c !== '');
  return { ok: true, value };
}

function badRequest(res: Response, error: string, message: string): void {
  res.status(400).json({ ok: false, error, message });
}

function sendFailure(res: Response, failure: CampusFailure): void {
  const notFound = failure.error !== CampusFailureKind.UNKNOWN_CATEGORY;
  res.status(notFound ? 404 : 400).json(failure);
}
