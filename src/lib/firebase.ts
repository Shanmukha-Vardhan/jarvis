import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

// Initialize Firebase only once
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

export interface TaskItem {
  id?: string;
  title: string;
  course?: string;
  dueDate: string; // ISO string e.g. "2026-09-29T12:00"
  priority: "high" | "medium" | "low";
  completed: boolean;
  notes?: string;
  createdAt?: string;
}

const TASKS_COLLECTION = "tasks";

export async function fetchTasks(): Promise<TaskItem[]> {
  try {
    const q = query(collection(db, TASKS_COLLECTION), orderBy("dueDate", "asc"));
    const snapshot = await getDocs(q);
    const tasks: TaskItem[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      tasks.push({
        id: d.id,
        title: data.title || "",
        course: data.course || "",
        dueDate: data.dueDate || "",
        priority: data.priority || "medium",
        completed: Boolean(data.completed),
        notes: data.notes || "",
        createdAt: data.createdAt || "",
      });
    });
    return tasks;
  } catch (error) {
    console.warn("Firestore fetch error, using local fallback:", error);
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("jarvis_tasks");
      if (local) {
        try {
          return JSON.parse(local);
        } catch {
          // ignore
        }
      }
    }
    return [];
  }
}

export async function saveTask(task: Omit<TaskItem, "id">): Promise<TaskItem> {
  const newTaskData = {
    ...task,
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, TASKS_COLLECTION), newTaskData);
    const saved: TaskItem = { id: docRef.id, ...newTaskData };
    // sync local cache
    if (typeof window !== "undefined") {
      const current = await fetchTasks();
      localStorage.setItem("jarvis_tasks", JSON.stringify([...current, saved]));
    }
    return saved;
  } catch (error) {
    console.warn("Firestore save error, saving locally:", error);
    const localId = "local_" + Date.now();
    const saved: TaskItem = { id: localId, ...newTaskData };
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("jarvis_tasks");
      const list = existing ? JSON.parse(existing) : [];
      list.push(saved);
      localStorage.setItem("jarvis_tasks", JSON.stringify(list));
    }
    return saved;
  }
}

export async function updateTaskStatus(id: string, completed: boolean): Promise<void> {
  try {
    if (!id.startsWith("local_")) {
      const ref = doc(db, TASKS_COLLECTION, id);
      await updateDoc(ref, { completed });
    }
  } catch (error) {
    console.warn("Firestore update error:", error);
  }

  if (typeof window !== "undefined") {
    const existing = localStorage.getItem("jarvis_tasks");
    if (existing) {
      const list: TaskItem[] = JSON.parse(existing);
      const updated = list.map((t) => (t.id === id ? { ...t, completed } : t));
      localStorage.setItem("jarvis_tasks", JSON.stringify(updated));
    }
  }
}

export async function removeTask(id: string): Promise<void> {
  try {
    if (!id.startsWith("local_")) {
      const ref = doc(db, TASKS_COLLECTION, id);
      await deleteDoc(ref);
    }
  } catch (error) {
    console.warn("Firestore delete error:", error);
  }

  if (typeof window !== "undefined") {
    const existing = localStorage.getItem("jarvis_tasks");
    if (existing) {
      const list: TaskItem[] = JSON.parse(existing);
      const updated = list.filter((t) => t.id !== id);
      localStorage.setItem("jarvis_tasks", JSON.stringify(updated));
    }
  }
}
