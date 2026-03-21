import { Subject } from '@/data/constants'
import { TimeSlotRef } from './teacher.types'

/**
 * 教学计划条目 - 定义某班级某学科的教学安排
 */
export interface CurriculumItem {
  id: string                      // 唯一标识
  classId: string                 // 关联班级ID
  subject: Subject                // 学科
  teacherId: string               // 授课教师ID
  weeklyHours: number             // 周课时数
  isConsecutive: boolean          // 是否需要连堂（如实验课）
  consecutiveCount?: number       // 连堂节数（默认2节）
  fixedSlots?: TimeSlotRef[]      // 固定时段（必须排在指定时间）
  priority: number                // 排课优先级（数值越大越优先）
  notes?: string                  // 备注
}

/**
 * 教学计划 - 一个班级的完整教学安排
 */
export interface Curriculum {
  id: string                      // 计划ID
  classId: string                 // 班级ID
  academicYear: string            // 学年（如 "2024-2025"）
  semester: number                // 学期（1或2）
  items: CurriculumItem[]         // 教学计划条目列表
  totalWeeklyHours: number        // 周总课时
}

/**
 * 教学计划创建/更新 DTO
 */
export interface CurriculumItemDto {
  classId: string
  subject: Subject
  teacherId: string
  weeklyHours: number
  isConsecutive?: boolean
  consecutiveCount?: number
  fixedSlots?: TimeSlotRef[]
  priority?: number
  notes?: string
}

/**
 * 教学计划过滤器
 */
export interface CurriculumFilter {
  classId?: string
  teacherId?: string
  subject?: Subject
}
