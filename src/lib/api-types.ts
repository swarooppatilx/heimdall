// Response shapes shared by the API routes and the client code that reads them.

interface FacetOption {
  value: string;
  count: number;
}

interface CountryFacet {
  value: string;
  count: number;
  cities: FacetOption[];
}

export interface FacetOptions {
  countries: CountryFacet[];
  companies: FacetOption[];
  departments: FacetOption[];
}

export interface SyncStatus {
  syncedAt: string | null;
}
