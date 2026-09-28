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
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
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
            maxOutputTokens: 1000,
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
      // try next model
    }
  }

  throw new Error("All Gemini models temporarily unavailable");
}

// 1. Natural Language Task Parser ("tomorrow at 12 i should submit assignment")
export async function parseNaturalLanguageTask(userInput: string): Promise<ParsedTaskResult> {
  const now = new Date();
  const currentDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentTimeStr = now.toTimeString().slice(0, 5); // HH:mm
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });

  const prompt = `
You are a task extractor for a personal productivity system.
Current Date: ${currentDateStr} (${currentDay}), Current Time: ${currentTimeStr}.

Extract the assignment/task details from this user sentence:
"${userInput}"

Available Courses at GITAM for the user:
- Financial Management (19EID401)
- Usability Design of Software Applications (19ECB431)
- Cognitive Science and Analytics (19ECB447)
- Advanced Social, Text and Media Analytics (ASTMA / 19ECB455)
- IT workshop skylab / matlab (19ECB433)
- Human Resource Management (HRM / 19EID403)
- Project Evaluation I (19ECB491)

Return ONLY valid JSON matching this schema:
{
  "title": "string (short, clean title of what needs to be done)",
  "course": "string (e.g. 'ASTMA', 'Financial Management', 'HRM', or 'General')",
  "dueDate": "string in YYYY-MM-DDTHH:mm format. Resolve relative dates like 'tomorrow', 'friday', 'today at 12', 'next wednesday' accurately based on the current date ${currentDateStr})",
  "priority": "'high' | 'medium' | 'low'",
  "notes": "string (optional extra context)"
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
  } catch (error) {
    console.warn("Gemini parse failed, using rule-based fallback:", error);
    // Simple fallback
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
  const prompt = `
Generate a concise, spoken daily morning briefing for ${ctx.userName}.
This briefing will be read aloud by Siri on their iPhone at 6:30 AM.

Context:
- Current Day & Date: ${ctx.currentDay}, ${ctx.currentDateStr}
- Weather: ${ctx.weather.temp}°C, ${ctx.weather.description}, Rain Risk: ${ctx.weather.rainProbability}%
- Commute & Bike Decision: ${ctx.bikeDecision.verdict} (${ctx.bikeDecision.reason}). Distance: Gopalapatnam to GITAM University Rushikonda (~40 mins).
- Today's Classes: ${
    ctx.todayClasses.length > 0
      ? ctx.todayClasses.map((c) => `${c.courseName} at ${c.time}`).join(", ")
      : "No scheduled classes today (Day off / Weekend)"
  }
- Today's Deadlines: ${
    ctx.todayDeadlines.length > 0
      ? ctx.todayDeadlines.map((d) => `${d.title} (${d.course || "General"}) due at ${d.dueDate.slice(11, 16) || "end of day"}`).join(", ")
      : "None due today"
  }
- Upcoming Deadlines (next 2-3 days): ${
    ctx.upcomingDeadlines.length > 0
      ? ctx.upcomingDeadlines.map((d) => `${d.title} on ${d.dueDate.slice(0, 10)}`).join(", ")
      : "Nothing major in the next 48 hours"
  }
- Attendance Stats: Overall ${ctx.attendance.overallPercentage}%, ${ctx.attendance.bunksRemaining} safe bunks left.
- Top Tech News: ${ctx.news.map((n) => n.title).slice(0, 2).join("; ")}

Persona Guidelines:
- Combine JARVIS intelligence with a smart close friend vibe (natural Gen-Z tone).
- Address them naturally as "Shanmukha" or "Boss".
- Do NOT sound like a corporate robot. But also do NOT force cringe slang into every sentence.
- Be crisp, practical, and conversational.
- Include the bike verdict clearly (mentioning the 40 min ride to GITAM).
- Summarize classes simply (e.g., "You've got FM at 8, Usability at 9...").
- Keep news to 1 or 2 quick sentences on what actually matters.
- End with one direct, no-bullshit daily focus/motivation line (e.g., "Finish before you optimize" or "Get the SNA assignment out of the way before tonight-you starts negotiating with tomorrow-you").
- Keep total length between 130 and 180 words so Siri speaks it smoothly in under 60 seconds.
`;

  try {
    const briefing = await callGemini(prompt);
    return briefing.trim();
  } catch (error) {
    console.warn("Gemini briefing generation failed, using intelligent template:", error);
    const bikeTxt =
      ctx.bikeDecision.verdict === "TAKE_BIKE"
        ? `Weather is clean at ${ctx.weather.temp} degrees with ${ctx.weather.rainProbability}% rain risk. Bike is a yes for your 40-minute commute to GITAM.`
        : `Rain risk is at ${ctx.weather.rainProbability}%. Skip the bike today and take a cab or bus to GITAM.`;

    const classTxt =
      ctx.todayClasses.length > 0
        ? `You have ${ctx.todayClasses.length} classes today: ${ctx.todayClasses.map((c) => `${c.courseName} at ${c.time}`).join(", ")}.`
        : `No classes today. You're completely free on the schedule.`;

    const taskTxt =
      ctx.todayDeadlines.length > 0
        ? `You've got ${ctx.todayDeadlines.length} deadline today: ${ctx.todayDeadlines[0].title}.`
        : `Zero deadlines for today. Clean slate.`;

    return `Morning Shanmukha. ${bikeTxt}

${classTxt}

${taskTxt} Overall attendance is sitting strong at ${ctx.attendance.overallPercentage}% with ${ctx.attendance.bunksRemaining} safe bunks left.

Today's focus: Do the next useful thing and get the important stuff handled early. You're good to go.`;
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
