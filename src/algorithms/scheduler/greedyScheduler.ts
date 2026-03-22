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
import { DayOfWeek, Subject, DEFAULT_PERIODS_PER_DAY, DEFAULT_SCHOOL_DAYS } from '@/data/constants'
import { useRuleStore } from '@/stores/ruleStore'

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
  subjectForbiddenSlots?: Map<Subject, Set<string>>,
  subject?: Subject
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
  subjectForbiddenSlots?: Map<Subject, Set<string>>,
  subject?: Subject
): boolean {
  // 检查起始节是否在合理范围内
  if (startPeriod + count - 1 > DEFAULT_PERIODS_PER_DAY) {
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
  subject: Subject
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
  subject: Subject
): void {
  const key = `${classId}_${dayOfWeek}_${subject}`
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
 */
function sortCurriculumItems(items: CurriculumItem[]): CurriculumItem[] {
  return [...items].sort((a, b) => calculateConstraintScore(b) - calculateConstraintScore(a))
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
  subjectDistribution: Map<string, number>
): number {
  if (!item.fixedSlots || item.fixedSlots.length === 0) {
    return 0
  }

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
 */
function findBestConsecutiveSlot(
  item: CurriculumItem,
  context: SchedulingContext,
  consecutiveCount: number,
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<Subject, Set<string>>,
  subjectDailyMax?: Map<Subject, number>,
  subjectTimePreference?: Map<Subject, string>
): { dayOfWeek: number; startPeriod: number } | null {
  // 计算每天该学科的课程数
  const dayScores: { day: number; score: number; startPeriod: number }[] = []

  // [P1-1] 获取该学科的每日上限
  const dailyMax = subjectDailyMax?.get(item.subject)
  // [P1-2] 获取该学科的时段偏好
  const timePreference = subjectTimePreference?.get(item.subject)

  for (const day of DEFAULT_SCHOOL_DAYS) {
    // 计算当天该学科已有的课程数
    const currentCount = getSubjectCountOnDay(subjectDistribution, item.classId, day, item.subject)

    // [P1-1] 如果当天已达到每日上限，跳过整天
    if (dailyMax !== undefined && currentCount >= dailyMax) {
      continue
    }

    // 找到第一个可用的连堂时段
    let earliestPeriod = -1
    for (let startPeriod = 1; startPeriod <= DEFAULT_PERIODS_PER_DAY - consecutiveCount + 1; startPeriod++) {
      if (canPlaceConsecutive(context, item.teacherId, item.classId, day, startPeriod, consecutiveCount, teacher, subjectForbiddenSlots, item.subject)) {
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

      // 分数越低越好（当天该学科课程越少越好）
      dayScores.push({
        day,
        score: currentCount * 10 + (earliestPeriod - 1) + preferenceScore,
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
  subjectForbiddenSlots?: Map<Subject, Set<string>>,
  subjectDailyMax?: Map<Subject, number>,
  subjectTimePreference?: Map<Subject, string>
): number {
  const consecutiveCount = item.consecutiveCount || 2
  const groupsToPlace = Math.floor(remainingHours / consecutiveCount)

  let placed = 0

  for (let g = 0; g < groupsToPlace; g++) {
    const bestSlot = findBestConsecutiveSlot(item, context, consecutiveCount, teacher, subjectDistribution, subjectForbiddenSlots, subjectDailyMax, subjectTimePreference)

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
 */
function findBestRegularSlot(
  item: CurriculumItem,
  context: SchedulingContext,
  teacher: Teacher | undefined,
  subjectDistribution: Map<string, number>,
  subjectForbiddenSlots?: Map<Subject, Set<string>>,
  subjectDailyMax?: Map<Subject, number>,
  subjectTimePreference?: Map<Subject, string>
): { dayOfWeek: number; period: number } | null {
  // 计算每天该学科的课程数
  const slotScores: { day: number; period: number; score: number }[] = []

  // [P1-1] 获取该学科的每日上限
  const dailyMax = subjectDailyMax?.get(item.subject)
  // [P1-2] 获取该学科的时段偏好
  const timePreference = subjectTimePreference?.get(item.subject)

  for (const day of DEFAULT_SCHOOL_DAYS) {
    // 计算当天该学科已有的课程数
    const currentCount = getSubjectCountOnDay(subjectDistribution, item.classId, day, item.subject)

    // [P1-1] 如果当天已达到每日上限，跳过整天
    if (dailyMax !== undefined && currentCount >= dailyMax) {
      continue
    }

    for (let period = 1; period <= DEFAULT_PERIODS_PER_DAY; period++) {
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
          periodScore = (DEFAULT_PERIODS_PER_DAY - period + 1) * 10 // 第8节得分最低（最优），第1节得分最高
        }

        // 分数越低越好
        // 当天该学科课程越少越好
        // 普通课程：节次越靠前越好（period 小）
        // 自习课：节次越靠后越好（period 大，但 periodScore 让它变优）
        slotScores.push({
          day,
          period,
          score: currentCount * 100 + periodScore + preferenceScore
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
  subjectForbiddenSlots?: Map<Subject, Set<string>>,
  subjectDailyMax?: Map<Subject, number>,
  subjectTimePreference?: Map<Subject, string>
): number {
  let placed = 0

  while (placed < remainingHours) {
    const bestSlot = findBestRegularSlot(item, context, teacher, subjectDistribution, subjectForbiddenSlots, subjectDailyMax, subjectTimePreference)

    if (bestSlot) {
      const cell = createScheduleCell(item, bestSlot.dayOfWeek, bestSlot.period, false)
      cells.push(cell)

      // 更新占用矩阵（自习课的 teacherId 为空时不占用教师时间）
      if (item.teacherId) {
        markSlotOccupied(context.occupancy.teachers, item.teacherId, bestSlot.dayOfWeek, bestSlot.period, cell.id)
      }
      markSlotOccupied(context.occupancy.classes, item.classId, bestSlot.dayOfWeek, bestSlot.period, cell.id)

      incrementSubjectCount(subjectDistribution, item.classId, bestSlot.dayOfWeek, item.subject)

      placed++
    } else {
      break // 无法找到合适的时段
    }
  }

  return placed
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
  const { subjectTimeRules, subjectRules: allSubjectRules } = useRuleStore.getState()

  // [P0-3] 学科绝对禁排时段： subject → Set<"dayOfWeek_period">
  const subjectForbiddenSlots = new Map<Subject, Set<string>>()
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
  const subjectDailyMax = new Map<Subject, number>()
  for (const rule of allSubjectRules) {
    if (rule.dailyMax !== undefined) {
      subjectDailyMax.set(rule.subject, rule.dailyMax)
    }
  }

  // [P1-2] 学科时段偏好： subject → 'morning_only' | 'afternoon_only' | 'no_preference'
  const subjectTimePreference = new Map<Subject, string>()
  for (const rule of allSubjectRules) {
    if (rule.timePreference && rule.timePreference !== 'no_preference') {
      subjectTimePreference.set(rule.subject, rule.timePreference)
    }
  }

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
      const fixedPlaced = placeFixedSlots(item, context, allCells, allConflicts, teacher, subjectDistribution)
      remainingHours -= fixedPlaced
    }

    // 2. 如果是连堂课，优先处理连堂
    if (item.isConsecutive && remainingHours > 0) {
      const consecutivePlaced = placeConsecutiveCourse(item, context, allCells, remainingHours, teacher, subjectDistribution, subjectForbiddenSlots, subjectDailyMax, subjectTimePreference)
      remainingHours -= consecutivePlaced
    }

    // 3. 放置剩余的普通课程（均匀分布）
    if (remainingHours > 0) {
      const regularPlaced = placeRegularCourse(item, context, allCells, remainingHours, teacher, subjectDistribution, subjectForbiddenSlots, subjectDailyMax, subjectTimePreference)
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
