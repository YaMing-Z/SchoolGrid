import { ScheduleCell } from '@/types/schedule.types'
import { Teacher } from '@/types/teacher.types'
import {
  AdjustmentSuggestion,
  AdjustmentPriority,
  AdjustmentStrategy,
  AdjustmentImpact,
  ScheduleOperation,
  OperationType
} from '@/types/adjustment.types'
import { Subject } from '@/data/constants'

/**
 * P2策略：同科代课
 *
 * 场景：教师请假无法调课，需要找同科目的其他教师代课
 * 解决：找到同学科、同时段有空的其他教师
 * 优点：课程不中断，学生按原计划上课
 */

/**
 * 教师可用性信息
 */
interface TeacherAvailability {
  teacherId: string
  teacherName: string
  subject: Subject
  isAvailable: boolean       // 该时段是否有空
  currentWeeklyHours: number // 当前周课时
  weeklyHoursLimit: number   // 周课时上限
  preference: number         // 代课偏好（0-100，越高越愿意）
}

/**
 * 查找可代课的教师
 *
 * @param targetCell 需要代课的单元格
 * @param allTeachers 所有教师列表
 * @param teacherSchedules 教师课表占用情况
 * @param teacherAvailability 教师时段可用性
 * @returns 可代课的建议列表
 */
export function findSubstitutes(
  targetCell: ScheduleCell,
  allTeachers: Teacher[],
  teacherSchedules: Map<string, Set<string>>, // teacherId -> Set<"day_period">
  teacherAvailability?: Map<string, Set<string>> // teacherId -> Set<"day_period"> 该时段有空
): AdjustmentSuggestion[] {
  const suggestions: AdjustmentSuggestion[] = []
  const targetSubject = targetCell.subject
  const targetSlot = `${targetCell.dayOfWeek}_${targetCell.period}`

  // 找到同学科的其他教师
  const sameSubjectTeachers = allTeachers.filter(
    teacher =>
      teacher.subject === targetSubject &&
      teacher.id !== targetCell.teacherId &&
      teacher.isActive
  )

  for (const teacher of sameSubjectTeachers) {
    // 检查该教师是否在该时段有空
    const isOccupied = teacherSchedules.get(teacher.id)?.has(targetSlot)
    const isExplicitlyAvailable = teacherAvailability?.get(teacher.id)?.has(targetSlot)

    // 如果明确标记为不可用，跳过
    if (isExplicitlyAvailable === false) {
      continue
    }

    // 如果被占用或不在可用列表中，跳过
    if (isOccupied) {
      continue
    }

    // 检查是否在避开时段列表中
    const isInAvoidList = teacher.avoidTimeSlots.some(
      slot => slot.dayOfWeek === targetCell.dayOfWeek && slot.period === targetCell.period
    )

    if (isInAvoidList) {
      continue
    }

    // 计算当前周课时
    const currentHours = teacherSchedules.get(teacher.id)?.size || 0

    // 检查是否超课时
    if (currentHours >= teacher.weeklyHoursLimit) {
      continue
    }

    // 生成代课建议
    const operations: ScheduleOperation[] = [
      {
        type: OperationType.Substitute,
        cellId: targetCell.id,
        fromTeacherId: targetCell.teacherId,
        toTeacherId: teacher.id
      }
    ]

    const impact: AdjustmentImpact = {
      affectedClasses: [targetCell.classId],
      affectedTeachers: [targetCell.teacherId, teacher.id],
      affectedStudents: 0,
      disruptionLevel: 'medium',
      studentImpact: 'minor' // 同学科代课，影响较小
    }

    const suggestion: AdjustmentSuggestion = {
      id: `p2_sub_${targetCell.id}_${teacher.id}`,
      requestId: '',
      priority: AdjustmentPriority.P2,
      strategy: AdjustmentStrategy.SubjectSubstitute,
      description: `由 ${teacher.name} 老师代课`,
      impact,
      operations,
      isValid: true,
      violations: [],
      score: calculateSubstituteScore(teacher, currentHours)
    }

    suggestions.push(suggestion)
  }

  // 按评分排序
  return suggestions.sort((a, b) => b.score - a.score)
}

/**
 * 计算代课建议的评分
 */
function calculateSubstituteScore(
  teacher: Teacher,
  currentWeeklyHours: number
): number {
  let score = 60 // P2策略基础分（最低）

  // 课时余量大的优先（避免超负荷）
  const remainingHours = teacher.weeklyHoursLimit - currentWeeklyHours
  score += Math.min(remainingHours * 5, 20)

  // 根据剩余课时比例加分
  const remainingRatio = remainingHours / teacher.weeklyHoursLimit
  if (remainingRatio > 0.5) {
    score += 15
  } else if (remainingRatio > 0.3) {
    score += 10
  }

  return score
}

/**
 * 检查教师是否可以代课
 */
export function canSubstitute(
  targetCell: ScheduleCell,
  teacher: Teacher,
  teacherSchedules: Map<string, Set<string>>,
  teacherAvailability?: Map<string, Set<string>>
): boolean {
  // 必须是同学科
  if (teacher.subject !== targetCell.subject) {
    return false
  }

  // 不能是原教师
  if (teacher.id === targetCell.teacherId) {
    return false
  }

  // 必须在职
  if (!teacher.isActive) {
    return false
  }

  const targetSlot = `${targetCell.dayOfWeek}_${targetCell.period}`

  // 检查是否被占用
  if (teacherSchedules.get(teacher.id)?.has(targetSlot)) {
    return false
  }

  // 检查是否明确不可用
  if (teacherAvailability?.get(teacher.id)?.has(targetSlot) === false) {
    return false
  }

  // 检查避开时段
  const isInAvoidList = teacher.avoidTimeSlots.some(
    slot => slot.dayOfWeek === targetCell.dayOfWeek && slot.period === targetCell.period
  )
  if (isInAvoidList) {
    return false
  }

  // 检查课时上限
  const currentHours = teacherSchedules.get(teacher.id)?.size || 0
  if (currentHours >= teacher.weeklyHoursLimit) {
    return false
  }

  return true
}

/**
 * 批量查找多个单元格的代课建议
 */
export function batchFindSubstitutes(
  targetCells: ScheduleCell[],
  allTeachers: Teacher[],
  teacherSchedules: Map<string, Set<string>>,
  teacherAvailability?: Map<string, Set<string>>
): Map<string, AdjustmentSuggestion[]> {
  const results = new Map<string, AdjustmentSuggestion[]>()

  for (const targetCell of targetCells) {
    const suggestions = findSubstitutes(targetCell, allTeachers, teacherSchedules, teacherAvailability)
    results.set(targetCell.id, suggestions)
  }

  return results
}

/**
 * 获取教师可用性汇总
 */
export function getTeacherAvailabilitySummary(
  teacher: Teacher,
  teacherSchedules: Map<string, Set<string>>
): TeacherAvailability {
  const currentHours = teacherSchedules.get(teacher.id)?.size || 0
  const remainingHours = teacher.weeklyHoursLimit - currentHours

  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    subject: teacher.subject,
    isAvailable: remainingHours > 0,
    currentWeeklyHours: currentHours,
    weeklyHoursLimit: teacher.weeklyHoursLimit,
    preference: calculatePreferenceScore(teacher, currentHours)
  }
}

/**
 * 计算教师代课偏好分数
 */
function calculatePreferenceScore(teacher: Teacher, currentHours: number): number {
  const remainingRatio = (teacher.weeklyHoursLimit - currentHours) / teacher.weeklyHoursLimit
  return Math.round(remainingRatio * 100)
}
