import { useScheduleStore } from '@/stores/scheduleStore'
import { SubjectType, getSubjectName, getSubjectColor, getAllSubjects } from '@/data/constants'
import { useScheduleConfig } from '@/hooks/useScheduleConfig'

const DAYS = ['周一', '周二', '周三', '周四', '周五']

export function GradeOverviewTable() {
  const { schedule, classes } = useScheduleStore()
  const { getPeriodNumbers } = useScheduleConfig()
  const periods = getPeriodNumbers()

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-[var(--color-text-muted)]">
        <span className="text-4xl mb-3">📊</span>
        <p>暂无课表数据，请先生成课表</p>
      </div>
    )
  }

  // 构建数据结构：classId -> dayOfWeek_period -> cell
  const scheduleMap = new Map<string, Map<string, { subject: SubjectType; teacherId: string }>>()

  for (const classSchedule of schedule.classSchedules) {
    const classCellMap = new Map<string, { subject: SubjectType; teacherId: string }>()
    for (const cell of classSchedule.cells) {
      classCellMap.set(`${cell.dayOfWeek}_${cell.period}`, {
        subject: cell.subject,
        teacherId: cell.teacherId
      })
    }
    scheduleMap.set(classSchedule.classId, classCellMap)
  }

  // 获取所有学科用于图例
  const allSubjects = getAllSubjects()

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden flex-1 flex flex-col min-h-0">
      <div className="overflow-auto flex-1">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[var(--color-bg-secondary)]">
              <th className="sticky left-0 z-10 px-4 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] border-b border-r border-[var(--color-border)] min-w-[100px]">
                班级
              </th>
              {DAYS.map((day) => (
                periods.map((period) => (
                  <th
                    key={`${day}-${period}`}
                    className="px-2 py-3 text-center text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)] min-w-[60px]"
                  >
                    <div>{day}</div>
                    <div className="text-[var(--color-text-muted)]">第{period}节</div>
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((cls, rowIndex) => {
              const classCellMap = scheduleMap.get(cls.id)

              return (
                <tr
                  key={cls.id}
                  className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[var(--color-bg-secondary)]/30'}
                >
                  <td className="sticky left-0 z-10 px-4 py-2 font-medium text-sm text-[var(--color-text-primary)] bg-inherit border-r border-[var(--color-border-light)]">
                    {cls.name}
                  </td>
                  {DAYS.map((_, dayIndex) => (
                    periods.map((period) => {
                      const cellKey = `${dayIndex + 1}_${period}`
                      const cellData = classCellMap?.get(cellKey)

                      if (!cellData) {
                        return (
                          <td
                            key={cellKey}
                            className="px-1 py-1.5 text-center border-b border-[var(--color-border-light)]"
                          >
                            <span className="text-[var(--color-text-muted)] text-xs">-</span>
                          </td>
                        )
                      }

                      const subjectName = getSubjectName(cellData.subject)
                      const bgColor = getSubjectColor(cellData.subject)

                      return (
                        <td
                          key={cellKey}
                          className="px-1 py-1.5 text-center border-b border-[var(--color-border-light)]"
                        >
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: bgColor }}
                          >
                            {subjectName}
                          </span>
                        </td>
                      )
                    })
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 图例 */}
      <div className="px-4 py-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]/50">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs text-[var(--color-text-muted)]">学科图例：</span>
          {allSubjects.map((subject) => (
            <div key={subject} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getSubjectColor(subject) }}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">{getSubjectName(subject)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
