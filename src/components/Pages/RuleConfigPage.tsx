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

      {/* Footer Navigation */}
      <div className="mt-8 flex justify-between items-center">
        <button 
          onClick={() => {
            useScheduleStore.getState().prevStep()
            useScheduleStore.getState().setView('import')
          }}
          className="px-6 py-3 rounded-xl border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-all font-medium flex items-center gap-2"
        >
          <span>⬅️</span>
          <span>返回修改数据</span>
        </button>
        
        <button 
          onClick={() => {
            useScheduleStore.getState().nextStep()
            useScheduleStore.getState().generateSchedule()
            // generateSchedule currently switches currentView to 'schedule' inside its logic, but we make sure here
            useScheduleStore.getState().setView('schedule')
          }}
          className="px-8 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white rounded-xl shadow-lg shadow-[var(--color-primary)]/20 hover:scale-105 transition-all font-medium text-lg flex items-center gap-2"
        >
          <span>下一步：自动生成课表</span>
          <span>➡️</span>
        </button>
      </div>
    </div>
  )
}


function SubjectRuleConfig() {
  const { subjectRules, addSubjectRule, updateSubjectRule, removeSubjectRule, subjectTimeRules, addSubjectTimeRule, removeSubjectTimeRule } = useRuleStore()
  const { rawImportData } = useScheduleStore()
  const [selectedSubject, setSelectedSubject] = useState<Subject | ''>('')

  
  // 当前规则
  const currentRules = subjectRules
  
  // 从导入数据中提取可选学科，并确保「班会」「自习」作为底部的默认选项
  const importedSubjects = new Set<Subject>()
  rawImportData?.assignments.forEach(a => importedSubjects.add(a.subject))
  const availableBaseSubjects = Array.from(importedSubjects)
  if (!availableBaseSubjects.includes(Subject.Meeting)) {
    availableBaseSubjects.push(Subject.Meeting)
  }
  if (!availableBaseSubjects.includes(Subject.SelfStudy)) {
    availableBaseSubjects.push(Subject.SelfStudy)
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
            className="px-4 py-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] text-white rounded-xl shadow-lg shadow-[var(--color-primary)]/20 hover:scale-105 transition-all duration-200 font-medium text-sm flex items-center gap-1"
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
                  <th className="p-4 font-medium border-b border-[var(--color-border)]">周课时</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] w-24">连堂</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] w-24">连堂节数</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] w-24">单日上限</th>
                  <th className="p-4 font-medium border-b border-[var(--color-border)] w-36">排课偏好</th>
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
                        className="w-[110px] px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent transition-all duration-200 font-medium text-sm text-[var(--color-text-primary)] shadow-sm cursor-pointer"
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
                        className="w-[84px] px-3 py-2 text-center bg-gray-50/50 border border-gray-200 rounded-xl hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent transition-all duration-200 font-medium text-sm text-[var(--color-text-primary)] shadow-sm"
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
                        className={`w-[84px] px-1 py-2 text-center border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent transition-all duration-200 text-sm font-medium shadow-sm ${
                          !rule.isConsecutive 
                            ? 'opacity-50 bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-gray-50/50 border-gray-200 text-[var(--color-text-primary)] hover:bg-white focus:bg-white cursor-pointer'
                        }`}
                      >
                        <option value={2}>2 节</option>
                        <option value={3}>3 节</option>
                        <option value={4}>4 节</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        min={1} max={8}
                        placeholder="不限"
                        value={rule.dailyMax || ''}
                        onChange={(e) => updateSubjectRule(rule.id, { dailyMax: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-[84px] px-3 py-2 text-center bg-gray-50/50 border border-gray-200 rounded-xl hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent transition-all duration-200 font-medium text-sm text-[var(--color-text-primary)] shadow-sm placeholder-gray-400"
                      />
                    </td>
                    <td className="p-4">
                      <select
                        value={rule.timePreference || 'no_preference'}
                        onChange={(e) => updateSubjectRule(rule.id, { timePreference: e.target.value as any })}
                        className="w-[130px] px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent transition-all duration-200 font-medium text-sm text-[var(--color-text-primary)] shadow-sm cursor-pointer"
                      >
                        <option value="no_preference">无强制偏好</option>
                        <option value="morning_only">尽量排上午</option>
                        <option value="afternoon_only">尽量排下午</option>
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
        
        {/* 单学科时间约束网格 */}
        <div className="mt-8 pt-8 border-t border-[var(--color-border-light)]">
           <div className="flex items-center justify-between mb-4">
             <h4 className="font-semibold text-lg text-[var(--color-text-primary)] flex items-center gap-2">
               <span>🎯</span> 单个学科特殊时间约束网格
             </h4>
             
             <select 
               value={selectedSubject}
               onChange={(e) => setSelectedSubject(e.target.value as Subject)}
               className="px-4 py-2 border border-[var(--color-border-dark)] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] font-medium bg-[var(--color-bg-secondary)] min-w-[200px]"
             >
               <option value="" disabled>-- 请选择一个学科 --</option>
               {availableBaseSubjects.map(s => (
                 <option key={s} value={s}>{SUBJECT_NAMES[s] || s}</option>
               ))}
             </select>
           </div>
           
           <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
             可以直接在下方总览面版中看到所有科目的时间约束。若要新增约束，请先在右上角选定学科。
           </div>
           
           <div className="bg-[var(--color-bg-secondary)] p-6 rounded-2xl border border-[var(--color-border)] shadow-inner animate-fade-in inline-block min-w-full overflow-x-auto">
               <div className="flex items-center gap-6 mb-6 px-4">
                 <div className="text-sm font-medium text-[var(--color-text-secondary)]">点击单元格切换状态：</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded border border-[var(--color-border-dark)] bg-white"></div> 随动混排 (默认)</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-emerald-50 border border-emerald-300"></div> 固定课位 (必须排)</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-red-50 border border-red-300"></div> 绝对禁排 (教研活动)</div>
               </div>

               <div className="grid grid-cols-6 gap-2 select-none min-w-[600px]">
                 {/* 表头 */}
                 <div className="h-8"></div>
                 {['周一', '周二', '周三', '周四', '周五'].map(day => (
                   <div key={day} className="h-8 font-bold text-[var(--color-text-secondary)] text-center w-full flex items-center justify-center border-b-2 border-[var(--color-border)]">
                     {day}
                   </div>
                 ))}

                 {/* 表格体 */}
                 {DEFAULT_PERIODS.map((p, periodIndex) => (
                   <React.Fragment key={`row-${periodIndex}`}>
                     <div className="font-medium text-[var(--color-text-secondary)] flex flex-col items-center justify-center text-xs h-14 bg-white rounded-lg shadow-sm">
                       <span>第{periodIndex + 1}节</span>
                       <span className="text-[9px] opacity-70">{p.startTime}-{p.endTime}</span>
                     </div>

                     {[1, 2, 3, 4, 5].map(day => {
                       const rulesInSlot = subjectTimeRules.filter(r => r.dayOfWeek === day && r.period === periodIndex + 1)
                       const existingRule = selectedSubject ? rulesInSlot.find(r => r.subject === selectedSubject) : null
                       const state = existingRule?.type || 'available'
                       
                       const handleClick = () => {
                         if (!selectedSubject) {
                            return // Without selecting a subject, clicking cell does nothing (only clicking 'x' on badge works)
                         }

                         if (!existingRule) {
                           addSubjectTimeRule({
                             id: `s_rule_${selectedSubject}_${day}_${periodIndex+1}_${Date.now()}`,
                             subject: selectedSubject as Subject,
                             dayOfWeek: day,
                             period: periodIndex + 1,
                             type: 'fixed'
                           })
                         } else if (existingRule.type === 'fixed') {
                           removeSubjectTimeRule(existingRule.id)
                           addSubjectTimeRule({
                             id: `s_rule_${selectedSubject}_${day}_${periodIndex+1}_${Date.now()}`,
                             subject: selectedSubject as Subject,
                             dayOfWeek: day,
                             period: periodIndex + 1,
                             type: 'must_not'
                           })
                         } else {
                           removeSubjectTimeRule(existingRule.id)
                         }
                       }
                       
                       return (
                         <div 
                           key={`${day}-${periodIndex + 1}`}
                           onClick={handleClick}
                           className={`
                             h-auto min-h-[56px] w-full rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center p-1 relative overflow-hidden group
                             ${selectedSubject ? 'cursor-pointer hover:shadow' : 'cursor-default'}
                             ${state === 'must_not' ? 'border-[var(--color-error)] bg-red-50' 
                             : state === 'fixed' ? 'border-[var(--color-success)] bg-emerald-50'
                             : 'border-transparent bg-white'}
                             ${selectedSubject && state === 'available' ? 'hover:border-[var(--color-primary-light)]' : ''}
                           `}
                         >
                           {/* 渲染该时段下的所有规则徽章 */}
                           <div className="flex flex-wrap gap-1 justify-center z-10 w-full relative">
                             {rulesInSlot.map(rule => (
                               <div 
                                 key={rule.id} 
                                 className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium border shadow-sm ${
                                   rule.type === 'fixed' 
                                     ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                     : 'bg-red-100 text-red-800 border-red-200'
                                 } ${rule.subject === selectedSubject ? 'ring-1 ring-offset-1 ring-black/20 font-bold scale-105 transition-transform' : ''}`}
                               >
                                 <span>{SUBJECT_NAMES[rule.subject] || rule.subject}</span>
                                 <span>{rule.type === 'fixed' ? '📌' : '🚫'}</span>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); removeSubjectTimeRule(rule.id) }}
                                   className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-700 transition-colors p-0.5 rounded-sm hover:bg-black/10"
                                   title={`删除 ${SUBJECT_NAMES[rule.subject] || rule.subject} 的约束`}
                                 >
                                   ×
                                 </button>
                               </div>
                             ))}
                           </div>

                           {/* 如果为空且选中了科目，提示可排位 */}
                           {rulesInSlot.length === 0 && selectedSubject && (
                             <span className="text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium z-10">
                               配置排位
                             </span>
                           )}

                           {/* 快捷悬浮提示（当已有别的科目标签，但在 hover 时提示可以添加当前科目） */}
                           {rulesInSlot.length > 0 && selectedSubject && !existingRule && (
                             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/90 backdrop-blur-[1px] z-20 transition-opacity">
                               <span className="text-[var(--color-primary)] text-xs font-medium border border-[var(--color-primary-light)] px-2 py-1 rounded bg-blue-50">+ {SUBJECT_NAMES[selectedSubject] || selectedSubject} 约束</span>
                             </div>
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
  const { teacherLoadRule, setTeacherLoadRule, teacherTimeRules, addTeacherTimeRule, removeTeacherTimeRule } = useRuleStore()
  const { teachers } = useScheduleStore()
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')

  // 获取当前选中教师的时间规则
  const currentTeacherRules = teacherTimeRules.filter(r => r.teacherId === selectedTeacherId)

  // 检查某个时段的状态
  const getSlotState = (day: number, period: number) => {
    return currentTeacherRules.find(r => r.dayOfWeek === day && r.period === period)?.type || 'available'
  }

  // 点击切换状态 (Available -> Prefer Not -> Must Not -> Available)
  const handleSlotClick = (day: number, period: number) => {
    if (!selectedTeacherId) return

    const existingRule = currentTeacherRules.find(r => r.dayOfWeek === day && r.period === period)
    
    if (!existingRule) {
      // Available -> Prefer Not
      addTeacherTimeRule({
        id: `t_rule_${selectedTeacherId}_${day}_${period}_${Date.now()}`,
        teacherId: selectedTeacherId,
        dayOfWeek: day,
        period: period,
        type: 'prefer_not'
      })
    } else if (existingRule.type === 'prefer_not') {
      // Prefer Not -> Must Not
      removeTeacherTimeRule(existingRule.id)
      addTeacherTimeRule({
        id: `t_rule_${selectedTeacherId}_${day}_${period}_${Date.now()}`,
        teacherId: selectedTeacherId,
        dayOfWeek: day,
        period: period,
        type: 'must_not'
      })
    } else {
      // Must Not -> Available
      removeTeacherTimeRule(existingRule.id)
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
      <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex justify-between items-center z-10">
        <div>
          <h3 className="text-lg font-serif font-semibold text-[var(--color-text-primary)]">教师时段与工作量规则</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">设定教师的基础工作量约束，并为特殊教师提供定制化的时间限制。</p>
        </div>
      </div>

      <div className="p-8 flex-1 overflow-y-auto space-y-8">
        {/* 全局工作量设定 */}
        <div className="max-w-xl bg-white p-6 border border-[var(--color-border)] rounded-2xl shadow-sm">
          <label className="block text-base font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <span>⚙️</span> 全套教师默认最大课时标准（节/周）
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">排课引擎计算时，任何一位老师的周课时都不会超过此数值作为安全界限。</p>
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
        
        {/* 教师特殊时间约束网格 */}
        <div className="pt-2">
           <div className="flex items-center justify-between mb-4">
             <h4 className="font-semibold text-lg text-[var(--color-text-primary)] flex items-center gap-2">
               <span>👩‍🏫</span> 单个教师个性化时间约束网格
             </h4>
             
             {/* 教师选择器 */}
             <select 
               value={selectedTeacherId}
               onChange={(e) => setSelectedTeacherId(e.target.value)}
               className="px-4 py-2 border border-[var(--color-border-dark)] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] font-medium bg-[var(--color-bg-secondary)] min-w-[200px]"
             >
               <option value="" disabled>-- 请选择一位教师 --</option>
               {teachers.map(t => (
                 <option key={t.id} value={t.id}>{t.name} ({t.employeeId || '无编号'})</option>
               ))}
             </select>
           </div>
           
           {!selectedTeacherId ? (
             <div className="bg-blue-50 text-blue-800 p-8 rounded-2xl border border-blue-100 flex flex-col items-center justify-center min-h-[300px]">
               <span className="text-5xl mb-4">👆</span>
               <p className="text-base font-medium">请在右上角选择一位教师以配置其专属排课时间。</p>
               <p className="text-sm opacity-80 mt-2">您可以为特定的教师设置“绝对禁排”和“尽量不排”的时间段，算法将尽力满足这些要求。</p>
             </div>
           ) : (
             <div className="bg-[var(--color-bg-secondary)] p-6 rounded-2xl border border-[var(--color-border)] shadow-inner animate-fade-in inline-block min-w-full overflow-x-auto">
               <div className="flex items-center gap-6 mb-6 px-4">
                 <div className="text-sm font-medium text-[var(--color-text-secondary)]">点击单元格切换状态：</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded border border-[var(--color-border-dark)] bg-white"></div> 可排课 (默认)</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div> 尽量不排</div>
                 <div className="flex items-center gap-2 text-xs"><div className="w-4 h-4 rounded bg-red-50 border border-red-300"></div> 绝对禁排</div>
               </div>

               <div className="grid grid-cols-6 gap-2 select-none min-w-[600px]">
                 {/* 表头 */}
                 <div className="h-8"></div>
                 {['周一', '周二', '周三', '周四', '周五'].map(day => (
                   <div key={day} className="h-8 font-bold text-[var(--color-text-secondary)] text-center w-full flex items-center justify-center border-b-2 border-[var(--color-border)]">
                     {day}
                   </div>
                 ))}

                 {/* 表格体 */}
                 {DEFAULT_PERIODS.map((p, periodIndex) => (
                   <React.Fragment key={`row-${periodIndex}`}>
                     <div className="font-medium text-[var(--color-text-secondary)] flex flex-col items-center justify-center text-xs h-14 bg-white rounded-lg shadow-sm">
                       <span>第{periodIndex + 1}节</span>
                       <span className="text-[9px] opacity-70">{p.startTime}-{p.endTime}</span>
                     </div>

                     {[1, 2, 3, 4, 5].map(day => {
                       const state = getSlotState(day, periodIndex + 1)
                       return (
                         <div 
                           key={`${day}-${periodIndex + 1}`}
                           onClick={() => handleSlotClick(day, periodIndex + 1)}
                           className={`
                             h-14 w-full rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-center relative overflow-hidden group
                             ${state === 'must_not' ? 'border-[var(--color-error)] bg-red-50 text-[var(--color-error)] shadow-sm' 
                             : state === 'prefer_not' ? 'border-yellow-400 bg-yellow-50 text-yellow-700 shadow-sm'
                             : 'border-transparent bg-white hover:border-[var(--color-primary-light)] hover:shadow'}
                           `}
                         >
                           {state === 'must_not' && (
                             <div className="text-center animate-pop-in">
                               <span className="block text-lg mb-0.5">🚫</span>
                               <span className="text-[10px] font-bold">绝对禁排</span>
                             </div>
                           )}
                           {state === 'prefer_not' && (
                             <div className="text-center animate-pop-in">
                               <span className="block text-lg mb-0.5">⚠️</span>
                               <span className="text-[10px] font-bold">尽量不排</span>
                             </div>
                           )}
                           {state === 'available' && (
                             <span className="text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">设置约束</span>
                           )}
                         </div>
                       )
                     })}
                   </React.Fragment>
                 ))}
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
import React from 'react'
