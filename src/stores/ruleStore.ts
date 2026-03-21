import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SubjectRule, GlobalTimeRule, TeacherLoadRule, TeacherTimeRule, SubjectTimeRule } from '@/types/rule.types'

interface RuleState {
  subjectRules: SubjectRule[]
  subjectTimeRules: SubjectTimeRule[]
  globalTimeRules: GlobalTimeRule[]
  teacherLoadRule: TeacherLoadRule
  teacherTimeRules: TeacherTimeRule[]

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
}

const initialState = {
  subjectRules: [],
  subjectTimeRules: [],
  globalTimeRules: [],
  teacherLoadRule: {
    defaultMaxWeeklyHours: 16
  },
  teacherTimeRules: []
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
        // 班会是内置的基础课，始终保留它的规则
        const safeSubjects = [...validSubjects, '班会']
        
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

      resetRules: () => set(initialState)
    }),
    {
      name: 'school-grid-rules',
    }
  )
)
