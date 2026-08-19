import { LoginForm } from "@/components/LoginForm";
import { studioPasswordConfigured } from "@/lib/auth";

/**
 * Login — ekmatra khula page.
 *
 * `STUDIO_PASSWORD` set na ho to yahan saaf likha jaata hai ki studio band hai.
 * "Password khaali hai to sabko aane do" wala default jaanbujh kar nahi rakha:
 * wo aisa gate hai jo dikhta to hai par rokta kuch nahi.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const configured = studioPasswordConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-ink-600 bg-ink-800 p-6">
        <h1 className="text-lg font-semibold tracking-tight">AI Reel Studio</h1>

        {configured ? (
          <>
            <p className="mt-1 text-sm text-chalk-500">Studio ka password daalo.</p>
            <LoginForm next={searchParams.next ?? "/"} />
          </>
        ) : (
          <p className="mt-3 rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
            <code className="font-mono">STUDIO_PASSWORD</code> env set nahi hai, isliye studio
            band hai. <code className="font-mono">studio/.env.local</code> me daalo aur dev
            server dobara chalao.
          </p>
        )}
      </div>
    </main>
  );
}
