import { DayOfWeek, Subject } from '@/data/constants'

/**
 * 课表单元格 - 表示一个具体时间段的课程安排
 */
export interface ScheduleCell {
  id: string                      // 唯一标识
  dayOfWeek: DayOfWeek            // 星期几
  period: number                  // 第几节课
  classId: string                 // 班级ID
  teacherId: string               // 教师ID
  subject: Subject                // 学科
  curriculumItemId: string        // 关联的教学计划条目ID
  isFixed: boolean                // 是否固定（不可调整）
  classroom?: string              // 上课地点
  notes?: string                  // 备注
}

/**
 * 班级课表 - 某班级一周的完整课表
 */
export interface ClassSchedule {
  id: string                      // 课表ID
  classId: string                 // 班级ID
  academicYear: string            // 学年
  semester: number                // 学期
  cells: ScheduleCell[]           // 课表单元格列表
  isValid: boolean                // 是否有效（无冲突）
  conflicts: ScheduleConflict[]   // 冲突列表
}

/**
 * 教师课表 - 某教师一周的完整课表
 */
export interface TeacherSchedule {
  id: string                      // 课表ID
  teacherId: string               // 教师ID
  academicYear: string            // 学年
  semester: number                // 学期
  cells: ScheduleCell[]           // 课表单元格列表
  totalWeeklyHours: number        // 周总课时
}

/**
 * 学校总课表
 */
export interface SchoolSchedule {
  id: string                      // 课表ID
  academicYear: string            // 学年
  semester: number                // 学期
  classSchedules: ClassSchedule[] // 各班级课表
  generatedAt: Date               // 生成时间
  algorithmVersion: string        // 算法版本
}

/**
 * 课表冲突
 */
export interface ScheduleConflict {
  id: string
  type: ConflictType
  severity: 'error' | 'warning'
  cellIds: string[]               // 涉及的单元格ID
  message: string
  suggestion?: string
}

/**
 * 冲突类型
 */
export enum ConflictType {
  TeacherOverlap = 'teacher_overlap',       // 教师时间冲突
  ClassOverlap = 'class_overlap',           // 班级时间冲突
  TeacherExceedsLimit = 'teacher_exceeds',  // 教师超课时
  ClassroomConflict = 'room_conflict',      // 教室冲突
  ConsecutiveViolation = 'consecutive_violation', // 连堂未满足
  AvoidSlotViolation = 'avoid_slot',        // 避开时段违规
}

/**
 * 占用矩阵 - 用于排课时检测冲突
 * 结构: [teacherId/classId][dayOfWeek][period] = cellId
 */
export type OccupancyMatrix = Map<string, Map<number, Map<number, string>>>

/**
 * 排课上下文 - 包含排课所需的所有数据
 */
export interface SchedulingContext {
  teachers: Map<string, import('./teacher.types').Teacher>
  classes: Map<string, import('./class.types').SchoolClass>
  curriculum: Map<string, import('./curriculum.types').CurriculumItem>
  fixedCells: ScheduleCell[]
  occupancy: {
    teachers: OccupancyMatrix    // 教师占用情况
    classes: OccupancyMatrix     // 班级占用情况
  }
}
