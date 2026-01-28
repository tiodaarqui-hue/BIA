"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WHATSAPP_NUMBER = "5562991918050";
const WHATSAPP_MESSAGE = "Olá! Gostaria de solicitar acesso ao sistema BIA.";

function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1490);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center justify-center">
        <div
          className="rounded-full animate-shine-logo flex items-center justify-center animate-logo-roll"
          style={{ width: '19px', height: '19px' }}
        >
          <svg width="15" height="15" viewBox="0 0 100 100">
            <polygon
              points="50,10 88,80 12,80"
              fill="#0a0a0a"
            />
          </svg>
        </div>
        <span className="text-lg font-light tracking-widest flex">
          <span className="animate-letter animate-letter-b text-transparent animate-shine">B</span>
          <span className="animate-letter animate-letter-dash text-transparent animate-shine">-</span>
          <span className="animate-letter animate-letter-i text-transparent animate-shine">I</span>
          <span className="animate-letter animate-letter-a text-transparent animate-shine">A</span>
        </span>
      </div>
    </main>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email ou senha incorretos");
      setLoading(false);
      return;
    }

    setShowLoadingScreen(true);
  }

  function handleRegisterClick() {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    window.open(url, "_blank");
  }

  if (showLoadingScreen) {
    return (
      <LoadingScreen onComplete={() => {
        router.push("/dashboard");
        router.refresh();
      }} />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center gap-2">
            <div
              className="rounded-full animate-shine-logo flex items-center justify-center"
              style={{ width: '24px', height: '24px' }}
            >
              <svg width="19" height="19" viewBox="0 0 100 100">
                <polygon
                  points="50,10 88,80 12,80"
                  fill="#0a0a0a"
                />
              </svg>
            </div>
            <p className="text-2xl font-light tracking-widest text-transparent animate-shine">
              BIA
            </p>
          </div>
          <p className="text-muted-foreground mt-2">Acesso ao painel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleRegisterClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Não tem conta? Solicitar acesso
          </button>
        </div>
      </div>
    </main>
  );
}
