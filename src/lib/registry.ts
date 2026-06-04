export interface RegistryEntry {
  name: string;
  provider: string;
  board: string;
}

const registry: RegistryEntry[] = [
  { name: "gitlab", provider: "greenhouse", board: "gitlab" },
  { name: "discord", provider: "greenhouse", board: "discord" },
];

export function getRegistry(): RegistryEntry[] {
  return registry;
}
