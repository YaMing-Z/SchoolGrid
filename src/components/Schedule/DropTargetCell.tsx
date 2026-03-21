import { useDroppable } from '@dnd-kit/core'
import { useDragAdjustment } from './hooks/useDragAdjustment'
import { AdjustmentPriority } from '@/types/adjustment.types'

interface DropTargetCellProps {
  dayOfWeek: number
  period: number
  children?: React.ReactNode
}

// 不可调课原因的映射
const REASON_LABELS: Record<string, string> = {
  'same_cell': '原位置',
  'same_day_only': '仅限同日调换',
  'teacher_conflict': '教师时间冲突',
  'subject_forbidden': '学科禁排时段',
  'fixed_course': '固定课程',
  'no_cross_day_available': '无可用跨日调换',
  'teacher_unavailable': '教师不可用'
}

export function DropTargetCell({ dayOfWeek, period, children }: DropTargetCellProps) {
  const { isDragging, getDropTargetInfo, hoveredTarget, setHoveredTarget, draggedCell } = useDragAdjustment()
  
  const targetKey = `${dayOfWeek}_${period}`
  const dropInfo = getDropTargetInfo(dayOfWeek, period)
  const isHovered = hoveredTarget === targetKey
  
  // 判断是否是原位置
  const isOriginalPosition = draggedCell &&
    draggedCell.dayOfWeek === dayOfWeek &&
    draggedCell.period === period
  
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${targetKey}`,
    data: {
      dayOfWeek,
      period,
      type: 'cell'
    },
    disabled: !isDragging || (dropInfo !== null && !dropInfo.isValid)
  })

  // 处理鼠标进入事件
  const handleMouseEnter = () => {
    if (isDragging) {
      setHoveredTarget(targetKey)
    }
  }

  // 处理鼠标离开事件
  const handleMouseLeave = () => {
    if (isDragging && isHovered) {
      setHoveredTarget(null)
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
      return 'border-2 border-dotted border-red-400 bg-red-50'
    }

    // 根据优先级设置样式
    const baseStyles = 'transition-all duration-150'
    const hoverScale = isOver ? 'scale-105 z-10' : ''
    
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
    
    return (
      <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold bg-white/80 shadow-sm"
           style={{
             color: dropInfo.priority === AdjustmentPriority.P0 ? '#10b981' :
                    dropInfo.priority === AdjustmentPriority.P1 ? '#3b82f6' : '#f59e0b'
           }}>
        {dropInfo.score}
      </div>
    )
  }

  // 获取优先级标签
  const renderPriorityLabel = () => {
    if (!isDragging || !dropInfo || !dropInfo.isValid || !isOver) return null
    
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
    
    // 有 dropInfo但不可行 - 显示违规原因
    if (dropInfo && !dropInfo.isValid && dropInfo.violations.length > 0) {
      const reason = dropInfo.violations.map((v: string) => REASON_LABELS[v] || v).join('、')
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
        reason = REASON_LABELS['teacher_conflict']
      } else {
        // 跨日位置没有建议
        reason = REASON_LABELS['teacher_unavailable']
      }
      
      return (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-1">
          <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{reason}</span>
        </div>
      )
    }
    
    return null
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        relative p-3 min-h-[80px] transition-all duration-200
        ${getCellStyles()}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {renderScore()}
      {renderPriorityLabel()}
      {renderInvalidReason()}
    </div>
  )
}
