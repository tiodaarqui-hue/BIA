import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-light tracking-wide">BIA</h1>
        <p className="text-muted-foreground text-lg">Barbear-IA</p>
        <div className="w-16 h-px bg-border mx-auto" />
        <p className="text-sm text-muted-foreground max-w-md">
          Sistema premium de atendimento para barbearias
        </p>
        <Link
          href="/login"
          className="inline-block mt-4 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
