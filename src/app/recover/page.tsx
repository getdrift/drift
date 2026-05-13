import { recoverAccessAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 className="login-title">Recover access</h1>
        <p className="login-sub">
          Lost your login URL? Enter the email you paid with and we&apos;ll
          regenerate your access link and send it within a minute.
        </p>

        {sent ? (
          <div className="alert alert-success" style={{ marginTop: 16 }}>
            <strong>✓</strong> If a workspace exists under{" "}
            <code>{sent}</code>, we just emailed you a fresh login URL. Check
            your inbox (and spam folder).
          </div>
        ) : (
          <form action={recoverAccessAction} className="login-form">
            <input
              type="email"
              name="email"
              placeholder="you@yourcompany.com"
              required
              autoFocus
              autoComplete="email"
            />
            <button type="submit" className="btn btn-primary">
              Send me a new login URL
            </button>
          </form>
        )}

        {error ? <div className="login-error">{error}</div> : null}

        <p className="login-hint">
          Still stuck? Email{" "}
          <a href="mailto:scriptsswiss@gmail.com">scriptsswiss@gmail.com</a> —
          reply within a business day.
        </p>
        <p className="login-hint">
          <a href="/login">← back to sign in</a>
        </p>
      </div>
    </div>
  );
}
