import { ScheduleCell } from '@/types/schedule.types'
import {
  AdjustmentSuggestion,
  AdjustmentPriority,
  AdjustmentStrategy,
  AdjustmentImpact,
  ScheduleOperation,
  OperationType
} from '@/types/adjustment.types'
import { SUBJECT_NAMES, Subject } from '@/data/constants'

/**
 * P0策略：同班同日互换
 *
 * 场景：教师某节课无法上，找同班当天其他课程互换
 * 优点：对学生影响最小，只需调换上课顺序
 */

/**
 * 查找同班同日可互换的课程
 *
 * @param targetCell 需要调整的目标单元格
 * @param allCells 该班级的所有课程单元格
 * @param teacherAvailability 教师可用性（可选）
 * @param subjectForbiddenSlots 学科绝对禁排时段（可选）
 * @returns 可互换的建议列表
 */
export function findSameDaySwaps(
  targetCell: ScheduleCell,
  allCells: ScheduleCell[],
  teacherAvailability?: Map<string, Set<string>>, // teacherId -> Set<"day_period">
  subjectForbiddenSlots?: Map<string, Set<string>> // subject -> Set<"day_period">
): AdjustmentSuggestion[] {
  const suggestions: AdjustmentSuggestion[] = []

  // 获取目标单元格的日期
  const targetDay = targetCell.dayOfWeek

  // 找到同班同日的其他课程（排除同一教师的课程，因为教师请假时换自己的课没有意义）
  const sameDayCells = allCells.filter(
    cell =>
      cell.dayOfWeek === targetDay &&
      cell.id !== targetCell.id &&
      cell.teacherId !== targetCell.teacherId && // 排除同一教师的课程
      !cell.isFixed // 不考虑固定课程
  )

  for (const candidateCell of sameDayCells) {
    // 检查互换后是否可行
    // 1. 目标教师是否能在候选时段上课
    const targetTeacherAvailable = !teacherAvailability ||
      teacherAvailability.get(targetCell.teacherId)?.has(`${candidateCell.dayOfWeek}_${candidateCell.period}`) !== false

    // 2. 候选教师是否能在目标时段上课
    const candidateTeacherAvailable = !teacherAvailability ||
      teacherAvailability.get(candidateCell.teacherId)?.has(`${targetCell.dayOfWeek}_${targetCell.period}`) !== false

    // [P0-3 修复] 3. 目标学科将进入候选时段
    const targetSubjectAllowed = !subjectForbiddenSlots ||
      !subjectForbiddenSlots.get(targetCell.subject)?.has(`${candidateCell.dayOfWeek}_${candidateCell.period}`)

    // [P0-3 修复] 4. 候选学科将进入目标时段，检查是否禁排
    const candidateSubjectAllowed = !subjectForbiddenSlots ||
      !subjectForbiddenSlots.get(candidateCell.subject)?.has(`${targetCell.dayOfWeek}_${targetCell.period}`)

    // 计算评分
    const score = calculateSwapScore(targetCell, candidateCell)

    // 检查是否可行（硬约束：教师可用性、学科禁排）
    const isHardConstraintValid = targetTeacherAvailable && candidateTeacherAvailable && targetSubjectAllowed && candidateSubjectAllowed

    // 生成互换建议
    const operations: ScheduleOperation[] = [
      {
        type: OperationType.Swap,
        cellId: targetCell.id,
        fromSlot: { dayOfWeek: targetDay, period: targetCell.period },
        toSlot: { dayOfWeek: candidateCell.dayOfWeek, period: candidateCell.period }
      },
      {
        type: OperationType.Swap,
        cellId: candidateCell.id,
        fromSlot: { dayOfWeek: candidateCell.dayOfWeek, period: candidateCell.period },
        toSlot: { dayOfWeek: targetDay, period: targetCell.period }
      }
    ]

    const impact: AdjustmentImpact = {
      affectedClasses: [targetCell.classId],
      affectedTeachers: [targetCell.teacherId, candidateCell.teacherId],
      affectedStudents: 0,
      disruptionLevel: 'low',
      studentImpact: 'minor'
    }

    // 生成违规/警告信息
    const violations: string[] = []

    // 只有硬约束冲突才标记为无效
    const isValid = isHardConstraintValid

    if (!isHardConstraintValid) {
      // 硬约束冲突：这些才是真正无法互换的原因
      if (!targetTeacherAvailable) violations.push('目标教师时间冲突')
      if (!candidateTeacherAvailable) violations.push('候选教师时间冲突')
      if (!targetSubjectAllowed) violations.push('目标学科禁排时段')
      if (!candidateSubjectAllowed) violations.push('候选学科禁排时段')
    } else if (score < 110) {
      // 评分较低但可以互换，添加警告信息
      const warnings: string[] = []
      if (targetCell.subject !== candidateCell.subject) {
        warnings.push('不同学科互换')
      }
      if (Math.abs(targetCell.period - candidateCell.period) > 2) {
        warnings.push('节次相差较大')
      }
      // 即使没有具体原因，也添加评分警告
      if (warnings.length > 0) {
        violations.push(`评分较低：${warnings.join('、')}`)
      } else {
        violations.push(`评分较低：${score}分`)
      }
      console.log('[p0SameDaySwap] Low score warning added:', {
        targetCell: { id: targetCell.id, subject: targetCell.subject, period: targetCell.period },
        candidateCell: { id: candidateCell.id, subject: candidateCell.subject, period: candidateCell.period },
        score,
        violations,
        warnings
      })
    }

    const suggestion: AdjustmentSuggestion = {
      id: `p0_swap_${targetCell.id}_${candidateCell.id}`,
      requestId: '',
      priority: AdjustmentPriority.P0,
      strategy: AdjustmentStrategy.SameDaySwap,
      description: `与 ${SUBJECT_NAMES[candidateCell.subject as Subject] || candidateCell.subject}（第${candidateCell.period}节）互换`,
      impact,
      operations,
      isValid,
      violations,
      score
    }

    suggestions.push(suggestion)
  }

  // 按评分排序
  return suggestions.sort((a, b) => b.score - a.score)
}

/**
 * 计算互换建议的评分
 * 考虑因素：
 * - 相同学科互换优先（学生更容易适应）
 * - 相邻节次互换优先（减少学生移动）
 */
function calculateSwapScore(targetCell: ScheduleCell, candidateCell: ScheduleCell): number {
  let score = 100 // P0策略基础分

  // 相同学科加分
  if (targetCell.subject === candidateCell.subject) {
    score += 20
  }

  // 相邻节次加分
  const periodDiff = Math.abs(targetCell.period - candidateCell.period)
  if (periodDiff === 1) {
    score += 15
  } else if (periodDiff === 2) {
    score += 10
  }

  // 不同学科但互补性强也加分（如主科互换）
  const mainSubjects = ['chinese', 'math', 'english']
  if (mainSubjects.includes(targetCell.subject) && mainSubjects.includes(candidateCell.subject)) {
    score += 5
  }

  return score
}

/**
 * 检查同日互换是否可行
 */
export function canSameDaySwap(
  targetCell: ScheduleCell,
  candidateCell: ScheduleCell,
  teacherAvailability?: Map<string, Set<string>>,
  subjectForbiddenSlots?: Map<string, Set<string>>
): boolean {
  // 固定课程不能互换
  if (targetCell.isFixed || candidateCell.isFixed) {
    return false
  }

  // 必须是同一天
  if (targetCell.dayOfWeek !== candidateCell.dayOfWeek) {
    return false
  }

  // 检查教师可用性
  if (teacherAvailability) {
    const targetTeacherCanTeach = teacherAvailability
      .get(targetCell.teacherId)
      ?.has(`${candidateCell.dayOfWeek}_${candidateCell.period}`)
    const candidateTeacherCanTeach = teacherAvailability
      .get(candidateCell.teacherId)
      ?.has(`${targetCell.dayOfWeek}_${targetCell.period}`)

    if (targetTeacherCanTeach === false || candidateTeacherCanTeach === false) {
      return false
    }
  }

  // [修复] 检查学科禁排时段
  if (subjectForbiddenSlots) {
    // 目标学科将进入候选时段
    if (subjectForbiddenSlots.get(targetCell.subject)?.has(`${candidateCell.dayOfWeek}_${candidateCell.period}`)) {
      return false
    }
    // 候选学科将进入目标时段
    if (subjectForbiddenSlots.get(candidateCell.subject)?.has(`${targetCell.dayOfWeek}_${targetCell.period}`)) {
      return false
    }
  }

  return true
}

/**
 * 批量查找多个目标单元格的同日互换建议
 */
export function batchFindSameDaySwaps(
  targetCells: ScheduleCell[],
  allCells: ScheduleCell[],
  teacherAvailability?: Map<string, Set<string>>
): Map<string, AdjustmentSuggestion[]> {
  const results = new Map<string, AdjustmentSuggestion[]>()

  for (const targetCell of targetCells) {
    const suggestions = findSameDaySwaps(targetCell, allCells, teacherAvailability)
    results.set(targetCell.id, suggestions)
  }

  return results
}
