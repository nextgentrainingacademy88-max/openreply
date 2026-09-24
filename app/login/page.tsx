import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { KeyRound, MessageCircleReply, Sparkles } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { EMAIL_PROVIDER_ID, auth, signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";

export const metadata = {
  title: "Login - OpenReply",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkEmail?: string;
    callbackUrl?: string;
    template?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const hasCredentialsError = params.error === "credentials";
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";

  // Already signed in with a valid session: skip the form. Only same-site
  // paths are followed, so a crafted callbackUrl can't redirect elsewhere.
  const session = await auth();
  if (session?.user) {
    redirect(
      callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard"
    );
  }

  async function signInWithPassword(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: callbackUrl,
      });
    } catch (error) {
      // signIn() itself throws a redirect on success — that must propagate,
      // not be swallowed here. Only a real auth failure gets our own
      // redirect back to the login form with a generic error.
      if (error instanceof AuthError) {
        const query = new URLSearchParams({ error: "credentials" });
        query.set("callbackUrl", callbackUrl);
        redirect(`/login?${query.toString()}`);
      }
      throw error;
    }
  }

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn(EMAIL_PROVIDER_ID, {
      email: String(formData.get("email") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_10px_24px_-8px_rgba(255,106,19,0.55)]">
            <MessageCircleReply className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            OpenReply
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in by email, then connect your Instagram professional account."}
          </p>
        </div>

        <Card>
          {selectedTemplate && !checkEmail && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent-soft p-4">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-accent">
                  Template selected
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {selectedTemplate.title}
                </p>
              </div>
            </div>
          )}

          {checkEmail ? (
            <div className="py-4 text-center">
              <h2 className="mb-2 text-lg font-bold text-foreground">
                Check your email
              </h2>
              <p className="text-sm text-muted">
                We sent you a secure sign-in link. Open it on this device to
                continue.
              </p>
            </div>
          ) : (
            <>
              {hasCredentialsError && (
                <div className="mb-5 rounded-xl border border-error/30 bg-error/10 p-4">
                  <p className="text-sm font-medium text-error">
                    Wrong email or password, or too many attempts. Try again
                    in a few minutes.
                  </p>
                </div>
              )}

              <form action={signInWithPassword} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••"
                  />
                </div>

                <Button type="submit" size="lg" className="w-full">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Sign in
                </Button>
              </form>

              <div className="mt-6 border-t border-border pt-5">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground">
                    Forgot password or no password yet? Email me a sign-in
                    link
                  </summary>

                  <form
                    action={sendMagicLink}
                    className="mt-4 flex flex-col gap-3 sm:flex-row"
                  >
                    <label htmlFor="magic-link-email" className="sr-only">
                      Work email
                    </label>
                    <Input
                      id="magic-link-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      className="sm:flex-1"
                    />
                    <Button type="submit" variant="secondary" className="shrink-0">
                      Email me a link
                    </Button>
                  </form>
                </details>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
