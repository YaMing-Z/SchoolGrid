import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { getSubjectName } from '@/data/constants'
import { ClassTeacherInfo } from '@/utils/classHelpers'
import { useScheduleStore } from '@/stores/scheduleStore'
import { useScheduleConfig } from '@/hooks/useScheduleConfig'

interface TeacherSelectorModalProps {
  visible: boolean
  classId: string
  dayOfWeek: number
  period: number
  currentTeacherId?: string
  teachers: ClassTeacherInfo[]
  onClose: () => void
  onSelectTeacher: (teacherId: string) => void
}

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五']

/**
 * 教师选择器弹窗组件
 *
 * 用于自习课选择值班教师
 */
export function TeacherSelectorModal({
  visible,
  classId: _classId, // 保留参数供未来使用
  dayOfWeek,
  period,
  currentTeacherId,
  teachers,
  onClose,
  onSelectTeacher
}: TeacherSelectorModalProps) {
  const schedule = useScheduleStore(state => state.schedule)
  const { getPeriodName } = useScheduleConfig()

  // ESC 键关闭
  useEffect(() => {
    if (!visible) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [visible, onClose])

  // 获取当前时段所有课程的教师ID（用于检查是否忙碌）
  const busyTeacherIds = new Set<string>()
  if (schedule) {
    for (const classSchedule of schedule.classSchedules) {
      for (const cell of classSchedule.cells) {
        if (cell.dayOfWeek === dayOfWeek && cell.period === period && cell.teacherId) {
          busyTeacherIds.add(cell.teacherId)
        }
      }
    }
  }

  // 过滤出可选择的教师（排除当前已选教师）
  const availableTeachers = teachers.filter(
    t => t.teacher.id !== currentTeacherId
  )

  if (!visible) return null

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[420px] max-h-[60vh] bg-white rounded-2xl shadow-2xl border border-[var(--color-border-light)] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-semibold text-lg text-[var(--color-text-primary)]">
                选择自习值班教师
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {DAY_NAMES[dayOfWeek]} {getPeriodName(period)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-[var(--color-text-muted)] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 教师列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableTeachers.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              <span className="text-4xl mb-2 block">📭</span>
              <p>暂无可选教师</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableTeachers.map(({ teacher, subjects, weeklyHours }) => {
                const isBusy = busyTeacherIds.has(teacher.id)
                const subjectLabels = subjects.map(s => getSubjectName(s)).join('、')

                return (
                  <button
                    key={teacher.id}
                    onClick={() => !isBusy && onSelectTeacher(teacher.id)}
                    disabled={isBusy}
                    className={`
                      w-full p-4 rounded-xl text-left transition-all duration-200
                      ${isBusy
                        ? 'bg-gray-100 cursor-not-allowed opacity-50'
                        : 'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-primary)] hover:text-white hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-[var(--color-text-primary)] group-hover:text-white">
                          {teacher.name}
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)] mt-1">
                          {subjectLabels}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {weeklyHours} 课时/周
                        </div>
                        {isBusy && (
                          <div className="text-xs text-red-500 mt-1">
                            该时段已有课
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-6 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            点击选择教师更换自习值班安排
          </p>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
