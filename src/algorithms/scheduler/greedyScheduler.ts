import {
  ScheduleCell,
  OccupancyMatrix,
  SchedulingContext,
  ScheduleConflict,
  ConflictType,
  ClassSchedule,
  SchoolSchedule
} from '@/types/schedule.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { Teacher, TimeSlotRef } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { DayOfWeek, Subject, DEFAULT_SCHOOL_DAYS } from '@/data/constants'
import { useRuleStore } from '@/stores/ruleStore'

// 定义主科列表（语文、数学、英语）
const MAIN_SUBJECTS = [Subject.Chinese, Subject.Math, Subject.English]

// 获取当前配置的每天节次数
function getPeriodsPerDay(): number {
  const { scheduleConfig } = useRuleStore.getState()
  return scheduleConfig.periodsPerDay
}

/**
 * 优化排课算法
 *
 * 核心逻辑：
 * 1. 分离固定时段和非固定时段课程
 * 2. 优先放置固定时段课程
 * 3. 按约束程度排序非固定课程（连堂优先、课时多优先）
 * 4. 初始化占用矩阵（检测教师/班级冲突）
 * 5. 智能填充：尽量让同一学科的课程分布在一周的不同天
 */

/**
 * 创建占用矩阵
 */
function createOccupancyMatrix(): OccupancyMatrix {
  return new Map()
}

/**
 * 检查某时段是否被占用
 */
function isSlotOccupied(
  matrix: OccupancyMatrix,
  entityId: string,
  dayOfWeek: number,
  period: number
): boolean {
  const dayMap = matrix.get(entityId)
  if (!dayMap) return false
  const periodMap = dayMap.get(dayOfWeek)
  if (!periodMap) return false
  return periodMap.has(period)
}

/**
 * 标记时段为占用
 */
function markSlotOccupied(
  matrix: OccupancyMatrix,
  entityId: string,
  dayOfWeek: number,
  period: number,
  cellId: string
): void {
  if (!matrix.has(entityId)) {
    matrix.set(entityId, new Map())
  }
  const dayMap = matrix.get(entityId)!
  if (!dayMap.has(dayOfWeek)) {
    dayMap.set(dayOfWeek, new Map())
  }
  dayMap.get(dayOfWeek)!.set(period, cellId)
}

/**
 * 检查时段是否在避开列表中
 */
function isSlotInAvoidList(slot: TimeSlotRef, avoidSlots: TimeSlotRef[]): boolean {
  return avoidSlots.some(avoid => avoid.dayOfWeek === slot.dayOfWeek && avoid.period === slot.period)
}

/**
 * 检查是否可以将课程放在某时段
 * [P0-3] 增加学科禁排时段检查（SubjectTimeRule.must_not）
 */
function canPlaceCourse(
  context: SchedulingContext,
  teacherId: string,
  classId: string,
  dayOfWeek: number,
  period: number,
  teacher: Teacher | undefined,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subject?: string
): boolean {
  // 检查班级是否被占用
  if (isSlotOccupied(context.occupancy.classes, classId, dayOfWeek, period)) {
    return false
  }

  // 检查教师是否被占用（自习课的 teacherId 为空字符串时跳过此检查）
  if (teacherId && isSlotOccupied(context.occupancy.teachers, teacherId, dayOfWeek, period)) {
    return false
  }

  // 检查是否在教师的避开时段列表中
  if (teacher && isSlotInAvoidList({ dayOfWeek, period }, teacher.avoidTimeSlots)) {
    return false
  }

  // [P0-3 修复] 检查是否在学科的绝对禁排时段中
  if (subject && subjectForbiddenSlots) {
    const forbidden = subjectForbiddenSlots.get(subject)
    if (forbidden && forbidden.has(`${dayOfWeek}_${period}`)) {
      return false
    }
  }

  return true
}

/**
 * 检查连堂课是否可以放置
 */
function canPlaceConsecutive(
  context: SchedulingContext,
  teacherId: string,
  classId: string,
  dayOfWeek: number,
  startPeriod: number,
  count: number,
  teacher: Teacher | undefined,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subject?: string,
  periodsPerDay?: number
): boolean {
  // 检查起始节是否在合理范围内
  const maxPeriods = periodsPerDay || getPeriodsPerDay()
  if (startPeriod + count - 1 > maxPeriods) {
    return false
  }

  // 检查每个节次是否都可用
  for (let p = startPeriod; p < startPeriod + count; p++) {
    if (!canPlaceCourse(context, teacherId, classId, dayOfWeek, p, teacher, subjectForbiddenSlots, subject)) {
      return false
    }
  }

  return true
}

/**
 * 获取某班级某天某学科的已排课节数
 */
function getSubjectCountOnDay(
  distribution: Map<string, number>,
  classId: string,
  dayOfWeek: number,
  subject: string
): number {
  const key = `${classId}_${dayOfWeek}_${subject}`
  return distribution.get(key) || 0
}

/**
 * 增加某班级某天某学科的计数
 */
function incrementSubjectCount(
  distribution: Map<string, number>,
  classId: string,
  dayOfWeek: number,
  subject: string
): void {
  const key = `${classId}_${dayOfWeek}_${subject}`
  distribution.set(key, (distribution.get(key) || 0) + 1)
}

/**
 * 计算主科的标准日分布（每个班级的目标日分布）
 * 返回 Map<subject, Map<dayOfWeek, targetCount>>
 * 例如：语文6节/周，标准分布可能是 {1: 2, 2: 1, 3: 1, 4: 1, 5: 1}
 *
 * 注意：这里计算的是"目标分布"，所有班级都应该尽量遵循这个分布
 */
function calculateStandardDailyDistribution(
  curriculumItems: CurriculumItem[],
  mainSubjects: string[]
): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>()

  // 收集每个主科的周课时数（取众数或最常见的值）
  // 这样可以确保所有班级都使用相同的分布
  const subjectHoursList = new Map<string, number[]>()
  for (const item of curriculumItems) {
    if (mainSubjects.includes(item.subject)) {
      if (!subjectHoursList.has(item.subject)) {
        subjectHoursList.set(item.subject, [])
      }
      subjectHoursList.get(item.subject)!.push(item.weeklyHours)
    }
  }

  // 为每个主科计算标准日分布（使用最常见的周课时数）
  for (const [subject, hoursList] of subjectHoursList) {
    // 找出最常见的周课时数
    const hoursCount = new Map<number, number>()
    for (const hours of hoursList) {
      hoursCount.set(hours, (hoursCount.get(hours) || 0) + 1)
    }
    let mostCommonHours = 0
    let maxCount = 0
    for (const [hours, count] of hoursCount) {
      if (count > maxCount) {
        maxCount = count
        mostCommonHours = hours
      }
    }

    // 分配课时：先每天1节，剩余课时均匀分配到前几天
    const dayDistribution = new Map<number, number>()
    let remaining = mostCommonHours

    // 先给每天分配1节
    for (const day of DEFAULT_SCHOOL_DAYS) {
      if (remaining > 0) {
        dayDistribution.set(day, 1)
        remaining--
      }
    }

    // 剩余课时分配到前几天
    for (const day of DEFAULT_SCHOOL_DAYS) {
      if (remaining <= 0) break
      dayDistribution.set(day, (dayDistribution.get(day) || 0) + 1)
      remaining--
    }

    result.set(subject, dayDistribution)
  }

  return result
}

/**
 * 判断某节次是否为上午
 * 假设上午为1-4节，下午为5节及以后
 */
function isMorningPeriod(period: number, morningPeriodCount: number = 4): boolean {
  return period <= morningPeriodCount
}

/**
 * 获取教师在某节次的使用次数
 */
function getTeacherPeriodUsage(
  usage: Map<string, number>,
  teacherId: string,
  period: number
): number {
  const key = `${teacherId}_${period}`
  return usage.get(key) || 0
}

/**
 * 增加教师在某节次的使用次数
 */
function incrementTeacherPeriodUsage(
  usage: Map<string, number>,
  teacherId: string,
  period: number
): void {
  const key = `${teacherId}_${period}`
  usage.set(key, (usage.get(key) || 0) + 1)
}

/**
 * 获取教师+学科在某天某时段类型的排课数
 */
function getTeacherSubjectDaySlotCount(
  distribution: Map<string, number>,
  teacherId: string,
  subject: string,
  dayOfWeek: number,
  isMorning: boolean
): number {
  const key = `${teacherId}_${subject}_${dayOfWeek}_${isMorning ? 'morning' : 'afternoon'}`
  return distribution.get(key) || 0
}

/**
 * 增加教师+学科在某天某时段类型的排课数
 */
function incrementTeacherSubjectDaySlot(
  distribution: Map<string, number>,
  teacherId: string,
  subject: string,
  dayOfWeek: number,
  isMorning: boolean
): void {
  const key = `${teacherId}_${subject}_${dayOfWeek}_${isMorning ? 'morning' : 'afternoon'}`
  distribution.set(key, (distribution.get(key) || 0) + 1)
}

/**
 * 增加全校某学科在某天的已排课时数
 */
function incrementSchoolSubjectDayCount(
  distribution: Map<string, number>,
  subject: string,
  dayOfWeek: number
): void {
  const key = `${subject}_${dayOfWeek}`
  distribution.set(key, (distribution.get(key) || 0) + 1)
}

/**
 * 获取某班级某天某学科在上午/下午的已排课数
 */
function getClassDaySubjectMorningAfternoonCount(
  distribution: Map<string, number>,
  classId: string,
  dayOfWeek: number,
  subject: string,
  isMorning: boolean
): number {
  const key = `${classId}_${dayOfWeek}_${subject}_${isMorning ? 'morning' : 'afternoon'}`
  return distribution.get(key) || 0
}

/**
 * 增加某班级某天某学科在上午/下午的已排课数
 */
function incrementClassDaySubjectMorningAfternoon(
  distribution: Map<string, number>,
  classId: string,
  dayOfWeek: number,
  subject: string,
  isMorning: boolean
): void {
  const key = `${classId}_${dayOfWeek}_${subject}_${isMorning ? 'morning' : 'afternoon'}`
  distribution.set(key, (distribution.get(key) || 0) + 1)
}

/**
 * 获取某班级某天的主课总数
 */
function getClassDayMainSubjectCount(
  distribution: Map<string, number>,
  classId: string,
  dayOfWeek: number
): number {
  const key = `${classId}_${dayOfWeek}`
  return distribution.get(key) || 0
}

/**
 * 增加某班级某天的主课总数
 */
function incrementClassDayMainSubjectCount(
  distribution: Map<string, number>,
  classId: string,
  dayOfWeek: number
): void {
  const key = `${classId}_${dayOfWeek}`
  distribution.set(key, (distribution.get(key) || 0) + 1)
}

/**
 * 计算课程的约束程度（用于排序）
 */
function calculateConstraintScore(item: CurriculumItem): number {
  let score = 0

  // 有固定时段的优先级最高
  if (item.fixedSlots && item.fixedSlots.length > 0) {
    score += 1000
  }

  // 连堂课优先
  if (item.isConsecutive) {
    score += 500
  }

  // 课时多的优先
  score += item.weeklyHours * 10

  // 显式设置的优先级
  score += item.priority

  return score
}

/**
 * 排序课程条目（约束程度高的排前面）
 * 同时确保同一学科的课程在班级间公平分配
 */
function sortCurriculumItems(items: CurriculumItem[]): CurriculumItem[] {
  // 1. 按学科分组
  const itemsBySubject = new Map<string, CurriculumItem[]>()
  for (const item of items) {
    const subject = item.subject
    if (!itemsBySubject.has(subject)) {
      itemsBySubject.set(subject, [])
    }
    itemsBySubject.get(subject)!.push(item)
  }

  // 2. 在每个学科内部，按约束程度排序
  for (const [_, subjectItems] of itemsBySubject) {
    subjectItems.sort((a, b) => calculateConstraintScore(b) - calculateConstraintScore(a))
  }

  // 3. 按学科的约束程度排序（学科中最高约束程度的课程决定学科排序）
  const subjects = Array.from(itemsBySubject.keys()).sort((a, b) => {
    const aMaxScore = Math.max(...itemsBySubject.get(a)!.map(item => calculateConstraintScore(item)))
    const bMaxScore = Math.max(...itemsBySubject.get(b)!.map(item => calculateConstraintScore(item)))
    return bMaxScore - aMaxScore
  })

  // 4. 按班级轮流排课，确保公平分配
  // 收集所有班级ID
  const classIds = new Set<string>()
  for (const item of items) {
    classIds.add(item.classId)
  }
  const classIdList = Array.from(classIds)

  // 5. 为每个学科创建班级轮换队列
  // 每轮每个班级排1节，确保公平分配时段
  const result: CurriculumItem[] = []
  const classRoundRobinIndex = new Map<string, number>() // 学科 -> 当前轮到的班级索引

  // 初始化每个学科的班级轮换索引
  for (const subject of subjects) {
    classRoundRobinIndex.set(subject, 0)
  }

  // 6. 多轮排课：每轮每个学科的每个班级排1节
  let hasMoreItems = true
  while (hasMoreItems) {
    hasMoreItems = false

    for (const subject of subjects) {
      const subjectItems = itemsBySubject.get(subject)!
      if (subjectItems.length === 0) continue

      // 找到当前应该排课的班级
      const startIndex = classRoundRobinIndex.get(subject)!

      // 尝试为每个班级排1节（如果该班级还有该学科的课程）
      for (let i = 0; i < classIdList.length; i++) {
        const classIndex = (startIndex + i) % classIdList.length
        const targetClassId = classIdList[classIndex]

        // 找到该班级该学科的下一个待排课程
        const itemIndex = subjectItems.findIndex(item => item.classId === targetClassId)
        if (itemIndex !== -1) {
          result.push(subjectItems.splice(itemIndex, 1)[0])
          hasMoreItems = true
          // 更新轮换索引到下一个班级
          classRoundRobinIndex.set(subject, (classIndex + 1) % classIdList.length)
          break // 每轮每个学科只排1节，确保公平
        }
      }
    }
  }

  return result
}

/**
 * 生成单元格ID
 */
function generateCellId(classId: string, dayOfWeek: number, period: number): string {
  return `cell_${classId}_${dayOfWeek}_${period}`
}

/**
 * 创建课表单元格
 */
function createScheduleCell(
  item: CurriculumItem,
  dayOfWeek: DayOfWeek,
  period: number,
  isFixed: boolean
): ScheduleCell {
  return {
    id: generateCellId(item.classId, dayOfWeek, period),
    dayOfWeek,
    period,
    classId: item.classId,
    teacherId: item.teacherId,
    subject: item.subject,
    curriculumItemId: item.id,
    isFixed
  }
}

/**
 * 放置固定时段课程
 */
function placeFixedSlots(
  item: CurriculumItem,
  context: SchedulingContext,
  cells: ScheduleCell[],
  conflicts: ScheduleConflict[],
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  // 新增：主科优化追踪器
  schoolSubjectDayCount?: Map<string, number>,
  teacherSubjectDaySlots?: Map<string, number>,
  teacherPeriodUsage?: Map<string, number>,
  classDaySubjectMorningAfternoon?: Map<string, number>
): number {
  if (!item.fixedSlots || item.fixedSlots.length === 0) {
    return 0
  }

  // 检查是否是主科
  const isMainSubject = MAIN_SUBJECTS.includes(item.subject as Subject)
  const morningPeriodCount = 4

  let placed = 0
  for (const slot of item.fixedSlots) {
    const canPlace = canPlaceCourse(
      context,
      item.teacherId,
      item.classId,
      slot.dayOfWeek,
      slot.period,
      teacher,
      undefined,
      item.subject
    )

    if (canPlace) {
      const cell = createScheduleCell(item, slot.dayOfWeek as DayOfWeek, slot.period, true)
      cells.push(cell)

      // 更新占用矩阵（自习课的 teacherId 为空时不占用教师时间）
      if (item.teacherId) {
        markSlotOccupied(context.occupancy.teachers, item.teacherId, slot.dayOfWeek, slot.period, cell.id)
      }
      markSlotOccupied(context.occupancy.classes, item.classId, slot.dayOfWeek, slot.period, cell.id)

      // 更新学科分布
      incrementSubjectCount(subjectDistribution, item.classId, slot.dayOfWeek, item.subject)

      // 更新主科优化追踪器
      if (isMainSubject) {
        const isMorning = isMorningPeriod(slot.period, morningPeriodCount)

        // 更新全校学科日分布
        if (schoolSubjectDayCount) {
          incrementSchoolSubjectDayCount(schoolSubjectDayCount, item.subject, slot.dayOfWeek)
        }

        // 更新班级-天-学科-上午/下午分布
        if (classDaySubjectMorningAfternoon) {
          incrementClassDaySubjectMorningAfternoon(
            classDaySubjectMorningAfternoon, item.classId, slot.dayOfWeek, item.subject, isMorning
          )
        }

        // 更新教师-学科-天-时段分布
        if (teacherSubjectDaySlots && item.teacherId) {
          incrementTeacherSubjectDaySlot(
            teacherSubjectDaySlots, item.teacherId, item.subject, slot.dayOfWeek, isMorning
          )
        }

        // 更新教师节次使用频率
        if (teacherPeriodUsage && item.teacherId) {
          incrementTeacherPeriodUsage(teacherPeriodUsage, item.teacherId, slot.period)
        }
      }

      placed++
    } else {
      // 检查具体是什么原因导致无法放置
      const className = context.classes.get(item.classId)?.name || item.classId
      const reason = []

      // 检查班级占用
      if (isSlotOccupied(context.occupancy.classes, item.classId, slot.dayOfWeek, slot.period)) {
        reason.push('班级该时段已有课程')
      }
      // 检查教师占用（自习课跳过）
      if (item.teacherId && isSlotOccupied(context.occupancy.teachers, item.teacherId, slot.dayOfWeek, slot.period)) {
        reason.push('教师该时段已有课程')
      }
      // 检查教师避开时段
      if (teacher && isSlotInAvoidList({ dayOfWeek: slot.dayOfWeek, period: slot.period }, teacher.avoidTimeSlots)) {
        reason.push('教师避开该时段')
      }

      conflicts.push({
        id: `conflict_${item.id}_${slot.dayOfWeek}_${slot.period}`,
        type: ConflictType.ClassOverlap,
        severity: 'error',
        cellIds: [],
        message: `无法将 ${item.subject}（${className}）放置在固定时段 周${slot.dayOfWeek}第${slot.period}节`,
        suggestion: reason.join('；') || '未知原因'
      })
    }
  }

  return placed
}

/**
 * 找到最适合放置连堂课的时段
 * 优先选择当天该学科课程最少的日期
 * [P1-1] 当日已排数 >= dailyMax 时整天跳过
 * [P1-2] 根据 timePreference 对节次评分加成
 * [优化] 主科额外评分规则（与单节课类似，但简化处理）
 */
function findBestConsecutiveSlot(
  item: CurriculumItem,
  context: SchedulingContext,
  consecutiveCount: number,
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subjectDailyMax?: Map<string, number>,
  subjectTimePreference?: Map<string, string>,
  periodsPerDay?: number,
  // 新增：主科优化追踪器（连堂课不使用上下午分布检查）
  standardDailyDistribution?: Map<string, Map<number, number>>,
  teacherSubjectDaySlots?: Map<string, number>
): { dayOfWeek: number; startPeriod: number } | null {
  // 计算每天该学科的课程数
  const dayScores: { day: number; score: number; startPeriod: number }[] = []

  // [P1-1] 获取该学科的每日上限
  const dailyMax = subjectDailyMax?.get(item.subject)
  // [P1-2] 获取该学科的时段偏好
  const timePreference = subjectTimePreference?.get(item.subject)
  // 获取每天节次数
  const maxPeriods = periodsPerDay || getPeriodsPerDay()

  // 检查是否是主科
  const isMainSubject = MAIN_SUBJECTS.includes(item.subject as Subject)
  const morningPeriodCount = 4

  for (const day of DEFAULT_SCHOOL_DAYS) {
    // 计算当天该学科已有的课程数
    const currentCount = getSubjectCountOnDay(subjectDistribution, item.classId, day, item.subject)

    // [P1-1] 如果当天已达到每日上限，跳过整天
    if (dailyMax !== undefined && currentCount >= dailyMax) {
      continue
    }

    // 找到第一个可用的连堂时段
    let earliestPeriod = -1
    for (let startPeriod = 1; startPeriod <= maxPeriods - consecutiveCount + 1; startPeriod++) {
      if (canPlaceConsecutive(context, item.teacherId, item.classId, day, startPeriod, consecutiveCount, teacher, subjectForbiddenSlots, item.subject, maxPeriods)) {
        earliestPeriod = startPeriod
        break
      }
    }

    if (earliestPeriod > 0) {
      // [P1-2] 根据时段偏好计算加权分数
      let preferenceScore = 0
      if (timePreference === 'morning_only') {
        // 上午偏好：上午节次（1-4）加分，下午节次惩罚
        preferenceScore = earliestPeriod <= 4 ? -50 : 100
      } else if (timePreference === 'afternoon_only') {
        // 下午偏好：下午节次（5+）加分，上午节次惩罚
        preferenceScore = earliestPeriod > 4 ? -50 : 100
      }

      // 主科优化评分（连堂课简化处理，主要考虑全校进度同步）
      let mainSubjectScore = 0
      if (isMainSubject) {
        const isMorning = isMorningPeriod(earliestPeriod, morningPeriodCount)

        // 规则2：全校进度同步（比较该班级在该天的已排数与目标数）
        if (standardDailyDistribution) {
          const standardCount = standardDailyDistribution.get(item.subject)?.get(day) || 0
          // currentCount 已经在上面计算过了，是该班级该天该科的已排数

          if (currentCount < standardCount) {
            // 该班级该天还没达到目标课时数，大幅加分（鼓励选择这天）
            mainSubjectScore -= 150
          } else if (currentCount >= standardCount) {
            // 该班级该天已达到或超过目标课时数，惩罚（不鼓励选择这天）
            mainSubjectScore += 100
          }
        }

        // 规则3：教师进度同步
        if (teacherSubjectDaySlots && item.teacherId) {
          const teacherMorningCount = getTeacherSubjectDaySlotCount(
            teacherSubjectDaySlots, item.teacherId, item.subject, day, true
          )
          const teacherAfternoonCount = getTeacherSubjectDaySlotCount(
            teacherSubjectDaySlots, item.teacherId, item.subject, day, false
          )

          if (teacherMorningCount > teacherAfternoonCount) {
            if (isMorning) mainSubjectScore -= 100
          } else if (teacherAfternoonCount > teacherMorningCount) {
            if (!isMorning) mainSubjectScore -= 100
          }
        }
      }

      // 分数越低越好（当天该学科课程越少越好）
      dayScores.push({
        day,
        score: currentCount * 10 + (earliestPeriod - 1) + preferenceScore + mainSubjectScore,
        startPeriod: earliestPeriod
      })
    }
  }

  // 按分数排序（分数低的优先）
  dayScores.sort((a, b) => a.score - b.score)

  if (dayScores.length > 0) {
    return {
      dayOfWeek: dayScores[0].day,
      startPeriod: dayScores[0].startPeriod
    }
  }

  return null
}

/**
 * 放置连堂课（优化版：均匀分布）
 */
function placeConsecutiveCourse(
  item: CurriculumItem,
  context: SchedulingContext,
  cells: ScheduleCell[],
  remainingHours: number,
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subjectDailyMax?: Map<string, number>,
  subjectTimePreference?: Map<string, string>,
  periodsPerDay?: number,
  // 新增：主科优化追踪器
  standardDailyDistribution?: Map<string, Map<number, number>>,
  schoolSubjectDayCount?: Map<string, number>,
  teacherSubjectDaySlots?: Map<string, number>,
  teacherPeriodUsage?: Map<string, number>,
  classDaySubjectMorningAfternoon?: Map<string, number>,
  classDayMainSubjectCount?: Map<string, number>
): number {
  const consecutiveCount = item.consecutiveCount || 2
  const groupsToPlace = Math.floor(remainingHours / consecutiveCount)
  const maxPeriods = periodsPerDay || getPeriodsPerDay()
  const morningPeriodCount = 4

  // 检查是否是主科
  const isMainSubject = MAIN_SUBJECTS.includes(item.subject as Subject)

  let placed = 0

  for (let g = 0; g < groupsToPlace; g++) {
    const bestSlot = findBestConsecutiveSlot(
      item, context, consecutiveCount, teacher, subjectDistribution,
      subjectForbiddenSlots, subjectDailyMax, subjectTimePreference, maxPeriods,
      standardDailyDistribution, teacherSubjectDaySlots
    )

    if (bestSlot) {
      // 放置连堂课
      for (let p = bestSlot.startPeriod; p < bestSlot.startPeriod + consecutiveCount; p++) {
        const cell = createScheduleCell(item, bestSlot.dayOfWeek, p, false)
        cells.push(cell)

        // 更新占用矩阵（自习课的 teacherId 为空时不占用教师时间）
        if (item.teacherId) {
          markSlotOccupied(context.occupancy.teachers, item.teacherId, bestSlot.dayOfWeek, p, cell.id)
        }
        markSlotOccupied(context.occupancy.classes, item.classId, bestSlot.dayOfWeek, p, cell.id)

        incrementSubjectCount(subjectDistribution, item.classId, bestSlot.dayOfWeek, item.subject)

        // 更新主科优化追踪器
        if (isMainSubject) {
          const isMorning = isMorningPeriod(p, morningPeriodCount)

          // 更新全校学科日分布
          if (schoolSubjectDayCount) {
            incrementSchoolSubjectDayCount(schoolSubjectDayCount, item.subject, bestSlot.dayOfWeek)
          }

          // 更新班级-天-学科-上午/下午分布
          if (classDaySubjectMorningAfternoon) {
            incrementClassDaySubjectMorningAfternoon(
              classDaySubjectMorningAfternoon, item.classId, bestSlot.dayOfWeek, item.subject, isMorning
            )
          }

          // 更新班级每天主课总数
          if (classDayMainSubjectCount) {
            incrementClassDayMainSubjectCount(classDayMainSubjectCount, item.classId, bestSlot.dayOfWeek)
          }

          // 更新教师-学科-天-时段分布
          if (teacherSubjectDaySlots && item.teacherId) {
            incrementTeacherSubjectDaySlot(
              teacherSubjectDaySlots, item.teacherId, item.subject, bestSlot.dayOfWeek, isMorning
            )
          }

          // 更新教师节次使用频率
          if (teacherPeriodUsage && item.teacherId) {
            incrementTeacherPeriodUsage(teacherPeriodUsage, item.teacherId, p)
          }
        }

        placed++
      }
    } else {
      break // 无法找到合适的时段
    }
  }

  return placed
}

/**
 * 找到最适合放置单节课的时段
 * 优先选择当天该学科课程最少的日期
 * [P1-1] 当日已排数 >= dailyMax 时整天跳过
 * [P1-2] 根据 timePreference 对节次评分加成
 * [优化] 主科额外评分规则：
 *   - 同日同科上下午分布（权重最高 -500/+400）
 *   - 每日主课上限（权重次高 -200/+150）
 *   - 全校进度同步（权重中等 -150/+100）
 *   - 教师进度同步（权重较低 -100）
 *   - 教师节次分散（权重最低 +30/次）
 */
function findBestRegularSlot(
  item: CurriculumItem,
  context: SchedulingContext,
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subjectDailyMax?: Map<string, number>,
  subjectTimePreference?: Map<string, string>,
  periodsPerDay?: number,
  // 新增：主科优化追踪器
  standardDailyDistribution?: Map<string, Map<number, number>>,
  teacherSubjectDaySlots?: Map<string, number>,
  teacherPeriodUsage?: Map<string, number>,
  classDaySubjectMorningAfternoon?: Map<string, number>,
  classDayMainSubjectCount?: Map<string, number>
): { dayOfWeek: number; period: number } | null {
  // 计算每天该学科的课程数
  const slotScores: { day: number; period: number; score: number }[] = []

  // [P1-1] 获取该学科的每日上限
  const dailyMax = subjectDailyMax?.get(item.subject)
  // [P1-2] 获取该学科的时段偏好
  const timePreference = subjectTimePreference?.get(item.subject)
  // 获取每天节次数
  const maxPeriods = periodsPerDay || getPeriodsPerDay()

  // 检查是否是主科
  const isMainSubject = MAIN_SUBJECTS.includes(item.subject as Subject)

  // 上午节次数量（假设1-4节是上午）
  const morningPeriodCount = 4

  for (const day of DEFAULT_SCHOOL_DAYS) {
    // 计算当天该学科已有的课程数
    const currentCount = getSubjectCountOnDay(subjectDistribution, item.classId, day, item.subject)

    // [P1-1] 如果当天已达到每日上限，跳过整天
    if (dailyMax !== undefined && currentCount >= dailyMax) {
      continue
    }

    for (let period = 1; period <= maxPeriods; period++) {
      if (canPlaceCourse(context, item.teacherId, item.classId, day, period, teacher, subjectForbiddenSlots, item.subject)) {
        // [P1-2] 根据时段偏好计算加权分数
        let preferenceScore = 0
        if (timePreference === 'morning_only') {
          // 上午偏好：上午节次（1-4）加分（降低分数），下午节次惩罚
          preferenceScore = period <= 4 ? -50 : 100
        } else if (timePreference === 'afternoon_only') {
          // 下午偏好：下午节次（5+）加分，上午节次惩罚
          preferenceScore = period > 4 ? -50 : 100
        }

        // 自习课特殊处理：倾向于选择后面的节次（最后一节最优）
        // 将 period 反向加权，越靠后的节次分数越低
        let periodScore = period
        if (item.subject === Subject.SelfStudy) {
          periodScore = (maxPeriods - period + 1) * 10 // 最后一节得分最低（最优），第1节得分最高
        }

        // 主科优化评分
        let mainSubjectScore = 0
        if (isMainSubject) {
          const isMorning = isMorningPeriod(period, morningPeriodCount)

          // 规则1：同日同科上下午分布（权重最高）
          // 如果当天已有课程，必须分布在上午和下午
          if (classDaySubjectMorningAfternoon) {
            const existingMorningCount = getClassDaySubjectMorningAfternoonCount(
              classDaySubjectMorningAfternoon, item.classId, day, item.subject, true
            )
            const existingAfternoonCount = getClassDaySubjectMorningAfternoonCount(
              classDaySubjectMorningAfternoon, item.classId, day, item.subject, false
            )

            if (existingMorningCount > 0 && existingAfternoonCount === 0) {
              // 已有上午课，没有下午课
              if (!isMorning) {
                // 选择下午时段：大幅加分（鼓励）
                mainSubjectScore -= 500
              } else {
                // 选择上午时段：大幅惩罚（避免都集中在上午）
                mainSubjectScore += 400
              }
            } else if (existingAfternoonCount > 0 && existingMorningCount === 0) {
              // 已有下午课，没有上午课
              if (isMorning) {
                // 选择上午时段：大幅加分（鼓励）
                mainSubjectScore -= 500
              } else {
                // 选择下午时段：大幅惩罚（避免都集中在下午）
                mainSubjectScore += 400
              }
            }
          }

          // 规则1.5：每日主课上限（权重次高）
          // 限制每天的主课总数，让主课均匀分布在一周
          // 假设每天最多3节主课（语数外共3门，每门每天最多1节，或其中一门2节）
          if (classDayMainSubjectCount) {
            const dailyMainSubjectCount = getClassDayMainSubjectCount(
              classDayMainSubjectCount, item.classId, day
            )
            // 每天主课上限设为3节
            const maxMainSubjectsPerDay = 3

            if (dailyMainSubjectCount >= maxMainSubjectsPerDay) {
              // 当天主课已满，大幅惩罚（尽量避免）
              mainSubjectScore += 300
            } else if (dailyMainSubjectCount >= maxMainSubjectsPerDay - 1) {
              // 当天主课快满了，适度惩罚
              mainSubjectScore += 150
            } else {
              // 当天主课还不多，鼓励选择这天
              mainSubjectScore -= 200
            }
          }

          // 规则2：全校进度同步（权重次高）
          // 比较该班级在该天的已排数与目标数，让所有班级都遵循相同的目标分布
          if (standardDailyDistribution) {
            const standardCount = standardDailyDistribution.get(item.subject)?.get(day) || 0
            // currentCount 已经在上面计算过了，是该班级该天该科的已排数

            if (currentCount < standardCount) {
              // 该班级该天还没达到目标课时数，鼓励选择这天
              mainSubjectScore -= 200
            } else if (currentCount >= standardCount) {
              // 该班级该天已达到或超过目标课时数，大幅惩罚（不鼓励选择这天）
              // 这个权重必须足够大，确保不会超过目标分布
              mainSubjectScore += 400
            }
          }

          // 规则3：教师进度同步（权重较低 -100）
          if (teacherSubjectDaySlots && item.teacherId) {
            const teacherMorningCount = getTeacherSubjectDaySlotCount(
              teacherSubjectDaySlots, item.teacherId, item.subject, day, true
            )
            const teacherAfternoonCount = getTeacherSubjectDaySlotCount(
              teacherSubjectDaySlots, item.teacherId, item.subject, day, false
            )

            if (teacherMorningCount > teacherAfternoonCount) {
              // 其他班多在上午，给上午加分
              if (isMorning) mainSubjectScore -= 100
            } else if (teacherAfternoonCount > teacherMorningCount) {
              // 其他班多在下午，给下午加分
              if (!isMorning) mainSubjectScore -= 100
            }
          }

          // 规则4：教师节次分散（权重最低 +30/次）
          if (teacherPeriodUsage && item.teacherId) {
            const periodUsage = getTeacherPeriodUsage(teacherPeriodUsage, item.teacherId, period)
            mainSubjectScore += periodUsage * 30  // 每多用一次，分数增加30
          }
        }

        // 分数越低越好
        // 当天该学科课程越少越好
        // 普通课程：节次越靠前越好（period 小）
        // 自习课：节次越靠后越好（period 大，但 periodScore 让它变优）
        slotScores.push({
          day,
          period,
          score: currentCount * 100 + periodScore + preferenceScore + mainSubjectScore
        })
      }
    }
  }

  // 按分数排序（分数低的优先）
  slotScores.sort((a, b) => a.score - b.score)

  if (slotScores.length > 0) {
    return {
      dayOfWeek: slotScores[0].day,
      period: slotScores[0].period
    }
  }

  return null
}

/**
 * 放置普通课程（优化版：均匀分布）
 */
function placeRegularCourse(
  item: CurriculumItem,
  context: SchedulingContext,
  cells: ScheduleCell[],
  remainingHours: number,
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subjectDailyMax?: Map<string, number>,
  subjectTimePreference?: Map<string, string>,
  periodsPerDay?: number,
  // 新增：主科优化追踪器
  standardDailyDistribution?: Map<string, Map<number, number>>,
  schoolSubjectDayCount?: Map<string, number>,
  teacherSubjectDaySlots?: Map<string, number>,
  teacherPeriodUsage?: Map<string, number>,
  classDaySubjectMorningAfternoon?: Map<string, number>,
  classDayMainSubjectCount?: Map<string, number>
): number {
  let placed = 0
  const maxPeriods = periodsPerDay || getPeriodsPerDay()
  const morningPeriodCount = 4

  // 检查是否是主科
  const isMainSubject = MAIN_SUBJECTS.includes(item.subject as Subject)

  while (placed < remainingHours) {
    const bestSlot = findBestRegularSlot(
      item, context, teacher, subjectDistribution,
      subjectForbiddenSlots, subjectDailyMax, subjectTimePreference, maxPeriods,
      standardDailyDistribution, teacherSubjectDaySlots,
      teacherPeriodUsage, classDaySubjectMorningAfternoon, classDayMainSubjectCount
    )

    if (bestSlot) {
      const cell = createScheduleCell(item, bestSlot.dayOfWeek, bestSlot.period, false)
      cells.push(cell)

      // 更新占用矩阵（自习课的 teacherId 为空时不占用教师时间）
      if (item.teacherId) {
        markSlotOccupied(context.occupancy.teachers, item.teacherId, bestSlot.dayOfWeek, bestSlot.period, cell.id)
      }
      markSlotOccupied(context.occupancy.classes, item.classId, bestSlot.dayOfWeek, bestSlot.period, cell.id)

      incrementSubjectCount(subjectDistribution, item.classId, bestSlot.dayOfWeek, item.subject)

      // 更新主科优化追踪器
      if (isMainSubject) {
        const isMorning = isMorningPeriod(bestSlot.period, morningPeriodCount)

        // 更新全校学科日分布
        if (schoolSubjectDayCount) {
          incrementSchoolSubjectDayCount(schoolSubjectDayCount, item.subject, bestSlot.dayOfWeek)
        }

        // 更新班级-天-学科-上午/下午分布
        if (classDaySubjectMorningAfternoon) {
          incrementClassDaySubjectMorningAfternoon(
            classDaySubjectMorningAfternoon, item.classId, bestSlot.dayOfWeek, item.subject, isMorning
          )
        }

        // 更新教师-学科-天-时段分布
        if (teacherSubjectDaySlots && item.teacherId) {
          incrementTeacherSubjectDaySlot(
            teacherSubjectDaySlots, item.teacherId, item.subject, bestSlot.dayOfWeek, isMorning
          )
        }

        // 更新教师节次使用频率
        if (teacherPeriodUsage && item.teacherId) {
          incrementTeacherPeriodUsage(teacherPeriodUsage, item.teacherId, bestSlot.period)
        }

        // 更新班级每天主课总数
        if (classDayMainSubjectCount) {
          incrementClassDayMainSubjectCount(classDayMainSubjectCount, item.classId, bestSlot.dayOfWeek)
        }
      }

      placed++
    } else {
      break // 无法找到合适的时段
    }
  }

  return placed
}

/**
 * 填充班级的空缺时段
 * 当某些课程因为禁排规则无法排在某个时段时，尝试用交换策略填充
 * 策略：找到空缺时段，然后找到该班级在该时段可以排的课程，
 * 如果该课程在其他时段有课，尝试交换位置
 */
function fillEmptySlots(
  classes: SchoolClass[],
  context: SchedulingContext,
  allCells: ScheduleCell[],
  curriculumItems: CurriculumItem[],
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<string, Set<string>>,
  subjectDailyMax?: Map<string, number>,
  _subjectTimePreference?: Map<string, string>,
  periodsPerDay?: number
): void {
  const maxPeriods = periodsPerDay || getPeriodsPerDay()
  const teacherMap = context.teachers
  const teacherByEmployeeId = new Map<string, Teacher>()
  for (const teacher of teacherMap.values()) {
    if (teacher.employeeId) {
      teacherByEmployeeId.set(teacher.employeeId, teacher)
    }
  }

  // 遍历每个班级，找出空缺时段并尝试填充
  for (const cls of classes) {
    const classId = cls.id
    const classCells = allCells.filter(c => c.classId === classId)
    const classItems = curriculumItems.filter(item => item.classId === classId)

    // 找出该班级的所有空缺时段（只检查1-7节，8-9节是自习课）
    for (const emptyDay of DEFAULT_SCHOOL_DAYS) {
      for (let emptyPeriod = 1; emptyPeriod <= Math.min(7, maxPeriods); emptyPeriod++) {
        // 检查这个时段是否已经被占用
        if (isSlotOccupied(context.occupancy.classes, classId, emptyDay, emptyPeriod)) {
          continue
        }

        // 这是一个空缺时段，尝试找到可以排在这里的课程
        // 策略：找到该班级所有课程中，可以排在这个空缺时段的课程
        for (const item of classItems) {
          const teacher = teacherMap.get(item.teacherId) || teacherByEmployeeId.get(item.teacherId)

          // 检查这个课程是否可以排在这个空缺时段
          if (!canPlaceCourse(context, item.teacherId, classId, emptyDay, emptyPeriod, teacher, subjectForbiddenSlots, item.subject)) {
            continue
          }

          // 检查每日上限
          const dailyMax = subjectDailyMax?.get(item.subject)
          if (dailyMax !== undefined) {
            const currentCount = getSubjectCountOnDay(subjectDistribution, classId, emptyDay, item.subject)
            if (currentCount >= dailyMax) {
              continue
            }
          }

          // 这个课程可以排在空缺时段
          // 但该课程已经排满了周课时，需要找一个已排的时段来交换
          // 找到该课程已排的时段中，可以被其他禁排课程填充的时段
          const itemCells = classCells.filter(c => c.curriculumItemId === item.id && !c.isFixed)

          for (const existingCell of itemCells) {
            const existingDay = existingCell.dayOfWeek
            const existingPeriod = existingCell.period

            // 尝试找到另一个课程可以填充 existingCell 的时段
            for (const otherItem of classItems) {
              if (otherItem.id === item.id) continue

              const otherTeacher = teacherMap.get(otherItem.teacherId) || teacherByEmployeeId.get(otherItem.teacherId)

              // 检查 otherItem 是否可以排在 existingCell 的位置
              // 需要临时释放 existingCell 的占用
              // 先检查 otherItem 是否在 existingCell 时段被禁排
              const forbidden = subjectForbiddenSlots?.get(otherItem.subject)
              if (forbidden && forbidden.has(`${existingDay}_${existingPeriod}`)) {
                // otherItem 在这个时段被禁排，不能交换
                continue
              }

              // 检查 otherItem 的教师是否可以在 existingCell 时段上课
              if (otherItem.teacherId && isSlotOccupied(context.occupancy.teachers, otherItem.teacherId, existingDay, existingPeriod)) {
                continue
              }

              // 检查 otherItem 的教师避开时段
              if (otherTeacher && isSlotInAvoidList({ dayOfWeek: existingDay, period: existingPeriod }, otherTeacher.avoidTimeSlots)) {
                continue
              }

              // 检查每日上限
              const otherDailyMax = subjectDailyMax?.get(otherItem.subject)
              if (otherDailyMax !== undefined) {
                const currentCount = getSubjectCountOnDay(subjectDistribution, classId, existingDay, otherItem.subject)
                if (currentCount >= otherDailyMax) {
                  continue
                }
              }

              // 可以交换！
              // 1. 将 item 从 existingCell 移动到空缺时段
              // 2. 将 otherItem 放到 existingCell 的位置

              // 释放 existingCell 的占用
              context.occupancy.classes.get(classId)?.get(existingDay)?.delete(existingPeriod)
              if (item.teacherId) {
                context.occupancy.teachers.get(item.teacherId)?.get(existingDay)?.delete(existingPeriod)
              }

              // 更新 existingCell 为 otherItem
              existingCell.teacherId = otherItem.teacherId
              existingCell.subject = otherItem.subject
              existingCell.curriculumItemId = otherItem.id

              // 标记 otherItem 占用 existingCell 时段
              if (otherItem.teacherId) {
                markSlotOccupied(context.occupancy.teachers, otherItem.teacherId, existingDay, existingPeriod, existingCell.id)
              }
              markSlotOccupied(context.occupancy.classes, classId, existingDay, existingPeriod, existingCell.id)
              incrementSubjectCount(subjectDistribution, classId, existingDay, otherItem.subject)

              // 创建 item 的新单元格在空缺时段
              const newCell = createScheduleCell(item, emptyDay, emptyPeriod, false)
              allCells.push(newCell)

              // 标记 item 占用空缺时段
              if (item.teacherId) {
                markSlotOccupied(context.occupancy.teachers, item.teacherId, emptyDay, emptyPeriod, newCell.id)
              }
              markSlotOccupied(context.occupancy.classes, classId, emptyDay, emptyPeriod, newCell.id)
              incrementSubjectCount(subjectDistribution, classId, emptyDay, item.subject)

              // 交换成功，跳出所有循环
              break
            }
            break
          }
        }
      }
    }
  }
}

/**
 * 执行贪心排课算法（优化版）
 */
export function runGreedyScheduler(
  teachers: Teacher[],
  classes: SchoolClass[],
  curriculumItems: CurriculumItem[],
  academicYear: string = '2024-2025',
  semester: number = 1
): SchoolSchedule {
  // 构建教师索引
  const teacherMap = new Map<string, Teacher>()
  const teacherByEmployeeId = new Map<string, Teacher>()
  for (const teacher of teachers) {
    teacherMap.set(teacher.id, teacher)
    teacherByEmployeeId.set(teacher.employeeId, teacher)
  }

  // 构建班级索引
  const classMap = new Map<string, SchoolClass>()
  for (const cls of classes) {
    classMap.set(cls.id, cls)
  }

  // 初始化排课上下文
  const context: SchedulingContext = {
    teachers: teacherMap,
    classes: classMap,
    curriculum: new Map(curriculumItems.map(item => [item.id, item])),
    fixedCells: [],
    occupancy: {
      teachers: createOccupancyMatrix(),
      classes: createOccupancyMatrix()
    }
  }

  // 学科分布追踪器
  const subjectDistribution = new Map<string, number>()

  // [P0-3 / P1-1 / P1-2] 从 ruleStore 构建学科级禁排、每日上限、时段偏好的查找表
  const { subjectTimeRules, subjectRules: allSubjectRules, scheduleConfig } = useRuleStore.getState()
  const periodsPerDay = scheduleConfig.periodsPerDay

  // [P0-3] 学科绝对禁排时段： subject → Set<"dayOfWeek_period">
  const subjectForbiddenSlots = new Map<string, Set<string>>()
  for (const rule of subjectTimeRules) {
    if (rule.type === 'must_not') {
      const subject = rule.subject as Subject
      if (!subjectForbiddenSlots.has(subject)) {
        subjectForbiddenSlots.set(subject, new Set())
      }
      subjectForbiddenSlots.get(subject)!.add(`${rule.dayOfWeek}_${rule.period}`)
    }
  }

  // [P1-1] 学科每日最大课时数： subject → dailyMax
  const subjectDailyMax = new Map<string, number>()
  for (const rule of allSubjectRules) {
    if (rule.dailyMax !== undefined) {
      subjectDailyMax.set(rule.subject, rule.dailyMax)
    }
  }

  // [P1-2] 学科时段偏好： subject → 'morning_only' | 'afternoon_only' | 'no_preference'
  const subjectTimePreference = new Map<string, string>()
  for (const rule of allSubjectRules) {
    if (rule.timePreference && rule.timePreference !== 'no_preference') {
      subjectTimePreference.set(rule.subject, rule.timePreference)
    }
  }

  // [主科优化] 计算主科的标准日分布
  const standardDailyDistribution = calculateStandardDailyDistribution(curriculumItems, MAIN_SUBJECTS)

  // [主科优化] 初始化新增的追踪器
  // 追踪全校每个学科每天已排的课时数（用于全校进度同步）
  const schoolSubjectDayCount = new Map<string, number>()

  // 追踪每个班级每天每学科在上午/下午的分布（用于同日同科上下午分布）
  const classDaySubjectMorningAfternoon = new Map<string, number>()

  // 追踪每个班级每天的主课总数（用于每日主课上限）
  const classDayMainSubjectCount = new Map<string, number>()

  // 追踪每个教师+学科组合在某天的时段分布（用于教师进度同步）
  const teacherSubjectDaySlots = new Map<string, number>()

  // 追踪每个教师在每个节次的使用频率（用于教师节次分散）
  const teacherPeriodUsage = new Map<string, number>()

  // 排序课程条目
  const sortedItems = sortCurriculumItems(curriculumItems)

  // 存储所有单元格和冲突
  const allCells: ScheduleCell[] = []
  const allConflicts: ScheduleConflict[] = []

  // 按优先级排课
  for (const item of sortedItems) {
    const teacher = teacherMap.get(item.teacherId) || teacherByEmployeeId.get(item.teacherId)
    let remainingHours = item.weeklyHours

    // 1. 放置固定时段课程
    if (item.fixedSlots && item.fixedSlots.length > 0) {
      const fixedPlaced = placeFixedSlots(
        item, context, allCells, allConflicts, teacher, subjectDistribution,
        schoolSubjectDayCount, teacherSubjectDaySlots, teacherPeriodUsage, classDaySubjectMorningAfternoon
      )
      remainingHours -= fixedPlaced
    }

    // 2. 如果是连堂课，优先处理连堂
    if (item.isConsecutive && remainingHours > 0) {
      const consecutivePlaced = placeConsecutiveCourse(
        item, context, allCells, remainingHours, teacher, subjectDistribution,
        subjectForbiddenSlots, subjectDailyMax, subjectTimePreference, periodsPerDay,
        standardDailyDistribution, schoolSubjectDayCount, teacherSubjectDaySlots,
        teacherPeriodUsage, classDaySubjectMorningAfternoon, classDayMainSubjectCount
      )
      remainingHours -= consecutivePlaced
    }

    // 3. 放置剩余的普通课程（均匀分布）
    if (remainingHours > 0) {
      const regularPlaced = placeRegularCourse(
        item, context, allCells, remainingHours, teacher, subjectDistribution,
        subjectForbiddenSlots, subjectDailyMax, subjectTimePreference, periodsPerDay,
        standardDailyDistribution, schoolSubjectDayCount, teacherSubjectDaySlots,
        teacherPeriodUsage, classDaySubjectMorningAfternoon, classDayMainSubjectCount
      )
      remainingHours -= regularPlaced
    }

    // 4. 如果还有未排的课程，记录警告
    if (remainingHours > 0) {
      allConflicts.push({
        id: `conflict_${item.id}_incomplete`,
        type: ConflictType.ClassOverlap,
        severity: 'warning',
        cellIds: [],
        message: `课程 ${item.subject} 还有 ${remainingHours} 节未能安排`,
        suggestion: '请检查教师可用时段或增加可用时段'
      })
    }
  }

  // 5. 填充空缺时段（当某些课程因禁排规则无法排在某时段时，用其他课程填充）
  fillEmptySlots(
    classes,
    context,
    allCells,
    curriculumItems,
    subjectDistribution,
    subjectForbiddenSlots,
    subjectDailyMax,
    subjectTimePreference,
    periodsPerDay
  )

  // 按班级组织课表
  const classSchedules: ClassSchedule[] = []
  const cellsByClass = new Map<string, ScheduleCell[]>()

  for (const cell of allCells) {
    if (!cellsByClass.has(cell.classId)) {
      cellsByClass.set(cell.classId, [])
    }
    cellsByClass.get(cell.classId)!.push(cell)
  }

  for (const [classId, cells] of cellsByClass) {
    const classConflicts = allConflicts.filter(c =>
      cells.some(cell => cell.classId === classId) ||
      c.message.includes(classId)
    )

    classSchedules.push({
      id: `schedule_${classId}`,
      classId,
      academicYear,
      semester,
      cells,
      isValid: classConflicts.filter(c => c.severity === 'error').length === 0,
      conflicts: classConflicts
    })
  }

  // 构建学校总课表
  const schoolSchedule: SchoolSchedule = {
    id: `school_schedule_${academicYear}_${semester}`,
    academicYear,
    semester,
    classSchedules,
    generatedAt: new Date(),
    algorithmVersion: 'greedy_v2.0_distributed'
  }

  return schoolSchedule
}

/**
 * 验证课表是否有冲突
 */
export function validateSchedule(schedule: SchoolSchedule): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  // 检查每个班级课表
  for (const classSchedule of schedule.classSchedules) {
    conflicts.push(...classSchedule.conflicts)

    // 检查班级内部是否有重复时段
    const slotMap = new Map<string, ScheduleCell[]>()
    for (const cell of classSchedule.cells) {
      const key = `${cell.dayOfWeek}_${cell.period}`
      if (!slotMap.has(key)) {
        slotMap.set(key, [])
      }
      slotMap.get(key)!.push(cell)
    }

    for (const [key, cells] of slotMap) {
      if (cells.length > 1) {
        conflicts.push({
          id: `conflict_duplicate_${classSchedule.classId}_${key}`,
          type: ConflictType.ClassOverlap,
          severity: 'error',
          cellIds: cells.map(c => c.id),
          message: `班级 ${classSchedule.classId} 在 ${key} 时段有重复课程`
        })
      }
    }
  }

  // 检查教师跨班级冲突
  const teacherSlotMap = new Map<string, ScheduleCell[]>()
  for (const classSchedule of schedule.classSchedules) {
    for (const cell of classSchedule.cells) {
      const key = `${cell.teacherId}_${cell.dayOfWeek}_${cell.period}`
      if (!teacherSlotMap.has(key)) {
        teacherSlotMap.set(key, [])
      }
      teacherSlotMap.get(key)!.push(cell)
    }
  }

  for (const [key, cells] of teacherSlotMap) {
    if (cells.length > 1) {
      conflicts.push({
        id: `conflict_teacher_${key}`,
        type: ConflictType.TeacherOverlap,
        severity: 'error',
        cellIds: cells.map(c => c.id),
        message: `教师 ${cells[0].teacherId} 在相同时段有多个班级的课程`
      })
    }
  }

  return conflicts
}
