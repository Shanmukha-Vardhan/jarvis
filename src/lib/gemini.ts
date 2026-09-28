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
    verdict: "TAKE_BIKE" | "SKIP_BIKE" | "CAUTION";
    title: string;
    reason: string;
    details?: string;
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
    shortageCourses?: Array<{
      code: string;
      name: string;
      percentage: number;
      needed: number;
    }>;
  };
}

export interface DailyBriefingResult {
  spoken_briefing: string;
  bike_decision: "TAKE_BIKE" | "SKIP_BIKE" | "CAUTION";
  bike_reason: string;
  priority: string;
  sections: {
    weather: boolean;
    classes: boolean;
    deadlines: boolean;
    upcoming_deadlines: boolean;
    attendance: boolean;
    news: boolean;
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
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s max per attempt

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

        // If 503 high demand spike, brief 500ms pause then retry
        if (res.status === 503) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
      } catch (e) {
        // try next attempt or candidate model
      }
    }
  }

  throw new Error("All Gemini models temporarily unavailable");
}

// -------------------------------------------------------------
// Indian Standard Time (Asia/Kolkata, UTC+5:30) Calendar Utilities
// -------------------------------------------------------------

export interface ISTDateTimeContext {
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;
  hours: number;
  minutes: number;
  currentDateStr: string; // YYYY-MM-DD
  currentTimeStr: string; // HH:mm
  calendarMap: Array<{ label: string; weekday: string; dateStr: string }>;
}

export function getNowIST(): ISTDateTimeContext {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = istFormatter.formatToParts(now);
  const findPart = (t: string) => parts.find((p) => p.type === t)?.value || "";

  const year = parseInt(findPart("year"), 10) || 2026;
  const month = parseInt(findPart("month"), 10) || 9;
  const day = parseInt(findPart("day"), 10) || 28;
  const dayOfWeek = findPart("weekday") || "Monday";
  const hours = parseInt(findPart("hour"), 10) || 12;
  const minutes = parseInt(findPart("minute"), 10) || 0;

  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const hoursStr = String(hours).padStart(2, "0");
  const minStr = String(minutes).padStart(2, "0");

  const baseUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const calendarMap: Array<{ label: string; weekday: string; dateStr: string }> = [];

  for (let i = 0; i <= 7; i++) {
    const d = new Date(baseUTC.getTime() + i * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dn = String(d.getUTCDate()).padStart(2, "0");
    const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday;
    calendarMap.push({ label, weekday, dateStr: `${y}-${m}-${dn}` });
  }

  return {
    year,
    month,
    day,
    dayOfWeek,
    hours,
    minutes,
    currentDateStr: `${year}-${monthStr}-${dayStr}`,
    currentTimeStr: `${hoursStr}:${minStr}`,
    calendarMap,
  };
}

export function parseTaskLocally(input: string): ParsedTaskResult {
  const ist = getNowIST();
  const lower = input.toLowerCase();

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const currentDayIndex = weekdays.indexOf(ist.dayOfWeek.toLowerCase());

  let targetDateStr = ist.calendarMap[1]?.dateStr || ist.currentDateStr; // default tomorrow

  if (lower.includes("day after tomorrow")) {
    targetDateStr = ist.calendarMap[2]?.dateStr || targetDateStr;
  } else if (lower.includes("tomorrow")) {
    targetDateStr = ist.calendarMap[1]?.dateStr || targetDateStr;
  } else if (lower.includes("today") || lower.includes("tonight")) {
    targetDateStr = ist.currentDateStr;
  } else {
    for (let i = 0; i < weekdays.length; i++) {
      const w = weekdays[i];
      if (new RegExp(`\\b${w}\\b`).test(lower)) {
        let diff = (i - currentDayIndex + 7) % 7;
        if (diff === 0) diff = 7;
        targetDateStr = ist.calendarMap[diff]?.dateStr || targetDateStr;
        break;
      }
    }
  }

  let timeStr = "12:00"; // default noon for assignments
  const explicitTimeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)|at\s+(\d{1,2})(?::(\d{2}))?/);
  if (explicitTimeMatch) {
    let hour = parseInt(explicitTimeMatch[1] || explicitTimeMatch[4], 10);
    const min = parseInt(explicitTimeMatch[2] || explicitTimeMatch[5] || "0", 10);
    const meridiem = explicitTimeMatch[3];

    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (!meridiem && hour === 12) hour = 12;
    timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else if (lower.includes("tonight") || lower.includes("end of day") || lower.includes("midnight")) {
    timeStr = "23:59";
  }

  let course = "General";
  if (/astma|social|text/i.test(input)) course = "ASTMA";
  else if (/financial|fm/i.test(input)) course = "Financial Management";
  else if (/usability|design/i.test(input)) course = "Usability Design";
  else if (/cognitive/i.test(input)) course = "Cognitive Science";
  else if (/workshop|matlab|skylab/i.test(input)) course = "IT Workshop";
  else if (/hrm|human resource/i.test(input)) course = "HRM";
  else if (/project|review/i.test(input)) course = "Project Evaluation";

  let title = input
    .replace(/^(tomorrow|today|tonight|yesterday)\s*(at\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\s*(i\s+should|i\s+need\s+to|i\s+have\s+to)?\s*/i, "")
    .replace(/^(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\s*/i, "")
    .trim();
  title = title ? title.charAt(0).toUpperCase() + title.slice(1) : input;

  return {
    title,
    course,
    dueDate: `${targetDateStr}T${timeStr}`,
    priority: /urgent|important|asap|critical/i.test(input) ? "high" : "medium",
    notes: `Added from: "${input}"`,
  };
}

// 1. Natural Language Task Parser ("tomorrow at 12 i should submit assignment")
export async function parseNaturalLanguageTask(userInput: string): Promise<ParsedTaskResult> {
  const localDefault = parseTaskLocally(userInput);
  const ist = getNowIST();

  const calendarRef = ist.calendarMap
    .map((c) => `- ${c.label} (${c.weekday}): ${c.dateStr}`)
    .join("\n");

  const prompt = `
Extract task details from this user text: "${userInput}".
Timezone: Asia/Kolkata (IST, UTC+5:30).
Today is: ${ist.currentDateStr} (${ist.dayOfWeek}), Current Time: ${ist.currentTimeStr}.

CALENDAR REFERENCE:
${calendarRef}

COURSES:
- Financial Management (19EID401)
- Usability Design (19ECB431)
- Cognitive Science (19ECB447)
- ASTMA (19ECB455)
- IT Workshop (19ECB433)
- HRM (19EID403)
- Project Evaluation (19ECB491)

CRITICAL RULES FOR DUE DATE:
- If user says "tomorrow at 12", dueDate MUST be "${ist.calendarMap[1]?.dateStr}T12:00" (noon). NEVER output 06:30 or UTC offset!
- If user says "Wednesday 10am", match Wednesday's exact date from the calendar reference at 10:00.
- Return dueDate strictly as local wall-clock "YYYY-MM-DDTHH:mm". Do NOT convert to UTC!
- Clean the title: remove "tomorrow at 12 i should", "i have to submit", etc.

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

    const validDueDate =
      typeof parsed.dueDate === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(parsed.dueDate)
        ? parsed.dueDate
        : localDefault.dueDate;

    return {
      title: parsed.title || localDefault.title,
      course: parsed.course || localDefault.course,
      dueDate: validDueDate,
      priority: parsed.priority || localDefault.priority,
      notes: `Parsed from: "${userInput}"`,
    };
  } catch {
    return localDefault;
  }
}

// -------------------------------------------------------------
// 2. Gen-Z Daily Briefing Engine for iPhone Shortcuts & Web
// -------------------------------------------------------------

function sanitizeSpokenText(text: string): string {
  return text
    .replace(/\\"/g, "")
    .replace(/\\'/g, "'")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildGenZBriefingFallback(ctx: BriefingContext): DailyBriefingResult {
  const bikeTxt =
    ctx.bikeDecision.verdict === "TAKE_BIKE"
      ? `Weather's chill today, ${ctx.weather.temp}° and only ${ctx.weather.rainProbability}% rain, so yeah, definitely take the bike. Commute to GITAM is around 40 minutes.`
      : `Rain risk is sitting at ${ctx.weather.rainProbability}%. Skip the bike today bro, take a cab or bus to campus.`;

  let scheduleTxt = "";
  const classCount = ctx.todayClasses.length;
  if (classCount === 0) {
    scheduleTxt = "Schedule's completely open today, zero classes.";
  } else if (classCount >= 5) {
    scheduleTxt = `You're kinda packed today with ${classCount} classes running from 8 to 4, with lab after lunch.`;
  } else {
    scheduleTxt = `You've got ${classCount} classes today wrapping up by noon, so your afternoon is wide open.`;
  }

  let attendanceTxt = "";
  let includeAttendance = false;
  const shortage = ctx.attendance.shortageCourses?.[0];
  if (shortage && shortage.percentage < 75) {
    includeAttendance = true;
    attendanceTxt = `Real talk on attendance: overall is chilling at ${ctx.attendance.overallPercentage}%, but ${shortage.name} is down bad at ${shortage.percentage}%. Do not bunk that 8 AM today, you need those classes.`;
  }

  let deadlineTxt = "";
  const hasTodayDeadlines = ctx.todayDeadlines.length > 0;
  const hasUpcoming = ctx.upcomingDeadlines.length > 0;

  if (hasTodayDeadlines) {
    deadlineTxt = `You've got a deadline tonight: ${ctx.todayDeadlines[0].title}.`;
  } else if (hasUpcoming) {
    deadlineTxt = `No deadlines tonight so you're chilling, but keep ${ctx.upcomingDeadlines[0].title} on your radar for tomorrow.`;
  } else {
    deadlineTxt = "Zero deadlines today, clean slate.";
  }

  let newsTxt = "";
  let includeNews = false;
  if (ctx.news && ctx.news.length > 0) {
    includeNews = true;
    const cleanNews = ctx.news[0].title.replace(/["']/g, "").slice(0, 85);
    newsTxt = `Quick tech drop: ${cleanNews}, kinda wild.`;
  }

  const parts = [
    "Morning bro.",
    bikeTxt,
    scheduleTxt,
    attendanceTxt,
    deadlineTxt,
    newsTxt,
    shortage
      ? "Today's focus: lock in, survive the schedule, and fix that FM attendance. Go cook."
      : "Today's focus: lock in, knock out the important stuff early, and go cook.",
  ].filter(Boolean);

  const cleanSpoken = sanitizeSpokenText(parts.join(" "));

  return {
    spoken_briefing: cleanSpoken,
    bike_decision: ctx.bikeDecision.verdict,
    bike_reason: `${ctx.weather.temp}°C, ${ctx.weather.description}, ${ctx.weather.rainProbability}% rain risk`,
    priority: shortage ? `Attend 8 AM ${shortage.name}` : "Lock in on schedule",
    sections: {
      weather: true,
      classes: classCount > 0,
      deadlines: hasTodayDeadlines,
      upcoming_deadlines: hasUpcoming,
      attendance: includeAttendance,
      news: includeNews,
    },
  };
}

export async function generateDailyBriefingResult(ctx: BriefingContext): Promise<DailyBriefingResult> {
  const topNewsTitle = ctx.news?.[0]?.title
    ? ctx.news[0].title.replace(/["']/g, "").slice(0, 90)
    : "new advancements in AI and software tools";

  const shortageCourse = ctx.attendance.shortageCourses?.[0];
  const needsAttendanceWarning = Boolean(shortageCourse && shortageCourse.percentage < 75);

  const prompt = `
You are Shanmukha's personal AI co-pilot and best friend.
Talk to him like a smart, chill Gen-Z friend on a voice note.

ABSOLUTE TONE RULES:
- NEVER say "Boss", "Rise and shine", "I am giving you the green light", "It is 29 degrees", or "we have a situation". That sounds like an old butler robot.
- Talk like a genuine college buddy: use natural phrasing ("Morning bro", "Weather's chill", "You're kinda packed today", "Real talk on attendance", "down at 68%", "don't bunk", "chilling on deadlines", "kinda wild", "lock in", "go cook").
- Don't force cringe slang like "skibidi" or "bussin"—keep it real, modern conversational texting/talking.

DATA:
- Weather: ${ctx.weather.temp}°C, ${ctx.weather.description}, Rain Risk: ${ctx.weather.rainProbability}%
- Bike verdict: ${ctx.bikeDecision.verdict} (Commute is 40 mins from Gopalapatnam to GITAM University Rushikonda)
- Schedule: ${ctx.todayClasses.length} classes (${ctx.todayClasses.map((c) => c.courseName).join(", ") || "None"})
- Deadlines today: ${ctx.todayDeadlines.map((d) => d.title).join(", ") || "None"}
- Upcoming deadlines (next 2-3 days): ${ctx.upcomingDeadlines.map((d) => d.title).join(", ") || "None"}
- Attendance: Overall ${ctx.attendance.overallPercentage}% (${ctx.attendance.bunksRemaining} safe bunks). ${
    needsAttendanceWarning
      ? `CRITICAL SHORTAGE: ${shortageCourse?.name} is down at ${shortageCourse?.percentage}% (below 75% cutoff, needs ${shortageCourse?.needed} classes). You MUST specifically warn him not to bunk ${shortageCourse?.name} today!`
      : "Attendance across all courses is healthy. DO NOT mention attendance in the spoken briefing."
  }
- Top Tech News: "${topNewsTitle}"

BRIEFING GUIDELINES:
1. spoken_briefing must be under 120 words (~40-50 seconds when spoken aloud).
2. Summarize classes naturally in 1 sentence. Do NOT read all 6 start and end times!
3. Give clear bike decision right away ("take the bike" or "skip the bike").
4. ATTENDANCE: If there is a shortage (like Financial Management at 68.8%), specifically warn him not to bunk it today. If attendance is healthy, SKIP the attendance section completely!
5. Mention today's deadlines (or "chilling on deadlines") and any upcoming deadline.
6. Drop the top tech highlight naturally in 1 sentence.
7. Finish with a contextual daily focus line ("Go cook", "Lock in").
8. Clean text: NO escaped quotation marks, NO asterisks (**), NO backticks.

Return ONLY a valid JSON object matching this schema:
{
  "spoken_briefing": "clean spoken text for Siri",
  "bike_decision": "${ctx.bikeDecision.verdict}",
  "bike_reason": "${ctx.weather.temp}°C, ${ctx.weather.description}, ${ctx.weather.rainProbability}% rain risk",
  "priority": "short focus phrase",
  "sections": {
    "weather": true,
    "classes": ${ctx.todayClasses.length > 0},
    "deadlines": ${ctx.todayDeadlines.length > 0},
    "upcoming_deadlines": ${ctx.upcomingDeadlines.length > 0},
    "attendance": ${needsAttendanceWarning},
    "news": ${ctx.news.length > 0}
  }
}
`;

  try {
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const spoken = sanitizeSpokenText(parsed.spoken_briefing || "");
    if (!spoken || spoken.length < 20) {
      throw new Error("Briefing speech too short");
    }

    return {
      spoken_briefing: spoken,
      bike_decision: parsed.bike_decision || ctx.bikeDecision.verdict,
      bike_reason: parsed.bike_reason || `${ctx.weather.temp}°C, ${ctx.weather.rainProbability}% rain risk`,
      priority: parsed.priority || (needsAttendanceWarning ? `Attend 8 AM ${shortageCourse?.name}` : "Lock in on schedule"),
      sections: {
        weather: Boolean(parsed.sections?.weather ?? true),
        classes: Boolean(parsed.sections?.classes ?? (ctx.todayClasses.length > 0)),
        deadlines: Boolean(parsed.sections?.deadlines ?? (ctx.todayDeadlines.length > 0)),
        upcoming_deadlines: Boolean(parsed.sections?.upcoming_deadlines ?? (ctx.upcomingDeadlines.length > 0)),
        attendance: Boolean(parsed.sections?.attendance ?? needsAttendanceWarning),
        news: Boolean(parsed.sections?.news ?? (ctx.news.length > 0)),
      },
    };
  } catch (error) {
    console.warn("Gemini briefing generation failed or spike, using Gen-Z fallback:", error);
    return buildGenZBriefingFallback(ctx);
  }
}

export async function generateDailyBriefingText(ctx: BriefingContext): Promise<string> {
  const result = await generateDailyBriefingResult(ctx);
  return result.spoken_briefing;
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
