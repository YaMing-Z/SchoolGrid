import { useScheduleStore } from '@/stores/scheduleStore'
import { useRuleStore } from '@/stores/ruleStore'
import { ViewMode } from '@/stores/scheduleStore'

const navItems: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'dashboard', label: '总览', icon: '📊' },
  { id: 'schedule', label: '课表', icon: '📅' },
  { id: 'import', label: '数据导入', icon: '📥' },
  { id: 'rules', label: '规则设置', icon: '⚙️' },
]

export function Header() {
  const { currentView, setView, schedule, teachers, classes } = useScheduleStore()

  return (
    <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-md">
              <span className="text-white font-serif font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="font-serif font-semibold text-lg text-[var(--color-text-primary)]">
                SchoolGrid
              </h1>
              <p className="text-xs text-[var(--color-text-muted)] -mt-0.5">智能排课系统</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1 bg-[var(--color-bg-secondary)] rounded-xl p-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  flex items-center gap-2
                  ${currentView === item.id
                    ? 'bg-white text-[var(--color-primary)] shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/50'
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Status indicators */}
          <div className="flex items-center gap-4">
            {schedule && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span>
                  <span className="text-[var(--color-text-secondary)]">
                    {teachers.length} 教师
                  </span>
                </div>
                <div className="w-px h-4 bg-[var(--color-border)]"></div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-info)]"></span>
                  <span className="text-[var(--color-text-secondary)]">
                    {classes.length} 班级
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Clear button */}
              <button
                onClick={() => {
                  if (confirm('确认彻底清除所有导入的系统数据、课表和本地保存的规则信息吗？此操作不可恢复。')) {
                    useScheduleStore.getState().resetData()
                    useRuleStore.getState().resetRules()
                    setView('dashboard')
                  }
                }}
                className="px-4 py-2 rounded-lg border border-[var(--color-error)] text-[var(--color-error)] text-sm font-medium
                           hover:bg-red-50 transition-colors duration-200
                           flex items-center gap-2 shadow-sm"
              >
                <span>🗑️</span>
                <span>清除所有数据</span>
              </button>

              {/* Export button */}
              <button
              onClick={() => {
                const data = useScheduleStore.getState().exportData()
                const blob = new Blob([data], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `schedule_${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium
                         hover:bg-[var(--color-primary-dark)] transition-colors duration-200
                         flex items-center gap-2 shadow-sm"
            >
              <span>📤</span>
              <span>导出</span>
            </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
