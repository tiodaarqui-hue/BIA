"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";

export default function SetupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isAlsoBarber, setIsAlsoBarber] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasOwner, setHasOwner] = useState<boolean | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkOwner() {
      const { count } = await supabase
        .from("staff")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      setHasOwner((count ?? 0) > 0);
    }
    checkOwner();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message || "Erro ao criar conta");
      setLoading(false);
      return;
    }

    // Create staff record via API (uses service role)
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_user_id: authData.user.id,
        name,
        email,
        phone: isAlsoBarber ? phone : undefined,
        is_also_barber: isAlsoBarber,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar perfil");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (hasOwner === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loading />
      </main>
    );
  }

  if (hasOwner) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-light">Setup concluído</h1>
          <p className="text-muted-foreground">
            O sistema já possui um proprietário configurado.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Ir para login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-light tracking-wide">BIA</h1>
          <p className="text-muted-foreground mt-2">Configuração inicial</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            Crie a conta do proprietário da barbearia. Esta será a conta
            principal com acesso total ao sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm mb-2">
              Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
              placeholder="Seu nome"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm mb-2">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAlsoBarber}
                onChange={(e) => setIsAlsoBarber(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <div>
                <span className="font-medium">Também sou barbeiro</span>
                <p className="text-xs text-muted-foreground">
                  Me cadastrar para receber agendamentos
                </p>
              </div>
            </label>

            {isAlsoBarber && (
              <div className="mt-4">
                <label htmlFor="phone" className="block text-sm mb-2">
                  Telefone (para contato)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                  placeholder="11999999999"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>
      </div>
    </main>
  );
}
