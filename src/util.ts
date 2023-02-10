export function replacer(key: string, value: any) {
  if (value instanceof Map) {
    return { __type: "Map", value: Object.fromEntries(value) };
  }
  if (value instanceof Set) {
    return { __type: "Set", value: Array.from(value) };
  }
  return value;
}

export function reviver(key: string, value: any) {
  if (value?.__type === "Set") {
    return new Set(value.value);
  }
  if (value?.__type === "Map") {
    return new Map(Object.entries(value.value));
  }
  return value;
}
