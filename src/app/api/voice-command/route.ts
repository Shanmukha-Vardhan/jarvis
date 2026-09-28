import { NextResponse } from "next/server";
import { getLiveWeather, evaluateBikeDecision, getGitamAttendance } from "@/lib/services";
import { getTodayClasses } from "@/lib/timetableData";
import { saveTask } from "@/lib/firebase";
import { processVoiceCommand } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body.text || body.prompt || body.transcript;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { reply: "I didn't catch that, Boss. Could you say it again?" },
        { status: 400 }
      );
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });

    // Concurrent context fetch
    const [weather, attendance] = await Promise.all([
      getLiveWeather(),
      getGitamAttendance(),
    ]);

    const bikeDecision = evaluateBikeDecision(weather);
    const classesToday = getTodayClasses(currentDay);

    // Call Gemini voice processor
    const result = await processVoiceCommand(text, {
      classesToday,
      weather,
      bikeDecision,
      attendance,
    });

    // If intent was to add task, save to Firestore immediately!
    let savedTask = null;
    if (result.action === "ADD_TASK" && result.taskData) {
      savedTask = await saveTask({
        title: result.taskData.title,
        course: result.taskData.course || "General",
        dueDate: result.taskData.dueDate,
        priority: result.taskData.priority || "medium",
        completed: false,
        notes: result.taskData.notes || "Added via Voice Command",
      });
    }

    return NextResponse.json({
      status: "success",
      reply: result.reply,
      action: result.action,
      task: savedTask,
    });
  } catch (error: any) {
    console.error("Voice command error:", error);
    return NextResponse.json(
      {
        status: "error",
        reply: "Sorry Boss, had a hiccup processing that. Try again in a second.",
        error: error?.message,
      },
      { status: 500 }
    );
  }
}
