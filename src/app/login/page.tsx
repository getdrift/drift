import { redirect } from "next/navigation";
import { authDisabled } from "@/lib/auth";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; token?: string }>;
}) {
  const params = await searchParams;
  if (authDisabled()) {
    redirect(params.next ?? "/app");
  }

  // Token-based login (customer email link → /login?token=XYZ) →
  // delegate to the API route which can set cookies.
  if (params.token) {
    const q = new URLSearchParams({ token: params.token });
    if (params.next) q.set("next", params.next);
    redirect(`/api/login?${q.toString()}`);
  }

  const next = params.next ?? "/app";

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">
          Owners: enter your admin password. Customers: use the login link from your
          welcome email — or paste your access token below.
        </p>
        <form action={loginAction} className="login-form">
          <input type="hidden" name="next" value={next} />
          <input
            type="password"
            name="password"
            placeholder="Password or access token"
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
          Customers: lost your token? Email{" "}
          <a href="mailto:scriptsswiss@gmail.com">scriptsswiss@gmail.com</a> — we
          regenerate one for you instantly.
        </p>
      </div>
    </div>
  );
}
