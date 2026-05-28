import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Mail, User, Loader2, Sparkles } from "lucide-react";
import { trpc } from "../lib/trpc";

export default function LoginPage() {
  const utils = trpc.useUtils();
  const hasUsersQuery = trpc.auth.hasUsers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("¡Sesión iniciada con éxito! Redirigiendo...");
      await utils.auth.me.invalidate();
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Error al iniciar sesión. Revisa tus credenciales.");
    },
  });

  const setupAdminMutation = trpc.auth.setupAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrador creado con éxito. Ahora puedes iniciar sesión.");
      setEmail("");
      setPassword("");
      setName("");
      hasUsersQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Error al inicializar el sistema.");
    },
  });

  const isLoading = hasUsersQuery.isLoading || loginMutation.isPending || setupAdminMutation.isPending;
  const isSetupMode = hasUsersQuery.data === false; // Explícitamente false (no hay usuarios)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      toast.warning("Por favor, completa todos los campos requeridos.");
      return;
    }

    if (password.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (isSetupMode) {
      if (!name) {
        toast.warning("Por favor, ingresa tu nombre completo.");
        return;
      }
      setupAdminMutation.mutate({
        name,
        email,
        password,
      });
    } else {
      loginMutation.mutate({
        email,
        password,
      });
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(29,78,216,0.15),_transparent_45%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
            <Sparkles className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Máquina de ventas
          </h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            {isSetupMode
              ? "Inicialización del sistema comercial"
              : "Ingresa tus credenciales para acceder al CRM"}
          </p>
        </div>

        {hasUsersQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-[32px] border border-white/5 bg-white/5 px-6 py-12 text-center shadow-2xl backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-4 text-sm text-slate-400">Verificando estado del sistema...</p>
          </div>
        ) : (
          <div className="rounded-[32px] border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
            {isSetupMode && (
              <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
                🚀 <strong>Modo Configuración Inicial:</strong> No se han detectado usuarios en la base de datos. Completa el formulario para registrar la cuenta del primer Administrador Principal.
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              {isSetupMode && (
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-slate-300">Nombre completo</span>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white/10"
                      placeholder="Ej. Sebastián Jaramillo"
                    />
                  </div>
                </label>
              )}

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-slate-300">Correo electrónico</span>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white/10"
                    placeholder="Ej. admin@maquinadeventas.com"
                  />
                </div>
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-slate-300">Contraseña</span>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white/10"
                    placeholder="••••••••"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isSetupMode ? (
                  "Crear y Configurar Sistema"
                ) : (
                  "Ingresar a la Plataforma"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
