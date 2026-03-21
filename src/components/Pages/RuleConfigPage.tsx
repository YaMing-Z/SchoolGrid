import { useState } from 'react'
import { useRuleStore } from '@/stores/ruleStore'
import { useScheduleStore } from '@/stores/scheduleStore'
import { Subject, SUBJECT_NAMES, DEFAULT_PERIODS } from '@/data/constants'

export function RuleConfigPage() {
  const [activeTab, setActiveTab] = useState<'subject' | 'global' | 'teacher'>('subject')

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-fade-in flex flex-col h-full">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">
          排课规则定制引擎
        </h2>
        <p className="text-[var(--color-text-secondary)] mt-2">
          在这里配置全校通用的排课约束和课程标准，系统在排课时将严格遵守这些底层规则。
        </p>
      </div>

      {/* Main Content Area with Sidebar Tabs */}
      <div className="flex flex-1 gap-8 min-h-[600px]">
        {/* Sidebar Nav */}
        <div className="w-64 shrink-0 space-y-2">
          <button
            onClick={() => setActiveTab('subject')}
            className={`w-full text-left px-5 py-4 rounded-xl font-medium transition-all duration-200 flex items-center gap-3
              ${activeTab === 'subject' 
                ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white shadow-md' 
                : 'bg-white hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)]'
              }`}
          >
            <span className="text-xl">📚</span>
            <span>年级课程标准</span>
          </button>

          <button
            onClick={() => setActiveTab('global')}
            className={`w-full text-left px-5 py-4 rounded-xl font-medium transition-all duration-200 flex items-center gap-3
              ${activeTab === 'global' 
                ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white shadow-md' 
                : 'bg-white hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)]'
              }`}
          >
            <span className="text-xl">🚫</span>
            <span>全校教研(禁排)时间</span>
          </button>

          <button
            onClick={() => setActiveTab('teacher')}
            className={`w-full text-left px-5 py-4 rounded-xl font-medium transition-all duration-200 flex items-center gap-3
              ${activeTab === 'teacher' 
                ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white shadow-md' 
                : 'bg-white hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)]'
              }`}
          >
            <span className="text-xl">👩‍🏫</span>
            <span>教师排课限制</span>
          </button>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden flex flex-col">
          {activeTab === 'subject' && <SubjectRuleConfig />}
          {activeTab === 'global' && <GlobalTimeRuleConfig />}
          {activeTab === 'teacher' && <TeacherRuleConfig />}
        </div>
      </div>
    </div>
  )
}

function SubjectRuleConfig() {
  const { subjectRules, addSubjectRule, updateSubjectRule, removeSubjectRule } = useRuleStore()
  const { rawImportData } = useScheduleStore()
  
  // 当前规则
  const currentRules = subjectRules
  
  // 从导入数据中提取可选学科，并确保「班会」作为底部的默认选项
  const importedSubjects = new Set<Subject>()
  rawImportData?.assignments.forEach(a => importedSubjects.add(a.subject))
  const availableBaseSubjects = Array.from(importedSubjects)
  if (!availableBaseSubjects.includes(Subject.Meeting)) {
    availableBaseSubjects.push(Subject.Meeting)
  }
  
  const handleAddRule = () => {
    // 找出尚未配置的学科
    const assignedSubjects = currentRules.map(r => r.subject)
    const availableSubjects = availableBaseSubjects.filter(s => !assignedSubjects.includes(s))
    
    if (availableSubjects.length === 0) {
      alert('所有科目均已配置该年级规则')
      return
    }
    
    addSubjectRule({
      id: `rule_sub_${Date.now()}`,
      subject: availableSubjects[0] as Subject,
      weeklyHours: 4,
      isConsecutive: false,
      consecutiveCount: 2
    })
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex justify-between items-center">
        <div>
          <h3 className="text-lg font-serif font-semibold text-[var(--color-text-primary)]">全局学科标准配置</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">设置本校每个学科的标准课时与连堂要求</p>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-auto">
        <div className="flex justify-end mb-4">
          <button 
            onClick={handleAddRule}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition duration-200 font-medium text-sm flex items-center gap-1"
          >
            <span>+</span> 添加学科规则
          </button>
        </div>

        {currentRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[var(--color-bg-secondary)] rounded-xl border border-dashed border-[var(--color-border)] mt-4">
            <span className="text-4xl mb-3 opacity-50">📋</span>
            <p className="text-[var(--color-text-secondary)]">尚未配置任何学科规则，导入的排课将默认安排为 1 节/周。</p>
            <button onClick={handleAddRule} className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg shadow-sm hover:shadow-md transition">立即配置第一条规则</button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm">
                  <th className="p-4 font-medium border-b border-[var(--color-border)]">学科</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)]">周标准课时</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] w-28">需要连堂</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] w-32">连堂节数</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {currentRules.map(rule => {
                  // 计算此行下拉框可选的其他科目（加上自己）
                  const assignedSubjects = currentRules.map(r => r.subject)
                  return (
                  <tr key={rule.id} className="hover:bg-[var(--color-bg-secondary)]/50 transition duration-150">
                    <td className="p-4 font-medium">
                      <select
                        value={rule.subject}
                        onChange={(e) => updateSubjectRule(rule.id, { subject: e.target.value as Subject })}
                        className="px-3 py-1.5 border border-[var(--color-border)] rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] font-medium text-[var(--color-text-primary)]"
                      >
                        <option value={rule.subject}>{SUBJECT_NAMES[rule.subject] || rule.subject}</option>
                        {availableBaseSubjects
                          .filter(s => s !== rule.subject && !assignedSubjects.includes(s))
                          .map(s => (
                            <option key={s} value={s}>{SUBJECT_NAMES[s] || s}</option>
                          ))
                        }
                      </select>
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        min={1} max={20}
                        value={rule.weeklyHours}
                        onChange={(e) => updateSubjectRule(rule.id, { weeklyHours: parseInt(e.target.value) || 1 })}
                        className="w-20 px-3 py-1.5 border border-[var(--color-border)] rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]"
                      />
                    </td>
                    <td className="p-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={rule.isConsecutive}
                          onChange={(e) => updateSubjectRule(rule.id, { isConsecutive: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                      </label>
                    </td>
                    <td className="p-4">
                      <select
                        disabled={!rule.isConsecutive}
                        value={rule.consecutiveCount}
                        onChange={(e) => updateSubjectRule(rule.id, { consecutiveCount: parseInt(e.target.value) })}
                        className={`w-20 px-3 py-1.5 border border-[var(--color-border)] rounded shadow-sm focus:outline-none focus:ring-2 ${!rule.isConsecutive ? 'opacity-50 bg-gray-50' : ''}`}
                      >
                        <option value={2}>2 节</option>
                        <option value={3}>3 节</option>
                        <option value={4}>4 节</option>
                      </select>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => removeSubjectRule(rule.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function GlobalTimeRuleConfig() {
  const { globalTimeRules, addGlobalTimeRule, removeGlobalTimeRule } = useRuleStore()

  // 检查某个时段是否已被禁排
  const isRuleActive = (day: number, period: number) => {
    return globalTimeRules.some(r => r.dayOfWeek === day && r.period === period)
  }

  // 切换某个时段的状态
  const toggleSlot = (day: number, period: number) => {
    const existingRule = globalTimeRules.find(r => r.dayOfWeek === day && r.period === period)
    if (existingRule) {
      removeGlobalTimeRule(existingRule.id)
    } else {
      addGlobalTimeRule({
        id: `global_${day}_${period}_${Date.now()}`,
        dayOfWeek: day,
        period: period,
        reason: '全校统一设定的禁排时段'
      })
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <h3 className="text-lg font-serif font-semibold text-[var(--color-text-primary)]">全校时间约束网络</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">点击网格中特定时间的格子，将其设为“全校禁排课”。这通常用于全校升旗、教职工大会的时间设置。</p>
      </div>

      <div className="p-6 flex-1 overflow-auto flex justify-center items-start">
        <div className="bg-[var(--color-bg-secondary)] p-6 rounded-2xl border border-[var(--color-border)] shadow-inner inline-block">
          <div className="grid grid-cols-6 gap-3 select-none">
            {/* 表头 */}
            <div className="h-10"></div>
            {['周一', '周二', '周三', '周四', '周五'].map(day => (
              <div key={day} className="h-10 font-bold text-[var(--color-text-secondary)] text-center w-24 flex items-center justify-center">
                {day}
              </div>
            ))}

            {/* 表格体 */}
            {DEFAULT_PERIODS.map((p, periodIndex) => (
              <React.Fragment key={`row-${periodIndex}`}>
                <div className="font-medium text-[var(--color-text-secondary)] flex items-center justify-end pr-4 text-xs">
                  第{periodIndex + 1}节<br/>
                  <span className="text-[10px] opacity-70 ml-1">{p.startTime}-{p.endTime}</span>
                </div>

                {[1, 2, 3, 4, 5].map(day => {
                  const blocked = isRuleActive(day, periodIndex + 1)
                  return (
                    <div 
                      key={`${day}-${periodIndex + 1}`}
                      onClick={() => toggleSlot(day, periodIndex + 1)}
                      className={`
                        h-16 w-24 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-center relative overflow-hidden
                        ${blocked 
                          ? 'border-[var(--color-error)] bg-red-50 text-[var(--color-error)] shadow-sm' 
                          : 'border-transparent bg-white hover:border-[var(--color-primary-light)] hover:shadow'
                        }
                      `}
                    >
                      {blocked ? (
                        <div className="text-center">
                          <span className="block text-xl mb-1">🚫</span>
                          <span className="text-[10px] font-bold">全校禁排</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xl opacity-0 hover:opacity-100 transition-opacity">×</span>
                      )}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TeacherRuleConfig() {
  const { teacherLoadRule, setTeacherLoadRule } = useRuleStore()

  return (
    <div className="flex flex-col h-full animate-fade-in">
        <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <h3 className="text-lg font-serif font-semibold text-[var(--color-text-primary)]">教师与工作量规则</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">设定对所有老师生效的基础保障约束底线</p>
      </div>

      <div className="p-8 space-y-8">
        <div className="max-w-xl">
          <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-2">全校教师默认最大课时标准（节/周）</label>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">排课引擎计算时，任何一位老师的周课时都不会超过此数值。这是一个保障线。</p>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="1" 
              max="40" 
              value={teacherLoadRule.defaultMaxWeeklyHours} 
              onChange={(e) => setTeacherLoadRule({ defaultMaxWeeklyHours: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-2xl font-bold font-serif text-[var(--color-primary)] w-12 text-center">
              {teacherLoadRule.defaultMaxWeeklyHours}
            </span>
          </div>
        </div>
        
        {/* Placeholder for future specific rules */}
        <div className="pt-8 border-t border-[var(--color-border-light)]">
           <h4 className="font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
             <span>✨</span> 单个教师个性化微调
           </h4>
           <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200 text-sm">
             <p className="mb-2"><strong>Tip:</strong> 如果需要针对单名老师设置他哪一节课不能上，请从导入课表后生成的【教师档案】页面进入专门配置。</p>
             <p>这里的全局引擎用于统一标准。</p>
           </div>
        </div>
      </div>
    </div>
  )
}
import React from 'react'
