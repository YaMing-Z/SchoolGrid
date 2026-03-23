import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useState, useRef } from 'react'
import { ScheduleCell } from '@/types/schedule.types'
import { SUBJECT_NAMES, SUBJECT_COLORS, Subject } from '@/data/constants'
import { useScheduleStore } from '@/stores/scheduleStore'

interface DraggableCourseProps {
  cell: ScheduleCell
  getTeacherName: (teacherId: string, subject?: Subject) => string
  onClick?: () => void
}

export function DraggableCourse({ cell, getTeacherName, onClick }: DraggableCourseProps) {
  const { isDragging: globalDragging, draggedCell } = useScheduleStore()

  // 用于区分点击和拖拽
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null)
  const [hasMoved, setHasMoved] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: `draggable-${cell.id}`,
    data: {
      cell,
      type: 'course'
    }
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  } : undefined

  const isBeingDragged = globalDragging && draggedCell?.id === cell.id

  // 是否是自习课
  const isSelfStudy = cell.subject === Subject.SelfStudy

  // 获取显示的教师名称
  const teacherName = getTeacherName(cell.teacherId, cell.subject)

  // 鼠标按下记录位置
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    setHasMoved(false)
  }

  // 鼠标移动检测是否拖拽
  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseDownPos.current) {
      const dx = Math.abs(e.clientX - mouseDownPos.current.x)
      const dy = Math.abs(e.clientY - mouseDownPos.current.y)
      if (dx > 5 || dy > 5) {
        setHasMoved(true)
      }
    }
  }

  // 点击处理
  const handleClick = () => {
    // 如果是拖拽操作，不触发点击
    if (hasMoved || isDragging) {
      return
    }
    // 触发点击回调
    onClick?.()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        h-full flex flex-col justify-between cursor-grab active:cursor-grabbing
        transition-all duration-200
        ${isDragging ? 'shadow-lg scale-105' : 'hover:shadow-md hover:-translate-y-0.5'}
        ${isBeingDragged ? 'opacity-30' : ''}
        ${isSelfStudy ? 'cursor-pointer' : ''}
      `}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      <div>
        <div
          className="inline-block px-2.5 py-1 rounded text-sm font-medium text-white mb-1.5"
          style={{ backgroundColor: SUBJECT_COLORS[cell.subject] || '#6b7280' }}
        >
          {SUBJECT_NAMES[cell.subject] || cell.subject}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {teacherName}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-xs text-[var(--color-text-muted)]">
          {cell.classroom || ''}
        </div>
        {isSelfStudy && !isBeingDragged && (
          <div className="text-xs text-[var(--color-primary)] opacity-0 hover:opacity-100 transition-opacity">
            点击更换
          </div>
        )}
      </div>
    </div>
  )
}
