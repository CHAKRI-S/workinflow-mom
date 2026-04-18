import { NextResponse } from "next/server";
import { requireSaSession } from "@/lib/sa-auth";

/**
 * GET /api/sa/integrations/status
 * Returns which 3rd-party integrations are configured (by env var presence).
 * Never returns the actual secret values.
 */
export async function GET() {
  try {
    await requireSaSession();
    return NextResponse.json({
      email: {
        resend: {
          configured: Boolean(process.env.RESEND_API_KEY),
          fromAddress: process.env.RESEND_FROM_ADDRESS || null,
        },
      },
      payment: {
        omise: {
          configured:
            Boolean(process.env.OMISE_PUBLIC_KEY) &&
            Boolean(process.env.OMISE_SECRET_KEY),
          webhookSecret: Boolean(process.env.OMISE_WEBHOOK_SECRET),
          publicKey: process.env.OMISE_PUBLIC_KEY
            ? process.env.OMISE_PUBLIC_KEY.slice(0, 12) + "..."
            : null,
        },
        slipok: {
          configured:
            Boolean(process.env.SLIPOK_API_KEY) &&
            Boolean(process.env.SLIPOK_BRANCH_ID),
          branchId: process.env.SLIPOK_BRANCH_ID || null,
        },
      },
      auth: {
        saJwtSecret: {
          configured: Boolean(process.env.SA_JWT_SECRET),
          fallback: !process.env.SA_JWT_SECRET && Boolean(process.env.AUTH_SECRET),
        },
      },
      cron: {
        configured: Boolean(process.env.CRON_SECRET),
      },
      urls: {
        appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
        landingUrl: process.env.NEXT_PUBLIC_LANDING_URL || null,
        saUrl: process.env.NEXT_PUBLIC_SA_URL || null,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
