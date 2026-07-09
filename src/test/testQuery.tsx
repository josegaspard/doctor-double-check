import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Wrapper de test: provee un QueryClient fresco (retries off para tests
// deterministas). LivesGrid/Doctors ahora usan useQuery (useUserInterests) y sin
// este provider el render lanzaba "No QueryClient set".
export function withQueryClient(ui: React.ReactNode): React.ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}
