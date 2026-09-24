import { Header } from "@/components/layout/header";

interface StatusPageProps {
  code: string;
  message: string;
  children: React.ReactNode;
}

export function StatusPage({ code, message, children }: StatusPageProps) {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="font-display text-6xl font-semibold tracking-tight text-muted-foreground">
            {code}
          </p>
          <p className="text-sm text-foreground">{message}</p>
          <div className="mt-3 flex items-center justify-center gap-2">{children}</div>
        </div>
      </main>
    </>
  );
}
