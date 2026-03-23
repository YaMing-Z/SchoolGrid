import { useState } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES, Subject } from '@/data/constants'
import { GenerateScheduleConfirmModal } from '@/components/Dashboard/GenerateScheduleConfirmModal'

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
  const { teachers, classes, curriculumItems, schedule, setView } = useScheduleStore()
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const stats = {
    teachers: teachers.length,
    classes: classes.length,
    scheduled: schedule?.classSchedules.reduce((sum, cs) => sum + cs.cells.length, 0) || 0,
  }

  // 统计学科分布
  const subjectDistribution = curriculumItems.reduce((acc, item) => {
    acc[item.subject] = (acc[item.subject] || 0) + item.weeklyHours
    return acc
  }, {} as Record<Subject, number>)

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
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 animate-fade-in h-full overflow-y-auto">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">
            排课总览
          </h2>
          <p className="text-[var(--color-text-secondary)] mt-1">
            查看数据统计和快速操作
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

      {/* Content grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Subject distribution */}
        <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)]">
          <h3 className="font-serif text-lg font-semibold text-[var(--color-text-primary)] mb-5">
            学科课时分布
          </h3>
          {Object.keys(subjectDistribution).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(subjectDistribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([subject, hours]) => {
                  const maxHours = Math.max(...Object.values(subjectDistribution))
                  const percentage = (hours / maxHours) * 100
                  return (
                    <div key={subject} className="flex items-center gap-4">
                      <span className="w-20 text-sm text-[var(--color-text-secondary)]">
                        {SUBJECT_NAMES[subject as Subject] || subject}
                      </span>
                      <div className="flex-1 h-8 bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] rounded-lg transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm font-medium text-[var(--color-text-primary)] text-right">
                        {hours}节
                      </span>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
              <span className="text-4xl mb-3">📊</span>
              <p>暂无数据，请先导入教学计划</p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)]">
          <h3 className="font-serif text-lg font-semibold text-[var(--color-text-primary)] mb-5">
            快速操作
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => setView('import')}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-secondary)] text-left
                         hover:bg-[var(--color-bg-tertiary)] transition-colors duration-200
                         flex items-center gap-3 group"
            >
              <span className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                📥
              </span>
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">导入数据</div>
                <div className="text-xs text-[var(--color-text-muted)]">上传Excel文件</div>
              </div>
            </button>

            <button
              onClick={() => setView('schedule')}
              disabled={!schedule}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-secondary)] text-left
                         hover:bg-[var(--color-bg-tertiary)] transition-colors duration-200
                         flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                📅
              </span>
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">查看课表</div>
                <div className="text-xs text-[var(--color-text-muted)]">浏览班级课表</div>
              </div>
            </button>

            <button
              onClick={() => setView('rules')}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg-secondary)] text-left
                         hover:bg-[var(--color-bg-tertiary)] transition-colors duration-200
                         flex items-center gap-3 group"
            >
              <span className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                ⚙️
              </span>
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">规则设置</div>
                <div className="text-xs text-[var(--color-text-muted)]">配置排课规则</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent activity / status */}
      {schedule && (
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-semibold">课表已生成</h3>
              <p className="text-white/80 mt-1">
                学年 {schedule.academicYear} · 第 {schedule.semester} 学期
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/80">生成时间</div>
              <div className="font-medium">
                {new Date(schedule.generatedAt).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      )}
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
