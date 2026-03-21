import { useScheduleStore } from '@/stores/scheduleStore'
import { AdjustmentPriority } from '@/types/adjustment.types'
import { SUBJECT_NAMES } from '@/data/constants'

const priorityConfig = {
  [AdjustmentPriority.P0]: {
    label: 'P0',
    name: '同日互换',
    description: '同班级当天内互换课程',
    color: 'var(--color-p0)',
    icon: '🔄'
  },
  [AdjustmentPriority.P1]: {
    label: 'P1',
    name: '跨日互换',
    description: '同班级本周内互换课程',
    color: 'var(--color-p1)',
    icon: '📆'
  },
  [AdjustmentPriority.P2]: {
    label: 'P2',
    name: '代课',
    description: '同科目教师代课',
    color: 'var(--color-p2)',
    icon: '👥'
  }
}

export function AdjustmentPanel() {
  const {
    adjustmentMode,
    selectedCell,
    adjustmentSuggestions,
    selectedSuggestion,
    selectSuggestion,
    applySuggestion,
    cancelAdjustment,
    teachers
  } = useScheduleStore()

  if (!adjustmentMode || !selectedCell) {
    return null
  }

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId || t.employeeId === teacherId)
    return teacher?.name || teacherId
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div className="w-[420px] bg-white rounded-2xl shadow-2xl border border-[var(--color-border-light)]
                      overflow-hidden pointer-events-auto animate-slide-in-right">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)] text-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-xl font-semibold">调课建议</h3>
              <p className="text-sm text-white/80 mt-1">
                {SUBJECT_NAMES[selectedCell.subject]} · 第{selectedCell.period}节
              </p>
            </div>
            <button
              onClick={cancelAdjustment}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center
                         transition-colors duration-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Current cell info */}
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center
                            text-lg">
              📍
            </div>
            <div>
              <div className="font-medium text-[var(--color-text-primary)]">
                当前课程
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {getTeacherName(selectedCell.teacherId)} · {SUBJECT_NAMES[selectedCell.subject]}
              </div>
            </div>
          </div>
        </div>

        {/* Suggestions list */}
        <div className="max-h-[400px] overflow-y-auto">
          {adjustmentSuggestions.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-muted)]">
              <span className="text-4xl block mb-3">🔍</span>
              <p>未找到可行的调课方案</p>
            </div>
          ) : (
            <div className="p-2">
              {adjustmentSuggestions.map((suggestion, index) => {
                const config = priorityConfig[suggestion.priority]
                const isSelected = selectedSuggestion?.id === suggestion.id

                return (
                  <button
                    key={suggestion.id}
                    onClick={() => selectSuggestion(suggestion)}
                    className={`
                      w-full p-3 rounded-xl text-left transition-all duration-200
                      flex items-start gap-3 group
                      ${isSelected
                        ? 'bg-[var(--color-bg-tertiary)] ring-2 ring-[var(--color-accent)]'
                        : 'hover:bg-[var(--color-bg-secondary)]'
                      }
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`
                    }}
                  >
                    {/* Priority badge */}
                    <div
                      className={`
                        w-10 h-10 rounded-xl flex items-center justify-center text-white
                        shrink-0 font-bold text-sm shadow-sm
                      `}
                      style={{ backgroundColor: config.color }}
                    >
                      {config.label}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {config.name}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          评分 {suggestion.score}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                        {suggestion.description}
                      </p>
                      {suggestion.violations.length > 0 && (
                        <div className="mt-1 text-xs text-[var(--color-warning)]">
                          ⚠️ {suggestion.violations.length} 个约束冲突
                        </div>
                      )}
                    </div>

                    {/* Score indicator */}
                    <div className="shrink-0 w-12 h-12">
                      <svg viewBox="0 0 36 36" className="w-full h-full">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="var(--color-border)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke={config.color}
                          strokeWidth="3"
                          strokeDasharray={`${suggestion.score} 100`}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                        <text
                          x="18"
                          y="18"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-xs fill-[var(--color-text-primary)] font-medium"
                        >
                          {suggestion.score}
                        </text>
                      </svg>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {selectedSuggestion && (
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <div className="flex gap-3">
              <button
                onClick={cancelAdjustment}
                className="flex-1 py-3 px-4 rounded-xl border border-[var(--color-border)]
                           text-[var(--color-text-secondary)] font-medium
                           hover:bg-[var(--color-bg-tertiary)] transition-colors duration-200"
              >
                取消
              </button>
              <button
                onClick={applySuggestion}
                className="flex-1 py-3 px-4 rounded-xl bg-[var(--color-accent)] text-white
                           font-medium hover:opacity-90 transition-opacity duration-200"
              >
                应用此方案
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
