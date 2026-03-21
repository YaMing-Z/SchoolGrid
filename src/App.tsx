import { useScheduleStore } from '@/stores/scheduleStore'
import { Header } from '@/components/Layout/Header'
import { DashboardPage } from '@/components/Pages/DashboardPage'
import { ImportPage } from '@/components/Pages/ImportPage'
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid'
import { AdjustmentPanel } from '@/components/Adjustment/AdjustmentPanel'

function RulesPage() {
  return (
    <div className="p-6 max-w-[1000px] mx-auto animate-fade-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">
            规则设置
          </h2>
          <p className="text-[var(--color-text-secondary)] mt-1">
            配置排课约束和优先级规则
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] p-6">
        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
          <span className="text-6xl mb-4">⚙️</span>
          <p className="text-lg mb-2">规则引擎开发中</p>
          <p className="text-sm">即将支持时间约束、频率约束、并发约束等高级规则配置</p>
        </div>
      </div>
    </div>
  )
}

function App() {
  const { currentView, adjustmentMode } = useScheduleStore()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 overflow-hidden">
        {currentView === 'dashboard' && <DashboardPage />}
        {currentView === 'import' && <ImportPage />}
        {currentView === 'schedule' && <ScheduleGrid />}
        {currentView === 'rules' && <RulesPage />}
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
