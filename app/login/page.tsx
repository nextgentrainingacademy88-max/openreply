import { MessageCircleReply, Sparkles } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { EMAIL_PROVIDER_ID, signIn } from "@/lib/auth";
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
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";

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
            <form action={sendMagicLink} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  Work email
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

              <Button type="submit" size="lg" className="w-full">
                Email me a magic link
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
