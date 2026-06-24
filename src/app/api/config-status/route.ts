import { NextResponse } from "next/server";
import { getAiConfigStatus } from "@/lib/ai-config";

export async function GET() {
  const status = getAiConfigStatus();

  return NextResponse.json({
    ready: status.ready,
    aiundetect: status.aiundetect,
    openrouter: status.openrouter,
    openai: status.openai,
  });
}
