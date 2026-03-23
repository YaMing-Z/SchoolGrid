import { useState, useEffect, useMemo } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES, SUBJECT_COLORS, Subject } from '@/data/constants'
import { useScheduleConfig } from '@/hooks/useScheduleConfig'
import { Teacher } from '@/types/teacher.types'

const DAYS = ['周一', '周二', '周三', '周四', '周五']

export function TeacherSchedulePreview() {
  const { schedule, classes, teachers } = useScheduleStore()
  const { getPeriodNumbers, isMorning: isMorningPeriod } = useScheduleConfig()
  const periods = getPeriodNumbers()

  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  // 按学科分组教师
  const teachersBySubject = useMemo(() => {
    const grouped = new Map<string, Teacher[]>()
    for (const teacher of teachers) {
      const subject = teacher.subject
      if (!grouped.has(subject)) {
        grouped.set(subject, [])
      }
      grouped.get(subject)!.push(teacher)
    }
    return grouped
  }, [teachers])

  // 构建教师课表映射
  const teacherScheduleMap = useMemo(() => {
    if (!schedule) return new Map<string, Map<string, { subject: Subject; classId: string }>>()

    const map = new Map<string, Map<string, { subject: Subject; classId: string }>>()

    for (const classSchedule of schedule.classSchedules) {
      for (const cell of classSchedule.cells) {
        if (!map.has(cell.teacherId)) {
          map.set(cell.teacherId, new Map())
        }
        map.get(cell.teacherId)!.set(`${cell.dayOfWeek}_${cell.period}`, {
          subject: cell.subject,
          classId: classSchedule.classId
        })
      }
    }

    return map
  }, [schedule])

  // 默认选中第一个教师
  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id)
    }
  }, [selectedTeacherId, teachers])

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-[var(--color-text-muted)]">
        <span className="text-4xl mb-3">📅</span>
        <p>暂无课表数据，请先生成课表</p>
      </div>
    )
  }

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId)
  const teacherCells = teacherScheduleMap.get(selectedTeacherId || '')

  // 获取班级名称
  const getClassName = (classId: string) => {
    const cls = classes.find(c => c.id === classId)
    return cls?.name || classId
  }

  // 计算周课时
  const weeklyHours = teacherCells?.size || 0

  return (
    <div className="flex flex-1 bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden min-h-0">
      {/* 左侧教师列表 */}
      <aside className="w-56 border-r border-[var(--color-border)] flex flex-col">
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h3 className="font-medium text-sm text-[var(--color-text-primary)]">教师列表</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{teachers.length} 位教师</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Array.from(teachersBySubject.entries()).map(([subject, subjectTeachers]) => (
            <div key={subject}>
              <div className="px-3 py-2 bg-[var(--color-bg-tertiary)] text-xs font-medium text-[var(--color-text-muted)] sticky top-0">
                {SUBJECT_NAMES[subject as Subject] || subject}
              </div>
              {subjectTeachers.map((teacher) => {
                const teacherCells = teacherScheduleMap.get(teacher.id)
                const hours = teacherCells?.size || 0

                return (
                  <button
                    key={teacher.id}
                    onClick={() => setSelectedTeacherId(teacher.id)}
                    className={`w-full px-3 py-2 text-left text-sm transition-all duration-200 flex items-center justify-between ${
                      selectedTeacherId === teacher.id
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="font-medium">{teacher.name}</span>
                    <span className={`text-xs ${selectedTeacherId === teacher.id ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                      {hours}节
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧课表 */}
      <div className="flex-1 overflow-auto p-4">
        {selectedTeacher ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-[var(--color-text-primary)]">
                {selectedTeacher.name} 课表
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  学科：<span className="font-medium">{SUBJECT_NAMES[selectedTeacher.subject] || selectedTeacher.subject}</span>
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  周课时：<span className="font-medium text-[var(--color-primary)]">{weeklyHours}</span> 节
                </span>
              </div>
            </div>
            <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
              {/* 表头 */}
              <div className="grid grid-cols-6 bg-[var(--color-bg-secondary)]">
                <div className="p-3 text-center border-r border-[var(--color-border-light)]">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">节次/日期</span>
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="p-3 text-center">
                    <span className="font-medium text-sm text-[var(--color-text-primary)]">{day}</span>
                  </div>
                ))}
              </div>

              {/* 课表内容 */}
              {periods.map((period, index) => {
                const prevPeriod = index > 0 ? periods[index - 1] : null
                const showDivider = prevPeriod !== null && isMorningPeriod(prevPeriod) && !isMorningPeriod(period)

                return (
                  <div key={period}>
                    {/* 上午/下午分割线 */}
                    {showDivider && (
                      <div className="grid grid-cols-6">
                        <div className="bg-[var(--color-bg-secondary)] border-t-2 border-[var(--color-primary-light)]"></div>
                        {DAYS.map((day) => (
                          <div key={day} className="border-t-2 border-[var(--color-primary-light)]"></div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-6 border-b border-[var(--color-border-light)] last:border-b-0">
                      {/* 节次标签 */}
                      <div className="p-2 bg-[var(--color-bg-secondary)] flex flex-col justify-center border-r border-[var(--color-border-light)]">
                        <span className="font-medium text-sm text-[var(--color-text-primary)]">第{period}节</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {isMorningPeriod(period) ? '上午' : '下午'}
                        </span>
                      </div>

                      {/* 课程格子 */}
                      {DAYS.map((_, dayIndex) => {
                        const dayOfWeek = dayIndex + 1
                        const cellKey = `${dayOfWeek}_${period}`
                        const cellData = teacherCells?.get(cellKey)

                        return (
                          <div
                            key={cellKey}
                            className="p-2 min-h-[60px] flex flex-col justify-center"
                          >
                            {cellData ? (
                              <>
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-1"
                                  style={{ backgroundColor: SUBJECT_COLORS[cellData.subject] || '#6b7280' }}
                                >
                                  {SUBJECT_NAMES[cellData.subject] || cellData.subject}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {getClassName(cellData.classId)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[var(--color-text-muted)] text-center">-</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            请选择一位教师查看课表
          </div>
        )}
      </div>
    </div>
  )
}
