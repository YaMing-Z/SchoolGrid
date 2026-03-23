import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SubjectRule, GlobalTimeRule, TeacherLoadRule, TeacherTimeRule, SubjectTimeRule, ScheduleConfig, PeriodConfig } from '@/types/rule.types'
import { Subject } from '@/data/constants'

// 默认课表配置
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  periodsPerDay: 9,
  morningPeriods: 4,
  periods: [
    { period: 1, startTime: '08:00', endTime: '08:45', isMorning: true },
    { period: 2, startTime: '08:55', endTime: '09:40', isMorning: true },
    { period: 3, startTime: '10:00', endTime: '10:45', isMorning: true },
    { period: 4, startTime: '10:55', endTime: '11:40', isMorning: true },
    { period: 5, startTime: '14:00', endTime: '14:45', isMorning: false },
    { period: 6, startTime: '14:55', endTime: '15:40', isMorning: false },
    { period: 7, startTime: '16:00', endTime: '16:45', isMorning: false },
    { period: 8, startTime: '16:55', endTime: '17:40', isMorning: false },
    { period: 9, startTime: '17:50', endTime: '18:35', isMorning: false },
  ]
}

interface RuleState {
  subjectRules: SubjectRule[]
  subjectTimeRules: SubjectTimeRule[]
  globalTimeRules: GlobalTimeRule[]
  teacherLoadRule: TeacherLoadRule
  teacherTimeRules: TeacherTimeRule[]
  scheduleConfig: ScheduleConfig

  // Actions
  setSubjectRules: (rules: SubjectRule[]) => void
  addSubjectRule: (rule: SubjectRule) => void
  updateSubjectRule: (id: string, rule: Partial<SubjectRule>) => void
  removeSubjectRule: (id: string) => void

  setSubjectTimeRules: (rules: SubjectTimeRule[]) => void
  addSubjectTimeRule: (rule: SubjectTimeRule) => void
  removeSubjectTimeRule: (id: string) => void
  getSubjectTimeRules: (subject: string) => SubjectTimeRule[]

  setGlobalTimeRules: (rules: GlobalTimeRule[]) => void
  addGlobalTimeRule: (rule: GlobalTimeRule) => void
  removeGlobalTimeRule: (id: string) => void

  setTeacherLoadRule: (rule: TeacherLoadRule) => void
  
  setTeacherTimeRules: (rules: TeacherTimeRule[]) => void
  addTeacherTimeRule: (rule: TeacherTimeRule) => void
  removeTeacherTimeRule: (id: string) => void
  getTeacherTimeRules: (teacherId: string) => TeacherTimeRule[]
  
  // 按照学科快捷查询规则（聚合服务会用到）
  getSubjectRule: (subject: string) => SubjectRule | undefined

  // 清除失效的规则（针对重新导入数据时，老师/科目被删掉的情况）
  cleanupInvalidRules: (validTeacherIds: string[], validSubjects: string[]) => void

  // 清空所有规则
  resetRules: () => void

  // 课表配置相关
  setScheduleConfig: (config: ScheduleConfig) => void
  updatePeriod: (period: number, updates: Partial<PeriodConfig>) => void
  addPeriod: (afterPeriod?: number) => void
  removePeriod: (period: number) => void
  resetScheduleConfig: () => void
}

// 默认学科规则（语文、数学、英语，周课时为6）
const DEFAULT_SUBJECT_RULES: SubjectRule[] = [
  {
    id: 'rule_chinese',
    subject: Subject.Chinese,
    weeklyHours: 6,
    isConsecutive: false,
    consecutiveCount: 2
  },
  {
    id: 'rule_math',
    subject: Subject.Math,
    weeklyHours: 6,
    isConsecutive: false,
    consecutiveCount: 2
  },
  {
    id: 'rule_english',
    subject: Subject.English,
    weeklyHours: 6,
    isConsecutive: false,
    consecutiveCount: 2
  }
]

const initialState = {
  subjectRules: DEFAULT_SUBJECT_RULES,
  subjectTimeRules: [],
  globalTimeRules: [],
  teacherLoadRule: {
    defaultMaxWeeklyHours: 16
  },
  teacherTimeRules: [],
  scheduleConfig: DEFAULT_SCHEDULE_CONFIG
}

export const useRuleStore = create<RuleState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSubjectRules: (rules) => set({ subjectRules: rules }),
      
      addSubjectRule: (rule) => set((state) => ({ 
        subjectRules: [...state.subjectRules, rule] 
      })),
      
      updateSubjectRule: (id, updatedRule) => set((state) => ({
        subjectRules: state.subjectRules.map(r => r.id === id ? { ...r, ...updatedRule } : r)
      })),
      
      removeSubjectRule: (id) => set((state) => ({
        subjectRules: state.subjectRules.filter(r => r.id !== id)
      })),

      setSubjectTimeRules: (rules) => set({ subjectTimeRules: rules }),
      
      addSubjectTimeRule: (rule) => set((state) => ({
        subjectTimeRules: [...state.subjectTimeRules, rule]
      })),
      
      removeSubjectTimeRule: (id) => set((state) => ({
        subjectTimeRules: state.subjectTimeRules.filter(r => r.id !== id)
      })),
      
      getSubjectTimeRules: (subject) => {
        return get().subjectTimeRules.filter(r => r.subject === subject)
      },

      setGlobalTimeRules: (rules) => set({ globalTimeRules: rules }),
      
      addGlobalTimeRule: (rule) => set((state) => ({
        globalTimeRules: [...state.globalTimeRules, rule]
      })),
      
      removeGlobalTimeRule: (id) => set((state) => ({
        globalTimeRules: state.globalTimeRules.filter(r => r.id !== id)
      })),

      setTeacherLoadRule: (rule) => set({ teacherLoadRule: rule }),
      
      setTeacherTimeRules: (rules) => set({ teacherTimeRules: rules }),
      
      addTeacherTimeRule: (rule) => set((state) => ({
        teacherTimeRules: [...state.teacherTimeRules, rule]
      })),
      
      removeTeacherTimeRule: (id) => set((state) => ({
        teacherTimeRules: state.teacherTimeRules.filter(r => r.id !== id)
      })),
      
      getTeacherTimeRules: (teacherId) => {
        return get().teacherTimeRules.filter(r => r.teacherId === teacherId)
      },
      
      getSubjectRule: (subject) => {
        const rules = get().subjectRules;
        return rules.find(r => r.subject === subject);
      },

      cleanupInvalidRules: (validTeacherIds, validSubjects) => set((state) => {
        // 班会、自习是内置的基础课，始终保留它们的规则
        const safeSubjects = [...validSubjects, '班会', '自习']
        
        const newSubjectRules = state.subjectRules.filter(r => safeSubjects.includes(r.subject))
        const newSubjectTimeRules = state.subjectTimeRules.filter(r => safeSubjects.includes(r.subject))
        const newTeacherTimeRules = state.teacherTimeRules.filter(r => validTeacherIds.includes(r.teacherId))
        
        // 全校规则通常不需要清理，特定老师规则和学科规则已在上方完成清理
        
        return {
          subjectRules: newSubjectRules,
          subjectTimeRules: newSubjectTimeRules,
          teacherTimeRules: newTeacherTimeRules
        }
      }),

      resetRules: () => set(initialState),

      // 课表配置相关
      setScheduleConfig: (config) => set({ scheduleConfig: config }),

      updatePeriod: (period, updates) => set((state) => ({
        scheduleConfig: {
          ...state.scheduleConfig,
          periods: state.scheduleConfig.periods.map(p =>
            p.period === period ? { ...p, ...updates } : p
          )
        }
      })),

      addPeriod: (afterPeriod) => set((state) => {
        const periods = [...state.scheduleConfig.periods]
        const newPeriodNumber = afterPeriod ? afterPeriod + 1 : periods.length + 1

        // 在指定位置后插入新节次
        const newPeriod: PeriodConfig = {
          period: newPeriodNumber,
          startTime: '',
          endTime: '',
          isMorning: false
        }

        if (afterPeriod) {
          periods.splice(afterPeriod, 0, newPeriod)
        } else {
          periods.push(newPeriod)
        }

        // 重新编号所有节次
        const renumberedPeriods = periods.map((p, index) => ({
          ...p,
          period: index + 1
        }))

        return {
          scheduleConfig: {
            ...state.scheduleConfig,
            periodsPerDay: renumberedPeriods.length,
            periods: renumberedPeriods
          }
        }
      }),

      removePeriod: (period) => set((state) => {
        if (state.scheduleConfig.periods.length <= 1) {
          return state // 至少保留一节课
        }

        const filteredPeriods = state.scheduleConfig.periods
          .filter(p => p.period !== period)
          .map((p, index) => ({
            ...p,
            period: index + 1
          }))

        // 更新 morningPeriods
        const newMorningPeriods = filteredPeriods.filter(p => p.isMorning).length

        return {
          scheduleConfig: {
            ...state.scheduleConfig,
            periodsPerDay: filteredPeriods.length,
            morningPeriods: newMorningPeriods,
            periods: filteredPeriods
          }
        }
      }),

      resetScheduleConfig: () => set({ scheduleConfig: DEFAULT_SCHEDULE_CONFIG })
    }),
    {
      name: 'school-grid-rules',
    }
  )
)
