// Gemini AI integration for Natural Language parsing, Daily Briefing, and Voice Commands

export interface ParsedTaskResult {
  title: string;
  course?: string;
  dueDate: string; // YYYY-MM-DDTHH:mm
  priority: "high" | "medium" | "low";
  notes?: string;
}

export interface BriefingContext {
  userName: string;
  currentDateStr: string;
  currentDay: string;
  weather: {
    temp: number;
    description: string;
    rainProbability: number;
  };
  bikeDecision: {
    verdict: string;
    title: string;
    reason: string;
  };
  todayClasses: Array<{
    time: string;
    courseCode: string;
    courseName: string;
  }>;
  todayDeadlines: Array<{
    title: string;
    course?: string;
    dueDate: string;
    priority: string;
  }>;
  upcomingDeadlines: Array<{
    title: string;
    course?: string;
    dueDate: string;
    priority: string;
  }>;
  news: Array<{
    title: string;
    description: string;
  }>;
  attendance: {
    overallPercentage: number;
    bunksRemaining: number;
  };
}

export interface VoiceCommandResponse {
  action: "ADD_TASK" | "CHECK_SCHEDULE" | "CHECK_BIKE" | "CHECK_ATTENDANCE" | "CHAT";
  reply: string;
  taskData?: ParsedTaskResult;
}

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
];

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || "";

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s max per model

      const contents: any[] = [];
      if (systemInstruction) {
        contents.push({
          role: "user",
          parts: [{ text: `System Instruction: ${systemInstruction}\n\nTask:\n${prompt}` }],
        });
      } else {
        contents.push({
          role: "user",
          parts: [{ text: prompt }],
        });
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      // try next candidate model
    }
  }

  throw new Error("All Gemini models temporarily unavailable");
}

function formatClassesNaturally(classes: Array<{ time: string; courseCode: string; courseName: string }>): string {
  if (!classes || classes.length === 0) return "Schedule's wide open today, zero classes.";

  const friendlyNames: Record<string, string> = {
    "19EID401": "Financial Management",
    "19ECB431": "Usability",
    "19ECB447": "Cognitive Science",
    "19ECB455": "ASTMA",
    "19ECB433P": "IT Workshop Lab",
    "19ECB433": "IT Workshop",
    "19EID403": "HRM",
    "19ECB491": "Project Evaluation",
  };

  const formatted = classes.map((c) => {
    const name = friendlyNames[c.courseCode] || c.courseName.split(" ")[0];
    const match = c.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    const timeStr = match ? `${parseInt(match[1])} ${match[3]}` : c.time;
    return `${name} at ${timeStr}`;
  });

  if (formatted.length === 1) return `You've got just ${formatted[0]} today.`;
  const firstOnes = formatted.slice(0, -1).join(", ");
  const lastOne = formatted[formatted.length - 1];
  return `You've got ${firstOnes}, and ${lastOne}.`;
}

// 1. Natural Language Task Parser ("tomorrow at 12 i should submit assignment")
export async function parseNaturalLanguageTask(userInput: string): Promise<ParsedTaskResult> {
  const now = new Date();
  const currentDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentTimeStr = now.toTimeString().slice(0, 5); // HH:mm
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });

  const prompt = `
Extract assignment/task details from this user input: "${userInput}".
Current Date: ${currentDateStr} (${currentDay}), Time: ${currentTimeStr}.

Available GITAM courses:
- Financial Management (19EID401)
- Usability Design (19ECB431)
- Cognitive Science (19ECB447)
- ASTMA (19ECB455)
- IT Workshop (19ECB433)
- HRM (19EID403)
- Project Evaluation (19ECB491)

Return ONLY valid JSON:
{
  "title": "clean title",
  "course": "course name or General",
  "dueDate": "YYYY-MM-DDTHH:mm",
  "priority": "high|medium|low"
}
`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title || userInput,
      course: parsed.course || "General",
      dueDate: parsed.dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      priority: parsed.priority || "medium",
      notes: parsed.notes || "",
    };
  } catch {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(12, 0, 0, 0);
    return {
      title: userInput,
      course: "General",
      dueDate: tomorrow.toISOString().slice(0, 16),
      priority: "medium",
    };
  }
}

// 2. Generate Daily Briefing for iPhone Shortcut & Web
export async function generateDailyBriefingText(ctx: BriefingContext): Promise<string> {
  const topNewsTitle = ctx.news?.[0]?.title ? `"${ctx.news[0].title}"` : "tech developments in AI and mobile";

  const prompt = `
You are JARVIS, personal assistant and close friend to Shanmukha (call him Shanmukha or Boss).
Generate his spoken morning briefing for 6:30 AM Siri.

Context:
- Weather: ${ctx.weather.temp}°C, ${ctx.weather.description}, Rain Risk: ${ctx.weather.rainProbability}%
- Bike verdict: ${ctx.bikeDecision.verdict} (${ctx.bikeDecision.reason})
- Today's classes: ${ctx.todayClasses.map((c) => `${c.courseName} at ${c.time.split(" - ")[0]}`).join(", ") || "None"}
- Deadlines today: ${ctx.todayDeadlines.map((d) => `${d.title} at ${d.dueDate.slice(11, 16)}`).join(", ") || "None"}
- Upcoming deadlines: ${ctx.upcomingDeadlines.map((d) => d.title).join(", ") || "None"}
- Attendance: ${ctx.attendance.overallPercentage}% (${ctx.attendance.bunksRemaining} safe bunks left)
- Tech News Headline: ${topNewsTitle}

Rules:
- Sound like a smart best friend: relaxed, intelligent, Gen-Z vibe. NO corporate robotic bullet-list talk.
- NEVER list classes like "Financial Management at 08:00 AM - 09:00 AM, Usability Design...". Speak naturally like "You've got FM at 8, Usability at 9, Cognitive Science at 10..."
- Include the bike verdict clearly for his 40-min ride to GITAM.
- Mention the top tech news in one natural sentence.
- End with one direct, no-bullshit daily focus punchline.
- Keep it under 150 words total so it speaks smoothly in under 50 seconds.
`;

  try {
    const briefing = await callGemini(prompt);
    return briefing.trim();
  } catch (error) {
    const bikeTxt =
      ctx.bikeDecision.verdict === "TAKE_BIKE"
        ? `Weather's clean today at ${ctx.weather.temp} degrees, ${ctx.weather.description.toLowerCase()}, with basically no rain risk during your commute. Bike is a yes.`
        : `Rain risk is sitting at ${ctx.weather.rainProbability}%. Skip the bike today, take a cab or bus to GITAM.`;

    const classTxt = formatClassesNaturally(ctx.todayClasses);

    let deadlineTxt = "Zero deadlines today. Clean slate.";
    if (ctx.todayDeadlines.length > 0) {
      deadlineTxt = `You've got one deadline tonight: ${ctx.todayDeadlines[0].title}.`;
    } else if (ctx.upcomingDeadlines.length > 0) {
      deadlineTxt = `Nothing urgent tonight, but keep ${ctx.upcomingDeadlines[0].title} on your radar for tomorrow.`;
    }

    const newsTxt = ctx.news && ctx.news.length > 0
      ? `Quick tech highlight: ${ctx.news[0].title.slice(0, 90)}. Worth checking out if you get a minute.`
      : "Tech front is pretty quiet this morning.";

    return `Morning bro. ${bikeTxt}

${classTxt}

${deadlineTxt} Attendance is sitting safe at ${ctx.attendance.overallPercentage}% with ${ctx.attendance.bunksRemaining} safe bunks left.

${newsTxt}

Today's focus: Get the important shit done before tonight-you starts negotiating with tomorrow-you. You're good to go.`;
  }
}

// 3. Process Two-Way Voice Commands ("Hey Siri, JARVIS")
export async function processVoiceCommand(
  transcript: string,
  context: {
    classesToday: any[];
    weather: any;
    bikeDecision: any;
    attendance: any;
  }
): Promise<VoiceCommandResponse> {
  const prompt = `
You are JARVIS, personal AI assistant for Shanmukha (Boss).
The user just spoke to their iPhone Siri shortcut:
"${transcript}"

Current context:
- Classes today: ${JSON.stringify(context.classesToday)}
- Weather: ${context.weather.temp}°C, rain risk ${context.weather.rainProbability}%
- Bike decision: ${context.bikeDecision.verdict} (${context.bikeDecision.reason})
- Attendance: ${context.attendance.overallPercentage}%

Determine the user's intent and return a JSON object:
If they want to add a task/assignment/deadline:
{
  "action": "ADD_TASK",
  "reply": "Conversational confirmation for Siri to speak (e.g. 'Got it Boss, added SNA assignment due tomorrow at 12 PM.')",
  "taskData": {
    "title": "title",
    "course": "course or General",
    "dueDate": "YYYY-MM-DDTHH:mm",
    "priority": "high|medium|low"
  }
}

If they ask about taking their bike / weather / commute:
{
  "action": "CHECK_BIKE",
  "reply": "Conversational answer on bike verdict and weather"
}

If they ask about classes / timetable / schedule:
{
  "action": "CHECK_SCHEDULE",
  "reply": "Conversational summary of their classes"
}

If they ask about attendance:
{
  "action": "CHECK_ATTENDANCE",
  "reply": "Conversational summary of attendance and safe bunks"
}

Otherwise:
{
  "action": "CHAT",
  "reply": "Short, clever, Gen-Z JARVIS response"
}

Return ONLY valid JSON.
`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn("Voice command parse fallback:", error);
    return {
      action: "CHAT",
      reply: `On it Boss. Received: "${transcript}". All systems running smoothly.`,
    };
  }
}
