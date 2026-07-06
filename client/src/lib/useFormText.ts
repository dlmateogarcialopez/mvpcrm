import { trpc } from "./trpc";

export function t(key: string, defaultText: string): string {
  return defaultText;
}

export function useFormText(key: string, defaultText: string): string {
  const query = trpc.leads.getFormLayout.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  return (query.data as any)?.textOverrides?.[key] ?? defaultText;
}
