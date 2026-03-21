import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ScheduleCell } from '@/types/schedule.types'
import { SUBJECT_NAMES, SUBJECT_COLORS } from '@/data/constants'
import { useScheduleStore } from '@/stores/scheduleStore'

interface DraggableCourseProps {
  cell: ScheduleCell
  getTeacherName: (teacherId: string) => string
  onClick?: () => void
}

export function DraggableCourse({ cell, getTeacherName, onClick }: DraggableCourseProps) {
  const { isDragging: globalDragging, draggedCell } = useScheduleStore()
  
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

  // 如果当前单元格正在被拖拽，显示占位符
  const isBeingDragged = globalDragging && draggedCell?.id === cell.id

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
      `}
      onClick={() => {
        if (!isDragging) {
          onClick?.()
        }
      }}
    >
      <div>
        <div
          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-1"
          style={{ backgroundColor: SUBJECT_COLORS[cell.subject] || '#6b7280' }}
        >
          {SUBJECT_NAMES[cell.subject] || cell.subject}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {getTeacherName(cell.teacherId)}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-xs text-[var(--color-text-muted)]">
          {cell.classroom || ''}
        </div>
        <div className="w-5 h-5 flex items-center justify-center text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
          ⋮⋮
        </div>
      </div>
    </div>
  )
}
