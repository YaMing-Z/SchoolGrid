import { Teacher } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import {
  ConsistencyValidationResult,
  ValidationError,
  ValidationWarning
} from '@/types/validation.types'
import { DEFAULT_PERIODS_PER_DAY, DEFAULT_SCHOOL_DAYS } from '@/data/constants'

/**
 * 验证教学计划数据的一致性
 */
export function validateConsistency(
  teachers: Teacher[],
  classes: SchoolClass[],
  curriculumItems: CurriculumItem[]
): ConsistencyValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 构建索引
  const teacherMap = new Map<string, Teacher>()
  const teacherByEmployeeId = new Map<string, Teacher>()
  const classMap = new Map<string, SchoolClass>()

  for (const teacher of teachers) {
    teacherMap.set(teacher.id, teacher)
    teacherByEmployeeId.set(teacher.employeeId, teacher)
  }

  for (const cls of classes) {
    classMap.set(cls.id, cls)
  }

  // 计算可用课时格子数
  const availableSlotsPerWeek = DEFAULT_PERIODS_PER_DAY * DEFAULT_SCHOOL_DAYS.length

  // 1. 验证教师引用完整性
  const missingTeachers = new Set<string>()
  for (const item of curriculumItems) {
    // 尝试通过ID或工号查找教师
    const teacher = teacherMap.get(item.teacherId) || teacherByEmployeeId.get(item.teacherId)
    if (!teacher) {
      missingTeachers.add(item.teacherId)
      errors.push({
        code: 'MISSING_TEACHER',
        message: `教学计划中引用的教师不存在: ${item.teacherId}`,
        field: 'teacherId',
        value: item.teacherId,
        suggestion: '请检查教师工号是否正确'
      })
    }
  }

  // 2. 验证班级引用完整性
  const missingClasses = new Set<string>()
  for (const item of curriculumItems) {
    if (!classMap.has(item.classId)) {
      missingClasses.add(item.classId)
      errors.push({
        code: 'MISSING_CLASS',
        message: `教学计划中引用的班级不存在: ${item.classId}`,
        field: 'classId',
        value: item.classId,
        suggestion: '请检查班级ID是否正确'
      })
    }
  }

  // 3. 验证教师课时上限
  const teacherHours = new Map<string, { assigned: number; limit: number }>()
  let teacherHoursViolations = 0

  for (const item of curriculumItems) {
    const teacher = teacherMap.get(item.teacherId) || teacherByEmployeeId.get(item.teacherId)
    if (teacher) {
      const current = teacherHours.get(teacher.id) || { assigned: 0, limit: teacher.weeklyHoursLimit }
      current.assigned += item.weeklyHours
      teacherHours.set(teacher.id, current)
    }
  }

  for (const [teacherId, hours] of teacherHours) {
    const teacher = teacherMap.get(teacherId)!
    if (hours.assigned > hours.limit) {
      teacherHoursViolations++
      errors.push({
        code: 'TEACHER_HOURS_EXCEEDED',
        message: `教师 ${teacher.name} 课时超限: 已分配 ${hours.assigned} 节，上限 ${hours.limit} 节`,
        field: 'weeklyHours',
        value: hours.assigned,
        suggestion: '请减少该教师的授课任务或增加课时上限'
      })
    } else if (hours.assigned > hours.limit * 0.9) {
      warnings.push({
        code: 'TEACHER_HOURS_WARNING',
        message: `教师 ${teacher.name} 课时接近上限: 已分配 ${hours.assigned} 节，上限 ${hours.limit} 节`,
        field: 'weeklyHours',
        value: hours.assigned
      })
    }
  }

  // 4. 验证班级课时容量
  const classHours = new Map<string, { assigned: number; available: number }>()
  let classHoursViolations = 0

  for (const item of curriculumItems) {
    const current = classHours.get(item.classId) || { assigned: 0, available: availableSlotsPerWeek }
    current.assigned += item.weeklyHours
    classHours.set(item.classId, current)
  }

  for (const [classId, hours] of classHours) {
    const cls = classMap.get(classId)
    if (hours.assigned > hours.available) {
      classHoursViolations++
      errors.push({
        code: 'CLASS_HOURS_EXCEEDED',
        message: `班级 ${cls?.name || classId} 课时超出可用格子: 已分配 ${hours.assigned} 节，可用 ${hours.available} 节`,
        field: 'weeklyHours',
        value: hours.assigned,
        suggestion: '请减少该班级的课程或增加每天的课时数'
      })
    }
  }

  // 5. 验证连堂课约束
  for (const item of curriculumItems) {
    if (item.isConsecutive && item.weeklyHours % (item.consecutiveCount || 2) !== 0) {
      warnings.push({
        code: 'CONSECUTIVE_MISMATCH',
        message: `教学计划的周课时数 ${item.weeklyHours} 不能被连堂节数 ${item.consecutiveCount || 2} 整除`,
        field: 'weeklyHours',
        value: item.weeklyHours
      })
    }
  }

  // 6. 验证固定时段的合法性
  for (const item of curriculumItems) {
    if (item.fixedSlots && item.fixedSlots.length > 0) {
      for (const slot of item.fixedSlots) {
        if (slot.dayOfWeek < 1 || slot.dayOfWeek > 7) {
          errors.push({
            code: 'INVALID_SLOT_DAY',
            message: `固定时段的星期无效: ${slot.dayOfWeek}，应为 1-7`,
            field: 'fixedSlots',
            value: slot
          })
        }
        if (slot.period < 1 || slot.period > DEFAULT_PERIODS_PER_DAY) {
          errors.push({
            code: 'INVALID_SLOT_PERIOD',
            message: `固定时段的节次无效: ${slot.period}，应为 1-${DEFAULT_PERIODS_PER_DAY}`,
            field: 'fixedSlots',
            value: slot
          })
        }
      }
    }
  }

  // 构建结果
  const result: ConsistencyValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalTeachers: teachers.length,
      totalClasses: classes.length,
      totalCurriculumItems: curriculumItems.length,
      teacherHoursViolations,
      classHoursViolations,
      missingReferences: missingTeachers.size + missingClasses.size
    },
    details: {
      teacherHours,
      classHours,
      missingTeachers: Array.from(missingTeachers),
      missingClasses: Array.from(missingClasses)
    }
  }

  return result
}

/**
 * 快速验证（只检查是否有错误）
 */
export function hasValidationErrors(
  teachers: Teacher[],
  classes: SchoolClass[],
  curriculumItems: CurriculumItem[]
): boolean {
  const result = validateConsistency(teachers, classes, curriculumItems)
  return !result.isValid
}

/**
 * 获取教师的剩余可用课时
 */
export function getTeacherRemainingHours(
  teacher: Teacher,
  curriculumItems: CurriculumItem[]
): number {
  const assigned = curriculumItems
    .filter(item => item.teacherId === teacher.id || item.teacherId === teacher.employeeId)
    .reduce((sum, item) => sum + item.weeklyHours, 0)
  return teacher.weeklyHoursLimit - assigned
}

/**
 * 获取班级的剩余可用课时格子
 */
export function getClassRemainingSlots(
  classId: string,
  curriculumItems: CurriculumItem[]
): number {
  const availableSlotsPerWeek = DEFAULT_PERIODS_PER_DAY * DEFAULT_SCHOOL_DAYS.length
  const assigned = curriculumItems
    .filter(item => item.classId === classId)
    .reduce((sum, item) => sum + item.weeklyHours, 0)
  return availableSlotsPerWeek - assigned
}
