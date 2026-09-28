import { NextResponse } from "next/server";
import { OFFICIAL_TIMETABLE, COURSE_NAMES } from "@/lib/timetableData";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    timetable: OFFICIAL_TIMETABLE,
    courses: COURSE_NAMES,
  });
}
