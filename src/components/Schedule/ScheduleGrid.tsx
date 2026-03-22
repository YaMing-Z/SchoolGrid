import { DndContext, DragStartEvent, DragEndEvent, DragMoveEvent, DragOverlay, PointerSensor, useSensor, useSensors, CollisionDetection } from '@dnd-kit/core'
import { useScheduleStore } from '@/stores/scheduleStore'
import { ScheduleCell } from '@/types/schedule.types'
import { SUBJECT_NAMES, SUBJECT_COLORS } from '@/data/constants'
import { DraggableCourse } from './DraggableCourse'
import { DropTargetCell } from './DropTargetCell'
import { AdjustmentProposalPanel } from '@/components/Adjustment/AdjustmentProposalPanel'
import { ConflictTooltip } from './ConflictUI'
import { useState, useEffect } from 'react'

const DAYS = ['周一', '周二', '周三', '周四', '周五']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * 自定义碰撞检测：基于指针位置的精确检测
 * 只返回指针下方的 droppable，不自动吸附
 */
const customCollisionDetection: CollisionDetection = ({
  pointerCoordinates,
  droppableContainers
}) => {
  if (!pointerCoordinates) {
    return []
  }

  const { x, y } = pointerCoordinates

  // 找到指针下方的所有 droppable
  const collisions: { id: string; data: any }[] = []

  for (const container of droppableContainers) {
    const rect = container.rect.current

    if (!rect) {
      continue
    }

    // 检查指针是否在 droppable 的边界框内
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      collisions.push({
        id: String(container.id),
        data: container
      })
    }
  }

  return collisions
}

export function ScheduleGrid() {
  const {
    schedule,
    selectedClassId,
    setSelectedClass,
    classes,
    teachers,
    clearSchedule,
    generateSchedule,
    startDrag,
    endDrag,
    applyDragAdjustment,
    adjustmentModeType,
    setAdjustmentModeType,
    isDragging,
    draggedCell,
    currentProposal,
    tooltipState,
    hideTooltip,
    setHoveredTarget,
    curriculumItems,
    rawImportData
  } = useScheduleStore()

  const [activeCell, setActiveCell] = useState<ScheduleCell | null>(null)

  // 默认选中第一个班级
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClass(classes[0].id)
    }
  }, [selectedClassId, classes, setSelectedClass])

  // 检查是否有数据但未排课
  const hasImportedData = rawImportData !== null || (classes.length > 0 && teachers.length > 0 && curriculumItems.length > 0)

  const classSchedule = schedule?.classSchedules.find(s => s.classId === selectedClassId)

  // 构建课表格子映射
  const cellMap = new Map<string, ScheduleCell>()
  if (classSchedule) {
    for (const cell of classSchedule.cells) {
      cellMap.set(`${cell.dayOfWeek}_${cell.period}`, cell)
    }
  }

  // 获取教师姓名
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId || t.employeeId === teacherId)
    return teacher?.name || teacherId
  }

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移动5px才触发拖拽
      },
    })
  )

  // 拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const cell = active.data.current?.cell as ScheduleCell
    if (cell) {
      setActiveCell(cell)
      startDrag(cell)
    }
  }

  // 拖拽移动 - 实时更新悬停状态
  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event

    if (over) {
      const targetData = over.data.current
      if (targetData?.dayOfWeek !== undefined && targetData?.period !== undefined) {
        const targetKey = `${targetData.dayOfWeek}_${targetData.period}`
        setHoveredTarget(targetKey)
      }
    } else {
      setHoveredTarget(null)
    }
  }

  // 拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event

    setActiveCell(null)

    // 关闭 Tooltip
    hideTooltip()

    if (over) {
      const targetData = over.data.current
      if (targetData?.dayOfWeek && targetData?.period) {
        const targetKey = `${targetData.dayOfWeek}_${targetData.period}`
        applyDragAdjustment(targetKey)
      }
    }

    endDrag()
  }

  // 拖拽取消
  const handleDragCancel = () => {
    setActiveCell(null)
    hideTooltip()
    endDrag()
  }

  // 空状态处理
  if (!schedule) {
    // 已导入数据但未排课
    if (hasImportedData) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-[var(--color-text-muted)]">
          <span className="text-6xl mb-4">📊</span>
          <p className="text-lg mb-2 text-[var(--color-text-primary)]">数据已就绪</p>
          <p className="text-sm mb-6">
            已导入 {classes.length} 个班级、{teachers.length} 位教师、{curriculumItems.length} 条教学计划
          </p>
          <button
            onClick={() => generateSchedule()}
            className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors flex items-center gap-2"
          >
            <span>🚀</span>
            <span>开始排课</span>
          </button>
        </div>
      )
    }

    // 没有导入数据
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[var(--color-text-muted)]">
        <span className="text-6xl mb-4">📅</span>
        <p className="text-lg mb-2">暂无课表数据</p>
        <p className="text-sm">请先导入数据并生成课表</p>
        <button
          onClick={() => useScheduleStore.getState().setView('import')}
          className="mt-4 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          前往导入数据
        </button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-white">
          <div className="flex items-center gap-4">
            <h2 className="font-serif text-xl font-semibold text-[var(--color-text-primary)]">
              课表管理
            </h2>
            {schedule && (
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-3 py-1 rounded-full">
                算法版本: {schedule.algorithmVersion}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* 模式切换 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setAdjustmentModeType('edit')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  adjustmentModeType === 'edit'
                    ? 'bg-white text-[var(--color-primary)] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✏️ 编辑模式
              </button>
              <button
                onClick={() => setAdjustmentModeType('suggest')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  adjustmentModeType === 'suggest'
                    ? 'bg-white text-[var(--color-primary)] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💡 建议模式
              </button>
            </div>
            
            <div className="w-px h-6 bg-gray-200"></div>
            
            <button
              onClick={() => {
                if (confirm('确定要重新生成课表吗？当前课表将被清除。')) {
                  generateSchedule()
                }
              }}
              className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg
                         hover:bg-[var(--color-primary-dark)] transition-colors flex items-center gap-2"
            >
              <span>🔄</span>
              <span>重新生成</span>
            </button>
            <button
              onClick={() => {
                if (confirm('确定要清空课表吗？此操作不可恢复。')) {
                  clearSchedule()
                }
              }}
              className="px-4 py-2 text-sm border border-[var(--color-error)] text-[var(--color-error)] rounded-lg
                         hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <span>🗑️</span>
              <span>清空课表</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - class list */}
          <aside className="w-64 border-r border-[var(--color-border)] bg-white flex flex-col">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="font-serif font-semibold text-[var(--color-text-primary)]">
                班级列表
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {classes.length} 个班级
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {classes.map((cls) => {
                const clsSchedule = schedule?.classSchedules.find(s => s.classId === cls.id)
                const isValid = clsSchedule?.isValid ?? true

                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.id)}
                    className={`
                      w-full px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-200
                      ${selectedClassId === cls.id
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{cls.name}</span>
                      {!isValid && (
                        <span className="text-xs" title="存在冲突">⚠️</span>
                      )}
                    </div>
                    <div className="text-xs opacity-70">{cls.studentCount} 名学生</div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Main schedule grid */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-6 border-b border-[var(--color-border)]">
                <div className="p-4 bg-[var(--color-bg-secondary)]">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">节次/日期</span>
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="p-4 bg-[var(--color-bg-secondary)] text-center">
                    <span className="font-medium text-[var(--color-text-primary)]">{day}</span>
                  </div>
                ))}
              </div>

              {/* Period rows */}
              {PERIODS.map((period) => (
                <div key={period} className="grid grid-cols-6 border-b border-[var(--color-border-light)] last:border-b-0">
                  {/* Period label */}
                  <div className="p-3 bg-[var(--color-bg-secondary)] flex flex-col justify-center">
                    <span className="font-medium text-[var(--color-text-primary)]">第{period}节</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {period <= 4 ? '上午' : '下午'}
                    </span>
                  </div>

                  {/* Day cells */}
                  {DAYS.map((_, dayIndex) => {
                    const dayOfWeek = dayIndex + 1
                    const cellKey = `${dayOfWeek}_${period}`
                    const cell = cellMap.get(cellKey)

                    return (
                      <DropTargetCell
                        key={cellKey}
                        dayOfWeek={dayOfWeek}
                        period={period}
                      >
                        {cell ? (
                          <DraggableCourse
                            cell={cell}
                            getTeacherName={getTeacherName}
                          />
                        ) : (
                          !isDragging && (
                            <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">
                              <span className="text-lg">-</span>
                            </div>
                          )
                        )}
                      </DropTargetCell>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              <span>图例：</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-500"></span>
                P0 同日互换
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500"></span>
                P1 跨日互换
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-orange-500"></span>
                P2 代课
              </span>
              <span className="flex items-center gap-1">
                <span>📌</span>
                固定课程
              </span>
            </div>
          </div>
        </div>

        {/* Drag overlay - 拖拽时显示的预览 */}
        <DragOverlay>
          {activeCell ? (
            <div className="p-3 bg-white rounded-lg shadow-xl border-2 border-[var(--color-primary)] opacity-90">
              <div
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-1"
                style={{ backgroundColor: SUBJECT_COLORS[activeCell.subject] || '#6b7280' }}
              >
                {SUBJECT_NAMES[activeCell.subject] || activeCell.subject}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {getTeacherName(activeCell.teacherId)}
              </div>
            </div>
          ) : null}
        </DragOverlay>

        {/* 拖拽提示 */}
        {isDragging && draggedCell && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl shadow-lg z-50">
            <span className="font-medium">
              {adjustmentModeType === 'edit' ? '拖拽到目标位置进行调课' : '拖拽到目标位置生成调课方案'}
            </span>
            <span className="text-sm opacity-80 ml-2">按 ESC 取消</span>
          </div>
        )}
      </div>

      {/* 建议模式的方案面板 */}
      {currentProposal && <AdjustmentProposalPanel />}

      {/* 全局冲突提示Tooltip */}
      <ConflictTooltip
        visible={tooltipState.visible}
        conflict={tooltipState.conflict}
        position={tooltipState.position}
        onClose={hideTooltip}
      />
    </DndContext>
  )
}
