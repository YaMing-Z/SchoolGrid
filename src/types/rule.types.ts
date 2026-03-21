import { Subject } from '@/data/constants'


/**
 * 学科排课标准规则
 * 定义特定年级某学科的默认排课要求
 */
export interface SubjectRule {
  id: string
  subject: Subject
  weeklyHours: number         // 默认周课时数
  isConsecutive: boolean      // 是否需要连堂
  consecutiveCount: number    // 连堂节数，通常为2
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
