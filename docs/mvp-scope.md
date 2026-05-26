# Alcance funcional del MVP

Este MVP está diseñado como una **aplicación interna de gestión comercial** para capturar leads, estimar valor potencial de venta, priorizar seguimiento y coordinar la atención comercial con la menor complejidad operativa posible. La meta de esta primera versión es permitir operación real con un flujo corto, claro y mantenible, sin extender la solución hacia un CRM empresarial completo.

## Decisiones funcionales del MVP

| Área | Incluido en MVP | Decisión operativa |
| --- | --- | --- |
| Captura de leads | Sí | Se registra la información comercial mínima, cantidades, precios, motivo, objeción y fechas clave. |
| Cotización automática | Sí | Los subtotales, total, personas y ticket promedio se recalculan automáticamente al crear o editar. |
| Prioridad y scoring | Sí | Se calcula score por cantidad, valor, ticket, urgencia y recencia, con reglas duras de prioridad. |
| Gestión comercial | Sí | Se permite listar, ver detalle, editar, actualizar estado, próxima acción, notas y fecha límite. |
| Dashboard | Sí | Se muestran métricas operativas, próximas visitas, vencidos y alertas pendientes. |
| Configuración | Sí | Los precios y umbrales base se gestionan desde configuración, sin tocar código. |
| Google Calendar | Sí, en modo MVP | Se implementa sincronización básica por lead con referencia del evento, control de duplicados y actualización del mismo registro. |
| Alertas | Sí, en modo MVP | Se implementa motor de alertas y canal básico de notificación, dejando preparado el adaptador para email y SMS. |
| Roles | Sí | Solo existen dos roles: administrador y agente. |
| CRM avanzado | No | Se posponen pipelines complejos, automatizaciones avanzadas, tableros por equipo y reportes históricos extensos. |
| Marketing / campañas | No | No se incluye gestión de campañas, audiencias ni segmentación avanzada. |
| Integraciones extra | No | Se evita integrar servicios no críticos en esta etapa. |

## Flujo operativo mínimo

El flujo base del MVP comienza con la creación del lead, continúa con el cálculo automático de la cotización y del scoring, y termina en una cola de trabajo priorizada que permite al agente gestionar seguimiento, estado, calendario y alertas. La edición posterior del lead mantiene el mismo registro como fuente única de verdad, evitando duplicados y reduciendo fricción operativa.

## Criterios de aceptación del MVP

| Criterio | Resultado esperado |
| --- | --- |
| Registro rápido | Un agente puede crear un lead completo sin navegar por múltiples pantallas. |
| Cálculo confiable | El sistema actualiza valores y scoring de forma consistente al modificar cantidades o precios. |
| Priorización visible | Cada lead muestra score, color, categoría y explicación breve. |
| Seguimiento accionable | El equipo puede identificar vencidos, próximos a visita y leads que requieren atención. |
| Configuración simple | Un administrador puede ajustar precios y reglas base sin editar código. |
| Base extensible | El modelo soporta futura profundización en alertas, bitácora y calendar sync sin rehacer la base. |
