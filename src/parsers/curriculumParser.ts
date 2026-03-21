import * as XLSX from 'xlsx'
import { Subject, SUBJECT_NAMES } from '@/data/constants'
import { CurriculumItem } from '@/types/curriculum.types'
import { TimeSlotRef } from '@/types/teacher.types'

/**
 * Excel教学计划表解析器
 * 期望的Excel格式:
 * | 班级名称 | 学科 | 教师工号 | 周课时数 | 是否连堂 | 连堂节数 | 固定时段 | 优先级 | 备注 |
 */

interface CurriculumRowData {
  '班级名称': string
  '学科': string
  '教师工号': string
  '周课时数': number | string
  '是否连堂'?: string
  '连堂节数'?: number | string
  '固定时段'?: string
  '优先级'?: number | string
  '备注'?: string
}

/**
 * 将学科名称转换为Subject枚举
 */
function parseSubject(subjectName: string): Subject | null {
  const normalizedName = subjectName?.trim()
  if (!normalizedName) return null

  for (const [key, value] of Object.entries(SUBJECT_NAMES)) {
    if (value === normalizedName) {
      return key as Subject
    }
  }
  return null
}

/**
 * 解析是否连堂
 */
function parseIsConsecutive(value?: string): boolean {
  if (!value) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized === '是' || normalized === 'yes' || normalized === 'true' || normalized === '1'
}

/**
 * 解析固定时段字符串
 * 格式: "周一1,周二2" 或 "1-1,2-2" (星期-节次)
 */
function parseFixedSlots(slotStr: string): TimeSlotRef[] {
  if (!slotStr || slotStr.trim() === '') {
    return []
  }

  const slots: TimeSlotRef[] = []
  const parts = slotStr.split(/[,，;；]/)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    let dayOfWeek: number | null = null
    let period: number | null = null

    // 格式1: "周X数字" 如 "周一1"
    const chineseDayMatch = trimmed.match(/^(周[一二三四五六日])(\d+)$/)
    if (chineseDayMatch) {
      const dayMap: Record<string, number> = {
        '周一': 1, '周二': 2, '周三': 3, '周四': 4,
        '周五': 5, '周六': 6, '周日': 7
      }
      dayOfWeek = dayMap[chineseDayMatch[1]]
      period = parseInt(chineseDayMatch[2], 10)
    }

    // 格式2: "数字-数字" 如 "1-1"
    if (!dayOfWeek) {
      const numericMatch = trimmed.match(/^(\d+)-(\d+)$/)
      if (numericMatch) {
        dayOfWeek = parseInt(numericMatch[1], 10)
        period = parseInt(numericMatch[2], 10)
      }
    }

    if (dayOfWeek !== null && period !== null) {
      slots.push({ dayOfWeek, period })
    }
  }

  return slots
}

/**
 * 查找班级ID
 */
function findClassId(className: string, classIdMap: Map<string, string>): string | null {
  const trimmed = className?.trim()
  if (!trimmed) return null

  // 直接匹配
  if (classIdMap.has(trimmed)) {
    return classIdMap.get(trimmed)!
  }

  // 尝试模糊匹配
  for (const [name, id] of classIdMap) {
    if (name === trimmed || name.includes(trimmed) || trimmed.includes(name)) {
      return id
    }
  }

  return null
}

/**
 * 查找教师ID
 */
function findTeacherId(teacherCode: string, teacherIdMap: Map<string, string>): string {
  const trimmed = teacherCode?.trim()
  if (!trimmed) return ''

  // 直接通过工号查找
  if (teacherIdMap.has(trimmed)) {
    return teacherIdMap.get(trimmed)!
  }

  // 返回工号本身作为ID
  return `teacher_${trimmed}`
}

/**
 * 解析教学计划Excel工作表
 */
export function parseCurriculumExcel(
  worksheet: XLSX.WorkSheet,
  classIdMap: Map<string, string>,
  teacherIdMap: Map<string, string>
): CurriculumItem[] {
  const items: CurriculumItem[] = []
  const jsonData = XLSX.utils.sheet_to_json<CurriculumRowData>(worksheet, {
    raw: false,
    defval: ''
  })

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i]

    // 跳过空行
    if (!row['班级名称'] || !row['学科']) {
      continue
    }

    const subject = parseSubject(row['学科'])
    if (!subject) {
      console.warn(`第 ${i + 2} 行: 无法识别的学科 "${row['学科']}"`)
      continue
    }

    const classId = findClassId(row['班级名称'], classIdMap)
    if (!classId) {
      console.warn(`第 ${i + 2} 行: 无法找到班级 "${row['班级名称']}"`)
      continue
    }

    const teacherId = findTeacherId(row['教师工号'], teacherIdMap)

    const item: CurriculumItem = {
      id: `curriculum_${classId}_${subject}_${i}`,
      classId,
      subject,
      teacherId,
      weeklyHours: parseInt(String(row['周课时数']), 10) || 1,
      isConsecutive: parseIsConsecutive(row['是否连堂']),
      consecutiveCount: parseInt(String(row['连堂节数']), 10) || 2,
      fixedSlots: parseFixedSlots(row['固定时段'] || ''),
      priority: parseInt(String(row['优先级']), 10) || 0,
      notes: row['备注']?.trim()
    }

    items.push(item)
  }

  return items
}

/**
 * 从文件路径解析教学计划数据
 */
export async function parseCurriculumFile(
  filePath: string,
  classIdMap: Map<string, string>,
  teacherIdMap: Map<string, string>
): Promise<CurriculumItem[]> {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames.find(name =>
    name.includes('教学计划') || name.toLowerCase().includes('curriculum')
  ) || workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('Excel文件中没有找到教学计划工作表')
  }
  return parseCurriculumExcel(workbook.Sheets[sheetName], classIdMap, teacherIdMap)
}

/**
 * 从 ArrayBuffer 解析教学计划数据
 */
export function parseCurriculumBuffer(
  buffer: ArrayBuffer,
  classIdMap: Map<string, string>,
  teacherIdMap: Map<string, string>
): CurriculumItem[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames.find(name =>
    name.includes('教学计划') || name.toLowerCase().includes('curriculum')
  ) || workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('Excel文件中没有找到教学计划工作表')
  }
  return parseCurriculumExcel(workbook.Sheets[sheetName], classIdMap, teacherIdMap)
}

/**
 * 创建教学计划DTO
 */
export function createCurriculumDto(item: Omit<CurriculumItem, 'id'>): CurriculumItemDto {
  return {
    classId: item.classId,
    subject: item.subject,
    teacherId: item.teacherId,
    weeklyHours: item.weeklyHours,
    isConsecutive: item.isConsecutive,
    consecutiveCount: item.consecutiveCount,
    fixedSlots: item.fixedSlots,
    priority: item.priority,
    notes: item.notes
  }
}

interface CurriculumItemDto {
  classId: string
  subject: Subject
  teacherId: string
  weeklyHours: number
  isConsecutive?: boolean
  consecutiveCount?: number
  fixedSlots?: TimeSlotRef[]
  priority?: number
  notes?: string
}
