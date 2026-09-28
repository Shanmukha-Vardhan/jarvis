export interface ClassSlot {
  slot: number;
  time: string; // e.g. "08:00 AM - 09:00 AM"
  startTime: string; // "08:00"
  endTime: string; // "09:00"
  courseCode: string;
  courseName: string;
  room?: string;
  type?: "theory" | "lab";
}

export interface DaySchedule {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  classes: ClassSlot[];
  isWeekend?: boolean;
}

export const OFFICIAL_TIMETABLE: Record<string, ClassSlot[]> = {
  Monday: [
    {
      slot: 1,
      time: "08:00 AM - 09:00 AM",
      startTime: "08:00",
      endTime: "09:00",
      courseCode: "19EID401",
      courseName: "Financial Management",
      type: "theory",
    },
    {
      slot: 2,
      time: "09:00 AM - 10:00 AM",
      startTime: "09:00",
      endTime: "10:00",
      courseCode: "19ECB431",
      courseName: "Usability Design of Software Applications",
      type: "theory",
    },
    {
      slot: 3,
      time: "10:00 AM - 11:00 AM",
      startTime: "10:00",
      endTime: "11:00",
      courseCode: "19ECB447",
      courseName: "Cognitive Science and Analytics",
      type: "theory",
    },
    {
      slot: 4,
      time: "11:00 AM - 12:00 PM",
      startTime: "11:00",
      endTime: "12:00",
      courseCode: "19ECB455",
      courseName: "Advanced Social, Text and Media Analytics",
      type: "theory",
    },
    {
      slot: 7,
      time: "02:00 PM - 03:00 PM",
      startTime: "14:00",
      endTime: "15:00",
      courseCode: "19ECB433P",
      courseName: "IT workshop skylab / matlab Lab",
      type: "lab",
    },
    {
      slot: 8,
      time: "03:00 PM - 04:00 PM",
      startTime: "15:00",
      endTime: "16:00",
      courseCode: "19ECB433P",
      courseName: "IT workshop skylab / matlab Lab",
      type: "lab",
    },
  ],
  Tuesday: [
    {
      slot: 1,
      time: "08:00 AM - 09:00 AM",
      startTime: "08:00",
      endTime: "09:00",
      courseCode: "19ECB433",
      courseName: "IT workshop skylab / matlab",
      type: "theory",
    },
    {
      slot: 2,
      time: "09:00 AM - 10:00 AM",
      startTime: "09:00",
      endTime: "10:00",
      courseCode: "19ECB433",
      courseName: "IT workshop skylab / matlab",
      type: "theory",
    },
    {
      slot: 3,
      time: "10:00 AM - 11:00 AM",
      startTime: "10:00",
      endTime: "11:00",
      courseCode: "19ECB447",
      courseName: "Cognitive Science and Analytics",
      type: "theory",
    },
    {
      slot: 6,
      time: "01:00 PM - 02:00 PM",
      startTime: "13:00",
      endTime: "14:00",
      courseCode: "19EID401",
      courseName: "Financial Management",
      type: "theory",
    },
    {
      slot: 7,
      time: "02:00 PM - 03:00 PM",
      startTime: "14:00",
      endTime: "15:00",
      courseCode: "19ECB431",
      courseName: "Usability Design of Software Applications",
      type: "theory",
    },
    {
      slot: 8,
      time: "03:00 PM - 04:00 PM",
      startTime: "15:00",
      endTime: "16:00",
      courseCode: "19ECB431",
      courseName: "Usability Design of Software Applications",
      type: "theory",
    },
  ],
  Wednesday: [
    {
      slot: 1,
      time: "08:00 AM - 09:00 AM",
      startTime: "08:00",
      endTime: "09:00",
      courseCode: "19ECB433",
      courseName: "IT workshop skylab / matlab",
      type: "theory",
    },
    {
      slot: 2,
      time: "09:00 AM - 10:00 AM",
      startTime: "09:00",
      endTime: "10:00",
      courseCode: "19EID401",
      courseName: "Financial Management",
      type: "theory",
    },
    {
      slot: 3,
      time: "10:00 AM - 11:00 AM",
      startTime: "10:00",
      endTime: "11:00",
      courseCode: "19EID403",
      courseName: "Human Resource Management",
      type: "theory",
    },
    {
      slot: 4,
      time: "11:00 AM - 12:00 PM",
      startTime: "11:00",
      endTime: "12:00",
      courseCode: "19ECB455",
      courseName: "Advanced Social, Text and Media Analytics",
      type: "theory",
    },
  ],
  Thursday: [
    {
      slot: 1,
      time: "08:00 AM - 09:00 AM",
      startTime: "08:00",
      endTime: "09:00",
      courseCode: "19EID403",
      courseName: "Human Resource Management",
      type: "theory",
    },
    {
      slot: 2,
      time: "09:00 AM - 10:00 AM",
      startTime: "09:00",
      endTime: "10:00",
      courseCode: "19ECB431",
      courseName: "Usability Design of Software Applications",
      type: "theory",
    },
    {
      slot: 3,
      time: "10:00 AM - 11:00 AM",
      startTime: "10:00",
      endTime: "11:00",
      courseCode: "19ECB455",
      courseName: "Advanced Social, Text and Media Analytics",
      type: "theory",
    },
    {
      slot: 4,
      time: "11:00 AM - 12:00 PM",
      startTime: "11:00",
      endTime: "12:00",
      courseCode: "19ECB447",
      courseName: "Cognitive Science and Analytics",
      type: "theory",
    },
  ],
  Friday: [
    {
      slot: 1,
      time: "08:00 AM - 09:00 AM",
      startTime: "08:00",
      endTime: "09:00",
      courseCode: "19ECB447",
      courseName: "Cognitive Science and Analytics",
      type: "theory",
    },
    {
      slot: 2,
      time: "09:00 AM - 10:00 AM",
      startTime: "09:00",
      endTime: "10:00",
      courseCode: "19ECB447",
      courseName: "Cognitive Science and Analytics",
      type: "theory",
    },
    {
      slot: 3,
      time: "10:00 AM - 11:00 AM",
      startTime: "10:00",
      endTime: "11:00",
      courseCode: "19ECB455P",
      courseName: "Advanced Social, Text and Media Analytics Lab",
      type: "lab",
    },
    {
      slot: 4,
      time: "11:00 AM - 12:00 PM",
      startTime: "11:00",
      endTime: "12:00",
      courseCode: "19ECB455P",
      courseName: "Advanced Social, Text and Media Analytics Lab",
      type: "lab",
    },
  ],
  Saturday: [],
  Sunday: [],
};

export const COURSE_NAMES: Record<string, string> = {
  "19EID401": "Financial Management",
  "19EID403": "Human Resource Management",
  "19ECB431": "Usability Design of Software Applications",
  "19ECB431P": "Usability Design Lab",
  "19ECB433": "IT Workshop (Skylab / Matlab)",
  "19ECB433P": "IT Workshop Lab",
  "19ECB447": "Cognitive Science & Analytics",
  "19ECB447P": "Cognitive Science Lab",
  "19ECB455": "ASTMA (Social & Text Analytics)",
  "19ECB455P": "ASTMA Lab",
  "19ECB491": "Project Evaluation I",
};

export function getTodayClasses(dayName?: string): ClassSlot[] {
  const day = dayName || new Date().toLocaleDateString("en-US", { weekday: "long" });
  return OFFICIAL_TIMETABLE[day] || [];
}
