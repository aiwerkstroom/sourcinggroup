/**
 * Mock source adapter for pijler 2 (SOURCING_SPEC.md §1, §7 step 1, §8) -
 * zero external calls. Mock-first for the same reason Stripe and
 * Supabase are: a third-party scraper (the Apify/RapidAPI class of
 * service SOURCING_SPEC.md §1 names) is a network dependency this
 * sandbox's egress policy would block exactly like it blocks
 * api.stripe.com and *.supabase.co, so it is never worth attempting from
 * here.
 *
 * Swapping this out for the real scraper adapter is meant to stay one
 * file: replace this file's body with a client for the chosen API,
 * keeping the two exported functions' names and signatures
 * (`searchListings`, `getListingDetail`) and returning the same
 * source-neutral `Listing`/`ListingDetail` shapes (types.ts). Every
 * caller - the search page, later the wizard-prefill - only ever depends
 * on this file's exported shape, not on how the data was produced, the
 * same convention lib/payments/stripe-mock.ts and
 * lib/auth/auth-memory.ts already established.
 *
 * SERVER-SIDE ONLY. A real adapter would carry an API key; nothing here
 * should ever reach a client bundle, so every caller of these two
 * functions must be a Server Component or a Route Handler. The
 * bundle-sweep discipline that already covers TSG_SCORE_DIMENSION_WEIGHTS
 * and the payment registry applies here too (SOURCING_SPEC.md §8).
 *
 * The 30 listings below are hand-authored, not procedurally generated -
 * the same choice this project already made for referenceCase.ts and
 * pdf-export.test.ts's secondCase: concrete, reviewable fixtures a test
 * can name and assert exact values against, rather than a seeded
 * generator whose output has to be trusted rather than read. Prices are
 * directionally plausible relative to Valencia-area 2025 sale prices and
 * scaled loosely against NEIGHBORHOOD_RENT_LONG_TERM's own relative
 * ordering (El Carmen and Ruzafa command the highest rents there and the
 * highest mock sale prices here) - but they are illustrative test data,
 * not a SOURCED claim the way parameters.ts's own tables are. No
 * calculation may ever treat them as one.
 */

import type { Listing, ListingDetail, SearchCriteria } from "./types";

/**
 * Mirrors stripe-mock.ts's own simulated-latency pattern: a real scraper
 * call costs real network time, so the loading states built on top of
 * this module should be honest in a browser - but 400ms per call adds up
 * fast across a test suite, hence the same env override and the same
 * vitest.setup.ts wiring that already zeroes it for Stripe's mock.
 */
const DEFAULT_LATENCY_MS = 400;

function simulatedLatencyMs(): number {
  const configured = Number(process.env.TSG_SOURCE_MOCK_LATENCY_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_LATENCY_MS;
}

function delay(): Promise<void> {
  const ms = simulatedLatencyMs();
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PHOTO = (id: string, n: number) => `https://mock-source.internal/photos/${id}-${n}.jpg`;
const URL_FOR = (id: string) => `https://mock-source.internal/listings/${id}`;

/**
 * The canonical fixture. searchListings() strips this down to `Listing`
 * (a real search-results page is thinner than a detail page too);
 * getListingDetail() returns it whole. sourceId order is not
 * significant - searchListings() does not promise an order beyond what
 * its own filters imply.
 */
const MOCK_LISTINGS: readonly ListingDetail[] = [
  {
    sourceId: "mock-001",
    title: "Lichte 2-kamerwoning nabij Mercado Central",
    neighborhood: "Valencia City",
    priceEUR: 235000,
    builtAreaM2: 78,
    usableAreaM2: 72,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-001"),
    photoUrls: [PHOTO("mock-001", 1), PHOTO("mock-001", 2)],
    listedDate: "2026-06-02",
    description: "Gerenoveerd appartement op de derde verdieping, dicht bij het centrum.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1968,
    energyLabel: "D",
  },
  {
    sourceId: "mock-002",
    title: "Compacte studio, ideaal voor verhuur",
    neighborhood: "Valencia City",
    priceEUR: 148000,
    builtAreaM2: 42,
    propertyType: "studio",
    sourceUrl: URL_FOR("mock-002"),
    listedDate: "2026-07-10",
    description: "Kleine studio zonder lift, populair bij studenten.",
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    constructionYear: 1975,
    energyLabel: "E",
  },
  {
    sourceId: "mock-003",
    title: "Appartement op loopafstand van het strand",
    neighborhood: "Alboraya",
    priceEUR: 245000,
    builtAreaM2: 85,
    usableAreaM2: 80,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-003"),
    photoUrls: [PHOTO("mock-003", 1)],
    listedDate: "2026-05-20",
    description: "Ruim appartement met balkon, vijf minuten van de kust.",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 2004,
    energyLabel: "C",
  },
  {
    sourceId: "mock-004",
    title: "Penthouse met groot terras",
    neighborhood: "Alboraya",
    priceEUR: 340000,
    builtAreaM2: 110,
    usableAreaM2: 95,
    propertyType: "penthouse",
    sourceUrl: URL_FOR("mock-004"),
    photoUrls: [PHOTO("mock-004", 1), PHOTO("mock-004", 2), PHOTO("mock-004", 3)],
    listedDate: "2026-06-28",
    description: "Penthouse met 40m² terras en zicht op zee.",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 2012,
    energyLabel: "B",
  },
  {
    sourceId: "mock-005",
    title: "Vrijstaande woning in rustige straat",
    neighborhood: "Godella",
    priceEUR: 385000,
    builtAreaM2: 140,
    usableAreaM2: 130,
    propertyType: "woonhuis",
    sourceUrl: URL_FOR("mock-005"),
    listedDate: "2026-04-15",
    description: "Ruime gezinswoning met tuin en garage.",
    rooms: 6,
    bedrooms: 4,
    bathrooms: 2,
    constructionYear: 1998,
    energyLabel: "D",
  },
  {
    sourceId: "mock-006",
    title: "Appartement dicht bij het dorpscentrum",
    neighborhood: "Godella",
    priceEUR: 178000,
    builtAreaM2: 68,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-006"),
    photoUrls: [PHOTO("mock-006", 1)],
    listedDate: "2026-07-01",
    description: "Instapklaar appartement met twee slaapkamers.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1985,
    energyLabel: "E",
  },
  {
    sourceId: "mock-007",
    title: "Villa met zeezicht en zwembad",
    neighborhood: "Canet d'En Berenguer",
    priceEUR: 480000,
    builtAreaM2: 210,
    usableAreaM2: 195,
    propertyType: "villa",
    sourceUrl: URL_FOR("mock-007"),
    photoUrls: [PHOTO("mock-007", 1), PHOTO("mock-007", 2)],
    listedDate: "2026-03-22",
    description: "Vrijstaande villa met privézwembad, uitzicht op zee.",
    rooms: 7,
    bedrooms: 5,
    bathrooms: 3,
    constructionYear: 2006,
    energyLabel: "C",
  },
  {
    sourceId: "mock-008",
    title: "Appartement in kustdorp, dicht bij de haven",
    neighborhood: "Canet d'En Berenguer",
    priceEUR: 165000,
    builtAreaM2: 72,
    usableAreaM2: 68,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-008"),
    listedDate: "2026-06-14",
    description: "Appartement op de tweede verdieping, vlak bij het strand.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1992,
    energyLabel: "D",
  },
  {
    sourceId: "mock-009",
    title: "Studio vlak bij het strand van Cullera",
    neighborhood: "Cullera",
    priceEUR: 72000,
    builtAreaM2: 38,
    propertyType: "studio",
    sourceUrl: URL_FOR("mock-009"),
    photoUrls: [PHOTO("mock-009", 1)],
    listedDate: "2026-07-18",
    description: "Kleine studio, geschikt als vakantieverhuur.",
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    constructionYear: 1980,
    energyLabel: "F",
  },
  {
    sourceId: "mock-010",
    title: "Appartement met balkon en bergruimte",
    neighborhood: "Cullera",
    priceEUR: 122000,
    builtAreaM2: 65,
    usableAreaM2: 60,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-010"),
    listedDate: "2026-05-09",
    description: "Appartement op de vierde verdieping met lift.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1988,
    energyLabel: "E",
  },
  {
    sourceId: "mock-011",
    title: "Centraal gelegen appartement in Mislata",
    neighborhood: "Mislata",
    priceEUR: 182000,
    builtAreaM2: 75,
    usableAreaM2: 70,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-011"),
    photoUrls: [PHOTO("mock-011", 1)],
    listedDate: "2026-06-25",
    description: "Appartement dicht bij metrostation, goed onderhouden.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1978,
    energyLabel: "D",
  },
  {
    sourceId: "mock-012",
    title: "Woning met patio in Mislata",
    neighborhood: "Mislata",
    priceEUR: 298000,
    builtAreaM2: 120,
    propertyType: "woonhuis",
    sourceUrl: URL_FOR("mock-012"),
    listedDate: "2026-04-30",
    description: "Twee-onder-een-kap-woning met binnenplaats.",
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 2001,
    energyLabel: "C",
  },
  {
    sourceId: "mock-013",
    title: "Appartement nabij treinstation Moncada",
    neighborhood: "Moncada",
    priceEUR: 168000,
    builtAreaM2: 82,
    usableAreaM2: 76,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-013"),
    listedDate: "2026-07-05",
    description: "Ruim appartement, ideaal voor pendelaars.",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 1,
    constructionYear: 1995,
    energyLabel: "D",
  },
  {
    sourceId: "mock-014",
    title: "Woning met grote tuin in Moncada",
    neighborhood: "Moncada",
    priceEUR: 315000,
    builtAreaM2: 155,
    usableAreaM2: 140,
    propertyType: "woonhuis",
    sourceUrl: URL_FOR("mock-014"),
    photoUrls: [PHOTO("mock-014", 1), PHOTO("mock-014", 2)],
    listedDate: "2026-03-11",
    description: "Vrijstaande woning met tuin van 300m².",
    rooms: 6,
    bedrooms: 4,
    bathrooms: 2,
    constructionYear: 1990,
    energyLabel: "D",
  },
  {
    sourceId: "mock-015",
    title: "Appartement in kuststad Oliva",
    neighborhood: "Oliva",
    priceEUR: 115000,
    builtAreaM2: 70,
    usableAreaM2: 65,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-015"),
    listedDate: "2026-06-19",
    description: "Appartement op loopafstand van het centrum van Oliva.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1983,
    energyLabel: "E",
  },
  {
    sourceId: "mock-016",
    title: "Villa met zwembad in Oliva",
    neighborhood: "Oliva",
    priceEUR: 395000,
    builtAreaM2: 230,
    propertyType: "villa",
    sourceUrl: URL_FOR("mock-016"),
    photoUrls: [PHOTO("mock-016", 1)],
    listedDate: "2026-02-27",
    description: "Grote villa met privézwembad en garage voor twee auto's.",
    rooms: 8,
    bedrooms: 5,
    bathrooms: 3,
    constructionYear: 2009,
    energyLabel: "C",
  },
  {
    sourceId: "mock-017",
    title: "Appartement in het centrum van Catarroja",
    neighborhood: "Catarroja",
    priceEUR: 132000,
    builtAreaM2: 68,
    usableAreaM2: 62,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-017"),
    listedDate: "2026-07-08",
    description: "Appartement dicht bij winkels en openbaar vervoer.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1987,
    energyLabel: "E",
  },
  {
    sourceId: "mock-018",
    title: "Woning met garage in Catarroja",
    neighborhood: "Catarroja",
    priceEUR: 205000,
    builtAreaM2: 105,
    usableAreaM2: 98,
    propertyType: "woonhuis",
    sourceUrl: URL_FOR("mock-018"),
    listedDate: "2026-05-17",
    description: "Rijwoning met garage en kleine achtertuin.",
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 1996,
    energyLabel: "D",
  },
  {
    sourceId: "mock-019",
    title: "Villa met tuin in Bétera",
    neighborhood: "Bétera",
    priceEUR: 425000,
    builtAreaM2: 190,
    usableAreaM2: 175,
    propertyType: "villa",
    sourceUrl: URL_FOR("mock-019"),
    photoUrls: [PHOTO("mock-019", 1), PHOTO("mock-019", 2)],
    listedDate: "2026-04-02",
    description: "Vrijstaande villa in familiewijk, grote tuin met zwembad.",
    rooms: 7,
    bedrooms: 4,
    bathrooms: 3,
    constructionYear: 2011,
    energyLabel: "B",
  },
  {
    sourceId: "mock-020",
    title: "Nieuwbouwappartement in Bétera",
    neighborhood: "Bétera",
    priceEUR: 205000,
    builtAreaM2: 88,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-020"),
    listedDate: "2026-06-30",
    description: "Nieuwbouwappartement met gemeenschappelijk zwembad.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    constructionYear: 2022,
    energyLabel: "A",
  },
  {
    sourceId: "mock-021",
    title: "Penthouse met dakterras in El Carmen",
    neighborhood: "El Carmen (Ciutat Vella)",
    priceEUR: 415000,
    builtAreaM2: 95,
    usableAreaM2: 88,
    propertyType: "penthouse",
    sourceUrl: URL_FOR("mock-021"),
    photoUrls: [PHOTO("mock-021", 1), PHOTO("mock-021", 2), PHOTO("mock-021", 3)],
    listedDate: "2026-06-08",
    description: "Penthouse in het historisch centrum met eigen dakterras.",
    rooms: 4,
    bedrooms: 2,
    bathrooms: 2,
    constructionYear: 2015,
    energyLabel: "B",
  },
  {
    sourceId: "mock-022",
    title: "Studio in historisch pand, El Carmen",
    neighborhood: "El Carmen (Ciutat Vella)",
    priceEUR: 195000,
    builtAreaM2: 45,
    usableAreaM2: 40,
    propertyType: "studio",
    sourceUrl: URL_FOR("mock-022"),
    listedDate: "2026-07-14",
    description: "Karakteristieke studio in een 19e-eeuws pand.",
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    constructionYear: 1890,
    energyLabel: "F",
  },
  {
    sourceId: "mock-023",
    title: "Volledig gerenoveerd appartement, El Carmen",
    neighborhood: "El Carmen (Ciutat Vella)",
    priceEUR: 305000,
    builtAreaM2: 72,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-023"),
    photoUrls: [PHOTO("mock-023", 1)],
    listedDate: "2026-05-25",
    description: "Volledig gerenoveerd appartement met originele elementen behouden.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    constructionYear: 1910,
    energyLabel: "C",
  },
  {
    sourceId: "mock-024",
    title: "Appartement in trendy Ruzafa",
    neighborhood: "Ruzafa",
    priceEUR: 305000,
    builtAreaM2: 80,
    usableAreaM2: 74,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-024"),
    photoUrls: [PHOTO("mock-024", 1), PHOTO("mock-024", 2)],
    listedDate: "2026-06-11",
    description: "Appartement in populaire buurt, dicht bij cafés en winkels.",
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    constructionYear: 1965,
    energyLabel: "D",
  },
  {
    sourceId: "mock-025",
    title: "Penthouse met terras in Ruzafa",
    neighborhood: "Ruzafa",
    priceEUR: 410000,
    builtAreaM2: 100,
    usableAreaM2: 90,
    propertyType: "penthouse",
    sourceUrl: URL_FOR("mock-025"),
    photoUrls: [PHOTO("mock-025", 1)],
    listedDate: "2026-07-02",
    description: "Penthouse met terras en uitzicht over de wijk.",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 2018,
    energyLabel: "B",
  },
  {
    sourceId: "mock-026",
    title: "Stadswoning in Ruzafa",
    neighborhood: "Ruzafa",
    priceEUR: 365000,
    builtAreaM2: 105,
    usableAreaM2: 98,
    propertyType: "woonhuis",
    sourceUrl: URL_FOR("mock-026"),
    listedDate: "2026-04-19",
    description: "Smalle stadswoning over drie verdiepingen, dicht bij het Mercado de Ruzafa.",
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 1958,
    energyLabel: "E",
  },
  {
    sourceId: "mock-027",
    title: "Luxeappartement in premium wijk",
    neighborhood: "Other premium central",
    priceEUR: 380000,
    builtAreaM2: 95,
    usableAreaM2: 88,
    propertyType: "appartement",
    sourceUrl: URL_FOR("mock-027"),
    photoUrls: [PHOTO("mock-027", 1), PHOTO("mock-027", 2)],
    listedDate: "2026-05-30",
    description: "Appartement in een van de duurdere centrale buurten, conciërge aanwezig.",
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    constructionYear: 2008,
    energyLabel: "B",
  },
  {
    sourceId: "mock-028",
    title: "Penthouse met parkeerplaats, premium wijk",
    neighborhood: "Other premium central",
    priceEUR: 495000,
    builtAreaM2: 120,
    propertyType: "penthouse",
    sourceUrl: URL_FOR("mock-028"),
    listedDate: "2026-06-22",
    description: "Penthouse met eigen parkeerplaats en berging.",
    rooms: 5,
    bedrooms: 3,
    bathrooms: 3,
    constructionYear: 2016,
    energyLabel: "A",
  },
  {
    sourceId: "mock-029",
    title: "Loft-appartement, industriële stijl",
    neighborhood: "Valencia City",
    priceEUR: 195000,
    builtAreaM2: 60,
    propertyType: "anders",
    sourceUrl: URL_FOR("mock-029"),
    photoUrls: [PHOTO("mock-029", 1)],
    listedDate: "2026-07-20",
    description: "Voormalige werkplaats omgebouwd tot loft-appartement.",
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    constructionYear: 1955,
    energyLabel: "E",
  },
  {
    sourceId: "mock-030",
    title: "Groot herenhuis in El Carmen",
    neighborhood: "El Carmen (Ciutat Vella)",
    priceEUR: 620000,
    builtAreaM2: 180,
    usableAreaM2: 165,
    propertyType: "villa",
    sourceUrl: URL_FOR("mock-030"),
    photoUrls: [PHOTO("mock-030", 1), PHOTO("mock-030", 2)],
    listedDate: "2026-03-05",
    description: "Historisch herenhuis over vier verdiepingen, deels gerenoveerd.",
    rooms: 9,
    bedrooms: 5,
    bathrooms: 3,
    constructionYear: 1902,
    energyLabel: "D",
  },
];

/** Strips detail-only fields - a real search-results page is thinner than a detail page too. */
function toListing(detail: ListingDetail): Listing {
  const {
    sourceId,
    title,
    neighborhood,
    priceEUR,
    builtAreaM2,
    propertyType,
    sourceUrl,
    usableAreaM2,
    photoUrls,
    listedDate,
  } = detail;
  return {
    sourceId,
    title,
    neighborhood,
    priceEUR,
    builtAreaM2,
    propertyType,
    sourceUrl,
    usableAreaM2,
    photoUrls,
    listedDate,
  };
}

function matchesCriteria(listing: ListingDetail, criteria: SearchCriteria): boolean {
  if (criteria.neighborhood !== undefined && listing.neighborhood !== criteria.neighborhood) {
    return false;
  }
  if (criteria.minPriceEUR !== undefined && listing.priceEUR < criteria.minPriceEUR) {
    return false;
  }
  if (criteria.maxPriceEUR !== undefined && listing.priceEUR > criteria.maxPriceEUR) {
    return false;
  }
  if (criteria.propertyType !== undefined && listing.propertyType !== criteria.propertyType) {
    return false;
  }
  return true;
}

/**
 * SOURCING_SPEC.md §1's `searchListings(criteria)`. An empty/absent
 * criteria object returns every listing - the same "no filter applied"
 * behaviour a real scraper's unfiltered search would have.
 */
export async function searchListings(criteria: SearchCriteria = {}): Promise<Listing[]> {
  await delay();
  return MOCK_LISTINGS.filter((listing) => matchesCriteria(listing, criteria)).map(toListing);
}

/** SOURCING_SPEC.md §1's `getListingDetail(sourceId)`. Unknown id: null, not a throw - a stale link is not the caller's bug. */
export async function getListingDetail(sourceId: string): Promise<ListingDetail | null> {
  await delay();
  const found = MOCK_LISTINGS.find((listing) => listing.sourceId === sourceId);
  return found === undefined ? null : { ...found };
}
