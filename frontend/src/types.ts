export type Workout = { type: string; start: string; end: string; minutes: number; kcal: number | null; source: string };
type HealthRecord = {
  id: number;
  kind: "water" | "weight";
  value: number;
  created_at: string;
};
export type Dashboard = {
  water: number;
  workouts?: Workout[];
  noise?: { date: string; value: number; at: string } | null;
  sleep?: { date: string; hours: number } | null;
  fitness?: { goalDate?: string; workoutOnly?: boolean; source?: string; date: string; activeKcal: number | null; activeGoal: number | null; exerciseMinutes: number | null; exerciseGoal: number | null; standHours: number | null; standGoal: number | null } | null;
  hrvHistory?: { at: string; value: number }[];
  hrv?: { date: string; value: number; average: number; at: string } | null;
  heartRate?: { date: string; value: number } | null;
  weight: number | null;
  date?: string;
  steps?: number | null;
  weightHistory?: { date: string; value: number; source: string }[];
  records: HealthRecord[];
};
export type Message = { attachments?: import("./chat-attachments").ChatAttachment[]; role: "user" | "assistant"; text: string; error?: boolean; report?: boolean };
