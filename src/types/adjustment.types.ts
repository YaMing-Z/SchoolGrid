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

// ============================================
// 冲突详情类型定义 - 用于优化冲突提示体验
// ============================================

/**
 * 调课冲突类型枚举
 * 注意：与 schedule.types.ts 中的 ConflictType 不同，这是专门用于调课场景的冲突类型
 */
export enum AdjustmentConflictType {
  TeacherBusy = 'teacher_busy',               // 教师有课
  TeacherUnavailable = 'teacher_unavailable', // 教师不可用时段
  SubjectForbidden = 'subject_forbidden',     // 学科禁排时段
  RoomOccupied = 'room_occupied',             // 教室被占用
  FixedCourse = 'fixed_course',               // 固定课程
  SameCell = 'same_cell',                     // 原位置
  SameDayOnly = 'same_day_only',              // 仅限同日调换
  NoCrossDayAvailable = 'no_cross_day_available', // 无可用跨日调换
}

/**
 * 冲突严重程度
 */
export type ConflictSeverity = 'error' | 'warning' | 'info'

/**
 * 冲突详情 - 结构化信息
 */
export interface ConflictDetail {
  type: AdjustmentConflictType            // 冲突类型
  severity: ConflictSeverity              // 严重程度
  message: string                         // 简短描述（用于格子内显示）
  details: ConflictDetails                // 具体详情
  suggestion?: string                     // 解决建议
}

/**
 * 冲突具体详情 - 根据类型不同有不同字段
 */
export type ConflictDetails =
  | TeacherBusyDetails
  | TeacherUnavailableDetails
  | SubjectForbiddenDetails
  | RoomOccupiedDetails
  | FixedCourseDetails
  | BasicConflictDetails

/**
 * 基础冲突详情（通用）
 */
export interface BasicConflictDetails {
  reason: string
}

/**
 * 教师有课详情
 */
export interface TeacherBusyDetails {
  teacherId: string
  teacherName: string
  busySlot: {
    dayOfWeek: number
    period: number
    dayName: string      // "周一"
    periodName: string   // "第3节"
  }
  busyWith: {
    className: string    // "三年二班"
    subject: string      // "数学"
  }
}

/**
 * 教师不可用时段详情（包括无互换目标的情况）
 */
export interface TeacherUnavailableDetails {
  teacherId?: string
  teacherName?: string
  reason: string         // "开会"、"培训"、"no_swap_target"等
  isSameDay?: boolean    // 是否是同一天
  targetDay?: number     // 目标天
  targetPeriod?: number  // 目标节次
  unavailableSlots?: Array<{
    dayOfWeek: number
    period: number
    dayName: string
    periodName: string
  }>
}

/**
 * 学科禁排时段详情
 */
export interface SubjectForbiddenDetails {
  subject: string
  subjectName: string
  forbiddenSlot: {
    dayOfWeek: number
    period: number
    dayName: string
    periodName: string
  }
  rule: string           // 规则来源："体育课不能排在上午前两节"
}

/**
 * 教室被占用详情
 */
export interface RoomOccupiedDetails {
  roomId: string
  roomName: string
  occupiedBy: {
    className: string
    subject: string
    teacherName: string
  }
}

/**
 * 固定课程详情
 */
export interface FixedCourseDetails {
  courseName: string
  reason: string         // "全校集会"、"期中考试"
}

/**
 * 冲突类型对应的视觉样式
 */
export interface ConflictStyle {
  bgColor: string
  borderColor: string
  icon: string
  pattern: 'solid' | 'dashed' | 'dotted'
}

/**
 * 冲突类型样式映射
 */
export const CONFLICT_STYLES: Record<AdjustmentConflictType, ConflictStyle> = {
  [AdjustmentConflictType.TeacherBusy]: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-400',
    icon: '👤❌',
    pattern: 'dotted'
  },
  [AdjustmentConflictType.TeacherUnavailable]: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-400',
    icon: '👤🚫',
    pattern: 'dotted'
  },
  [AdjustmentConflictType.SubjectForbidden]: {
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-400',
    icon: '📚🚫',
    pattern: 'dashed'
  },
  [AdjustmentConflictType.RoomOccupied]: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-400',
    icon: '🏫⛔',
    pattern: 'solid'
  },
  [AdjustmentConflictType.FixedCourse]: {
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-400',
    icon: '📌',
    pattern: 'solid'
  },
  [AdjustmentConflictType.SameCell]: {
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '📍',
    pattern: 'dashed'
  },
  [AdjustmentConflictType.SameDayOnly]: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    icon: '📅',
    pattern: 'dashed'
  },
  [AdjustmentConflictType.NoCrossDayAvailable]: {
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    icon: '❓',
    pattern: 'dotted'
  }
}

/**
 * 冲突类型显示名称映射
 */
export const CONFLICT_TYPE_LABELS: Record<AdjustmentConflictType, string> = {
  [AdjustmentConflictType.TeacherBusy]: '教师有课',
  [AdjustmentConflictType.TeacherUnavailable]: '教师不可用',
  [AdjustmentConflictType.SubjectForbidden]: '学科禁排',
  [AdjustmentConflictType.RoomOccupied]: '教室被占用',
  [AdjustmentConflictType.FixedCourse]: '固定课程',
  [AdjustmentConflictType.SameCell]: '原位置',
  [AdjustmentConflictType.SameDayOnly]: '仅限同日调换',
  [AdjustmentConflictType.NoCrossDayAvailable]: '无可用调换'
}

/**
 * 旧版错误码到新版冲突类型的映射
 * 用于兼容现有算法层的 string[] violations
 */
export const VIOLATION_CODE_TO_CONFLICT_TYPE: Record<string, AdjustmentConflictType> = {
  'same_cell': AdjustmentConflictType.SameCell,
  'same_day_only': AdjustmentConflictType.SameDayOnly,
  'teacher_conflict': AdjustmentConflictType.TeacherBusy,
  'teacher_unavailable': AdjustmentConflictType.TeacherUnavailable,
  'subject_forbidden': AdjustmentConflictType.SubjectForbidden,
  'fixed_course': AdjustmentConflictType.FixedCourse,
  'no_cross_day_available': AdjustmentConflictType.NoCrossDayAvailable,
}

/**
 * 旧版错误码到显示文本的映射（兼容现有代码）
 */
export const REASON_LABELS: Record<string, string> = {
  'same_cell': '原位置',
  'same_day_only': '仅限同日调换',
  'teacher_conflict': '教师时间冲突',
  'subject_forbidden': '学科禁排时段',
  'fixed_course': '固定课程',
  'no_cross_day_available': '无可用跨日调换',
  'teacher_unavailable': '教师不可用'
}
