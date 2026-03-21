import { useScheduleStore, DropTargetInfo } from '@/stores/scheduleStore'
import { useMemo } from 'react'

/**
 * 拖拽调课Hook
 * 处理拖拽开始、结束、放置目标计算等逻辑
 */
export function useDragAdjustment() {
  const {
    isDragging,
    draggedCell,
    dropTargets,
    hoveredTarget,
    adjustmentModeType,
    currentProposal,
    startDrag,
    endDrag,
    setHoveredTarget,
    applyDragAdjustment,
    createProposal,
    clearProposal,
    setAdjustmentModeType
  } = useScheduleStore()

  // 计算放置目标的数组形式（便于遍历）
  const dropTargetList = useMemo(() => {
    return Array.from(dropTargets.entries()).map(([key, info]) => ({
      key,
      ...info
    }))
  }, [dropTargets])

  // 获取特定位置的放置信息
  const getDropTargetInfo = (dayOfWeek: number, period: number): DropTargetInfo | null => {
    const key = `${dayOfWeek}_${period}`
    return dropTargets.get(key) || null
  }

  // 检查位置是否是有效的放置目标
  const isValidDropTarget = (dayOfWeek: number, period: number): boolean => {
    const info = getDropTargetInfo(dayOfWeek, period)
    return info !== null && info.isValid
  }

  // 获取位置的高亮样式类名
  const getHighlightClass = (dayOfWeek: number, period: number): string => {
    if (!isDragging) return ''
    
    const info = getDropTargetInfo(dayOfWeek, period)
    if (!info) return 'opacity-50' // 非目标位置变暗
    
    const isHovered = hoveredTarget === info.cellId
    
    if (!info.isValid) {
      return 'ring-2 ring-red-400 ring-dotted bg-red-50'
    }
    
    // 根据优先级返回不同的高亮样式
    switch (info.priority) {
      case 0: // P0-同日互换
        return isHovered 
          ? 'ring-3 ring-green-500 bg-green-100 scale-105'
          : 'ring-2 ring-green-400 bg-green-50'
      case 1: // P1-跨日互换
        return isHovered 
          ? 'ring-3 ring-blue-500 bg-blue-100 scale-105'
          : 'ring-2 ring-blue-400 bg-blue-50'
      case 2: // P2-代课
        return isHovered 
          ? 'ring-3 ring-orange-500 bg-orange-100 scale-105'
          : 'ring-2 ring-orange-400 ring-dashed bg-orange-50'
      default:
        return 'ring-2 ring-gray-400 ring-dashed bg-gray-50'
    }
  }

  return {
    // 状态
    isDragging,
    draggedCell,
    dropTargets,
    dropTargetList,
    hoveredTarget,
    adjustmentModeType,
    currentProposal,
    
    // 方法
    startDrag,
    endDrag,
    setHoveredTarget,
    applyDragAdjustment,
    createProposal,
    clearProposal,
    setAdjustmentModeType,
    
    // 辅助方法
    getDropTargetInfo,
    isValidDropTarget,
    getHighlightClass
  }
}
