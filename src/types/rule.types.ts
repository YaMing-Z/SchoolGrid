import { SubjectType } from '@/data/constants'


/**
 * 节次时间配置
 * 定义每一节课的基本信息
 */
export interface PeriodConfig {
  period: number;       // 第几节 (1-based)
  startTime: string;    // 开始时间 "HH:mm"
  endTime: string;      // 结束时间 "HH:mm"
  isMorning: boolean;   // 是否上午
}

/**
 * 课表配置
 * 定义每天的节次数和每节课的时间
 */
export interface ScheduleConfig {
  periodsPerDay: number;           // 每天节次数
  periods: PeriodConfig[];         // 节次时间配置
  morningPeriods: number;          // 上午几节课（用于UI显示）
}

/**
 * 学科排课标准规则
 * 定义特定年级某学科的默认排课要求
 */
export interface SubjectRule {
  id: string
  subject: SubjectType            // 学科（支持自定义）
  weeklyHours: number         // 默认周课时数
  isConsecutive: boolean      // 是否需要连堂
  consecutiveCount: number    // 连堂节数，通常为2
  dailyMax?: number           // 单日最大课时数
  timePreference?: 'morning_only' | 'afternoon_only' | 'no_preference' // 时段偏好
}

/**
 * 学科时间约束规则
 * 定义特定学科在特定时间段的绝对排课限制（如班会固定课位、教研活动禁排）
 */
export interface SubjectTimeRule {
  id: string
  subject: SubjectType            // 学科（支持自定义）
  dayOfWeek: number
  period: number
  type: 'fixed' | 'must_not'  // fixed: 必须排在这里(如班会), must_not: 绝对禁排(如教研活动)
  reason?: string
}

/**
 * 全局禁排时间规则
 * 定义全校范围内不可排课的时间段（如全校教职工大会）
 */
export interface GlobalTimeRule {
  id: string
  dayOfWeek: number           // 星期几 (1-7)
  period: number              // 第几节课
  reason: string              // 禁排原因
}

/**
 * 教师排课约束规则
 * 定义教师的工作量限制等
 */
export interface TeacherLoadRule {
  defaultMaxWeeklyHours: number // 默认周最大课时数（如 16 节）
}

/**
 * 教师专属时间约束规则
 * 定义特定教师不可排或尽量不排的时间槽
 */
export interface TeacherTimeRule {
  id: string
  teacherId: string           // 对应教师的唯一ID或姓名
  dayOfWeek: number           // 星期几 (1-7)
  period: number              // 第几节课
  type: 'must_not' | 'prefer_not' // 绝对禁排 vs 尽量不排
  reason?: string
}
