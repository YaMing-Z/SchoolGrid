import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SubjectRule, GlobalTimeRule, TeacherLoadRule } from '@/types/rule.types'

interface RuleState {
  subjectRules: SubjectRule[]
  globalTimeRules: GlobalTimeRule[]
  teacherLoadRule: TeacherLoadRule

  // Actions
  setSubjectRules: (rules: SubjectRule[]) => void
  addSubjectRule: (rule: SubjectRule) => void
  updateSubjectRule: (id: string, rule: Partial<SubjectRule>) => void
  removeSubjectRule: (id: string) => void

  setGlobalTimeRules: (rules: GlobalTimeRule[]) => void
  addGlobalTimeRule: (rule: GlobalTimeRule) => void
  removeGlobalTimeRule: (id: string) => void

  setTeacherLoadRule: (rule: TeacherLoadRule) => void
  
  // 按照学科快捷查询规则（聚合服务会用到）
  getSubjectRule: (subject: string) => SubjectRule | undefined
}

const initialState = {
  subjectRules: [],
  globalTimeRules: [],
  teacherLoadRule: {
    defaultMaxWeeklyHours: 16
  }
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

      setGlobalTimeRules: (rules) => set({ globalTimeRules: rules }),
      
      addGlobalTimeRule: (rule) => set((state) => ({
        globalTimeRules: [...state.globalTimeRules, rule]
      })),
      
      removeGlobalTimeRule: (id) => set((state) => ({
        globalTimeRules: state.globalTimeRules.filter(r => r.id !== id)
      })),

      setTeacherLoadRule: (rule) => set({ teacherLoadRule: rule }),
      
      getSubjectRule: (subject) => {
        const rules = get().subjectRules;
        return rules.find(r => r.subject === subject);
      }
    }),
    {
      name: 'school-grid-rules',
    }
  )
)
