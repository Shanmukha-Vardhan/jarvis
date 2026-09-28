import { NextResponse } from "next/server";
import { fetchTasks } from "@/lib/firebase";
import { OFFICIAL_TIMETABLE } from "@/lib/timetableData";
import { getGitamAttendance } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [allTasks, attendance] = await Promise.all([
      fetchTasks(),
      getGitamAttendance(),
    ]);

    const completed = allTasks.filter((t) => t.completed);
    const pending = allTasks.filter((t) => !t.completed);

    // Calculate busy days based on timetable slots count
    const daysSummary = Object.entries(OFFICIAL_TIMETABLE).map(([day, classes]) => ({
      day,
      classCount: classes.length,
    }));

    // Find busiest class day
    let busiestDay = "Monday";
    let maxClasses = 0;
    daysSummary.forEach((d) => {
      if (d.classCount > maxClasses) {
        maxClasses = d.classCount;
        busiestDay = d.day;
      }
    });

    const apiKey = process.env.GEMINI_API_KEY || "";
    const prompt = `
Generate a Sunday Evening Weekly Review for Shanmukha (Boss).
Context:
- Past Week Completed Tasks: ${completed.length} (${completed.map((t) => t.title).join(", ") || "None marked"})
- Pending/Upcoming Deadlines: ${pending.length} (${pending.map((t) => t.title).join(", ") || "Clean slate"})
- Coming Week Schedule: Busiest day is ${busiestDay} with ${maxClasses} classes. Monday has 6 slots, Friday has labs. Wednesday & Thursday afternoons are free.
- GITAM Attendance: ${attendance.overallPercentage}% with ${attendance.bunksRemaining} safe bunks left.

Persona Guidelines:
- JARVIS intelligence meets relaxed Gen-Z friend ("Boss").
- Honest, direct, no-bullshit tone.
- Give props if tasks were finished, or call them out gently if deadlines slipped.
- Preview the coming week's intensity (point out ${busiestDay} and free afternoons).
- Keep it under 150 words for smooth voice delivery on iPhone.
`;

    let reviewText = "";
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
    if (res.ok) {
        const data = await res.json();
        reviewText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
      if (!reviewText) {
        reviewText = `Evening Shanmukha. Sunday check-in. You've got ${pending.length} pending items on deck for this coming week. ${busiestDay} is your heaviest day with ${maxClasses} classes, but you've got afternoons clear on Wednesday and Thursday. Attendance is sitting safe at ${attendance.overallPercentage}%. Rest up tonight, we execute tomorrow.`;
      }
    } catch {
      reviewText = `Evening Shanmukha. Sunday check-in. You've got ${pending.length} pending items on deck for this coming week. ${busiestDay} is your heaviest day with ${maxClasses} classes, but you've got afternoons clear on Wednesday and Thursday. Attendance is sitting safe at ${attendance.overallPercentage}%. Rest up tonight, we execute tomorrow.`;
    }

    return NextResponse.json({
      status: "success",
      speech: reviewText,
      text: reviewText,
      stats: {
        completedCount: completed.length,
        pendingCount: pending.length,
        busiestDay,
        maxClasses,
        attendance: attendance.overallPercentage,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
