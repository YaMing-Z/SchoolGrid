import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ConflictDetail, AdjustmentConflictType, CONFLICT_STYLES, CONFLICT_TYPE_LABELS } from '@/types/adjustment.types'

interface ConflictTooltipProps {
  visible: boolean
  conflict: ConflictDetail | null
  position: { x: number; y: number; placement: string }
  onClose?: () => void
}

/**
 * 获取冲突类型对应的图标
 */
function getConflictIcon(type: AdjustmentConflictType): string {
  const style = CONFLICT_STYLES[type]
  return style?.icon || '⚠️'
}

/**
 * 获取严重程度对应的样式
 */
function getSeverityStyles(severity: 'error' | 'warning' | 'info') {
  switch (severity) {
    case 'error':
      return {
        border: 'border-red-400',
        bg: 'bg-red-50',
        text: 'text-red-700',
        icon: 'text-red-500'
      }
    case 'warning':
      return {
        border: 'border-orange-400',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        icon: 'text-orange-500'
      }
    case 'info':
    default:
      return {
        border: 'border-blue-400',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        icon: 'text-blue-500'
      }
  }
}

/**
 * 渲染冲突详情内容
 */
function ConflictDetailsContent({ conflict }: { conflict: ConflictDetail }) {
  const { details, type } = conflict
  
  // 根据冲突类型渲染不同的详情
  switch (type) {
    case AdjustmentConflictType.TeacherBusy: {
      const teacherBusy = details as {
        teacherName?: string
        busySlot?: { dayName: string; periodName: string }
        busyWith?: { className: string; subject: string }
      }
      return (
        <div className="space-y-2 text-sm">
          {teacherBusy.teacherName && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">👤</span>
              <span>{teacherBusy.teacherName}</span>
            </div>
          )}
          {teacherBusy.busySlot && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🕐</span>
              <span>{teacherBusy.busySlot.dayName} {teacherBusy.busySlot.periodName}</span>
            </div>
          )}
          {teacherBusy.busyWith && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📚</span>
              <span>正在给 <strong>{teacherBusy.busyWith.className}</strong> 上<strong>{teacherBusy.busyWith.subject}</strong></span>
            </div>
          )}
        </div>
      )
    }
    
    case AdjustmentConflictType.SubjectForbidden: {
      const subjectForbidden = details as {
        subjectName?: string
        forbiddenSlot?: { dayName: string; periodName: string }
        rule?: string
      }
      return (
        <div className="space-y-2 text-sm">
          {subjectForbidden.subjectName && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📚</span>
              <span>{subjectForbidden.subjectName}</span>
            </div>
          )}
          {subjectForbidden.forbiddenSlot && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🕐</span>
              <span>{subjectForbidden.forbiddenSlot.dayName} {subjectForbidden.forbiddenSlot.periodName}</span>
            </div>
          )}
          {subjectForbidden.rule && (
            <div className="mt-2 px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs">
              规则：{subjectForbidden.rule}
            </div>
          )}
        </div>
      )
    }
    
    case AdjustmentConflictType.RoomOccupied: {
      const roomOccupied = details as {
        roomName?: string
        occupiedBy?: { className: string; subject: string; teacherName: string }
      }
      return (
        <div className="space-y-2 text-sm">
          {roomOccupied.roomName && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🏫</span>
              <span>{roomOccupied.roomName}</span>
            </div>
          )}
          {roomOccupied.occupiedBy && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">👥</span>
              <span>被 <strong>{roomOccupied.occupiedBy.className}</strong> 的{roomOccupied.occupiedBy.subject}课占用</span>
            </div>
          )}
        </div>
      )
    }
    
    default: {
      // 基础冲突详情
      const basic = details as { reason?: string }
      return (
        <div className="text-sm text-gray-600">
          {basic.reason || CONFLICT_TYPE_LABELS[type] || '未知冲突'}
        </div>
      )
    }
  }
}

/**
 * 冲突提示Tooltip组件
 * 使用Portal渲染到body，避免遮挡问题
 */
export function ConflictTooltip({ visible, conflict, position, onClose }: ConflictTooltipProps) {
  // 按ESC关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) {
      onClose()
    }
  }, [onClose])
  
  useEffect(() => {
    if (visible) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [visible, handleKeyDown])
  
  if (!visible || !conflict) return null
  
  const severityStyles = getSeverityStyles(conflict.severity)
  const icon = getConflictIcon(conflict.type)
  
  const tooltipContent = (
    <div
      className={`
        fixed z-[9999] w-72 p-3 rounded-lg shadow-xl border-2
        animate-in fade-in-0 zoom-in-95 duration-200
        ${severityStyles.border} ${severityStyles.bg}
      `}
      style={{ left: position.x, top: position.y }}
      role="tooltip"
      aria-live="polite"
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className={`font-medium ${severityStyles.text}`}>
          {conflict.message}
        </span>
      </div>
      
      {/* 分隔线 */}
      <div className="border-t border-gray-200 my-2" />
      
      {/* 具体详情 */}
      <div className="text-gray-700">
        <ConflictDetailsContent conflict={conflict} />
      </div>
      
      {/* 解决建议 */}
      {conflict.suggestion && (
        <div className="mt-3 pt-2 border-t border-gray-200">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-amber-500">💡</span>
            <span>{conflict.suggestion}</span>
          </div>
        </div>
      )}
      
      {/* 快捷操作按钮 */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          关闭
        </button>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          查看其他时段
        </button>
      </div>
      
      {/* 小箭头指示器 */}
      <div
        className={`
          absolute w-3 h-3 rotate-45 ${severityStyles.bg} ${severityStyles.border}
          ${position.placement === 'left' ? 'right-[-7px] top-4 border-l-0 border-b-0' : ''}
          ${position.placement === 'right' ? 'left-[-7px] top-4 border-r-0 border-t-0' : ''}
          ${position.placement === 'top' ? 'bottom-[-7px] left-4 border-t-0 border-l-0' : ''}
          ${position.placement === 'bottom' ? 'top-[-7px] left-4 border-b-0 border-r-0' : ''}
        `}
      />
    </div>
  )
  
  // 使用Portal渲染到body
  return createPortal(tooltipContent, document.body)
}

export default ConflictTooltip
