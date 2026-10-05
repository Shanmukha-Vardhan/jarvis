import { NextResponse } from "next/server";
import { getLiveWeather, evaluateBikeDecision, getFilteredNews, getGitamAttendance } from "@/lib/services";
import { getTodayClasses } from "@/lib/timetableData";
import { fetchTasks, TaskItem } from "@/lib/firebase";
import { generateDailyBriefingResult, getNowIST, BriefingContext } from "@/lib/gemini";

export const dynamic = "force-dynamic";

interface CachedBriefing {
  timestamp: number;
  dateKey: string;
  taskHash: string;
  briefing: any;
}

let briefingCache: CachedBriefing | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format"); // "text" or "json"
    const forceRefresh = searchParams.get("refresh") === "true";

    const ist = getNowIST();
    const currentDay = ist.dayOfWeek;
    const currentDateStr = `${ist.calendarMap[0]?.weekday}, ${ist.calendarMap[0]?.dateStr}`;

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

    // 4. Deadlines in IST (Today vs Upcoming 2-3 days)
    const todayStr = ist.currentDateStr; // YYYY-MM-DD
    const threeDaysLater = ist.calendarMap[3]?.dateStr || todayStr;

    const activeTasks = allTasks.filter((t) => !t.completed);
    const todayDeadlines = activeTasks.filter((t) => t.dueDate.startsWith(todayStr));
    const upcomingDeadlines = activeTasks.filter((t) => {
      const taskDate = t.dueDate.slice(0, 10);
      return taskDate > todayStr && taskDate <= threeDaysLater;
    });

    // 5. Construct Context
    const ctx: BriefingContext = {
      userName: process.env.USER_NAME || "Shanmukha",
      currentDateStr: ist.currentDateStr,
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
        details: bikeDecision.details,
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
        shortageCourses: attendance.shortageCourses,
      },
    };

    // 6. Generate AI Briefing (with smart 60-min in-memory cache to prevent quota waste)
    const taskHash = activeTasks.map((t) => `${t.id}-${t.dueDate}`).join(",");
    const isCacheValid =
      !forceRefresh &&
      briefingCache !== null &&
      briefingCache.dateKey === ist.currentDateStr &&
      briefingCache.taskHash === taskHash &&
      Date.now() - briefingCache.timestamp < CACHE_TTL_MS;

    let briefingResult;
    if (isCacheValid && briefingCache) {
      briefingResult = briefingCache.briefing;
    } else {
      briefingResult = await generateDailyBriefingResult(ctx);
      briefingCache = {
        timestamp: Date.now(),
        dateKey: ist.currentDateStr,
        taskHash,
        briefing: briefingResult,
      };
    }
    const speechText = briefingResult.spoken_briefing;

    if (format === "text") {
      // Plain text response if iPhone shortcut requests text directly
      return new Response(speechText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({
      status: "success",
      spoken_briefing: speechText,
      speech: speechText,
      text: speechText,
      bike_decision: briefingResult.bike_decision,
      bike_reason: briefingResult.bike_reason,
      priority: briefingResult.priority,
      sections: briefingResult.sections,
      date: ist.currentDateStr,
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
