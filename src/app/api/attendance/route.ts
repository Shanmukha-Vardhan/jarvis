import { NextResponse } from "next/server";
import { getGitamAttendance } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const attendance = await getGitamAttendance();
    return NextResponse.json({ attendance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
