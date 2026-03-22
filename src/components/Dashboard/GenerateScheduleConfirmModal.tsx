import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useRuleStore } from '@/stores/ruleStore'
import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES, DAY_OF_WEEK_NAMES, Subject } from '@/data/constants'

interface GenerateScheduleConfirmModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
}

// 时段偏好显示名称
const TIME_PREFERENCE_NAMES: Record<string, string> = {
  'morning_only': '仅上午',
  'afternoon_only': '仅下午',
  'no_preference': '无偏好'
}

/**
 * 生成课表确认弹窗
 *
 * 显示所有规则配置信息，让用户在生成课表前确认
 */
export function GenerateScheduleConfirmModal({
  visible,
  onClose,
  onConfirm
}: GenerateScheduleConfirmModalProps) {
  const {
    subjectRules,
    subjectTimeRules,
    globalTimeRules,
    teacherTimeRules,
    scheduleConfig,
    teacherLoadRule
  } = useRuleStore()

  const { teachers } = useScheduleStore()

  // 根据教师ID获取教师姓名
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId)
    return teacher?.name || teacherId
  }

  // ESC 键关闭
  useEffect(() => {
    if (!visible) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [visible, onClose])

  if (!visible) return null

  // 统计信息
  const totalWeeklyHours = subjectRules.reduce((sum, r) => sum + r.weeklyHours, 0)
  const morningPeriods = scheduleConfig.periods.filter(p => p.isMorning).length
  const afternoonPeriods = scheduleConfig.periods.filter(p => !p.isMorning).length

  // 合并学科规则和时间约束
  const mergedSubjectRules = (() => {
    const merged = new Map<string, {
      subject: string
      weeklyHours?: number
      isConsecutive?: boolean
      consecutiveCount?: number
      dailyMax?: number
      timePreference?: string
      fixed: string[]
      blocked: string[]
    }>()

    // 添加学科课程标准
    subjectRules.forEach(rule => {
      const subjectName = SUBJECT_NAMES[rule.subject as Subject] || rule.subject
      merged.set(subjectName, {
        subject: rule.subject,
        weeklyHours: rule.weeklyHours,
        isConsecutive: rule.isConsecutive,
        consecutiveCount: rule.consecutiveCount,
        dailyMax: rule.dailyMax,
        timePreference: rule.timePreference,
        fixed: [],
        blocked: []
      })
    })

    // 添加学科时间约束
    subjectTimeRules.forEach(rule => {
      const subjectName = SUBJECT_NAMES[rule.subject as Subject] || rule.subject
      const timeStr = `${DAY_OF_WEEK_NAMES[rule.dayOfWeek as keyof typeof DAY_OF_WEEK_NAMES]}第${rule.period}节`

      if (!merged.has(subjectName)) {
        merged.set(subjectName, {
          subject: rule.subject,
          fixed: [],
          blocked: []
        })
      }

      const item = merged.get(subjectName)!
      if (rule.type === 'fixed') {
        item.fixed.push(timeStr)
      } else {
        item.blocked.push(timeStr)
      }
    })

    return merged
  })()

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[680px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-[var(--color-border-light)] overflow-hidden flex flex-col animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h3 className="font-serif font-semibold text-xl">
                确认生成课表
              </h3>
              <p className="text-sm text-white/80 mt-1">
                请检查以下规则配置是否正确
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 课表配置 */}
          <section>
            <h4 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-sm">📅</span>
              课表配置
            </h4>
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[var(--color-text-muted)]">每天节次</span>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1">
                    {scheduleConfig.periodsPerDay} 节
                  </p>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">上午节次</span>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1">
                    {morningPeriods} 节
                  </p>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">下午节次</span>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1">
                    {afternoonPeriods} 节
                  </p>
                </div>
              </div>
              {/* 时间表 */}
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">节次时间安排</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {scheduleConfig.periods.slice(0, 9).map(p => (
                    <div key={p.period} className="flex items-center gap-2 bg-white rounded px-2 py-1.5">
                      <span className="text-[var(--color-text-muted)]">第{p.period}节</span>
                      <span className="text-[var(--color-text-primary)] font-medium">
                        {p.startTime}-{p.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 学科规则总览 */}
          <section>
            <h4 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-sm">📚</span>
              学科规则
              {totalWeeklyHours > 0 && (
                <span className="text-xs font-normal text-[var(--color-text-muted)] ml-auto">
                  周课时总计: {totalWeeklyHours} 节
                </span>
              )}
            </h4>
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 space-y-2">
              {mergedSubjectRules.size === 0 ? (
                <div className="text-center text-[var(--color-text-muted)] text-sm py-2">
                  未配置学科规则，将使用导入的课程数据
                </div>
              ) : (
                Array.from(mergedSubjectRules.entries()).map(([subjectName, rule]) => (
                  <div key={subjectName} className="bg-white rounded-lg p-3 border border-[var(--color-border-light)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[var(--color-text-primary)]">{subjectName}</span>
                      <div className="flex items-center gap-2 text-sm">
                        {rule.dailyMax && (
                          <span className="text-[var(--color-text-muted)]">日限{rule.dailyMax}节</span>
                        )}
                        {rule.weeklyHours !== undefined && (
                          <span className="font-medium text-[var(--color-primary)]">{rule.weeklyHours}节/周</span>
                        )}
                      </div>
                    </div>
                    {/* 标签和约束 */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {rule.isConsecutive && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          连堂{rule.consecutiveCount}节
                        </span>
                      )}
                      {rule.timePreference && rule.timePreference !== 'no_preference' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {TIME_PREFERENCE_NAMES[rule.timePreference]}
                        </span>
                      )}
                      {rule.fixed.length > 0 && (
                        <span className="text-green-600 text-xs">
                          固定: {rule.fixed.join('、')}
                        </span>
                      )}
                      {rule.blocked.length > 0 && (
                        <span className="text-orange-600 text-xs">
                          禁排: {rule.blocked.join('、')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 全局禁排规则 */}
          {globalTimeRules.length > 0 && (
            <section>
              <h4 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded bg-red-100 flex items-center justify-center text-sm">🚫</span>
                全局禁排时段
                <span className="text-xs font-normal text-[var(--color-text-muted)] ml-auto">
                  共 {globalTimeRules.length} 条
                </span>
              </h4>
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                <div className="flex flex-wrap gap-2">
                  {globalTimeRules.map(rule => (
                    <div
                      key={rule.id}
                      className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm"
                      title={rule.reason}
                    >
                      <span className="text-red-700">
                        {DAY_OF_WEEK_NAMES[rule.dayOfWeek as keyof typeof DAY_OF_WEEK_NAMES]} 第{rule.period}节
                      </span>
                      {rule.reason && (
                        <span className="text-red-500 text-xs ml-2">({rule.reason})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 教师时间规则 */}
          {teacherTimeRules.length > 0 && (
            <section>
              <h4 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded bg-cyan-100 flex items-center justify-center text-sm">👨‍🏫</span>
                教师时间约束
                <span className="text-xs font-normal text-[var(--color-text-muted)] ml-auto">
                  共 {teacherTimeRules.length} 条 · 教师周上限 {teacherLoadRule.defaultMaxWeeklyHours} 节
                </span>
              </h4>
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                <div className="flex flex-wrap gap-2">
                  {teacherTimeRules.map(rule => (
                    <div
                      key={rule.id}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        rule.type === 'must_not'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                      }`}
                      title={rule.reason}
                    >
                      <span>{getTeacherName(rule.teacherId)}</span>
                      <span className="mx-1">·</span>
                      <span>{DAY_OF_WEEK_NAMES[rule.dayOfWeek as keyof typeof DAY_OF_WEEK_NAMES]} 第{rule.period}节</span>
                      <span className="text-xs ml-1">
                        {rule.type === 'must_not' ? '(禁排)' : '(尽量不排)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 无规则提示 */}
          {subjectRules.length === 0 && globalTimeRules.length === 0 && subjectTimeRules.length === 0 && teacherTimeRules.length === 0 && (
            <div className="text-center py-6 text-[var(--color-text-muted)]">
              <span className="text-4xl mb-2 block">📋</span>
              <p>未配置额外规则，将使用导入的课程数据直接排课</p>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">
            点击确认后将根据以上规则自动生成课表
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)]
                         hover:bg-white hover:border-[var(--color-border)] transition-colors duration-200"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)]
                         text-white font-medium shadow-md hover:shadow-lg transition-all duration-300
                         flex items-center gap-2"
            >
              <span>⚡</span>
              <span>确认生成</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
