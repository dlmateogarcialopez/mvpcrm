import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRefreshBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import { UNAUTHED_ERR_MSG } from "@shared/const";

/**
 * Página de aceptación de invitación. Se accede vía
 * /accept-invitation?token=xxx (link del email).
 *
 * Estados:
 *  - Token inválido o expirado: muestra error + CTA logout.
 *  - Sin sesión: muestra "Inicia sesión para continuar".
 *  - Con sesión: muestra datos de la invitación + CTA
 *    "Aceptar y entrar".
 */
export default function AcceptInvitationPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") ?? "";

  const { user, loading: userLoading, refresh } = useAuth();
  const refreshBrand = useRefreshBrand();
  const utils = trpc.useUtils();

  const invitationQuery = trpc.organizations.getInvitation.useQuery(
    { token },
    {
      enabled: token.length >= 10,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const acceptMutation = trpc.organizations.acceptInvitation.useMutation();

  const [accepted, setAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Si no hay token en la URL, redirigir
  useEffect(() => {
    if (!token) {
      setLocation("/");
    }
  }, [token, setLocation]);

  // Si el token expiró / fue revocado, mostrar error
  useEffect(() => {
    if (invitationQuery.data?.invitation.status === "expired") {
      setErrorMessage("La invitación ha expirado. Pide al administrador una nueva.");
    } else if (invitationQuery.data?.invitation.status === "revoked") {
      setErrorMessage("La invitación fue revocada por el administrador.");
    } else if (invitationQuery.data?.invitation.status === "accepted") {
      setErrorMessage("Esta invitación ya fue aceptada.");
    }
  }, [invitationQuery.data]);

  const handleAccept = async () => {
    try {
      const result = await acceptMutation.mutateAsync({ token });
      if (result.organization) {
        toast.success(`Te uniste a ${result.organization.name}.`);
      }
      await refresh();
      await refreshBrand();
      await utils.invalidate();
      setAccepted(true);
      setTimeout(() => setLocation("/"), 1500);
    } catch (err: any) {
      const message =
        err instanceof TRPCClientError
          ? err.message
          : err?.message || "No fue posible aceptar la invitación.";
      setErrorMessage(message);
      toast.error(message);
    }
  };

  if (!token) {
    return null;
  }

  if (userLoading || invitationQuery.isLoading) {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CenteredShell>
    );
  }

  // Sin sesión: pedir login (manteniendo el token en la URL)
  if (!user) {
    return (
      <CenteredShell>
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Tienes una invitación pendiente
          </h1>
          {invitationQuery.data?.organization && (
            <p className="mt-2 text-sm text-muted-foreground">
              Te invitaron a{" "}
              <strong className="text-foreground">
                {invitationQuery.data.organization.name}
              </strong>
              . Inicia sesión con la cuenta donde recibiste el email para
              aceptarla.
            </p>
          )}
          <Button
            className="mt-6 w-full"
            onClick={() =>
              setLocation(
                `/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`
              )
            }
          >
            Iniciar sesión
          </Button>
        </div>
      </CenteredShell>
    );
  }

  // Aceptada con éxito
  if (accepted) {
    return (
      <CenteredShell>
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            ¡Listo!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ya eres parte de {invitationQuery.data?.organization?.name}.
            Redirigiendo...
          </p>
        </div>
      </CenteredShell>
    );
  }

  // Con sesión: mostrar detalle
  const invitation = invitationQuery.data?.invitation;
  const organization = invitationQuery.data?.organization;

  if (errorMessage || invitationQuery.error) {
    return (
      <CenteredShell>
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <XCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Invitación no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {errorMessage || invitationQuery.error?.message}
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => setLocation("/")}
            variant="outline"
          >
            Ir al inicio
          </Button>
        </div>
      </CenteredShell>
    );
  }

  if (!invitation || !organization) {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CenteredShell>
    );
  }

  // Verificar que el email del user coincide con el de la invitación
  const emailMatch =
    user.email && invitation.email
      ? user.email.toLowerCase() === invitation.email.toLowerCase()
      : true; // si no podemos comparar, dejamos pasar (admin)

  return (
    <CenteredShell>
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Invitación a {organization.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Has sido invitado a unirte como{" "}
            <strong className="text-foreground uppercase tracking-wide">
              {invitation.orgRole}
            </strong>
            .
          </p>
        </div>

        {!emailMatch && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold">Email no coincide</p>
            <p className="mt-1">
              Esta invitación fue enviada a{" "}
              <strong>{invitation.email}</strong> pero tu cuenta actual es{" "}
              <strong>{user.email}</strong>. Si esto es un error, contacta al
              administrador.
            </p>
          </div>
        )}

        <Button
          className="mt-6 w-full"
          onClick={handleAccept}
          disabled={acceptMutation.isPending}
        >
          {acceptMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Aceptar y entrar
        </Button>
      </div>
    </CenteredShell>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {children}
    </div>
  );
}
