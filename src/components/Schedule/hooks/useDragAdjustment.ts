import { useScheduleStore, DropTargetInfo } from '@/stores/scheduleStore'
import { useMemo, useCallback } from 'react'
import { ConflictDetail } from '@/types/adjustment.types'

// Tooltip 位置计算常量
const TOOLTIP_SIZE = { width: 288, height: 200 }
const OFFSET = 12
const PADDING = 16

/**
 * 计算Tooltip的智能位置
 */
function calculateTooltipPosition(
  targetRect: DOMRect,
  viewport: { width: number; height: number }
): { x: number; y: number; placement: 'top' | 'bottom' | 'left' | 'right' } {
  const { width: tw, height: th } = TOOLTIP_SIZE
  
  const spaceRight = viewport.width - targetRect.right - OFFSET
  const spaceLeft = targetRect.left - OFFSET
  const spaceBottom = viewport.height - targetRect.bottom - OFFSET
  
  if (spaceRight >= tw) {
    return {
      x: targetRect.right + OFFSET,
      y: Math.min(targetRect.top, viewport.height - th - PADDING),
      placement: 'right'
    }
  }
  
  if (spaceLeft >= tw) {
    return {
      x: targetRect.left - tw - OFFSET,
      y: Math.min(targetRect.top, viewport.height - th - PADDING),
      placement: 'left'
    }
  }
  
  if (spaceBottom >= th) {
    return {
      x: Math.max(PADDING, Math.min(targetRect.left, viewport.width - tw - PADDING)),
      y: targetRect.bottom + OFFSET,
      placement: 'bottom'
    }
  }
  
  return {
    x: Math.max(PADDING, Math.min(targetRect.left, viewport.width - tw - PADDING)),
    y: Math.max(PADDING, targetRect.top - th - OFFSET),
    placement: 'top'
  }
}

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
    tooltipState,
    startDrag,
    endDrag,
    setHoveredTarget,
    applyDragAdjustment,
    createProposal,
    clearProposal,
    setAdjustmentModeType,
    showTooltip,
    hideTooltip
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
    const result = dropTargets.get(key) || null
    if (isDragging) {
      console.log('[getDropTargetInfo]', {
        key,
        hasResult: !!result,
        isValid: result?.isValid,
        priority: result?.priority,
        score: result?.score,
        violationsCount: result?.violations?.length || 0,
        violations: result?.violations?.map(v => ({ type: v.type, severity: v.severity, message: v.message, suggestion: v.suggestion })),
        violationsRaw: result?.violations
      })
    }
    return result
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

  // 显示冲突 Tooltip（使用全局状态）
  const showConflictTooltip = useCallback((
    conflict: ConflictDetail,
    event: React.MouseEvent | { clientX: number; clientY: number; target: EventTarget | null }
  ) => {
    const target = event.target as HTMLElement
    if (!target) return
    
    const rect = target.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }
    
    const position = calculateTooltipPosition(rect, viewport)
    showTooltip(conflict, position)
  }, [showTooltip])

  return {
    // 状态
    isDragging,
    draggedCell,
    dropTargets,
    dropTargetList,
    hoveredTarget,
    adjustmentModeType,
    currentProposal,
    tooltipState,
    
    // 方法
    startDrag,
    endDrag,
    setHoveredTarget,
    applyDragAdjustment,
    createProposal,
    clearProposal,
    setAdjustmentModeType,
    showTooltip: showConflictTooltip,
    hideTooltip,
    
    // 辅助方法
    getDropTargetInfo,
    isValidDropTarget,
    getHighlightClass
  }
}
