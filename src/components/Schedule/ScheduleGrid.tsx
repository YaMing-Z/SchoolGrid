import { useScheduleStore } from '@/stores/scheduleStore'
import { ScheduleCell } from '@/types/schedule.types'
import { SUBJECT_NAMES, SUBJECT_COLORS } from '@/data/constants'

const DAYS = ['周一', '周二', '周三', '周四', '周五']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

export function ScheduleGrid() {
  const {
    schedule,
    selectedClassId,
    setSelectedClass,
    classes,
    teachers,
    startAdjustment,
    adjustmentMode,
    selectedCell,
    clearSchedule,
    generateSchedule,
  } = useScheduleStore()

  const classSchedule = schedule?.classSchedules.find(s => s.classId === selectedClassId)

  // 构建课表格子映射
  const cellMap = new Map<string, ScheduleCell>()
  if (classSchedule) {
    for (const cell of classSchedule.cells) {
      cellMap.set(`${cell.dayOfWeek}_${cell.period}`, cell)
    }
  }

  // 获取教师姓名
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId || t.employeeId === teacherId)
    return teacher?.name || teacherId
  }

  // 处理单元格点击
  const handleCellClick = (cell: ScheduleCell) => {
    if (adjustmentMode && selectedCell?.id !== cell.id) {
      return
    }
    startAdjustment(cell)
  }

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[var(--color-text-muted)]">
        <span className="text-6xl mb-4">📅</span>
        <p className="text-lg mb-2">暂无课表数据</p>
        <p className="text-sm">请先导入数据并生成课表</p>
        <button
          onClick={() => useScheduleStore.getState().setView('import')}
          className="mt-4 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          前往导入数据
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-white">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              useScheduleStore.getState().prevStep()
              useScheduleStore.getState().setView('rules')
            }}
            className="p-2 -ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <span>⬅️</span>
            <span>返回</span>
          </button>
          <div className="w-px h-6 bg-[var(--color-border)] mx-1"></div>
          <h2 className="font-serif text-xl font-semibold text-[var(--color-text-primary)]">
            课表管理
          </h2>
          {schedule && (
            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-3 py-1 rounded-full">
              算法版本: {schedule.algorithmVersion}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('确定要重新生成课表吗？当前课表将被清除。')) {
                generateSchedule()
              }
            }}
            className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg
                       hover:bg-[var(--color-primary-dark)] transition-colors flex items-center gap-2"
          >
            <span>🔄</span>
            <span>重新生成</span>
          </button>
          <button
            onClick={() => {
              if (confirm('确定要清空课表吗？此操作不可恢复。')) {
                clearSchedule()
              }
            }}
            className="px-4 py-2 text-sm border border-[var(--color-error)] text-[var(--color-error)] rounded-lg
                       hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <span>🗑️</span>
            <span>清空课表</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - class list */}
        <aside className="w-64 border-r border-[var(--color-border)] bg-white flex flex-col">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="font-serif font-semibold text-[var(--color-text-primary)]">
              班级列表
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {classes.length} 个班级
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {classes.map((cls) => {
              const clsSchedule = schedule?.classSchedules.find(s => s.classId === cls.id)
              const isValid = clsSchedule?.isValid ?? true

              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`
                    w-full px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-200
                    ${selectedClassId === cls.id
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{cls.name}</span>
                    {!isValid && (
                      <span className="text-xs" title="存在冲突">⚠️</span>
                    )}
                  </div>
                  <div className="text-xs opacity-70">{cls.studentCount} 名学生</div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main schedule grid */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-6 border-b border-[var(--color-border)]">
              <div className="p-4 bg-[var(--color-bg-secondary)]">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">节次/日期</span>
              </div>
              {DAYS.map((day) => (
                <div key={day} className="p-4 bg-[var(--color-bg-secondary)] text-center">
                  <span className="font-medium text-[var(--color-text-primary)]">{day}</span>
                </div>
              ))}
            </div>

            {/* Period rows */}
            {PERIODS.map((period) => (
              <div key={period} className="grid grid-cols-6 border-b border-[var(--color-border-light)] last:border-b-0">
                {/* Period label */}
                <div className="p-3 bg-[var(--color-bg-secondary)] flex flex-col justify-center">
                  <span className="font-medium text-[var(--color-text-primary)]">第{period}节</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {period <= 4 ? '上午' : '下午'}
                  </span>
                </div>

                {/* Day cells */}
                {DAYS.map((_, dayIndex) => {
                  const dayOfWeek = dayIndex + 1
                  const cellKey = `${dayOfWeek}_${period}`
                  const cell = cellMap.get(cellKey)

                  return (
                    <div
                      key={cellKey}
                      className={`
                        p-3 min-h-[80px] border-r border-[var(--color-border-light)] last:border-r-0
                        transition-all duration-200 cursor-pointer
                        ${cell ? 'hover:shadow-md hover:-translate-y-0.5' : ''}
                        ${selectedCell?.id === cell?.id ? 'ring-2 ring-[var(--color-accent)]' : ''}
                        ${adjustmentMode && !cell ? 'bg-[var(--color-bg-tertiary)]' : ''}
                      `}
                      onClick={() => cell && handleCellClick(cell)}
                    >
                      {cell ? (
                        <div className="h-full flex flex-col justify-between">
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
                          {cell.isFixed && (
                            <span className="text-xs text-[var(--color-text-muted)]">📌 固定</span>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">
                          <span className="text-lg">-</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span>图例：</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-[var(--color-primary)]"></span>
              当前选中
            </span>
            <span className="flex items-center gap-1">
              <span>📌</span>
              固定课程（不可调整）
            </span>
            <span className="flex items-center gap-1">
              <span>⚠️</span>
              存在冲突
            </span>
          </div>
        </div>
      </div>

      {/* Adjustment mode indicator */}
      {adjustmentMode && selectedCell && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/22 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl shadow-lg animate-slide-up z-50">
          <span className="font-medium">调课模式已开启</span>
          <span className="text-sm opacity-80 ml-2">- 点击其他课程进行交换</span>
        </div>
      )}
    </div>
  )
}
