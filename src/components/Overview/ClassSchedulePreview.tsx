import { useState, useEffect } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { SubjectType, getSubjectName, getSubjectColor } from '@/data/constants'
import { useScheduleConfig } from '@/hooks/useScheduleConfig'

const DAYS = ['周一', '周二', '周三', '周四', '周五']

export function ClassSchedulePreview() {
  const { schedule, classes, teachers } = useScheduleStore()
  const { getPeriodNumbers, isMorning: isMorningPeriod } = useScheduleConfig()
  const periods = getPeriodNumbers()

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)

  // 默认选中第一个班级
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id)
    }
  }, [selectedClassId, classes])

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-[var(--color-text-muted)]">
        <span className="text-4xl mb-3">📅</span>
        <p>暂无课表数据，请先生成课表</p>
      </div>
    )
  }

  const classSchedule = schedule.classSchedules.find(s => s.classId === selectedClassId)

  // 构建课表格子映射
  const cellMap = new Map<string, { subject: SubjectType; teacherId: string }>()
  if (classSchedule) {
    for (const cell of classSchedule.cells) {
      cellMap.set(`${cell.dayOfWeek}_${cell.period}`, {
        subject: cell.subject,
        teacherId: cell.teacherId
      })
    }
  }

  // 获取教师姓名
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId || t.employeeId === teacherId)
    return teacher?.name || teacherId
  }

  return (
    <div className="flex flex-1 bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden min-h-0">
      {/* 左侧班级列表 */}
      <aside className="w-56 border-r border-[var(--color-border)] flex flex-col">
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h3 className="font-medium text-sm text-[var(--color-text-primary)]">班级列表</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{classes.length} 个班级</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 mb-1 ${
                selectedClassId === cls.id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
              }`}
            >
              <span className="font-medium">{cls.name}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* 右侧课表 */}
      <div className="flex-1 overflow-auto p-4">
        {classSchedule ? (
          <>
            <h3 className="font-serif text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              {classes.find(c => c.id === selectedClassId)?.name} 课表
            </h3>
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
                        const cellData = cellMap.get(cellKey)

                        return (
                          <div
                            key={cellKey}
                            className="p-2 min-h-[60px] flex flex-col justify-center"
                          >
                            {cellData ? (
                              <>
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-1"
                                  style={{ backgroundColor: getSubjectColor(cellData.subject) }}
                                >
                                  {getSubjectName(cellData.subject)}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  {getTeacherName(cellData.teacherId)}
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
            请选择一个班级查看课表
          </div>
        )}
      </div>
    </div>
  )
}
