export function snakeCase(name: string): string {
  return name.replace(/([A-Z])/g, "_$1").replace(/^_/, "").toLowerCase();
}

export function pascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
