import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/password";

const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string(),
  confirmPassword: z.string(),
});

/** Whether the signed-in user already has a password set, so the settings UI knows to ask for the current one. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  return NextResponse.json({
    success: true,
    data: { hasPassword: Boolean(user?.passwordHash) },
  });
}

/**
 * Set or change the signed-in user's password. If a password is already
 * set, the current one must be supplied and verified first.
 */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { success: false, error: "New password and confirmation do not match" },
      { status: 400 }
    );
  }

  const passwordError = validateNewPassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.passwordHash) {
    const currentIsValid =
      typeof currentPassword === "string" &&
      currentPassword.length > 0 &&
      (await verifyPassword(currentPassword, user.passwordHash));

    if (!currentIsValid) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
