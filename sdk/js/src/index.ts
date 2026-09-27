/**
 * OnDexMap rasmiy SDK'si.
 *
 * Ikki mustaqil qism:
 *
 *   createMap()    — xaritani to'g'ri sozlab yaratadi (atribut majburiy)
 *   createClient() — REST API: geocode, reverse, directions, places
 *
 * Ikkalasini alohida ishlatish mumkin: faqat REST kerak bo'lsa
 * `maplibre-gl` o'rnatilishi shart emas.
 */

export { createMap, type CreateMapOptions } from "./map.js";

export {
  createClient,
  OnDexMapClient,
  type ClientOptions,
  type QuotaInfo,
  type GeocodeResponse,
  type GeocodeMatch,
  type ReverseResponse,
  type DirectionsResponse,
  type PlacesResponse,
  type PlaceDetail,
} from "./client.js";

export { OnDexMapError, isQuotaExceeded, isKeyProblem } from "./errors.js";

export { clampBBox, bboxParam, type BBox, type BoundsLike } from "./bbox.js";

export {
  SERVICE_AREA,
  REVERSE_AREA,
  BBOX_SPAN,
  GEOCODE_MAX_LIMIT,
  DEFAULT_API_BASE,
  DEFAULT_STYLE_URL,
  COPYRIGHT_URL,
  type PlanName,
} from "./limits.js";
