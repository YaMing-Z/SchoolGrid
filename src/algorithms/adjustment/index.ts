import { ScheduleCell, SchoolSchedule } from '@/types/schedule.types'
import { Teacher } from '@/types/teacher.types'
import {
  AdjustmentRequest,
  AdjustmentSuggestion,
  AdjustmentPriority,
  AdjustmentResult,
  AdjustmentStatus,
  AdjustmentType
} from '@/types/adjustment.types'
import { findSameDaySwaps } from './p0SameDaySwap'
import { findCrossDaySwaps } from './p1CrossDaySwap'
import { findSubstitutes } from './p2Substitute'
import { useRuleStore } from '@/stores/ruleStore'

/**
 * 调课建议引擎
 *
 * 按优先级顺序尝试三种策略：
 * P0: 同班同日互换（最优，学生影响最小）
 * P1: 同班跨日互换（次优）
 * P2: 同科代课（可接受）
 */

/**
 * 调课引擎配置
 */
export interface AdjustmentEngineConfig {
  enableP0: boolean       // 启用同日互换
  enableP1: boolean       // 启用跨日互换
  enableP2: boolean       // 启用代课
  maxSuggestions: number  // 每种策略最多返回的建议数
}

const DEFAULT_CONFIG: AdjustmentEngineConfig = {
  enableP0: true,
  enableP1: true,
  enableP2: true,
  maxSuggestions: 5
}

/**
 * 调课引擎
 */
export class AdjustmentEngine {
  private teachers: Teacher[]
  private schedule: SchoolSchedule
  private teacherSchedules: Map<string, Set<string>>
  private subjectForbiddenSlots: Map<string, Set<string>>
  private config: AdjustmentEngineConfig

  constructor(
    teachers: Teacher[],
    schedule: SchoolSchedule,
    config: Partial<AdjustmentEngineConfig> = {}
  ) {
    this.teachers = teachers
    this.schedule = schedule
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.teacherSchedules = this.buildTeacherSchedules()
    this.subjectForbiddenSlots = this.buildSubjectForbiddenSlots()
  }

  /**
   * 构建教师课表占用情况
   */
  private buildTeacherSchedules(): Map<string, Set<string>> {
    const schedules = new Map<string, Set<string>>()

    for (const classSchedule of this.schedule.classSchedules) {
      for (const cell of classSchedule.cells) {
        if (!schedules.has(cell.teacherId)) {
          schedules.set(cell.teacherId, new Set())
        }
        schedules.get(cell.teacherId)!.add(`${cell.dayOfWeek}_${cell.period}`)
      }
    }

    return schedules
  }

  /**
   * 构建学科绝对禁排时段表（从 ruleStore 读取）
   * subject → Set<"dayOfWeek_period">
   */
  private buildSubjectForbiddenSlots(): Map<string, Set<string>> {
    const forbidden = new Map<string, Set<string>>()
    const { subjectTimeRules } = useRuleStore.getState()
    for (const rule of subjectTimeRules) {
      if (rule.type === 'must_not') {
        if (!forbidden.has(rule.subject)) {
          forbidden.set(rule.subject, new Set())
        }
        forbidden.get(rule.subject)!.add(`${rule.dayOfWeek}_${rule.period}`)
      }
    }
    return forbidden
  }

  /**
   * 获取班级的所有课程单元格
   */
  private getClassCells(classId: string): ScheduleCell[] {
    const classSchedule = this.schedule.classSchedules.find(s => s.classId === classId)
    return classSchedule?.cells || []
  }

  /**
   * 根据单元格ID查找单元格
   */
  private findCellById(cellId: string): ScheduleCell | undefined {
    for (const classSchedule of this.schedule.classSchedules) {
      const cell = classSchedule.cells.find(c => c.id === cellId)
      if (cell) return cell
    }
    return undefined
  }

  /**
   * 生成调课建议
   *
   * @param request 调课请求
   * @returns 按优先级排序的调课建议列表
   */
  generateSuggestions(request: AdjustmentRequest): AdjustmentSuggestion[] {
    const targetCell = this.findCellById(request.targetCellId)
    if (!targetCell) {
      return []
    }

    const classCells = this.getClassCells(targetCell.classId)
    const allSuggestions: AdjustmentSuggestion[] = []

    // P0: 同班同日互换
    if (this.config.enableP0) {
      const p0Suggestions = findSameDaySwaps(targetCell, classCells, undefined, this.subjectForbiddenSlots)
        // 不要截取！包含所有可行的建议（包括低评分的）
        // .slice(0, this.config.maxSuggestions)
        .map(s => ({ ...s, requestId: request.id }))

      allSuggestions.push(...p0Suggestions)
    }

    // P1: 同班跨日互换（移除数量限制，包含所有可行建议）
    if (this.config.enableP1) {
      const p1Suggestions = findCrossDaySwaps(targetCell, classCells, undefined, this.subjectForbiddenSlots)
        // 不要截取！包含所有可行的建议（包括低评分的）
        // .slice(0, this.config.maxSuggestions)
        .map(s => ({ ...s, requestId: request.id }))

      console.log('[AdjustmentEngine] P1 cross-day suggestions:', {
        targetCellId: targetCell.id,
        classCellsCount: classCells.length,
        p1Count: p1Suggestions.length,
        p1Scores: p1Suggestions.map(s => s.score)
      })

      allSuggestions.push(...p1Suggestions)
    }

    // P2: 同科代课
    if (this.config.enableP2) {
      const p2Suggestions = findSubstitutes(
        targetCell,
        this.teachers,
        this.teacherSchedules
      )
        // 不要截取！包含所有可行的建议（包括低评分的）
        // .slice(0, this.config.maxSuggestions)
        .map(s => ({ ...s, requestId: request.id }))

      allSuggestions.push(...p2Suggestions)
    }

    // 按优先级和评分排序
    const sortedSuggestions = allSuggestions.sort((a, b) => {
      // 先按优先级排序
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      // 同优先级按评分排序
      return b.score - a.score
    })

    // 调试日志：显示所有生成的建议，包括低评分的
    console.log('[AdjustmentEngine] All suggestions generated:', {
      targetCellId: request.targetCellId,
      totalCount: sortedSuggestions.length,
      lowScoreWarnings: sortedSuggestions.filter(s => s.score < 110 && s.priority === 0).map(s => ({
        id: s.id,
        priority: s.priority,
        score: s.score,
        isValid: s.isValid,
        violations: s.violations
      })),
      allScores: sortedSuggestions.map(s => `${s.priority === 0 ? 'P0' : s.priority === 1 ? 'P1' : 'P2'}:${s.score}`)
    })

    return sortedSuggestions
  }

  /**
   * 处理调课请求
   */
  processRequest(request: AdjustmentRequest): AdjustmentResult {
    const suggestions = this.generateSuggestions(request)

    const result: AdjustmentResult = {
      requestId: request.id,
      selectedSuggestion: null,
      allSuggestions: suggestions,
      status: suggestions.length > 0 ? 'success' : 'failed',
      message: suggestions.length > 0
        ? `找到 ${suggestions.length} 个调课建议`
        : '未找到可行的调课方案'
    }

    return result
  }

  /**
   * 批量处理多个单元格的调课建议
   */
  batchGenerateSuggestions(
    cellIds: string[],
    reason: string = '批量调课'
  ): Map<string, AdjustmentSuggestion[]> {
    const results = new Map<string, AdjustmentSuggestion[]>()

    for (const cellId of cellIds) {
      const request: AdjustmentRequest = {
        id: `batch_${cellId}`,
        type: AdjustmentType.TeacherLeave,
        reason,
        targetCellId: cellId,
        targetDate: new Date(),
        requestedBy: 'system',
        requestedAt: new Date(),
        status: AdjustmentStatus.Pending
      }

      const suggestions = this.generateSuggestions(request)
      results.set(cellId, suggestions)
    }

    return results
  }
}

/**
 * 快速生成调课建议（便捷函数）
 */
export function generateAdjustmentSuggestions(
  targetCellId: string,
  teachers: Teacher[],
  schedule: SchoolSchedule,
  config?: Partial<AdjustmentEngineConfig>
): AdjustmentSuggestion[] {
  const engine = new AdjustmentEngine(teachers, schedule, config)

  const request: AdjustmentRequest = {
    id: `quick_${targetCellId}`,
    type: AdjustmentType.TeacherLeave,
    reason: '教师请假',
    targetCellId,
    targetDate: new Date(),
    requestedBy: 'system',
    requestedAt: new Date(),
    status: AdjustmentStatus.Pending
  }

  return engine.generateSuggestions(request)
}

/**
 * 获取建议的优先级标签
 */
export function getPriorityLabel(priority: AdjustmentPriority): string {
  switch (priority) {
    case AdjustmentPriority.P0:
      return 'P0 - 同日互换'
    case AdjustmentPriority.P1:
      return 'P1 - 跨日互换'
    case AdjustmentPriority.P2:
      return 'P2 - 代课'
    default:
      return '未知策略'
  }
}

/**
 * 导出子模块
 */
export { findSameDaySwaps, canSameDaySwap } from './p0SameDaySwap'
export { findCrossDaySwaps, canCrossDaySwap } from './p1CrossDaySwap'
export { findSubstitutes, canSubstitute } from './p2Substitute'
