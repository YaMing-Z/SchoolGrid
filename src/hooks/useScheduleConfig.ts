import { useRuleStore } from '@/stores/ruleStore'

/**
 * 获取课表配置的统一 Hook
 * 用于替代硬编码的节次配置
 */
export function useScheduleConfig() {
  const scheduleConfig = useRuleStore(state => state.scheduleConfig)
  const setScheduleConfig = useRuleStore(state => state.setScheduleConfig)
  const updatePeriod = useRuleStore(state => state.updatePeriod)
  const addPeriod = useRuleStore(state => state.addPeriod)
  const removePeriod = useRuleStore(state => state.removePeriod)

  // 获取节次数字数组 [1, 2, ..., n]
  const getPeriodNumbers = () => {
    return scheduleConfig.periods.map(p => p.period)
  }

  // 获取节次名称 "第X节"
  const getPeriodName = (period: number) => {
    return `第${period}节`
  }

  // 判断是否上午
  const isMorning = (period: number) => {
    const periodConfig = scheduleConfig.periods.find(p => p.period === period)
    return periodConfig?.isMorning ?? (period <= scheduleConfig.morningPeriods)
  }

  // 获取节次的时间范围
  const getPeriodTime = (period: number) => {
    const periodConfig = scheduleConfig.periods.find(p => p.period === period)
    if (periodConfig && periodConfig.startTime && periodConfig.endTime) {
      return `${periodConfig.startTime}-${periodConfig.endTime}`
    }
    return ''
  }

  // 生成 PERIOD_NAMES 数组（用于 TeacherSelectorModal 等组件）
  const getPeriodNames = () => {
    const names: string[] = [''] // index 0 为空
    for (let i = 1; i <= scheduleConfig.periodsPerDay; i++) {
      names.push(`第${i}节`)
    }
    return names
  }

  return {
    periodsPerDay: scheduleConfig.periodsPerDay,
    periods: scheduleConfig.periods,
    morningPeriods: scheduleConfig.morningPeriods,
    scheduleConfig,

    // Actions
    setScheduleConfig,
    updatePeriod,
    addPeriod,
    removePeriod,

    // Helpers
    getPeriodNumbers,
    getPeriodName,
    isMorning,
    getPeriodTime,
    getPeriodNames,
  }
}
