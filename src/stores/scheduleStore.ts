import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Teacher } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { SchoolSchedule, ScheduleCell } from '@/types/schedule.types'
import { AdjustmentSuggestion, AdjustmentRequest, AdjustmentType, AdjustmentStatus, AdjustmentPriority, ScheduleOperation, AdjustmentImpact } from '@/types/adjustment.types'
import { runGreedyScheduler } from '@/algorithms/scheduler/greedyScheduler'
import { AdjustmentEngine } from '@/algorithms/adjustment'
import { aggregateRulesWithData, AggregationInput } from '@/services/ruleAggregator'
import { useRuleStore } from '@/stores/ruleStore'

export type ViewMode = 'dashboard' | 'schedule' | 'import' | 'rules'
export type ScheduleViewType = 'class' | 'teacher'

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
  violations: string[]
  operations: ScheduleOperation[]
  impact?: AdjustmentImpact  // 新增：影响信息
  description?: string  // 新增：建议描述
}

// 调课方案（建议模式使用）
export interface AdjustmentProposal {
  id: string
  originalCell: ScheduleCell
  targetSlot: { dayOfWeek: number; period: number }
  targetCell: ScheduleCell | null  // null表示空白格子
  priority: AdjustmentPriority
  score: number
  violations: string[]
  operations: ScheduleOperation[]
  impact?: AdjustmentImpact  // 新增：影响信息
  description?: string  // 新增：建议描述
  createdAt: Date
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
        const { teachers, schedule } = get()
        if (!schedule) return

        console.log('[startDrag] Starting drag for cell:', {
          cellId: cell.id,
          subject: cell.subject,
          teacherId: cell.teacherId,
          classId: cell.classId,
          dayOfWeek: cell.dayOfWeek,
          period: cell.period
        })

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
          total: suggestions.length,
          byPriority: {
            p0: suggestions.filter(s => s.priority === 0).length,
            p1: suggestions.filter(s => s.priority === 1).length,
            p2: suggestions.filter(s => s.priority === 2).length
          },
          suggestions: suggestions.map(s => ({
            id: s.id,
            priority: s.priority,
            description: s.description,
            operations: s.operations.map(op => ({ type: op.type, cellId: op.cellId, toSlot: op.toSlot }))
          }))
        })
        
        // 构建dropTargets Map
        // 只使用第一个操作的toSlot作为拖拽目标（即被拖拽课程的新位置）
        const dropTargets = new Map<string, DropTargetInfo>()
        
        // 首先添加所有可行的建议
        for (const suggestion of suggestions) {
          // 找到涉及被拖拽单元格的操作（cellId匹配被拖拽单元格）
          const targetOp = suggestion.operations.find(op => op.cellId === cell.id)
          if (targetOp && targetOp.toSlot) {
            const targetKey = `${targetOp.toSlot.dayOfWeek}_${targetOp.toSlot.period}`
            
            // 检查是否已有更高优先级的建议
            const existing = dropTargets.get(targetKey)
            if (!existing || suggestion.priority < existing.priority!) {
              dropTargets.set(targetKey, {
                cellId: targetKey,
                dayOfWeek: targetOp.toSlot.dayOfWeek as number,
                period: targetOp.toSlot.period,
                priority: suggestion.priority,
                score: suggestion.score,
                isValid: suggestion.isValid,
                violations: suggestion.violations,
                operations: suggestion.operations,
                impact: suggestion.impact,
                description: suggestion.description
              })
            }
          }
        }

        console.log('[startDrag] Drop targets built:', {
          count: dropTargets.size,
          targets: Array.from(dropTargets.entries()).map(([key, info]) => ({
            key,
            priority: info.priority,
            isValid: info.isValid,
            description: info.description
          }))
        })

        set({
          isDragging: true,
          draggedCell: cell,
          dropTargets
        })
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

        // 如果是建议模式，创建方案而不是直接应用
        if (adjustmentModeType === 'suggest') {
          const proposal: AdjustmentProposal = {
            id: `proposal_${Date.now()}`,
            originalCell: draggedCell,
            targetSlot: { dayOfWeek: targetInfo.dayOfWeek, period: targetInfo.period },
            targetCell: null, // TODO: 如果目标有课程，需要填充
            priority: targetInfo.priority!,
            score: targetInfo.score,
            violations: targetInfo.violations,
            operations: targetInfo.operations,
            impact: targetInfo.impact,  // 传递影响信息
            description: targetInfo.description,  // 传递描述信息
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
        const { dropTargets, draggedCell } = get()
        if (!draggedCell) return

        const targetInfo = dropTargets.get(targetCellId)
        if (!targetInfo) return

        const proposal: AdjustmentProposal = {
          id: `proposal_${Date.now()}`,
          originalCell: draggedCell,
          targetSlot: { dayOfWeek: targetInfo.dayOfWeek, period: targetInfo.period },
          targetCell: null,
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
