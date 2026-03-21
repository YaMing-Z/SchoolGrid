import { useState, useCallback } from 'react'
import { ConflictDetail } from '@/types/adjustment.types'

interface TooltipPosition {
  x: number
  y: number
  placement: 'top' | 'bottom' | 'left' | 'right'
}

interface TooltipState {
  visible: boolean
  conflict: ConflictDetail | null
  position: TooltipPosition
}

const TOOLTIP_SIZE = { width: 288, height: 200 }
const OFFSET = 12
const PADDING = 16

/**
 * 计算Tooltip的智能位置
 * 优先级：右下 > 左下 > 右上 > 左上
 * 避免遮挡用户视线和目标格子
 */
function calculateTooltipPosition(
  targetRect: DOMRect,
  viewport: { width: number; height: number }
): TooltipPosition {
  const { width: tw, height: th } = TOOLTIP_SIZE
  
  // 计算各个方向的可用空间
  const spaceRight = viewport.width - targetRect.right - OFFSET
  const spaceLeft = targetRect.left - OFFSET
  const spaceBottom = viewport.height - targetRect.bottom - OFFSET
  // spaceTop 用于向上展开的计算
  
  // 优先向右展开（不遮挡课表主体）
  if (spaceRight >= tw) {
    return {
      x: targetRect.right + OFFSET,
      y: Math.min(targetRect.top, viewport.height - th - PADDING),
      placement: 'right'
    }
  }
  
  // 向左展开
  if (spaceLeft >= tw) {
    return {
      x: targetRect.left - tw - OFFSET,
      y: Math.min(targetRect.top, viewport.height - th - PADDING),
      placement: 'left'
    }
  }
  
  // 向下展开
  if (spaceBottom >= th) {
    return {
      x: Math.max(PADDING, Math.min(targetRect.left, viewport.width - tw - PADDING)),
      y: targetRect.bottom + OFFSET,
      placement: 'bottom'
    }
  }
  
  // 向上展开
  return {
    x: Math.max(PADDING, Math.min(targetRect.left, viewport.width - tw - PADDING)),
    y: Math.max(PADDING, targetRect.top - th - OFFSET),
    placement: 'top'
  }
}

/**
 * 冲突提示Tooltip Hook
 * 处理Tooltip的显示/隐藏和智能定位
 */
export function useConflictTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    conflict: null,
    position: { x: 0, y: 0, placement: 'right' }
  })
  
  /**
   * 显示Tooltip
   */
  const showTooltip = useCallback((
    conflict: ConflictDetail,
    event: React.MouseEvent | React.FocusEvent | { clientX: number; clientY: number; target: EventTarget | null }
  ) => {
    const target = event.target as HTMLElement
    if (!target) return
    
    const rect = target.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }
    
    const position = calculateTooltipPosition(rect, viewport)
    
    setTooltip({
      visible: true,
      conflict,
      position
    })
  }, [])
  
  /**
   * 隐藏Tooltip
   */
  const hideTooltip = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }, [])
  
  /**
   * 更新Tooltip位置（用于滚动时）
   */
  const updatePosition = useCallback(() => {
    if (!tooltip.visible || !tooltip.conflict) return
    
    // 重新计算位置（如果需要）
    setTooltip(prev => ({
      ...prev,
      position: calculateTooltipPosition(
        document.body.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight }
      )
    }))
  }, [tooltip.visible, tooltip.conflict])
  
  return {
    tooltip,
    showTooltip,
    hideTooltip,
    updatePosition
  }
}

export type { TooltipPosition, TooltipState }
