import { NextResponse } from "next/server";
import { fetchTasks, saveTask, updateTaskStatus, removeTask, TaskItem } from "@/lib/firebase";
import { parseNaturalLanguageTask } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await fetchTasks();
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Natural Language Magic Add support!
    // If user provided a prompt like "tomorrow at 12 i should submit assignment"
    if (body.prompt && typeof body.prompt === "string") {
      const parsed = await parseNaturalLanguageTask(body.prompt);
      const newTask = await saveTask({
        title: parsed.title,
        course: parsed.course || "General",
        dueDate: parsed.dueDate,
        priority: parsed.priority || "medium",
        completed: false,
        notes: parsed.notes || `Parsed from: "${body.prompt}"`,
      });
      return NextResponse.json({ task: newTask, parsed });
    }

    // Standard manual add
    const { title, course, dueDate, priority, notes } = body;
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const newTask = await saveTask({
      title,
      course: course || "General",
      dueDate: dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      priority: priority || "medium",
      completed: false,
      notes: notes || "",
    });

    return NextResponse.json({ task: newTask });
  } catch (error: any) {
    console.error("Task creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, completed } = body;

    if (!id || typeof completed !== "boolean") {
      return NextResponse.json({ error: "id and completed are required" }, { status: 400 });
    }

    await updateTaskStatus(id, completed);
    return NextResponse.json({ success: true, id, completed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
    }

    await removeTask(id);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
