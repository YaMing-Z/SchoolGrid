import { DayOfWeek } from '@/data/constants'

/**
 * 调课请求
 */
export interface AdjustmentRequest {
  id: string                      // 请求ID
  type: AdjustmentType            // 调课类型
  reason: string                  // 调课原因
  targetCellId: string            // 目标单元格（需要调整的课）
  targetDate: Date                // 目标日期
  requestedBy: string             // 申请人ID
  requestedAt: Date               // 申请时间
  status: AdjustmentStatus        // 状态
}

/**
 * 调课类型
 */
export enum AdjustmentType {
  TeacherLeave = 'teacher_leave',     // 教师请假
  ClassroomChange = 'room_change',    // 教室变更
  TimeSwap = 'time_swap',             // 时间互换
  CourseCancel = 'course_cancel',     // 课程取消
  TemporarySubstitute = 'substitute', // 临时代课
}

/**
 * 调课状态
 */
export enum AdjustmentStatus {
  Pending = 'pending',
  Processing = 'processing',
  Resolved = 'resolved',
  Cancelled = 'cancelled',
}

/**
 * 调课建议
 */
export interface AdjustmentSuggestion {
  id: string                      // 建议ID
  requestId: string               // 关联的调课请求ID
  priority: AdjustmentPriority    // 优先级（P0/P1/P2）
  strategy: AdjustmentStrategy    // 采用的策略
  description: string             // 建议描述
  impact: AdjustmentImpact        // 影响评估
  operations: ScheduleOperation[] // 需要执行的操作
  isValid: boolean                // 是否有效（满足所有约束）
  violations: string[]            // 违反的约束（如有）
  score: number                   // 综合评分（0-100）
}

/**
 * 调课优先级
 */
export enum AdjustmentPriority {
  P0 = 0,  // 同班同日互换 - 最优
  P1 = 1,  // 同班跨日互换 - 次优
  P2 = 2,  // 同科代课 - 可接受
}

/**
 * 调课策略
 */
export enum AdjustmentStrategy {
  SameDaySwap = 'same_day_swap',       // P0: 同班同日互换
  CrossDaySwap = 'cross_day_swap',     // P1: 同班跨日互换
  SubjectSubstitute = 'substitute',    // P2: 同科代课
  FreeSlotFill = 'free_slot_fill',     // 空闲时段填充
  CourseCancel = 'course_cancel',      // 课程取消（最后手段）
}

/**
 * 调课影响评估
 */
export interface AdjustmentImpact {
  affectedClasses: string[]       // 受影响的班级ID
  affectedTeachers: string[]      // 受影响的教师ID
  affectedStudents: number        // 受影响的学生人数
  disruptionLevel: 'low' | 'medium' | 'high'  // 干扰程度
  studentImpact: 'none' | 'minor' | 'major'   // 对学生的影响
}

/**
 * 课表操作
 */
export interface ScheduleOperation {
  type: OperationType
  cellId: string
  fromSlot?: { dayOfWeek: DayOfWeek; period: number }
  toSlot?: { dayOfWeek: DayOfWeek; period: number }
  fromTeacherId?: string
  toTeacherId?: string
}

/**
 * 操作类型
 */
export enum OperationType {
  Swap = 'swap',           // 互换两个时段
  Move = 'move',           // 移动到新时段
  Substitute = 'substitute', // 更换教师
  Cancel = 'cancel',       // 取消课程
  Add = 'add',             // 添加课程
}

/**
 * 调课结果
 */
export interface AdjustmentResult {
  requestId: string
  selectedSuggestion: AdjustmentSuggestion | null
  allSuggestions: AdjustmentSuggestion[]
  appliedAt?: Date
  appliedBy?: string
  status: 'success' | 'partial' | 'failed'
  message: string
}
