import { useScheduleStore, OverviewTab } from '@/stores/scheduleStore'

const TABS: { key: OverviewTab; label: string }[] = [
  { key: 'grade', label: '级部总表' },
  { key: 'class', label: '班级课表' },
  { key: 'teacher', label: '教师课表' },
]

export function OverviewTabs() {
  const { overviewTab, setOverviewTab } = useScheduleStore()

  return (
    <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)] p-1 rounded-lg">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setOverviewTab(tab.key)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            overviewTab === tab.key
              ? 'bg-white text-[var(--color-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
