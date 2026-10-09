export const packageKeys = {
  all: ["packages"] as const,
  pricing: (clientId: string) => ["client-pricing", clientId] as const,
};
