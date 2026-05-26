import { describe, expect, it } from "vitest";
import { buildLeadCompanyBlock, buildLeadContactBlock } from "./db";

describe("lead contact and company blocks", () => {
  it("normaliza el bloque de contacto usando los campos operativos actuales del lead", () => {
    const contacto = buildLeadContactBlock({
      nombreCliente: "  Laura Gómez  ",
      telefono: " 3001234567 ",
      correo: "  LAURA@EMPRESA.COM ",
    });

    expect(contacto).toEqual({
      nombre: "Laura Gómez",
      telefono: "3001234567",
      correo: "laura@empresa.com",
    });
  });

  it("normaliza el bloque de empresa y mantiene compatibilidad cuando faltan datos opcionales", () => {
    const empresa = buildLeadCompanyBlock({
      nombreEmpresa: "  Boutique Centro SAS  ",
      ciudad: null,
    });

    expect(empresa).toEqual({
      nombre: "Boutique Centro SAS",
      ciudad: "",
    });
  });
});
