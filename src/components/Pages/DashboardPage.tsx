import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES, Subject } from '@/data/constants'
import { Stepper } from '@/components/Layout/Stepper'

const statCards = [
  { key: 'teachers', label: '教师总数', icon: '👨‍🏫', color: 'from-blue-500 to-blue-600' },
  { key: 'classes', label: '班级总数', icon: '🏫', color: 'from-emerald-500 to-emerald-600' },
  { key: 'curriculum', label: '课程条目', icon: '📚', color: 'from-purple-500 to-purple-600' },
  { key: 'scheduled', label: '已排课时', icon: '✅', color: 'from-amber-500 to-amber-600' },
]

export function DashboardPage() {
  const { teachers, classes, curriculumItems, schedule, setView } = useScheduleStore()

  const stats = {
    teachers: teachers.length,
    classes: classes.length,
    curriculum: curriculumItems.length,
    scheduled: schedule?.classSchedules.reduce((sum, cs) => sum + cs.cells.length, 0) || 0,
  }

  // 统计学科分布
  const subjectDistribution = curriculumItems.reduce((acc, item) => {
    acc[item.subject] = (acc[item.subject] || 0) + item.weeklyHours
    return acc
  }, {} as Record<Subject, number>)

  const hasData = teachers.length > 0 && classes.length > 0 && curriculumItems.length > 0

  if (!hasData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[var(--color-bg-secondary)] animate-fade-in relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-accent)]/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="text-center max-w-2xl mb-12">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-xl mb-6 shadow-[var(--color-primary)]/20 rotate-[10deg] hover:rotate-0 transition-transform duration-500">
            <span className="text-white text-4xl">S</span>
          </div>
          <h1 className="font-serif text-4xl font-bold text-[var(--color-text-primary)] mb-4">
            欢迎来到 SchoolGrid 智能排课系统
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
            仅需四个简单步骤，即可生成全校最优课表。您可以在任意时刻回到此向导查看当前进度。
          </p>
        </div>

        <div className="w-full max-w-4xl bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white p-2 mb-12">
          <div className="bg-transparent rounded-2xl overflow-hidden">
            <Stepper currentStep={0} />
          </div>
        </div>

        <button
          onClick={() => setView('import')}
          className="group relative px-10 py-4 bg-[var(--color-primary)] text-white rounded-2xl font-semibold text-lg overflow-hidden shadow-xl shadow-[var(--color-primary)]/30 hover:shadow-2xl hover:shadow-[var(--color-primary)]/40 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
          <span className="relative text-2xl">📥</span>
          <span className="relative">开始第一步：导入数据</span>
          <span className="relative group-hover:translate-x-1 transition-transform">➡️</span>
        </button>
      </div>
    )
  }

  return (
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
            onClick={() => useScheduleStore.getState().generateSchedule()}
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
  )
}
