# Evidencia de exportación Excel e ID CRM único

La validación del requerimiento quedó confirmada en el proyecto actual del CRM **Máquina de ventas**. La evidencia combina presencia visible en la interfaz, validación automatizada del archivo Excel y estado operativo del entorno.

| Componente validado | Evidencia | Resultado |
| --- | --- | --- |
| Botón visible en el CRM | En `client/src/pages/LeadsPage.tsx` existe el botón **"Exportar Excel"** y está conectado a `exportSpreadsheetMutation` para iniciar la descarga. | Conforme |
| ID CRM visible en la app | En la misma vista aparece el texto **"ID CRM {lead.publicId}"** en el listado y el bloque **"ID único CRM"** en el panel de detalle. | Conforme |
| Archivo Excel descargable | La prueba `server/lead-export.test.ts` valida que el libro generado se llama **"CRM Leads"** y contiene columnas como **"ID CRM"**, **"Cliente"** y **"Valor total"**. | Conforme |
| ID único dentro del Excel | La misma prueba confirma que la primera fila exportada conserva el identificador **`LD-2026-00017`**. | Conforme |
| Prueba automatizada ejecutada | Se ejecutó `pnpm test server/lead-export.test.ts server/leads-page.ui-copy.test.ts`. | 2 archivos de prueba aprobados, 7 pruebas en verde |
| Estado del proyecto | El servidor de desarrollo permanece en ejecución y la vista previa fue capturada correctamente. | Conforme |

La prueba automatizada de exportación verifica explícitamente que el archivo Excel conserve una sábana estructurada y manipulable con encabezados de negocio. Además, la prueba de microcopy valida que el usuario vea en la interfaz tanto el botón de exportación como las referencias al **ID CRM** y al **ID único CRM** antes de descargar el archivo.

| Dato puntual | Evidencia puntual |
| --- | --- |
| Texto del botón | `Exportar Excel` |
| Acción conectada | `exportSpreadsheetMutation.mutate()` |
| Búsqueda por identificador | `placeholder="Busca por cliente, empresa, correo, teléfono o ID CRM"` |
| Identificador en listado | `ID CRM {lead.publicId}` |
| Identificador en panel | `ID único CRM` |
| Nombre de hoja Excel | `CRM Leads` |
| Columnas validadas | `ID CRM`, `Cliente`, `Valor total` |

Como prueba visual adicional, se adjunta la captura reciente de la vista previa del proyecto. Si quieres, en el siguiente paso puedo continuar con el siguiente bloque funcional del MVP sin tocar esta funcionalidad ya validada.
