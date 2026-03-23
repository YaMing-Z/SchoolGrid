import { useState } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { GenerateScheduleConfirmModal } from '@/components/Dashboard/GenerateScheduleConfirmModal'
import { OverviewTabs } from '@/components/Overview/OverviewTabs'
import { GradeOverviewTable } from '@/components/Overview/GradeOverviewTable'
import { ClassSchedulePreview } from '@/components/Overview/ClassSchedulePreview'
import { TeacherSchedulePreview } from '@/components/Overview/TeacherSchedulePreview'
import { ExportDropdown } from '@/components/Overview/ExportDropdown'

const statCards = [
  { key: 'teachers', label: '教师总数', icon: '👨‍🏫', color: 'from-blue-500 to-blue-600' },
  { key: 'classes', label: '班级总数', icon: '🏫', color: 'from-emerald-500 to-emerald-600' },
  { key: 'scheduled', label: '已排课时', icon: '✅', color: 'from-amber-500 to-amber-600' },
]

// 流程步骤卡片数据
const flowSteps = [
  { icon: '📥', title: '导入数据', desc: '上传 Excel 文件' },
  { icon: '⚙️', title: '配置规则', desc: '设置排课约束' },
  { icon: '⚡', title: '生成课表', desc: '智能算法排课' },
  { icon: '📋', title: '微调导出', desc: '调整并导出' },
]

export function DashboardPage() {
  const { teachers, classes, curriculumItems, schedule, setView, overviewTab } = useScheduleStore()
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const stats = {
    teachers: teachers.length,
    classes: classes.length,
    scheduled: schedule?.classSchedules.reduce((sum, cs) => sum + cs.cells.length, 0) || 0,
  }

  const hasData = teachers.length > 0 && classes.length > 0 && curriculumItems.length > 0

  // 空白状态 - 简约专业风格
  if (!hasData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[var(--color-bg-secondary)] animate-fade-in">
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center mb-6">
          <span className="text-white font-serif font-bold text-xl">S</span>
        </div>

        {/* 标题层次 */}
        <h1 className="font-serif text-4xl font-semibold text-[var(--color-text-primary)]">
          SchoolGrid
        </h1>
        <p className="text-xl text-[var(--color-text-secondary)] mt-2">
          规则驱动的智能排课
        </p>
        <p className="text-base text-[var(--color-text-muted)] mt-4 max-w-md text-center">
          导入数据，配置规则，一键生成全校课表
        </p>

        {/* CTA 按钮 */}
        <button
          onClick={() => setView('import')}
          className="mt-8 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium text-base
                     hover:bg-[var(--color-primary-dark)] transition-colors duration-200"
        >
          开始使用
        </button>

        {/* 流程步骤卡片 */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full px-4">
          {flowSteps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-5 border border-[var(--color-border-light)]
                         hover:shadow-sm hover:border-[var(--color-border)] transition-all duration-200"
            >
              <span className="text-2xl mb-3 block">{step.icon}</span>
              <h3 className="font-medium text-[var(--color-text-primary)] text-sm">
                {step.title}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fade-in h-full overflow-y-auto">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">
            排课总览
          </h2>
          <p className="text-[var(--color-text-secondary)] mt-1">
            查看数据统计和课表信息
          </p>
        </div>
        {hasData && !schedule && (
          <button
            onClick={() => setShowConfirmModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)]
                       text-white font-medium shadow-md hover:shadow-lg transition-all duration-300
                       flex items-center gap-2"
          >
            <span>⚡</span>
            <span>生成课表</span>
          </button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-5">
        {statCards.map((card, index) => (
          <div
            key={card.key}
            className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-[var(--color-border-light)]
                       hover:shadow-md transition-all duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-10 rounded-bl-[100%]`}></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{card.icon}</span>
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{card.label}</span>
              </div>
              <div className="text-4xl font-serif font-bold text-[var(--color-text-primary)]">
                {stats[card.key as keyof typeof stats]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab 区域 */}
      <div className="flex items-center justify-between">
        <OverviewTabs />
        <ExportDropdown />
      </div>

      {/* 课表展示区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        {overviewTab === 'grade' && <GradeOverviewTable />}
        {overviewTab === 'class' && <ClassSchedulePreview />}
        {overviewTab === 'teacher' && <TeacherSchedulePreview />}
      </div>
    </div>

      {/* 生成课表确认框 */}
      <GenerateScheduleConfirmModal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => useScheduleStore.getState().generateSchedule()}
      />
    </>
  )
}
