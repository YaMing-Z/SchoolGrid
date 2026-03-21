import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES, Subject } from '@/data/constants'

const statCards = [
  { key: 'teachers', label: '教师总数', icon: '👨‍🏫', color: 'from-blue-500 to-blue-600' },
  { key: 'classes', label: '班级总数', icon: '🏫', color: 'from-emerald-500 to-emerald-600' },
  { key: 'curriculum', label: '课程条目', icon: '📚', color: 'from-purple-500 to-purple-600' },
  { key: 'scheduled', label: '已排课时', icon: '✅', color: 'from-amber-500 to-amber-600' },
]

export function DashboardPage() {
  const { teachers, classes, curriculumItems, schedule, setView, generateSchedule } = useScheduleStore()

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

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 animate-fade-in">
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
        {!hasData && (
          <button
            onClick={() => setView('import')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]
                       text-white font-medium shadow-md hover:shadow-lg transition-all duration-300
                       flex items-center gap-2"
          >
            <span>📥</span>
            <span>导入数据</span>
          </button>
        )}
        {hasData && !schedule && (
          <button
            onClick={generateSchedule}
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
