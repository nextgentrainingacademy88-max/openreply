import Link from "next/link";
import { MailCheck, MessageCircleReply } from "lucide-react";
import { Card } from "@/components/ui";

export const metadata = {
  title: "Check your email - OpenReply",
  description: "A sign-in link was sent to your email.",
};

export default function VerifyRequestPage() {
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
        </div>

        <Card className="text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mb-2 text-lg font-bold text-foreground">
            Check your email
          </h2>
          <p className="text-sm text-muted">
            We sent you a secure sign-in link. Open it on this device to
            continue.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
