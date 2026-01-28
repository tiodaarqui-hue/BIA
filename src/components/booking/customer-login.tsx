"use client";

import { useState } from "react";

interface CustomerLoginProps {
  barbershopId: string;
  barbershopName: string;
  onSuccess: (customer: { id: string; name: string; phone: string }) => void;
}

export function CustomerLogin({ barbershopId, barbershopName, onSuccess }: CustomerLoginProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function formatPhoneInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/api/customer/login" : "/api/customer/register";
      const body = mode === "login"
        ? { phone, password, barbershopId }
        : { name, phone, password, barbershopId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao processar");
        setLoading(false);
        return;
      }

      onSuccess(data.customer);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-6 sm:p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-light">Agendar em</h1>
          <p className="text-lg font-medium">{barbershopName}</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-border">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors touch-manipulation ${
              mode === "login"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors touch-manipulation ${
              mode === "register"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 touch-manipulation"
                placeholder="Seu nome"
                required
                autoComplete="name"
                autoCapitalize="words"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Telefone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 touch-manipulation"
              placeholder="(11) 99999-9999"
              required
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 touch-manipulation"
              placeholder="Sua senha"
              required
              minLength={4}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center py-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 touch-manipulation text-base"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
