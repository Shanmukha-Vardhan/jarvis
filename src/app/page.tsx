"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bike,
  CloudRain,
  Sun,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Trash2,
  Volume2,
  VolumeX,
  RefreshCw,
  Send,
  Smartphone,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  GraduationCap,
  Newspaper,
  Mic,
  MicOff,
  Copy,
  Check,
  Plus,
} from "lucide-react";
import { OFFICIAL_TIMETABLE, COURSE_NAMES, ClassSlot } from "@/lib/timetableData";

interface Task {
  id?: string;
  title: string;
  course?: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  notes?: string;
}

interface DailyBriefingData {
  text: string;
  speech: string;
  date: string;
  day: string;
  weather: {
    temp: number;
    description: string;
    rainProbability: number;
    city: string;
    humidity: number;
    windSpeed: number;
  };
  bikeDecision: {
    verdict: "TAKE_BIKE" | "SKIP_BIKE" | "CAUTION";
    title: string;
    reason: string;
    details: string;
  };
  todayClasses: Array<{
    time: string;
    courseCode: string;
    courseName: string;
  }>;
  attendance: {
    overallPercentage: number;
    totalAttended: number;
    totalClasses: number;
    bunksRemaining: number;
    statusText: string;
    shortageCourses: Array<{
      code: string;
      name: string;
      percentage: number;
      needed: number;
    }>;
  };
  news: Array<{
    title: string;
    description: string;
    source: string;
    url: string;
  }>;
}

export default function Dashboard() {
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Quick Add input
  const [quickInput, setQuickInput] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Audio / Speech State
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Timetable Day Selector
  const [selectedDay, setSelectedDay] = useState<string>("Monday");

  // Filter Tasks
  const [taskFilter, setTaskFilter] = useState<"all" | "today" | "upcoming" | "completed">("all");

  // Voice simulator
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceReply, setVoiceReply] = useState<string | null>(null);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Shortcut Modal
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Current live time
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine today's day on mount
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    if (OFFICIAL_TIMETABLE[today]) {
      setSelectedDay(today);
    }
  }, []);

  // Load Briefing
  const loadBriefing = async () => {
    setLoadingBriefing(true);
    try {
      const res = await fetch("/api/daily-briefing");
      const data = await res.json();
      if (data.status === "success") {
        setBriefing(data);
      }
    } catch (e) {
      console.error("Error loading briefing:", e);
    } finally {
      setLoadingBriefing(false);
    }
  };

  // Load Tasks
  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error("Error loading tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadBriefing();
    loadTasks();
  }, []);

  // Natural Language Task Quick-Add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    setAddingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: quickInput.trim() }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        setQuickInput("");
      }
    } catch (err) {
      console.error("Task add error:", err);
    } finally {
      setAddingTask(false);
    }
  };

  // Toggle Task Completion
  const toggleTask = async (task: Task) => {
    if (!task.id) return;
    const newStatus = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: newStatus } : t))
    );
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, completed: newStatus }),
      });
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  // Delete Task
  const deleteTask = async (id?: string) => {
    if (!id) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Speech Synthesizer for Briefing
  const toggleSpeech = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (briefing?.speech) {
      const utterance = new SpeechSynthesisUtterance(briefing.speech);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Interactive Voice Simulator
  const handleVoiceSubmit = async (textToSend?: string) => {
    const text = textToSend || voiceQuery;
    if (!text.trim()) return;

    setProcessingVoice(true);
    setVoiceReply(null);

    try {
      const res = await fetch("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setVoiceReply(data.reply);

      // If a task was added, reload task list
      if (data.action === "ADD_TASK") {
        loadTasks();
      }

      // Speak reply aloud
      if (window.speechSynthesis && data.reply) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(data.reply);
        window.speechSynthesis.speak(utter);
      }
    } catch (err) {
      setVoiceReply("Connection failed. Try again.");
    } finally {
      setProcessingVoice(false);
      setVoiceQuery("");
    }
  };

  // Web Speech Recognition for Voice Simulator
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. You can type in the voice box!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceQuery(transcript);
      handleVoiceSubmit(transcript);
    };

    recognition.start();
  };

  // Filtered Task List
  const todayStr = new Date().toISOString().slice(0, 10);
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "completed") return t.completed;
    if (taskFilter === "today") return !t.completed && t.dueDate.startsWith(todayStr);
    if (taskFilter === "upcoming") return !t.completed && !t.dueDate.startsWith(todayStr);
    return true;
  });

  return (
    <div className="min-h-screen bg-white text-zinc-950 flex flex-col font-sans">
      {/* Top Ambient Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-mono font-bold text-sm tracking-wider shadow-sm">
              J
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-zinc-950 text-sm sm:text-base">
                  JARVIS OS
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-300">
                  LIVE • GITAM
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Gopalapatnam ➡️ GITAM Rushikonda
              </p>
            </div>
          </div>

          {/* Center Clock */}
          <div className="hidden md:flex items-center gap-2 font-mono text-xs text-zinc-600 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-200">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{currentTime || "06:30:00 AM"}</span>
            <span className="text-zinc-300">|</span>
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowShortcutModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-zinc-700" />
              <span>iPhone Shortcut</span>
            </button>

            <button
              onClick={() => {
                loadBriefing();
                loadTasks();
              }}
              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 transition-colors"
              title="Refresh All Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBriefing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* HERO SECTION: Bike Verdict & Morning Briefing */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Commute & Bike Decision Card */}
          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-medium">
                  Commute & Bike Engine
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    briefing?.bikeDecision.verdict === "TAKE_BIKE"
                      ? "bg-zinc-950 text-white"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  {briefing?.bikeDecision.verdict === "TAKE_BIKE" ? "TAKE BIKE ✅" : "SKIP BIKE 🌧️"}
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-zinc-950 mb-2">
                {briefing?.bikeDecision.title || "Checking Live Weather..."}
              </h2>
              <p className="text-sm text-zinc-700 font-medium leading-relaxed mb-4">
                {briefing?.bikeDecision.reason}
              </p>
              <p className="text-xs text-zinc-500 bg-zinc-50 p-3 rounded-xl border border-zinc-200 leading-normal">
                {briefing?.bikeDecision.details}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
              <div className="flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-zinc-600" />
                <span>Rain Risk: <strong>{briefing?.weather.rainProbability ?? 10}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-zinc-600" />
                <span>
                  Temp: <strong>{briefing?.weather.temp ?? 29}°C</strong> ({Math.round(((briefing?.weather.temp ?? 29) * 9) / 5 + 32)}°F)
                </span>
              </div>
              <div>
                <span>Threshold: <strong>60%</strong></span>
              </div>
            </div>
          </div>

          {/* Daily Briefing Executive Card */}
          <div className="lg:col-span-8 bg-zinc-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-medium">
                    Daily Executive Briefing • {briefing?.date || "Today"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSpeech}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-colors"
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Listen Aloud</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={loadBriefing}
                    className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    title="Regenerate Briefing"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingBriefing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {loadingBriefing ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-400 space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-zinc-200" />
                  <p className="text-sm font-mono">Synthesizing personal briefing from Firebase & live feeds...</p>
                </div>
              ) : (
                <div className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal whitespace-pre-line tracking-normal">
                  {briefing?.text}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span>Persona: Gen-Z + JARVIS Brain</span>
              <span>Siri Briefing Ready • 6:30 AM Trigger</span>
            </div>
          </div>
        </section>

        {/* MAGIC QUICK-ADD INPUT BAR */}
        <section className="bg-zinc-50 border border-zinc-300 rounded-2xl p-4 sm:p-5 shadow-xs">
          <form onSubmit={handleQuickAdd} className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="quick-add"
                className="text-xs font-mono uppercase tracking-wider text-zinc-700 font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
                <span>Magic Task & Assignment Add (Natural Language)</span>
              </label>
              <span className="text-[11px] text-zinc-500 font-mono hidden sm:block">
                Powered by Gemini AI • Auto-detects date, time, course & priority
              </span>
            </div>

            <div className="flex gap-2">
              <input
                id="quick-add"
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder='Type any sentence: e.g. "tomorrow at 12 i should submit assignment", "friday 5pm cognitive science lab record review"'
                className="flex-1 bg-white border border-zinc-300 rounded-xl px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 transition-colors shadow-2xs"
                disabled={addingTask}
              />
              <button
                type="submit"
                disabled={addingTask || !quickInput.trim()}
                className="px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-medium text-sm flex items-center gap-2 transition-colors shrink-0 shadow-sm"
              >
                {addingTask ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Quick Add</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* TWO-COLUMN GRID: TASKS & ATTENDANCE vs TIMETABLE & NEWS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: Tasks & Deadlines (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Deadlines Section */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 tracking-tight">
                    Assignments & Deadlines
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Source of truth in Firestore. Tracked for daily briefings.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs">
                  <button
                    onClick={() => setTaskFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      taskFilter === "all" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    All ({tasks.length})
                  </button>
                  <button
                    onClick={() => setTaskFilter("today")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      taskFilter === "today" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setTaskFilter("upcoming")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      taskFilter === "upcoming" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => setTaskFilter("completed")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      taskFilter === "completed" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* Task Items List */}
              {loadingTasks ? (
                <div className="py-8 text-center text-sm text-zinc-400">Loading tasks...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  <p className="text-sm text-zinc-500 font-medium">No deadlines in this view.</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Use the magic quick-add bar above to create one in natural language!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTasks.map((t) => (
                    <div
                      key={t.id || t.title}
                      className={`group flex items-start justify-between p-3.5 rounded-xl border transition-all ${
                        t.completed
                          ? "bg-zinc-50 border-zinc-200 opacity-60"
                          : "bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => toggleTask(t)}
                          className="mt-0.5 text-zinc-400 hover:text-zinc-950 transition-colors shrink-0"
                        >
                          {t.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-zinc-950 fill-zinc-950 stroke-white" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-400 hover:text-zinc-900" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium tracking-tight truncate ${
                              t.completed ? "line-through text-zinc-400" : "text-zinc-900"
                            }`}
                          >
                            {t.title}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-zinc-500">
                            {t.course && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 font-medium text-[11px]">
                                {t.course}
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-zinc-600">
                              Due: {new Date(t.dueDate).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-medium ${
                                t.priority === "high"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : t.priority === "medium"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {t.priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteTask(t.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0 ml-2"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live GITAM Attendance Tracker Card */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-zinc-950" />
                  <h3 className="text-lg font-bold text-zinc-950 tracking-tight">
                    GITAM Attendance Status
                  </h3>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-300">
                  {briefing?.attendance.statusText || "Safe ✅"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="text-[11px] text-zinc-500 font-mono uppercase">Overall</span>
                  <p className="text-2xl font-bold text-zinc-950 mt-0.5">
                    {briefing?.attendance.overallPercentage ?? 88.8}%
                  </p>
                  <span className="text-[10px] text-zinc-500">Target: 75%</span>
                </div>

                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="text-[11px] text-zinc-500 font-mono uppercase">Safe Bunks</span>
                  <p className="text-2xl font-bold text-zinc-950 mt-0.5">
                    {briefing?.attendance.bunksRemaining ?? 47}
                  </p>
                  <span className="text-[10px] text-zinc-500">Available across terms</span>
                </div>

                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-zinc-500 font-mono uppercase">Attended</span>
                  <p className="text-2xl font-bold text-zinc-950 mt-0.5">
                    {briefing?.attendance.totalAttended ?? 230}
                    <span className="text-xs text-zinc-400 font-normal">
                      /{briefing?.attendance.totalClasses ?? 259}
                    </span>
                  </p>
                  <span className="text-[10px] text-zinc-500">Live tracker sync</span>
                </div>
              </div>

              {/* Shortage warning banner if any course is below 75% */}
              {briefing?.attendance?.shortageCourses &&
                briefing.attendance.shortageCourses.length > 0 && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Attendance Shortage Alert</span>
                    </div>
                    {briefing.attendance.shortageCourses.map((c) => (
                      <p key={c.code} className="text-xs text-amber-800">
                        • <strong>{c.name} ({c.code})</strong>: Sitting at {c.percentage}%. Needs{" "}
                        {c.needed} consecutive classes to reach 75%.
                      </p>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* RIGHT COLUMN: Timetable & News (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Interactive Weekly Timetable Card */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 tracking-tight">
                    Weekly Timetable
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Official schedule for Semester 7
                  </p>
                </div>
              </div>

              {/* Day Selector Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                      selectedDay === day
                        ? "bg-zinc-950 text-white font-semibold"
                        : "bg-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>

              {/* Day Classes List */}
              <div className="space-y-2.5">
                {OFFICIAL_TIMETABLE[selectedDay]?.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-xl">
                    No classes scheduled for {selectedDay}. Enjoy the break!
                  </div>
                ) : (
                  OFFICIAL_TIMETABLE[selectedDay]?.map((c) => (
                    <div
                      key={`${selectedDay}-${c.slot}-${c.courseCode}`}
                      className="p-3 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-zinc-500 text-[11px]">
                            {c.time}
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="font-semibold text-zinc-950 truncate">
                            {c.courseName}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          Code: {c.courseCode}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold shrink-0 ${
                          c.type === "lab"
                            ? "bg-zinc-950 text-white"
                            : "bg-zinc-100 text-zinc-700 border border-zinc-300"
                        }`}
                      >
                        {c.type === "lab" ? "LAB" : "THEORY"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Free Afternoon Badge for Wed/Thu/Fri */}
              {(selectedDay === "Wednesday" || selectedDay === "Thursday" || selectedDay === "Friday") && (
                <div className="mt-3 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-xs text-zinc-600 font-medium">
                  🎉 Afternoon Free after 12:00 PM
                </div>
              )}
            </div>

            {/* Curated News Digest Card */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-zinc-950" />
                  <h3 className="text-lg font-bold text-zinc-950 tracking-tight">
                    Curated Tech & Local News
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">Recent 2-3 Days</span>
              </div>

              <div className="space-y-3">
                {briefing?.news && briefing.news.length > 0 ? (
                  briefing.news.slice(0, 3).map((art, idx) => (
                    <a
                      key={idx}
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-xl border border-zinc-200 hover:border-zinc-400 bg-white hover:shadow-2xs transition-all group"
                    >
                      <h4 className="text-xs font-semibold text-zinc-950 group-hover:underline line-clamp-2">
                        {art.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1">
                        {art.description}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-400 font-mono">
                        <span>{art.source}</span>
                        <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-zinc-950" />
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="text-xs text-zinc-400 text-center py-4">No recent headlines.</p>
                )}
              </div>
            </div>

            {/* Interactive Siri Voice Simulator */}
            <div className="bg-zinc-950 text-white rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-bold tracking-tight text-white">
                    Siri / Voice Simulator ("Hey Siri, JARVIS")
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Two-Way Voice</span>
              </div>

              <p className="text-xs text-zinc-400">
                Test how your iPhone Shortcut will respond to questions like: <em>"Can I take my bike today?"</em> or <em>"Add assignment due tomorrow at 12"</em>.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={voiceQuery}
                  onChange={(e) => setVoiceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVoiceSubmit()}
                  placeholder='Say or type: "Should I take my bike?"'
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-zinc-400"
                />
                <button
                  onClick={startListening}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    isListening
                      ? "bg-red-500 text-white border-red-400 animate-pulse"
                      : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white"
                  }`}
                  title="Speak through mic"
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleVoiceSubmit()}
                  disabled={processingVoice || !voiceQuery.trim()}
                  className="px-3 py-2 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  Ask
                </button>
              </div>

              {processingVoice && (
                <p className="text-xs text-zinc-400 font-mono animate-pulse">
                  JARVIS thinking & formulating response...
                </p>
              )}

              {voiceReply && (
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                    JARVIS Reply (Speaks Aloud):
                  </span>
                  <p className="leading-relaxed">{voiceReply}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* iPhone Shortcut Setup Modal */}
      {showShortcutModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-zinc-950" />
                <h3 className="text-lg font-bold text-zinc-950">
                  iPhone Shortcut Setup (6:30 AM & Voice)
                </h3>
              </div>
              <button
                onClick={() => setShowShortcutModal(false)}
                className="text-zinc-400 hover:text-zinc-900 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Your iPhone Shortcut can either run automatically every morning at <strong>6:30 AM</strong>, or you can talk to it anytime by saying <em>"Hey Siri, JARVIS"</em>.
            </p>

            <div className="space-y-4 text-xs text-zinc-700">
              {/* Option 1 */}
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div className="font-semibold text-zinc-950 flex items-center justify-between">
                  <span>1. Morning Briefing URL (GET)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/daily-briefing?format=text`);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-600 hover:text-zinc-950"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? "Copied!" : "Copy URL"}</span>
                  </button>
                </div>
                <code className="block p-2 bg-white border border-zinc-200 rounded-md font-mono text-[11px] text-zinc-800 break-all select-all">
                  {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/daily-briefing?format=text
                </code>
                <p className="text-[11px] text-zinc-500">
                  In Apple Shortcuts: Add <strong>Get Contents of URL</strong> ➡️ Add <strong>Speak Text</strong>. Then set an Automation to run at <strong>6:30 AM</strong> every day!
                </p>
              </div>

              {/* Option 2 */}
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div className="font-semibold text-zinc-950">
                  <span>2. Two-Way Voice Command ("Hey Siri, JARVIS")</span>
                </div>
                <code className="block p-2 bg-white border border-zinc-200 rounded-md font-mono text-[11px] text-zinc-800 break-all select-all">
                  POST {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/voice-command
                </code>
                <p className="text-[11px] text-zinc-500">
                  Shortcut actions: <strong>Dictate Text</strong> ➡️ <strong>Get Contents of URL (POST JSON with {"{ text: Dictated Text }"}</strong>) ➡️ <strong>Get Dictionary Value "reply"</strong> ➡️ <strong>Speak Text</strong>.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowShortcutModal(false)}
                className="px-4 py-2 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
