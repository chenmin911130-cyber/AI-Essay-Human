import { NextResponse } from "next/server";
import { checkAiUndetectBalance, hasAiUndetect } from "@/lib/aiundetect";

export async function GET() {
  if (!hasAiUndetect()) {
    return NextResponse.json({
      configured: false,
      balance: null,
      error: "AIUNDETECT_API_KEY 或 AIUNDETECT_EMAIL 未配置",
    });
  }

  const { balance, error } = await checkAiUndetectBalance();

  return NextResponse.json({
    configured: true,
    balance,
    error,
  });
}
