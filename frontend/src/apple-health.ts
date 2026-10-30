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
  pickFiles(): Promise<{ files: { name: string; data: string }[]; cancelled?: boolean }>;
  pickFolder(): Promise<{ files: { name: string; data: string }[]; cancelled?: boolean }>;
  pickImages(): Promise<{ files: { name: string; data: string }[] }>;
  takePhoto(): Promise<{ files: { name: string; data: string }[] }>;
  exportData(options: { json: string }): Promise<{ completed: boolean }>;
  addWeight(options: { kilograms: number }): Promise<{ saved: boolean }>;
  addWater(options: { milliliters: number }): Promise<{ saved: boolean }>;
  isAvailable(): Promise<{ available: boolean }>;
  requestReadAccess(): Promise<{ requestCompleted: boolean }>;
  readSummary(options?: { date?: string }): Promise<AppleHealthSummary>;
}
export const HealthKit = registerPlugin<HealthKitBridge>("HealthKit");
export const isNativeIPhone = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
export async function readAppleHealth(
  requestAccess: boolean,
  date?: string,
): Promise<AppleHealthSummary> {
  if (!isNativeIPhone())
    throw new Error(
      "请在安装到 iPhone 的冷酸宁 App 中连接；Safari 和网页预览无法读取 Apple 健康。",
    );
  const availability = await HealthKit.isAvailable();
  if (!availability.available) throw new Error("当前设备不支持 Apple 健康。");
  if (requestAccess) {
    const result = await HealthKit.requestReadAccess();
    if (!result.requestCompleted) throw new Error("授权请求未完成，请重试。");
  }
  return HealthKit.readSummary({ date });
}

export async function addAppleHealthWater(milliliters: number): Promise<void> {
  if (!isNativeIPhone()) throw new Error("请在 iPhone App 中保存到 Apple 健康。");
  if (!Number.isFinite(milliliters) || milliliters <= 0 || milliliters > 5000) throw new Error("饮水量须在 0–5000 mL 之间");
  const result = await HealthKit.addWater({ milliliters });
  if (!result.saved) throw new Error("饮水记录未保存，请重试。");
}

export async function addAppleHealthWeight(kilograms: number): Promise<void> {
  if (!isNativeIPhone()) throw new Error("请在 iPhone App 中保存到 Apple 健康。");
  if (!Number.isFinite(kilograms) || kilograms < 1 || kilograms > 500) throw new Error("体重须在 1–500 kg 之间");
  const result = await HealthKit.addWeight({ kilograms });
  if (!result.saved) throw new Error("体重记录未保存，请重试。");
}

// HealthKit hides read-permission status; an empty result can also mean no records.
export function hasReadableHealthData(summary: AppleHealthSummary): boolean {
  return [summary.steps, summary.sleepHours, summary.weightKg, summary.heartRate,
    summary.hrv, summary.waterMl, summary.noise, summary.fitness].some(value => value != null)
    || summary.workouts.length > 0 || summary.weightHistory.length > 0 || summary.hrvHistory.length > 0;
}

export async function exportAppleHealthData(json: string): Promise<boolean> {
  if (!isNativeIPhone()) throw new Error("请在 iPhone App 中使用系统导出。");
  return (await HealthKit.exportData({ json })).completed;
}
