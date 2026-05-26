import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    user: null,
    logout: vi.fn(),
  }),
}));

import DashboardLayout from "@/components/DashboardLayout";

describe("DashboardLayout", () => {
  it("muestra una puerta de acceso clara cuando no hay sesión", () => {
    const html = renderToStaticMarkup(
      createElement(
        DashboardLayout,
        null,
        createElement("div", null, "contenido privado"),
      ),
    );

    expect(html).toContain("Acceso a Máquina de ventas");
    expect(html).toContain("Entrar a Máquina de ventas");
    expect(html).not.toContain("contenido privado");
  });
});
