import { Subject } from '@/data/constants'

/**
 * 时段引用 - 用于标识具体的时间格子
 */
export interface TimeSlotRef {
  dayOfWeek: number    // 星期几 (1-7)
  period: number       // 第几节课 (1-n)
}

/**
 * 教师实体
 */
export interface Teacher {
  id: string                      // 唯一标识
  employeeId: string              // 工号
  name: string                    // 姓名
  subject: Subject                // 任教学科
  weeklyHoursLimit: number        // 周课时上限
  avoidTimeSlots: TimeSlotRef[]   // 避开时段（如不排早读、不排周五下午等）
  isActive: boolean               // 是否在职
  phone?: string                  // 联系电话
  email?: string                  // 邮箱
  notes?: string                  // 备注
}

/**
 * 教师创建/更新 DTO
 */
export interface TeacherDto {
  employeeId: string
  name: string
  subject: Subject
  weeklyHoursLimit: number
  avoidTimeSlots?: TimeSlotRef[]
  phone?: string
  email?: string
  notes?: string
}

/**
 * 教师过滤器
 */
export interface TeacherFilter {
  subject?: Subject
  isActive?: boolean
  searchKeyword?: string
}
