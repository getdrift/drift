import { authDisabled } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  if (authDisabled()) {
    redirect(params.next ?? "/app");
  }
  const next = params.next ?? "/app";

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">
          Enter the admin password configured in <code>DRIFT_PASSWORD</code>.
        </p>
        <form action={loginAction} className="login-form">
          <input type="hidden" name="next" value={next} />
          <input
            type="password"
            name="password"
            placeholder="Admin password"
            required
            autoFocus
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-primary">
            Sign in
          </button>
        </form>
        {params.error ? (
          <div className="login-error">{params.error}</div>
        ) : null}
        <p className="login-hint">
          Forgot it? Restart with a new <code>DRIFT_PASSWORD</code> in <code>.env</code>.
        </p>
      </div>
    </div>
  );
}
