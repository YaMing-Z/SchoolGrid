import { useDroppable } from '@dnd-kit/core'
import { useDragAdjustment } from './hooks/useDragAdjustment'
import { AdjustmentPriority, ConflictDetail } from '@/types/adjustment.types'
import { useScheduleStore } from '@/stores/scheduleStore'
import { useEffect, useRef, useCallback } from 'react'

interface DropTargetCellProps {
  dayOfWeek: number
  period: number
  children?: React.ReactNode
}

export function DropTargetCell({ dayOfWeek, period, children }: DropTargetCellProps) {
  const { isDragging, getDropTargetInfo, hoveredTarget, setHoveredTarget, draggedCell, showTooltip, hideTooltip } = useDragAdjustment()
  const { teachers } = useScheduleStore()

  const targetKey = `${dayOfWeek}_${period}`
  const dropInfo = getDropTargetInfo(dayOfWeek, period)
  const isHovered = hoveredTarget === targetKey

  // 调试：输出 dropTarget 信息
  if (isDragging) {
    console.log('[DropTargetCell] Rendering', {
      targetKey,
      dayOfWeek,
      period,
      dropInfo,
      hasDropInfo: !!dropInfo,
      isValid: dropInfo?.isValid,
      violationsCount: dropInfo?.violations?.length || 0,
      violations: dropInfo?.violations
    })
  }

  // 判断是否是原位置
  const isOriginalPosition = draggedCell &&
    draggedCell.dayOfWeek === dayOfWeek &&
    draggedCell.period === period

  const cellRef = useRef<HTMLDivElement>(null)

  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${targetKey}`,
    data: {
      dayOfWeek,
      period,
      type: 'cell'
    }
    // 移除 disabled 限制：所有格子都是 droppable
    // 在 onDragEnd 中判断是否执行调课
  })

  // 组合 ref - 使用 useCallback
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node)
    if (node) {
      (cellRef as any).current = node
    }
  }, [setNodeRef])

  // 监听 isOver 状态变化，触发 Tooltip
  useEffect(() => {
    if (isOver && isDragging) {
      setHoveredTarget(targetKey)

      // 获取元素位置用于 Tooltip
      const rect = cellRef.current?.getBoundingClientRect()
      if (!rect) return

      // 构造鼠标事件对象（用于 showTooltip）
      // 确保 target 是有效的 DOM 元素
      const mockEvent = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top,
        target: cellRef.current || document.createElement('div')
      } as any

      // 显示 Tooltip 的条件：
      // 1. 有 dropInfo 且有违规信息（包括警告）
      // 2. 或者是原位置（显示取消提示）
      // 3. 或者是没有 dropInfo 的无效位置（显示默认提示）
      if (dropInfo && dropInfo.violations.length > 0) {
        showTooltip(dropInfo.violations[0], mockEvent)
      } else if (dropInfo && dropInfo.isValid && isOver) {
        // 有 dropInfo 且有效，显示调课详情
        const priorityLabels = {
          [AdjustmentPriority.P0]: 'P0 同日互换 - 推荐',
          [AdjustmentPriority.P1]: 'P1 跨日互换 - 次选',
          [AdjustmentPriority.P2]: 'P2 代课 - 备选'
        }
        showTooltip({
          type: 'same_cell' as any,
          severity: 'info',
          message: priorityLabels[dropInfo.priority as AdjustmentPriority] || '调课方案',
          details: {
            reason: 'swap_suggestion'
          },
          suggestion: `${dropInfo.description || ''} · 评分：${dropInfo.score} 分${dropInfo.impact ? ` · 影响：${dropInfo.impact.disruptionLevel === 'low' ? '低' : dropInfo.impact.disruptionLevel === 'medium' ? '中' : '高'}` : ''}`
        }, mockEvent)
      } else if (isOriginalPosition) {
        // 原位置显示提示
        showTooltip({
          type: 'same_cell' as any,
          severity: 'info',
          message: '拖回原位置可取消操作',
          details: { reason: 'same_cell' },
          suggestion: '将课程拖回原位置即可取消调课，课表保持不变'
        }, mockEvent)
      } else if (!dropInfo) {
        // 没有 dropInfo 的位置（灰色格子）
        const teacherName = draggedCell ? teachers.find(t => t.id === draggedCell.teacherId)?.name : '教师'
        const dayName = ['', '周一', '周二', '周三', '周四', '周五'][dayOfWeek]
        showTooltip({
          type: 'teacher_unavailable' as any,
          severity: 'warning',
          message: '无法调到此时段',
          details: {
            teacherName,
            reason: 'no_swap_target',
            targetDay: dayOfWeek,
            targetPeriod: period
          },
          suggestion: `${dayName}第${period}节为空位，无法进行互换。请拖拽到有课程的位置。`
        }, mockEvent)
      }
    } else if (!isOver && isHovered) {
      // 离开时隐藏 Tooltip
      setHoveredTarget(null)
      hideTooltip()
    }
  }, [isOver, isDragging, targetKey, dropInfo, isOriginalPosition, draggedCell, teachers, dayOfWeek, period, isHovered, setHoveredTarget, showTooltip, hideTooltip])

  // 处理鼠标进入事件 - 备用方案（当不拖拽时）
  const handleMouseEnter = () => {
    // 这个方法现在主要保留用于非拖拽状态的处理
    // 拖拽时的 Tooltip 由 useEffect 监听 isOver 处理
  }

  // 处理鼠标离开事件
  const handleMouseLeave = () => {
    if (!isOver && isHovered) {
      setHoveredTarget(null)
      hideTooltip()
    }
  }

  // 计算样式
  const getCellStyles = () => {
    if (!isDragging) {
      return 'border-r border-[var(--color-border-light)] last:border-r-0'
    }

    // 原位置特殊样式
    if (isOriginalPosition) {
      return 'border-2 border-dashed border-gray-400 bg-gray-200/50'
    }

    // 拖拽中的样式
    if (!dropInfo) {
      // 不是有效的放置目标 - 灰色（不使用opacity，避免影响tooltip）
      return 'border-r border-[var(--color-border-light)] last:border-r-0 bg-gray-200/60'
    }

    if (!dropInfo.isValid) {
      // 不可行 - 红色虚线
      return 'border-2 border-dotted border-red-400 bg-red-50 cursor-help'
    }

    // 检查是否有错误或警告
    const hasErrors = dropInfo.violations?.some(v => v.severity === 'error') ?? false
    const hasWarnings = dropInfo.violations?.some(v => v.severity === 'warning') ?? false

    // 根据优先级设置样式
    const baseStyles = 'transition-all duration-150'
    const hoverScale = isOver ? 'scale-105 z-10' : ''

    // 如果有错误，使用红色样式
    if (hasErrors) {
      return `${baseStyles} ${hoverScale} border-2 border-dotted border-red-400 bg-red-50 cursor-help`
    }

    // 如果有警告，使用黄色样式
    if (hasWarnings) {
      return `${baseStyles} ${hoverScale} border-2 border-dashed border-yellow-500 ${isOver ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-yellow-50'}`
    }

    switch (dropInfo.priority) {
      case AdjustmentPriority.P0: // P0-同日互换
        return `${baseStyles} ${hoverScale} border-2 border-solid border-green-500 ${isOver ? 'bg-green-100 ring-2 ring-green-400' : 'bg-green-50'}`
      case AdjustmentPriority.P1: // P1-跨日互换
        return `${baseStyles} ${hoverScale} border-2 border-solid border-blue-500 ${isOver ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-blue-50'}`
      case AdjustmentPriority.P2: // P2-代课
        return `${baseStyles} ${hoverScale} border-2 border-dashed border-orange-500 ${isOver ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-orange-50'}`
      default:
        return `${baseStyles} border-2 border-dashed border-gray-400 bg-gray-50`
    }
  }

  // 获取评分显示
  const renderScore = () => {
    if (!isDragging || !dropInfo || !dropInfo.isValid) return null

    const hasWarnings = dropInfo.violations?.some(v => v.severity === 'warning') ?? false

    return (
      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold bg-white/80 shadow-sm"
           style={{
             color: hasWarnings ? '#f59e0b' :
                    dropInfo.priority === AdjustmentPriority.P0 ? '#10b981' :
                    dropInfo.priority === AdjustmentPriority.P1 ? '#3b82f6' : '#f59e0b'
           }}>
        {dropInfo.score}
      </div>
    )
  }

  // 获取优先级标签
  const renderPriorityLabel = () => {
    if (!isDragging || !dropInfo || !dropInfo.isValid || !isOver) return null

    // 检查是否有警告
    const warningViolation = dropInfo.violations?.find(v => v.severity === 'warning')

    // 如果有警告，显示警告信息
    if (warningViolation) {
      const warningMessage = warningViolation.suggestion || warningViolation.message
      return (
        <div className="absolute bottom-1 left-1 right-1 px-2 py-1 rounded text-xs font-medium bg-yellow-600/80 text-white text-center truncate">
          ⚠️ {warningMessage}
        </div>
      )
    }

    const labels = {
      [AdjustmentPriority.P0]: 'P0 同日互换',
      [AdjustmentPriority.P1]: 'P1 跨日互换',
      [AdjustmentPriority.P2]: 'P2 代课'
    }

    return (
      <div className="absolute bottom-1 left-1 right-1 px-2 py-1 rounded text-xs font-medium bg-black/70 text-white text-center truncate">
        {labels[dropInfo.priority as AdjustmentPriority]}
      </div>
    )
  }

  // 渲染不可调课原因提示（直接显示在格子内）
  const renderInvalidReason = () => {
    if (!isDragging) return null
    
    // 原位置显示标签
    if (isOriginalPosition) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-300/80 z-10">
          <span className="text-xs text-gray-600 font-medium px-2 py-1 bg-white/80 rounded">原位置</span>
        </div>
      )
    }
    
    // 可行的不显示原因
    if (dropInfo?.isValid) return null

    // 有 dropInfo但不可行 - 显示违规原因（使用新的 ConflictDetail 类型）
    if (dropInfo && !dropInfo.isValid && (dropInfo.violations?.length ?? 0) > 0) {
      const reason = dropInfo.violations.map((v: ConflictDetail) => v.message).join('、')
      return (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-1">
          <span className="text-[10px] text-red-600 font-medium text-center leading-tight">{reason}</span>
        </div>
      )
    }
    
    // 没有 dropInfo（灰色位置）- 显示原因
    if (!dropInfo) {
      let reason = ''
      // 检查是否是同一天（P0应该覆盖但没有）
      if (draggedCell && draggedCell.dayOfWeek === dayOfWeek) {
        reason = '教师时间冲突'
      } else {
        // 跨日位置没有建议
        reason = '教师不可用'
      }
      
      return (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-1">
          <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{reason}</span>
        </div>
      )
    }
    
    return null
  }

  // 获取主要冲突信息（用于Tooltip）
  const getPrimaryConflict = () => {
    if (!dropInfo || dropInfo.isValid || (dropInfo.violations?.length ?? 0) === 0) {
      return null
    }
    return dropInfo.violations[0]
  }

  return (
    <div
      ref={setRefs}
      className={`
        relative p-3 min-h-[80px] transition-all duration-200
        ${getCellStyles()}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={getPrimaryConflict() ? '悬停查看详情' : undefined}
    >
      {children}
      {renderScore()}
      {renderPriorityLabel()}
      {renderInvalidReason()}
    </div>
  )
}
