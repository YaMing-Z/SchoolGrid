/**
 * 学校排课系统常量定义
 */

// 星期枚举
export enum DayOfWeek {
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
  Sunday = 7,
}

// 星期显示名称
export const DAY_OF_WEEK_NAMES: Record<DayOfWeek, string> = {
  [DayOfWeek.Monday]: '周一',
  [DayOfWeek.Tuesday]: '周二',
  [DayOfWeek.Wednesday]: '周三',
  [DayOfWeek.Thursday]: '周四',
  [DayOfWeek.Friday]: '周五',
  [DayOfWeek.Saturday]: '周六',
  [DayOfWeek.Sunday]: '周日',
}

// 学科枚举（保留标准学科作为常量）
export enum Subject {
  Chinese = 'chinese',           // 语文
  Math = 'math',                 // 数学
  English = 'english',           // 英语
  Physics = 'physics',           // 物理
  Chemistry = 'chemistry',       // 化学
  Biology = 'biology',           // 生物
  History = 'history',           // 历史
  Geography = 'geography',       // 地理
  Politics = 'politics',         // 政治
  PhysicalEducation = 'pe',      // 体育
  Music = 'music',               // 音乐
  Art = 'art',                   // 美术
  ComputerScience = 'cs',        // 计算机
  SelfStudy = 'self_study',      // 自习
  Meeting = 'meeting',           // 班会
}

// 学科类型：支持标准学科 + 自定义学科（任意字符串）
export type SubjectType = Subject | string

// 标准学科显示名称
export const SUBJECT_NAMES: Record<Subject, string> = {
  [Subject.Chinese]: '语文',
  [Subject.Math]: '数学',
  [Subject.English]: '英语',
  [Subject.Physics]: '物理',
  [Subject.Chemistry]: '化学',
  [Subject.Biology]: '生物',
  [Subject.History]: '历史',
  [Subject.Geography]: '地理',
  [Subject.Politics]: '政治',
  [Subject.PhysicalEducation]: '体育',
  [Subject.Music]: '音乐',
  [Subject.Art]: '美术',
  [Subject.ComputerScience]: '计算机',
  [Subject.SelfStudy]: '自习',
  [Subject.Meeting]: '班会',
}

// 标准学科颜色（用于课表显示）
export const SUBJECT_COLORS: Record<Subject, string> = {
  [Subject.Chinese]: '#ef4444',      // red
  [Subject.Math]: '#3b82f6',         // blue
  [Subject.English]: '#22c55e',      // green
  [Subject.Physics]: '#f59e0b',      // amber
  [Subject.Chemistry]: '#8b5cf6',    // violet
  [Subject.Biology]: '#10b981',      // emerald
  [Subject.History]: '#f97316',      // orange
  [Subject.Geography]: '#06b6d4',    // cyan
  [Subject.Politics]: '#ec4899',     // pink
  [Subject.PhysicalEducation]: '#84cc16', // lime
  [Subject.Music]: '#a855f7',        // purple
  [Subject.Art]: '#f472b6',          // rose
  [Subject.ComputerScience]: '#6366f1', // indigo
  [Subject.SelfStudy]: '#9ca3af',    // gray
  [Subject.Meeting]: '#78716c',      // stone
}

// ========== 自定义学科支持 ==========

// 自定义学科颜色池（用于为新学科分配颜色）
const CUSTOM_COLOR_POOL = [
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#fbbf24', // amber
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#ec4899', // pink
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#f97316', // orange
  '#22d3ee', // cyan light
  '#a3e635', // lime light
  '#fb7185', // rose light
  '#c084fc', // purple light
]

// 自定义学科注册表：学科ID -> 中文名称
const customSubjectNames = new Map<string, string>()

// 自定义学科颜色注册表：学科ID -> 颜色
const customSubjectColors = new Map<string, string>()

// 已使用的颜色索引
let colorIndex = 0

/**
 * 注册自定义学科
 * @param subjectId 学科唯一标识（如 "labor", "art1", "art2"）
 * @param displayName 显示名称（如 "劳动", "艺术1", "艺术2"）
 */
export function registerCustomSubject(subjectId: string, displayName: string): void {
  if (!customSubjectNames.has(subjectId)) {
    customSubjectNames.set(subjectId, displayName)
    // 分配颜色
    const color = CUSTOM_COLOR_POOL[colorIndex % CUSTOM_COLOR_POOL.length]
    customSubjectColors.set(subjectId, color)
    colorIndex++
  }
}

/**
 * 获取学科显示名称（支持标准学科和自定义学科）
 */
export function getSubjectName(subject: SubjectType): string {
  // 先检查是否是标准学科
  if (subject in SUBJECT_NAMES) {
    return SUBJECT_NAMES[subject as Subject]
  }
  // 检查自定义学科
  const customName = customSubjectNames.get(subject)
  if (customName) {
    return customName
  }
  // 直接返回学科ID作为显示名称
  return subject
}

/**
 * 获取学科颜色（支持标准学科和自定义学科）
 */
export function getSubjectColor(subject: SubjectType): string {
  // 先检查是否是标准学科
  if (subject in SUBJECT_COLORS) {
    return SUBJECT_COLORS[subject as Subject]
  }
  // 检查自定义学科
  const customColor = customSubjectColors.get(subject)
  if (customColor) {
    return customColor
  }
  // 默认灰色
  return '#9ca3af'
}

/**
 * 获取所有已注册的学科列表（标准 + 自定义）
 */
export function getAllSubjects(): SubjectType[] {
  const standardSubjects = Object.values(Subject)
  const customSubjects = Array.from(customSubjectNames.keys())
  return [...standardSubjects, ...customSubjects]
}

/**
 * 根据显示名称查找学科ID
 * @param displayName 学科显示名称（如 "语文", "劳动"）
 * @returns 学科ID，如果未找到则返回 displayName 本身（作为新的自定义学科）
 */
export function findSubjectByName(displayName: string): SubjectType {
  const normalized = displayName?.trim()
  if (!normalized) return ''

  // 1. 检查标准学科
  for (const [key, name] of Object.entries(SUBJECT_NAMES)) {
    if (name === normalized) {
      return key as Subject
    }
  }

  // 2. 检查已注册的自定义学科
  for (const [subjectId, name] of customSubjectNames.entries()) {
    if (name === normalized) {
      return subjectId
    }
  }

  // 3. 作为新的自定义学科注册，使用显示名称作为ID
  registerCustomSubject(normalized, normalized)
  return normalized
}

// 默认时间段配置
export interface PeriodConfig {
  period: number;       // 第几节
  startTime: string;    // 开始时间
  endTime: string;      // 结束时间
  isMorning: boolean;   // 是否上午
}

// 默认时间段
export const DEFAULT_PERIODS: PeriodConfig[] = [
  { period: 1, startTime: '08:00', endTime: '08:45', isMorning: true },
  { period: 2, startTime: '08:55', endTime: '09:40', isMorning: true },
  { period: 3, startTime: '10:00', endTime: '10:45', isMorning: true },
  { period: 4, startTime: '10:55', endTime: '11:40', isMorning: true },
  { period: 5, startTime: '14:00', endTime: '14:45', isMorning: false },
  { period: 6, startTime: '14:55', endTime: '15:40', isMorning: false },
  { period: 7, startTime: '16:00', endTime: '16:45', isMorning: false },
  { period: 8, startTime: '16:55', endTime: '17:40', isMorning: false },
]

// 默认每天课时数
export const DEFAULT_PERIODS_PER_DAY = DEFAULT_PERIODS.length

// 默认每周上课天数
export const DEFAULT_SCHOOL_DAYS = [
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
]
