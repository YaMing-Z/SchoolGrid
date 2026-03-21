import * as XLSX from 'xlsx'
import { Subject, SUBJECT_NAMES } from '@/data/constants'
import { Teacher, TimeSlotRef } from '@/types/teacher.types'

/**
 * Excel教师表解析器
 * 期望的Excel格式:
 * | 工号 | 姓名 | 任教学科 | 周课时上限 | 避开时段 | 电话 | 邮箱 | 备注 |
 */

interface TeacherRowData {
  '工号': string
  '姓名': string
  '任教学科': string
  '周课时上限': number | string
  '避开时段'?: string
  '电话'?: string
  '邮箱'?: string
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
 * 解析避开时段字符串
 * 格式: "周一1-2,周三3" 或 "1-1,2-2" (星期-节次)
 */
function parseAvoidTimeSlots(slotStr: string): TimeSlotRef[] {
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

    // 格式1: "周X数字" 如 "周一1", "周二3"
    const chineseDayMatch = trimmed.match(/^(周[一二三四五六日])(\d+)$/)
    if (chineseDayMatch) {
      const dayMap: Record<string, number> = {
        '周一': 1, '周二': 2, '周三': 3, '周四': 4,
        '周五': 5, '周六': 6, '周日': 7
      }
      dayOfWeek = dayMap[chineseDayMatch[1]]
      period = parseInt(chineseDayMatch[2], 10)
    }

    // 格式2: "数字-数字" 如 "1-1", "2-3"
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
 * 解析教师Excel工作表
 */
export function parseTeacherExcel(worksheet: XLSX.WorkSheet): Teacher[] {
  const teachers: Teacher[] = []
  const jsonData = XLSX.utils.sheet_to_json<TeacherRowData>(worksheet, {
    raw: false,
    defval: ''
  })

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i]

    // 跳过空行
    if (!row['工号'] && !row['姓名']) {
      continue
    }

    const subject = parseSubject(row['任教学科'])
    if (!subject) {
      console.warn(`第 ${i + 2} 行: 无法识别的学科 "${row['任教学科']}"`)
      continue
    }

    const teacher: Teacher = {
      id: `teacher_${row['工号']}`,
      employeeId: row['工号']?.trim() || '',
      name: row['姓名']?.trim() || '',
      subject,
      weeklyHoursLimit: parseInt(String(row['周课时上限']), 10) || 20,
      avoidTimeSlots: parseAvoidTimeSlots(row['避开时段'] || ''),
      isActive: true,
      phone: row['电话']?.toString().trim(),
      email: row['邮箱']?.trim(),
      notes: row['备注']?.trim()
    }

    teachers.push(teacher)
  }

  return teachers
}

/**
 * 从文件路径解析教师数据
 */
export async function parseTeacherFile(filePath: string): Promise<Teacher[]> {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames.find(name =>
    name.includes('教师') || name.toLowerCase().includes('teacher')
  ) || workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('Excel文件中没有找到教师工作表')
  }
  return parseTeacherExcel(workbook.Sheets[sheetName])
}

/**
 * 从 ArrayBuffer 解析教师数据
 */
export function parseTeacherBuffer(buffer: ArrayBuffer): Teacher[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames.find(name =>
    name.includes('教师') || name.toLowerCase().includes('teacher')
  ) || workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('Excel文件中没有找到教师工作表')
  }
  return parseTeacherExcel(workbook.Sheets[sheetName])
}
