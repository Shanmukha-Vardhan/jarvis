import { NextResponse } from "next/server";
import { getLiveWeather, evaluateBikeDecision } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const weather = await getLiveWeather();
    const bikeDecision = evaluateBikeDecision(weather);
    return NextResponse.json({ weather, bikeDecision });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
