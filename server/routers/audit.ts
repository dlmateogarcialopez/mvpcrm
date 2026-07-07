import { z } from "zod";
import { router, superadminProcedure } from "../_core/trpc";
import { listAuditLogs } from "../db";

export const auditRouter = router({
  list: superadminProcedure
    .input(
      z.object({
        userId: z.number().int().positive().optional(),
        organizationId: z.number().int().positive().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        search: z.string().max(255).optional(),
        from: z.number().optional(),
        to: z.number().optional(),
        limit: z.number().min(1).max(200).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return listAuditLogs(input);
    }),
});
