import { ScheduleCell } from '@/types/schedule.types'
import {
  AdjustmentSuggestion,
  AdjustmentPriority,
  AdjustmentStrategy,
  AdjustmentImpact,
  ScheduleOperation,
  OperationType
} from '@/types/adjustment.types'
import { DayOfWeek, SUBJECT_NAMES, Subject } from '@/data/constants'

/**
 * P1策略：同班跨日互换
 *
 * 场景：教师某天无法上课，且当天没有可互换的课程
 * 解决：找本周其他天的同班课程互换
 * 优点：保持课程总量不变，学生课程安排变化可控
 */

/**
 * 查找同班跨日可互换的课程
 *
 * @param targetCell 需要调整的目标单元格
 * @param allCells 该班级的所有课程单元格
 * @param teacherAvailability 教师可用性（可选）
 * @returns 可互换的建议列表
 */
export function findCrossDaySwaps(
  targetCell: ScheduleCell,
  allCells: ScheduleCell[],
  teacherAvailability?: Map<string, Set<string>>
): AdjustmentSuggestion[] {
  const suggestions: AdjustmentSuggestion[] = []

  // 找到同班不同日的课程（排除同一教师的课程，因为教师请假时换自己的课没有意义）
  const crossDayCells = allCells.filter(
    cell =>
      cell.dayOfWeek !== targetCell.dayOfWeek &&
      cell.id !== targetCell.id &&
      cell.teacherId !== targetCell.teacherId && // 排除同一教师的课程
      !cell.isFixed
  )

  for (const candidateCell of crossDayCells) {
    // 检查互换后是否可行
    const canSwap = canCrossDaySwap(targetCell, candidateCell, teacherAvailability)

    if (canSwap) {
      const operations: ScheduleOperation[] = [
        {
          type: OperationType.Swap,
          cellId: targetCell.id,
          fromSlot: { dayOfWeek: targetCell.dayOfWeek, period: targetCell.period },
          toSlot: { dayOfWeek: candidateCell.dayOfWeek, period: candidateCell.period }
        },
        {
          type: OperationType.Swap,
          cellId: candidateCell.id,
          fromSlot: { dayOfWeek: candidateCell.dayOfWeek, period: candidateCell.period },
          toSlot: { dayOfWeek: targetCell.dayOfWeek, period: targetCell.period }
        }
      ]

      const impact: AdjustmentImpact = {
        affectedClasses: [targetCell.classId],
        affectedTeachers: [targetCell.teacherId, candidateCell.teacherId],
        affectedStudents: 0,
        disruptionLevel: 'medium', // 跨日影响较大
        studentImpact: 'minor'
      }

      const suggestion: AdjustmentSuggestion = {
        id: `p1_swap_${targetCell.id}_${candidateCell.id}`,
        requestId: '',
        priority: AdjustmentPriority.P1,
        strategy: AdjustmentStrategy.CrossDaySwap,
        description: `与周${candidateCell.dayOfWeek}第${candidateCell.period}节的${SUBJECT_NAMES[candidateCell.subject as Subject] || candidateCell.subject}互换`,
        impact,
        operations,
        isValid: true,
        violations: [],
        score: calculateCrossDaySwapScore(targetCell, candidateCell)
      }

      suggestions.push(suggestion)
    }
  }

  // 按评分排序
  return suggestions.sort((a, b) => b.score - a.score)
}

/**
 * 检查跨日互换是否可行
 */
export function canCrossDaySwap(
  targetCell: ScheduleCell,
  candidateCell: ScheduleCell,
  teacherAvailability?: Map<string, Set<string>>
): boolean {
  // 固定课程不能互换
  if (targetCell.isFixed || candidateCell.isFixed) {
    return false
  }

  // 必须是不同的天
  if (targetCell.dayOfWeek === candidateCell.dayOfWeek) {
    return false
  }

  // 检查教师可用性
  if (teacherAvailability) {
    // 目标教师是否能在候选日期的该节次上课
    const targetTeacherAvailable = teacherAvailability
      .get(targetCell.teacherId)
      ?.has(`${candidateCell.dayOfWeek}_${candidateCell.period}`)

    // 候选教师是否能在目标日期的该节次上课
    const candidateTeacherAvailable = teacherAvailability
      .get(candidateCell.teacherId)
      ?.has(`${targetCell.dayOfWeek}_${targetCell.period}`)

    if (targetTeacherAvailable === false || candidateTeacherAvailable === false) {
      return false
    }
  }

  return true
}

/**
 * 计算跨日互换建议的评分
 */
function calculateCrossDaySwapScore(targetCell: ScheduleCell, candidateCell: ScheduleCell): number {
  let score = 80 // P1策略基础分（低于P0）

  // 相同学科加分
  if (targetCell.subject === candidateCell.subject) {
    score += 15
  }

  // 相邻日期加分
  const dayDiff = Math.abs(targetCell.dayOfWeek - candidateCell.dayOfWeek)
  if (dayDiff === 1) {
    score += 10
  } else if (dayDiff === 2) {
    score += 5
  }

  // 相同节次加分（学生作息不变）
  if (targetCell.period === candidateCell.period) {
    score += 15
  }

  // 上午/下午一致性加分
  const targetIsMorning = targetCell.period <= 4
  const candidateIsMorning = candidateCell.period <= 4
  if (targetIsMorning === candidateIsMorning) {
    score += 5
  }

  // 不同学科但互补性强也加分（如主科互换）
  const mainSubjects = ['chinese', 'math', 'english']
  if (mainSubjects.includes(targetCell.subject) && mainSubjects.includes(candidateCell.subject)) {
    score += 5
  }

  return score
}

/**
 * 找到特定日期范围内的跨日互换建议
 */
export function findCrossDaySwapsInRange(
  targetCell: ScheduleCell,
  allCells: ScheduleCell[],
  preferredDays: DayOfWeek[], // 优先考虑的日期
  teacherAvailability?: Map<string, Set<string>>
): AdjustmentSuggestion[] {
  // 先在优先日期中查找
  const preferredCells = allCells.filter(
    cell => preferredDays.includes(cell.dayOfWeek) && cell.id !== targetCell.id
  )

  const preferredSuggestions = preferredCells
    .filter(cell => canCrossDaySwap(targetCell, cell, teacherAvailability))
    .map(cell => createSuggestion(targetCell, cell))

  // 如果优先日期有结果，直接返回
  if (preferredSuggestions.length > 0) {
    return preferredSuggestions.sort((a, b) => b.score - a.score)
  }

  // 否则在所有日期中查找
  return findCrossDaySwaps(targetCell, allCells, teacherAvailability)
}

/**
 * 创建调课建议
 */
function createSuggestion(targetCell: ScheduleCell, candidateCell: ScheduleCell): AdjustmentSuggestion {
  const operations: ScheduleOperation[] = [
    {
      type: OperationType.Swap,
      cellId: targetCell.id,
      fromSlot: { dayOfWeek: targetCell.dayOfWeek, period: targetCell.period },
      toSlot: { dayOfWeek: candidateCell.dayOfWeek, period: candidateCell.period }
    },
    {
      type: OperationType.Swap,
      cellId: candidateCell.id,
      fromSlot: { dayOfWeek: candidateCell.dayOfWeek, period: candidateCell.period },
      toSlot: { dayOfWeek: targetCell.dayOfWeek, period: targetCell.period }
    }
  ]

  return {
    id: `p1_swap_${targetCell.id}_${candidateCell.id}`,
    requestId: '',
    priority: AdjustmentPriority.P1,
    strategy: AdjustmentStrategy.CrossDaySwap,
    description: `与周${candidateCell.dayOfWeek}第${candidateCell.period}节的${candidateCell.subject}互换`,
    impact: {
      affectedClasses: [targetCell.classId],
      affectedTeachers: [targetCell.teacherId, candidateCell.teacherId],
      affectedStudents: 0,
      disruptionLevel: 'medium',
      studentImpact: 'minor'
    },
    operations,
    isValid: true,
    violations: [],
    score: calculateCrossDaySwapScore(targetCell, candidateCell)
  }
}
