import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each(["/index", "/index/"])("redirects legacy dashboard address %s to /", async (path) => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), context: { queryClient: new QueryClient() } });
    await router.load();
    expect(router.state.location.pathname).toBe("/");
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each(["/login", "/dia", "/minha-prestacao", "/prestadores", "/prestadores/novo", "/registro", "/validacao", "/escalas", "/documentos", "/relatorios", "/notificacoes", "/locais", "/configuracoes", ...Array.from({ length: 8 }, (_, i) => `/prestadores/${i + 1}`)])("matches the registered page at %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes(path);
    expect(matches.at(-1)?.routeId).toBeDefined();
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
