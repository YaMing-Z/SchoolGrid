import { Teacher } from '@/types/teacher.types'
import { SchoolClass, GradeLevel } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { Subject } from '@/data/constants'
import { useRuleStore } from '@/stores/ruleStore'

export interface SimpleAssignment {
  teacherName: string
  className: string
  grade: GradeLevel
  subject: Subject
}

export interface AggregationInput {
  classes: { name: string; grade: GradeLevel; homeroomTeacherName?: string }[]
  assignments: SimpleAssignment[]
}

export interface AggregatedResult {
  teachers: Teacher[]
  classes: SchoolClass[]
  curriculumItems: CurriculumItem[]
}

/**
 * 规则聚合引擎
 * 将极简的二维表解析结果（单纯的映射名单），结合系统的《排课规则树》，自动推导出完整的排课数据实体。
 */
export function aggregateRulesWithData(input: AggregationInput): AggregatedResult {
  const { subjectRules, globalTimeRules, teacherLoadRule, teacherTimeRules, subjectTimeRules } = useRuleStore.getState()

  const teachersMap = new Map<string, Teacher>()
  const classesMap = new Map<string, SchoolClass>()
  const curriculumItems: CurriculumItem[] = []

  // 1. 根据任课关系提取所有教师名字并初始化 Teacher 对象
  const allTeacherNames = new Set<string>()
  input.classes.forEach(c => {
    if (c.homeroomTeacherName) allTeacherNames.add(c.homeroomTeacherName.trim())
  })
  input.assignments.forEach(a => {
    allTeacherNames.add(a.teacherName.trim())
  })

  // 为每个老师分配随机/递增工号（因为新模板去掉了必填工号），并赋予默认规则
  let teacherCounter = 1
  allTeacherNames.forEach(name => {
    const defaultEmployeeId = `T${String(teacherCounter++).padStart(4, '0')}`
    const teacherId = `teacher_${defaultEmployeeId}`
    
    // 提取全局禁排时间（应用于所有教师）
    const globalAvoidSlots = globalTimeRules.map(rule => ({
      dayOfWeek: rule.dayOfWeek,
      period: rule.period
    }))

    // [P0-1 修复] 提取该教师的个人绝对禁排时间（teacherTimeRules.must_not）
    // teacherTimeRules 中 teacherId 字段存储的是教师姓名（ruleStore 约定）
    const personalMustNotSlots = teacherTimeRules
      .filter(r => r.teacherId === name && r.type === 'must_not')
      .map(r => ({ dayOfWeek: r.dayOfWeek, period: r.period }))

    // 合并全局禁排和个人禁排，去重
    const avoidTimeSlots = [...globalAvoidSlots]
    for (const slot of personalMustNotSlots) {
      const alreadyIncluded = avoidTimeSlots.some(
        s => s.dayOfWeek === slot.dayOfWeek && s.period === slot.period
      )
      if (!alreadyIncluded) {
        avoidTimeSlots.push(slot)
      }
    }

    teachersMap.set(name, {
      id: teacherId,
      employeeId: defaultEmployeeId,
      name: name,
      // 如果老师教多个科目，随机取一个或者定义为通用，这里为了类型正确，暂时取教的第一个科目，后文再完善
      subject: Object.values(Subject)[0], 
      weeklyHoursLimit: teacherLoadRule.defaultMaxWeeklyHours,
      avoidTimeSlots: avoidTimeSlots,
      isActive: true
    })
  })

  // 2. 修饰并处理科目信息
  input.assignments.forEach(a => {
    const teacher = teachersMap.get(a.teacherName.trim())
    if (teacher && teacher.subject === Object.values(Subject)[0]) {
        // 更新为实际教授的科目
        teacher.subject = a.subject
    }
  });

  // 3. 构建完整的 SchoolClass
  input.classes.forEach((c, index) => {
    const classId = `class_${c.name.trim()}_${index}`
    let hrTeacherId
    if (c.homeroomTeacherName) {
      hrTeacherId = teachersMap.get(c.homeroomTeacherName.trim())?.id
    }

    classesMap.set(c.name.trim(), {
      id: classId,
      name: c.name.trim(),
      grade: c.grade,
      classNumber: index + 1, // 简化的推导
      studentCount: 40, // 默认人数
      homeroomTeacherId: hrTeacherId,
      isActive: true
    })
  })

  // 4. 构建 CurriculumItem (将任课记录和 Rules 结合)
  input.assignments.forEach((a, index) => {
    const classEntity = classesMap.get(a.className.trim())
    const teacherEntity = teachersMap.get(a.teacherName.trim())

    if (!classEntity || !teacherEntity) return

    // 尝试找有没有对应的学科规则
    const rule = subjectRules.find(r => r.subject === a.subject)

    // [P0-2 修复] 从 subjectTimeRules 中提取该学科的固定课位（type === 'fixed'）
    const fixedSlots = subjectTimeRules
      .filter(r => r.subject === a.subject && r.type === 'fixed')
      .map(r => ({ dayOfWeek: r.dayOfWeek, period: r.period }))

    const item: CurriculumItem = {
      id: `curr_${classEntity.id}_${a.subject}_${index}`,
      classId: classEntity.id,
      subject: a.subject,
      teacherId: teacherEntity.id,
      weeklyHours: rule?.weeklyHours || 1, // 如果没配规则，默认 1 节
      isConsecutive: rule?.isConsecutive || false,
      consecutiveCount: rule?.consecutiveCount || 2,
      fixedSlots: fixedSlots.length > 0 ? fixedSlots : undefined, // 注入固定课位
      priority: fixedSlots.length > 0 ? 10 : 0 // 有固定课位的课程优先级更高
    }

    curriculumItems.push(item)
  })

  // 5. 补充「班会」等特殊自动排课科目
  // 在处理完 input.assignments 后，检查系统规则中是否有班会课
  const meetingRule = subjectRules.find(r => r.subject === Subject.Meeting)
  if (meetingRule) {
    classesMap.forEach(classEntity => {
      // 检查这个班是否已经排了班会课（可能有人在 Excel 里填了）
      const hasMeeting = curriculumItems.some(i => i.classId === classEntity.id && i.subject === Subject.Meeting)
      if (!hasMeeting) {
        // 如果没有排，默认由班主任上（确保该班有班主任）
        const hrTeacherId = classEntity.homeroomTeacherId
        if (hrTeacherId) {
          // [P0-2 修复] 班会课同样注入固定课位
          const meetingFixedSlots = subjectTimeRules
            .filter(r => r.subject === Subject.Meeting && r.type === 'fixed')
            .map(r => ({ dayOfWeek: r.dayOfWeek, period: r.period }))

          curriculumItems.push({
            id: `curr_${classEntity.id}_meeting_auto`,
            classId: classEntity.id,
            subject: Subject.Meeting,
            teacherId: hrTeacherId,
            weeklyHours: meetingRule.weeklyHours,
            isConsecutive: meetingRule.isConsecutive,
            consecutiveCount: meetingRule.consecutiveCount,
            fixedSlots: meetingFixedSlots.length > 0 ? meetingFixedSlots : undefined, // 注入固定课位
            priority: meetingFixedSlots.length > 0 ? 15 : (meetingRule.weeklyHours > 0 ? 5 : 0) // 班会固定课位时优先级最高
          })
        }
      }
    })
  }

  return {
    teachers: Array.from(teachersMap.values()),
    classes: Array.from(classesMap.values()),
    curriculumItems
  }
}
