import { useScheduleStore } from '@/stores/scheduleStore'
import { Header } from '@/components/Layout/Header'
import { DashboardPage } from '@/components/Pages/DashboardPage'
import { ImportPage } from '@/components/Pages/ImportPage'
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid'
import { AdjustmentPanel } from '@/components/Adjustment/AdjustmentPanel'

import { RuleConfigPage } from '@/components/Pages/RuleConfigPage'

function App() {
  const { currentView, adjustmentMode } = useScheduleStore()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 overflow-hidden">
        {currentView === 'dashboard' && <DashboardPage />}
        {currentView === 'import' && <ImportPage />}
        {currentView === 'schedule' && <ScheduleGrid />}
        {currentView === 'rules' && <RuleConfigPage />}
      </main>

      {/* Adjustment panel overlay */}
      {adjustmentMode && <AdjustmentPanel />}

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border-light)]">
        <p>
          SchoolGrid 智能排课系统 · 基于贪心算法与三级优先级调课策略
        </p>
      </footer>
    </div>
  )
}

export default App
