import registryData from "@/lib/registry.json";

export interface RegistryEntry {
  name: string;
  provider: string;
  label?: string;
  apiUrl?: string;
}

const registry = registryData as RegistryEntry[];

export function getRegistry(): RegistryEntry[] {
  return registry;
}
