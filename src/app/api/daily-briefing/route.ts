import { NextResponse } from "next/server";
import { getLiveWeather, evaluateBikeDecision, getFilteredNews, getGitamAttendance } from "@/lib/services";
import { getTodayClasses } from "@/lib/timetableData";
import { fetchTasks, TaskItem } from "@/lib/firebase";
import { generateDailyBriefingText, BriefingContext } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format"); // "text" or "json"

    const now = new Date();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
    const currentDateStr = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // 1. Gather all data concurrently
    const [weather, news, attendance, allTasks] = await Promise.all([
      getLiveWeather(),
      getFilteredNews(),
      getGitamAttendance(),
      fetchTasks(),
    ]);

    // 2. Evaluate bike decision
    const bikeDecision = evaluateBikeDecision(weather);

    // 3. Classes today
    const rawClasses = getTodayClasses(currentDay);
    const todayClasses = rawClasses.map((c) => ({
      time: c.time,
      courseCode: c.courseCode,
      courseName: c.courseName,
    }));

    // 4. Deadlines (Today vs Upcoming 2-3 days)
    const todayStr = now.toISOString().slice(0, 10);
    const threeDaysLater = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);

    const activeTasks = allTasks.filter((t) => !t.completed);
    const todayDeadlines = activeTasks.filter((t) => t.dueDate.startsWith(todayStr));
    const upcomingDeadlines = activeTasks.filter((t) => {
      const taskDate = t.dueDate.slice(0, 10);
      return taskDate > todayStr && taskDate <= threeDaysLater;
    });

    // 5. Construct Context
    const ctx: BriefingContext = {
      userName: process.env.USER_NAME || "Shanmukha",
      currentDateStr,
      currentDay,
      weather: {
        temp: weather.temp,
        description: weather.description,
        rainProbability: weather.rainProbability,
      },
      bikeDecision: {
        verdict: bikeDecision.verdict,
        title: bikeDecision.title,
        reason: bikeDecision.reason,
      },
      todayClasses,
      todayDeadlines: todayDeadlines.map((t) => ({
        title: t.title,
        course: t.course,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
      upcomingDeadlines: upcomingDeadlines.map((t) => ({
        title: t.title,
        course: t.course,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
      news: news.map((n) => ({ title: n.title, description: n.description })),
      attendance: {
        overallPercentage: attendance.overallPercentage,
        bunksRemaining: attendance.bunksRemaining,
      },
    };

    // 6. Generate AI Briefing
    const speechText = await generateDailyBriefingText(ctx);

    if (format === "text") {
      // Plain text response if iPhone shortcut requests text directly
      return new Response(speechText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({
      status: "success",
      speech: speechText,
      text: speechText,
      date: currentDateStr,
      day: currentDay,
      weather,
      bikeDecision,
      todayClasses,
      deadlines: {
        today: todayDeadlines,
        upcoming: upcomingDeadlines,
      },
      attendance,
      news,
    });
  } catch (error: any) {
    console.error("Daily briefing error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to generate briefing",
      },
      { status: 500 }
    );
  }
}
