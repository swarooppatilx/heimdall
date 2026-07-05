import registryData from "./registry.json";

export interface RegistryEntry {
  name: string;
  provider: string;
  board: string;
  apiUrl?: string;
}

const registry = registryData as RegistryEntry[];

export function getRegistry(): RegistryEntry[] {
  return registry;
}
