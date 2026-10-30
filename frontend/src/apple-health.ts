import type { Dashboard, Workout } from "./types";
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface AppleHealthSummary {
  dataDate: string;
  workouts: Workout[];
  warnings?: string[];
  hrvHistory: NonNullable<Dashboard["hrvHistory"]>;
  hrv: { value: number; average: number; at: string } | null;
  heartRate: number | null;
  waterMl: number | null;
  noise: { value: number; at: string } | null;
  fitness: Omit<NonNullable<Dashboard["fitness"]>, "date"> | null;
  steps: number | null;
  weightHistory: NonNullable<Dashboard["weightHistory"]>;
  weightKg: number | null;
  weightDate: string | null;
  sleepHours: number | null;
  sleepStart: string;
  sleepEnd: string;
  syncedAt: string;
}
interface HealthKitBridge {
  isAvailable(): Promise<{ available: boolean }>;
  requestReadAccess(): Promise<{ requestCompleted: boolean }>;
  readSummary(options?: { date?: string }): Promise<AppleHealthSummary>;
}
const HealthKit = registerPlugin<HealthKitBridge>("HealthKit");
export const isNativeIPhone = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
export async function readAppleHealth(
  requestAccess: boolean,
  date?: string,
): Promise<AppleHealthSummary> {
  if (!isNativeIPhone())
    throw new Error(
      "请在安装到 iPhone 的知康 App 中连接；Safari 和网页预览无法读取 Apple 健康。",
    );
  const availability = await HealthKit.isAvailable();
  if (!availability.available) throw new Error("当前设备不支持 Apple 健康。");
  if (requestAccess) {
    const result = await HealthKit.requestReadAccess();
    if (!result.requestCompleted) throw new Error("授权请求未完成，请重试。");
  }
  return HealthKit.readSummary({ date });
}
