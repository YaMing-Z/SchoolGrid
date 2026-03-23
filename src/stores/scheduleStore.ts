import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Teacher } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { SchoolSchedule, ScheduleCell } from '@/types/schedule.types'
import { AdjustmentSuggestion, AdjustmentRequest, AdjustmentType, AdjustmentStatus, AdjustmentPriority, ScheduleOperation, AdjustmentImpact, ConflictDetail, AdjustmentConflictType, VIOLATION_CODE_TO_CONFLICT_TYPE, REASON_LABELS } from '@/types/adjustment.types'
import { runGreedyScheduler } from '@/algorithms/scheduler/greedyScheduler'
import { AdjustmentEngine } from '@/algorithms/adjustment'
import { aggregateRulesWithData, AggregationInput } from '@/services/ruleAggregator'
import { useRuleStore } from '@/stores/ruleStore'
import { Subject } from '@/data/constants'

// 获取当前配置的节次数组
function getPeriodsFromConfig(): number[] {
  const { scheduleConfig } = useRuleStore.getState()
  return scheduleConfig.periods.map(p => p.period)
}

/**
 * 将旧版错误码数组转换为结构化冲突详情
 */
function convertViolationsToConflictDetails(violations: string[]): ConflictDetail[] {
  return violations.map(message => {
    // 检查是否是动态警告信息（以"评分较低"开头）
    if (message.startsWith('评分较低')) {
      return {
        type: AdjustmentConflictType.SameDayOnly,
        severity: 'warning' as const,
        message: '评分较低',
        details: { reason: 'low_score' },
        suggestion: message
      }
    }

    // 检查是否是其他硬约束冲突
    const conflictType = VIOLATION_CODE_TO_CONFLICT_TYPE[message] || AdjustmentConflictType.SameCell
    return {
      type: conflictType,
      severity: 'error' as const,
      message: REASON_LABELS[message] || message,
      details: { reason: message }
    }
  })
}

/**
 * 查找指定班级、星期、节次的课程单元格
 */
function findCellAtSlot(
  schedule: SchoolSchedule | null,
  classId: string,
  dayOfWeek: number,
  period: number
): ScheduleCell | null {
  if (!schedule) return null

  const classSchedule = schedule.classSchedules.find(s => s.classId === classId)
  if (!classSchedule) return null

  return classSchedule.cells.find(c => c.dayOfWeek === dayOfWeek && c.period === period) || null
}

export type ViewMode = 'dashboard' | 'schedule' | 'import' | 'rules'
export type ScheduleViewType = 'class' | 'teacher'
export type OverviewTab = 'grade' | 'class' | 'teacher'

// 调课模式类型
export type AdjustmentModeType = 'edit' | 'suggest'

// 放置目标信息
export interface DropTargetInfo {
  cellId: string
  dayOfWeek: number
  period: number
  priority: AdjustmentPriority | null
  score: number
  isValid: boolean
  violations: ConflictDetail[]  // 改进：从 string[] 改为结构化冲突详情
  operations: ScheduleOperation[]
  impact?: AdjustmentImpact
  description?: string
}

// 调课方案（建议模式使用）
export interface AdjustmentProposal {
  id: string
  originalCell: ScheduleCell
  targetSlot: { dayOfWeek: number; period: number }
  targetCell: ScheduleCell | null  // null表示空白格子
  priority: AdjustmentPriority
  score: number
  violations: ConflictDetail[]  // 改进：从 string[] 改为结构化冲突详情
  operations: ScheduleOperation[]
  impact?: AdjustmentImpact
  description?: string
  createdAt: Date
}

// Tooltip 状态接口
export interface TooltipState {
  visible: boolean
  conflict: ConflictDetail | null
  position: { x: number; y: number; placement: 'top' | 'bottom' | 'left' | 'right' }
}

interface ScheduleState {
  // 数据
  teachers: Teacher[]
  classes: SchoolClass[]
  curriculumItems: CurriculumItem[]
  rawImportData: AggregationInput | null
  schedule: SchoolSchedule | null

  // UI 状态
  currentView: ViewMode
  selectedClassId: string | null
  selectedTeacherId: string | null
  selectedCell: ScheduleCell | null
  scheduleViewType: ScheduleViewType
  overviewTab: OverviewTab

  // 调课状态（旧版，保留兼容）
  adjustmentMode: boolean
  adjustmentSuggestions: AdjustmentSuggestion[]
  selectedSuggestion: AdjustmentSuggestion | null

  // 拖拽调课状态（新版）
  adjustmentModeType: AdjustmentModeType  // 'edit' | 'suggest'
  isDragging: boolean
  draggedCell: ScheduleCell | null
  dropTargets: Map<string, DropTargetInfo>
  hoveredTarget: string | null
  currentProposal: AdjustmentProposal | null

  // Tooltip 状态（全局）
  tooltipState: TooltipState

  // 验证状态
  validationErrors: string[]
  validationWarnings: string[]

  // Actions
  setView: (view: ViewMode) => void
  setTeachers: (teachers: Teacher[]) => void
  setClasses: (classes: SchoolClass[]) => void
  setCurriculumItems: (items: CurriculumItem[]) => void
  setSelectedClass: (classId: string | null) => void
  setSelectedTeacher: (teacherId: string | null) => void
  setSelectedCell: (cell: ScheduleCell | null) => void
  setScheduleViewType: (type: ScheduleViewType) => void
  setOverviewTab: (tab: OverviewTab) => void
  setValidationErrors: (errors: string[]) => void
  setValidationWarnings: (warnings: string[]) => void
  setRawImportData: (data: AggregationInput | null) => void
  recalculateRules: () => void

  // 业务操作
  generateSchedule: () => void
  clearSchedule: () => void
  startAdjustment: (cell: ScheduleCell) => void
  selectSuggestion: (suggestion: AdjustmentSuggestion) => void
  applySuggestion: () => void
  cancelAdjustment: () => void

  // 拖拽调课操作
  setAdjustmentModeType: (mode: AdjustmentModeType) => void
  startDrag: (cell: ScheduleCell) => void
  endDrag: () => void
  setDropTargets: (targets: Map<string, DropTargetInfo>) => void
  setHoveredTarget: (targetId: string | null) => void
  applyDragAdjustment: (targetCellId: string) => void
  createProposal: (targetCellId: string) => void
  clearProposal: () => void

  // Tooltip 操作
  showTooltip: (conflict: ConflictDetail, position: { x: number; y: number; placement: 'top' | 'bottom' | 'left' | 'right' }) => void
  hideTooltip: () => void

  // 自习课教师分配
  assignSelfStudyTeacher: (cellId: string, teacherId: string) => void

  // 数据持久化
  exportData: () => string
  importData: (json: string) => void
  resetData: () => void

  // 步骤条流转
  currentStep: number
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
}

const initialTooltipState: TooltipState = {
  visible: false,
  conflict: null,
  position: { x: 0, y: 0, placement: 'right' }
}

const initialState = {
  teachers: [],
  classes: [],
  curriculumItems: [],
  rawImportData: null,
  schedule: null,
  currentView: 'dashboard' as ViewMode,
  selectedClassId: null,
  selectedTeacherId: null,
  selectedCell: null,
  scheduleViewType: 'class' as ScheduleViewType,
  overviewTab: 'grade' as OverviewTab,
  adjustmentMode: false,
  adjustmentSuggestions: [],
  selectedSuggestion: null,
  validationErrors: [],
  validationWarnings: [],
  currentStep: 0,
  // 新增拖拽状态
  adjustmentModeType: 'edit' as AdjustmentModeType,
  isDragging: false,
  draggedCell: null,
  dropTargets: new Map<string, DropTargetInfo>(),
  hoveredTarget: null,
  currentProposal: null,
  // Tooltip 状态
  tooltipState: initialTooltipState,
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setView: (view) => set({ currentView: view }),
      setTeachers: (teachers) => set({ teachers }),
      setClasses: (classes) => set({ classes }),
      setCurriculumItems: (items) => set({ curriculumItems: items }),
      setSelectedClass: (classId) => set({ selectedClassId: classId }),
      setSelectedTeacher: (teacherId) => set({ selectedTeacherId: teacherId }),
      setSelectedCell: (cell) => set({ selectedCell: cell }),
      setScheduleViewType: (type) => set({ scheduleViewType: type }),
      setOverviewTab: (tab) => set({ overviewTab: tab }),
      setValidationErrors: (errors) => set({ validationErrors: errors }),
      setValidationWarnings: (warnings) => set({ validationWarnings: warnings }),
      setRawImportData: (data) => set({ rawImportData: data }),

      setStep: (step) => set({ currentStep: Math.max(0, Math.min(3, step)) }),
      nextStep: () => set((state) => ({ currentStep: Math.min(3, state.currentStep + 1) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),

      recalculateRules: () => {
        const { rawImportData } = get()
        if (rawImportData) {
          const aggregatedResult = aggregateRulesWithData(rawImportData)
          set({
            teachers: aggregatedResult.teachers,
            classes: aggregatedResult.classes,
            curriculumItems: aggregatedResult.curriculumItems,
          })
        }
      },

      generateSchedule: () => {
        get().recalculateRules()

        const { teachers, classes, curriculumItems } = get()
        if (teachers.length === 0 || classes.length === 0 || curriculumItems.length === 0) {
          set({ validationErrors: ['请先导入教师、班级和教学计划数据'] })
          return
        }

        const schedule = runGreedyScheduler(teachers, classes, curriculumItems)
        set({ schedule, currentView: 'schedule' })
      },

      clearSchedule: () => set({
        schedule: null,
        selectedClassId: null,
        selectedTeacherId: null,
        selectedCell: null,
        adjustmentMode: false,
        adjustmentSuggestions: [],
        selectedSuggestion: null
      }),

      startAdjustment: (cell) => {
        const { teachers, schedule } = get()
        if (!schedule) return

        const engine = new AdjustmentEngine(teachers, schedule)
        const request: AdjustmentRequest = {
          id: `adj_${cell.id}`,
          type: AdjustmentType.TeacherLeave,
          reason: '教师请假',
          targetCellId: cell.id,
          targetDate: new Date(),
          requestedBy: 'user',
          requestedAt: new Date(),
          status: AdjustmentStatus.Pending
        }

        const suggestions = engine.generateSuggestions(request)
        set({
          adjustmentMode: true,
          selectedCell: cell,
          adjustmentSuggestions: suggestions,
          selectedSuggestion: null
        })
      },

      selectSuggestion: (suggestion) => set({ selectedSuggestion: suggestion }),

      applySuggestion: () => {
        const { selectedSuggestion, schedule, selectedCell } = get()
        console.log('[applySuggestion] Called with:', { selectedSuggestion, schedule: !!schedule, selectedCell })

        if (!selectedSuggestion || !schedule || !selectedCell) {
          console.log('[applySuggestion] Missing required data, returning early')
          return
        }

        console.log('[applySuggestion] Operations:', selectedSuggestion.operations)

        // 根据操作类型应用调整
        const updatedSchedules = schedule.classSchedules.map(classSchedule => {
          const updatedCells = classSchedule.cells.map(cell => {
            // 查找是否有操作涉及此单元格
            for (const op of selectedSuggestion.operations) {
              if (op.type === 'swap' && op.cellId === cell.id) {
                console.log(`[applySuggestion] Swapping cell ${cell.id}:`, {
                  from: { dayOfWeek: cell.dayOfWeek, period: cell.period },
                  to: { dayOfWeek: op.toSlot!.dayOfWeek, period: op.toSlot!.period }
                })
                // 执行交换 - 同时更新 ID 以保持一致性
                const newDayOfWeek = op.toSlot!.dayOfWeek as any
                const newPeriod = op.toSlot!.period
                return {
                  ...cell,
                  id: `cell_${cell.classId}_${newDayOfWeek}_${newPeriod}`, // 更新 ID
                  dayOfWeek: newDayOfWeek,
                  period: newPeriod
                }
              }
              if (op.type === 'substitute' && op.cellId === cell.id) {
                console.log(`[applySuggestion] Substituting teacher for cell ${cell.id}:`, {
                  from: cell.teacherId,
                  to: op.toTeacherId
                })
                // 执行代课
                return {
                  ...cell,
                  teacherId: op.toTeacherId!
                }
              }
            }
            return cell
          })

          return {
            ...classSchedule,
            cells: updatedCells
          }
        })

        console.log('[applySuggestion] Updated schedules:', updatedSchedules)

        // 更新课表
        set({
          schedule: {
            ...schedule,
            classSchedules: updatedSchedules
          },
          adjustmentMode: false,
          adjustmentSuggestions: [],
          selectedSuggestion: null,
          selectedCell: null
        })

        console.log('[applySuggestion] Schedule updated successfully')
      },

      cancelAdjustment: () => set({
        adjustmentMode: false,
        adjustmentSuggestions: [],
        selectedSuggestion: null,
        selectedCell: null
      }),

      // 拖拽调课操作
      setAdjustmentModeType: (mode) => set({ adjustmentModeType: mode }),

      startDrag: (cell) => {
        const { teachers, classes, schedule, selectedClassId } = get()
        if (!schedule) return

        // 计算所有可能的放置目标
        const engine = new AdjustmentEngine(teachers, schedule)
        const request: AdjustmentRequest = {
          id: `drag_${cell.id}`,
          type: AdjustmentType.TimeSwap,
          reason: '拖拽调课',
          targetCellId: cell.id,
          targetDate: new Date(),
          requestedBy: 'user',
          requestedAt: new Date(),
          status: AdjustmentStatus.Pending
        }

        const suggestions = engine.generateSuggestions(request)

        console.log('[startDrag] Generated suggestions:', {
          targetCellId: cell.id,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.map(s => ({
            id: s.id,
            priority: s.priority,
            isValid: s.isValid,
            violations: s.violations,
            score: s.score,
            operations: s.operations
          }))
        })

        // 构建dropTargets Map
        // 只使用第一个操作的toSlot作为拖拽目标（即被拖拽课程的新位置）
        const dropTargets = new Map<string, DropTargetInfo>()
        
        // 构建教师占用情况表（用于分析不可行位置）
        const teacherOccupancy = new Map<string, { dayOfWeek: number; period: number; classId: string; subject: string }>()
        for (const classSchedule of schedule.classSchedules) {
          for (const c of classSchedule.cells) {
            if (c.teacherId === cell.teacherId && c.id !== cell.id) {
              teacherOccupancy.set(`${c.dayOfWeek}_${c.period}`, {
                dayOfWeek: c.dayOfWeek,
                period: c.period,
                classId: classSchedule.classId,
                subject: c.subject
              })
            }
          }
        }
        
        // 为所有可能的时段生成冲突分析（周一到周五，使用动态节次配置）
        const DAYS = [1, 2, 3, 4, 5]
        const PERIODS = getPeriodsFromConfig()

        for (const day of DAYS) {
          for (const period of PERIODS) {
            const targetKey = `${day}_${period}`
            
            // 跳过原位置
            if (day === cell.dayOfWeek && period === cell.period) {
              dropTargets.set(targetKey, {
                cellId: targetKey,
                dayOfWeek: day,
                period: period,
                priority: null,
                score: 0,
                isValid: false,
                violations: [{
                  type: AdjustmentConflictType.SameCell,
                  severity: 'info',
                  message: '原位置',
                  details: { reason: 'same_cell' }
                }],
                operations: []
              })
              continue
            }
            
            // 检查教师是否在该时段有课
            const teacherBusy = teacherOccupancy.get(targetKey)
            if (teacherBusy) {
              dropTargets.set(targetKey, {
                cellId: targetKey,
                dayOfWeek: day,
                period: period,
                priority: null,
                score: 0,
                isValid: false,
                violations: [{
                  type: AdjustmentConflictType.TeacherBusy,
                  severity: 'error',
                  message: `${teachers.find(t => t.id === cell.teacherId)?.name || '教师'}在${classes.find(c => c.id === teacherBusy.classId)?.name || '某班级'}有${teacherBusy.subject}课`,
                  details: {
                    teacherId: cell.teacherId,
                    teacherName: teachers.find(t => t.id === cell.teacherId)?.name || '教师',
                    busySlot: {
                      dayOfWeek: day,
                      period: period,
                      dayName: ['','周一','周二','周三','周四','周五'][day],
                      periodName: `第${period}节`
                    },
                    busyWith: {
                      className: classes.find(c => c.id === teacherBusy.classId)?.name || '某班级',
                      subject: teacherBusy.subject
                    }
                  },
                  suggestion: '可尝试选择其他时段，或与该班级协调调课'
                }],
                  operations: []
                })
              } else {
                // 教师没有在该时段有课，但也没有可行的建议
                // 分析具体原因并提供更有意义的提示

                // 计算是否同一天（用于后续判断）
                const isSameDay = day === cell.dayOfWeek

                // 检查目标位置是否有课程（可能是其他教师或自习课）
                const targetCell = findCellAtSlot(schedule, selectedClassId || '', day, period)

                let conflictMessage = ''
                let conflictType = AdjustmentConflictType.TeacherUnavailable
                let suggestionTip = ''

                if (targetCell) {
                  // 目标位置有课程
                  if (targetCell.isFixed) {
                    // 目标是固定排课课程
                    const subjectName = (() => {
                      if (targetCell.subject === Subject.Meeting) return '班会课'
                      if (targetCell.subject === Subject.SelfStudy) return '自习课'
                      return `${targetCell.subject}课`
                    })()

                    conflictMessage = `${subjectName}为固定排课`
                    conflictType = AdjustmentConflictType.FixedCourse
                    suggestionTip = '固定排课的课程无法调换，请在规则配置中修改后再排课'
                  } else {
                    // 目标是非固定课程，但可能是不同班级/教师的课程
                    const targetClass = classes.find(c => c.id === targetCell.classId)
                    const targetTeacher = teachers.find(t => t.id === targetCell.teacherId)

                    if (targetClass && targetClass.id !== selectedClassId) {
                      conflictMessage = `该位置为${targetClass.name}的课程`
                      suggestionTip = '不同班级的课程无法直接调换'
                    } else if (targetTeacher && targetTeacher.id !== cell.teacherId) {
                      conflictMessage = `该位置为${targetTeacher.name}的${targetCell.subject}课`
                      suggestionTip = '不同教师的课程无法直接调换'
                    } else {
                      conflictMessage = '目标时段课程无法互换'
                      suggestionTip = '该课程可能存在其他限制，无法进行互换'
                    }
                  }
                } else {
                  // 目标位置为空
                  if (isSameDay) {
                    conflictMessage = '当天无其他课程可互换'
                    suggestionTip = '该教师当天只有这一节课，无法进行同日互换'
                  } else {
                    conflictMessage = '目标时段无课程可互换'
                    suggestionTip = '该时段为空，无法进行课程互换。可尝试拖拽到有课程的位置进行交换'
                  }
                }

                dropTargets.set(targetKey, {
                  cellId: targetKey,
                  dayOfWeek: day,
                  period: period,
                  priority: null,
                  score: 0,
                  isValid: false,
                  violations: [{
                    type: conflictType,
                    severity: 'warning',
                    message: conflictMessage,
                    details: {
                      reason: 'no_swap_target',
                      isSameDay,
                      targetDay: day,
                      targetPeriod: period,
                      teacherName: teachers.find(t => t.id === cell.teacherId)?.name || '教师'
                    },
                    suggestion: suggestionTip
                  }],
                  operations: []
                })
              }
            }
          }
        
        // 添加所有可行的建议（会覆盖上面的冲突分析）
        for (const suggestion of suggestions) {
          // 找到涉及被拖拽单元格的操作（cellId匹配被拖拽单元格）
          const targetOp = suggestion.operations.find(op => op.cellId === cell.id)

          if (targetOp && targetOp.toSlot) {
            const targetKey = `${targetOp.toSlot.dayOfWeek}_${targetOp.toSlot.period}`

            console.log('[startDrag] Processing suggestion:', {
              suggestionId: suggestion.id,
              targetKey,
              isValid: suggestion.isValid,
              violations: suggestion.violations
            })

            // 检查是否已有更高优先级的建议
            const existing = dropTargets.get(targetKey)

            if (!existing || existing.priority === null || suggestion.priority < existing.priority) {
              const convertedViolations = convertViolationsToConflictDetails(suggestion.violations)
              console.log('[startDrag] Setting dropTarget:', {
                targetKey,
                suggestionId: suggestion.id,
                isValid: suggestion.isValid,
                score: suggestion.score,
                priority: suggestion.priority,
                originalViolations: suggestion.violations,
                convertedViolationsCount: convertedViolations.length,
                convertedViolations: convertedViolations.map(v => ({ type: v.type, severity: v.severity, message: v.message }))
              })

              dropTargets.set(targetKey, {
                cellId: targetKey,
                dayOfWeek: targetOp.toSlot.dayOfWeek as number,
                period: targetOp.toSlot.period,
                priority: suggestion.priority,
                score: suggestion.score,
                isValid: suggestion.isValid,
                violations: convertedViolations,
                operations: suggestion.operations,
                impact: suggestion.impact,
                description: suggestion.description
              })
            }
          }
        }

        console.log('[startDrag] Final dropTargets count:', dropTargets.size)

        // 验证一些关键条目
        for (const [key, value] of dropTargets.entries()) {
          if (value.isValid) {
            console.log('[startDrag] Valid dropTarget:', { key, isValid: value.isValid, priority: value.priority, score: value.score })
          }
        }

        // 创建新的Map以触发Zustand状态更新（浅比较需要新引用）
        set({
          isDragging: true,
          draggedCell: cell,
          dropTargets: new Map(dropTargets)
        })

        // 验证状态已正确设置
        setTimeout(() => {
          const currentState = get()
          console.log('[startDrag] State verification:', {
            isDragging: currentState.isDragging,
            dropTargetsType: Object.prototype.toString.call(currentState.dropTargets),
            dropTargetsSize: currentState.dropTargets.size,
            dropTargetsIsMap: currentState.dropTargets instanceof Map,
            sampleEntry: Array.from(currentState.dropTargets.entries()).find(([_, v]) => v.isValid)
          })
        }, 0)
      },

      endDrag: () => set({
        isDragging: false,
        draggedCell: null,
        dropTargets: new Map(),
        hoveredTarget: null
      }),

      setDropTargets: (targets) => set({ dropTargets: targets }),

      setHoveredTarget: (targetId) => set({ hoveredTarget: targetId }),

      applyDragAdjustment: (targetCellId) => {
        const { dropTargets, draggedCell, schedule, adjustmentModeType } = get()
        if (!draggedCell || !schedule) return

        const targetInfo = dropTargets.get(targetCellId)
        if (!targetInfo || !targetInfo.isValid) return

        // 获取目标位置的单元格信息
        const targetCell = findCellAtSlot(schedule, draggedCell.classId, targetInfo.dayOfWeek, targetInfo.period)

        // 如果是建议模式，创建方案而不是直接应用
        if (adjustmentModeType === 'suggest') {
          const proposal: AdjustmentProposal = {
            id: `proposal_${Date.now()}`,
            originalCell: draggedCell,
            targetSlot: { dayOfWeek: targetInfo.dayOfWeek, period: targetInfo.period },
            targetCell: targetCell,
            priority: targetInfo.priority!,
            score: targetInfo.score,
            violations: targetInfo.violations,
            operations: targetInfo.operations,
            impact: targetInfo.impact,
            description: targetInfo.description,
            createdAt: new Date()
          }
          set({ currentProposal: proposal, isDragging: false, draggedCell: null })
          return
        }

        // 编辑模式：直接应用调整
        const updatedSchedules = schedule.classSchedules.map(classSchedule => {
          const updatedCells = classSchedule.cells.map(cell => {
            for (const op of targetInfo.operations) {
              if (op.type === 'swap' && op.cellId === cell.id) {
                const newDayOfWeek = op.toSlot!.dayOfWeek as number
                const newPeriod = op.toSlot!.period
                return {
                  ...cell,
                  id: `cell_${cell.classId}_${newDayOfWeek}_${newPeriod}`,
                  dayOfWeek: newDayOfWeek,
                  period: newPeriod
                }
              }
              if (op.type === 'substitute' && op.cellId === cell.id) {
                return {
                  ...cell,
                  teacherId: op.toTeacherId!
                }
              }
            }
            return cell
          })

          return {
            ...classSchedule,
            cells: updatedCells
          }
        })

        set({
          schedule: {
            ...schedule,
            classSchedules: updatedSchedules
          },
          isDragging: false,
          draggedCell: null,
          dropTargets: new Map(),
          hoveredTarget: null
        })
      },

      createProposal: (targetCellId) => {
        const { dropTargets, draggedCell, schedule } = get()
        if (!draggedCell || !schedule) return

        const targetInfo = dropTargets.get(targetCellId)
        if (!targetInfo) return

        // 获取目标位置的单元格信息
        const targetCell = findCellAtSlot(schedule, draggedCell.classId, targetInfo.dayOfWeek, targetInfo.period)

        const proposal: AdjustmentProposal = {
          id: `proposal_${Date.now()}`,
          originalCell: draggedCell,
          targetSlot: { dayOfWeek: targetInfo.dayOfWeek, period: targetInfo.period },
          targetCell: targetCell,
          priority: targetInfo.priority!,
          score: targetInfo.score,
          violations: targetInfo.violations,
          operations: targetInfo.operations,
          createdAt: new Date()
        }
        set({ currentProposal: proposal })
      },

      clearProposal: () => set({
        currentProposal: null,
        isDragging: false,
        draggedCell: null,
        dropTargets: new Map(),
        hoveredTarget: null
      }),

      // Tooltip 操作
      showTooltip: (conflict, position) => set({
        tooltipState: {
          visible: true,
          conflict,
          position
        }
      }),

      hideTooltip: () => set({
        tooltipState: {
          ...get().tooltipState,
          visible: false
        }
      }),

      assignSelfStudyTeacher: (cellId: string, teacherId: string) => {
        const { schedule } = get()
        if (!schedule) return

        // 更新课表中的自习课教师
        const updatedSchedules = schedule.classSchedules.map(classSchedule => {
          const updatedCells = classSchedule.cells.map(cell => {
            if (cell.id === cellId) {
              return {
                ...cell,
                teacherId
              }
            }
            return cell
          })

          return {
            ...classSchedule,
            cells: updatedCells
          }
        })

        set({
          schedule: {
            ...schedule,
            classSchedules: updatedSchedules
          }
        })
      },

      exportData: () => {
        const { teachers, classes, curriculumItems, schedule } = get()
        return JSON.stringify({ teachers, classes, curriculumItems, schedule }, null, 2)
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json)
          set({
            teachers: data.teachers || [],
            classes: data.classes || [],
            curriculumItems: data.curriculumItems || [],
            schedule: data.schedule || null
          })
        } catch (e) {
          set({ validationErrors: ['导入数据格式错误'] })
        }
      },

      resetData: () => set(initialState),
    }),
    {
      name: 'school-grid-storage',
      partialize: (state) => ({
        teachers: state.teachers,
        classes: state.classes,
        curriculumItems: state.curriculumItems,
        schedule: state.schedule,
        rawImportData: state.rawImportData,
        currentStep: state.currentStep,
      }),
    }
  )
)

// 订阅规则库的变化，任何排课规则改变时，自动重新聚合计算内存中的课表元数据
useRuleStore.subscribe(() => {
  useScheduleStore.getState().recalculateRules()
})
