import { CurriculumItem } from '@/types/curriculum.types'
import { Teacher } from '@/types/teacher.types'
import { SubjectType } from '@/data/constants'

/**
 * 班级任课教师信息
 */
export interface ClassTeacherInfo {
  teacher: Teacher
  subjects: SubjectType[]
  weeklyHours: number
}

/**
 * 获取班级的所有任课教师
 *
 * @param classId - 班级ID
 * @param curriculumItems - 所有教学计划条目
 * @param teachers - 所有教师列表
 * @returns 班级任课教师信息列表
 *
 * @example
 * ```ts
 * const classTeachers = getClassTeachers('class_123', curriculumItems, teachers)
 * // 返回: [{ teacher: Teacher, subjects: [Subject.Math, Subject.Physics], weeklyHours: 8 }, ...]
 * ```
 */
export function getClassTeachers(
  classId: string,
  curriculumItems: CurriculumItem[],
  teachers: Teacher[]
): ClassTeacherInfo[] {
  // 1. 过滤出该班级的所有教学计划
  const classCurriculum = curriculumItems.filter(item => item.classId === classId)

  if (classCurriculum.length === 0) {
    return []
  }

  // 2. 提取所有唯一的教师ID
  const teacherIds = Array.from(new Set(classCurriculum.map(item => item.teacherId)))

  // 3. 为每个教师构建详细信息
  const teachersInfo: ClassTeacherInfo[] = []

  for (const teacherId of teacherIds) {
    const teacher = teachers.find(t => t.id === teacherId)

    if (!teacher) {
      continue // 跳过找不到的教师
    }

    // 获取该教师在该班级教授的所有学科
    const teacherSubjects = classCurriculum
      .filter(item => item.teacherId === teacherId)
      .map(item => item.subject)

    // 去重
    const uniqueSubjects = Array.from(new Set(teacherSubjects))

    // 计算该教师在该班级的周课时总数
    const weeklyHours = classCurriculum
      .filter(item => item.teacherId === teacherId)
      .reduce((sum, item) => sum + item.weeklyHours, 0)

    teachersInfo.push({
      teacher,
      subjects: uniqueSubjects,
      weeklyHours
    })
  }

  // 按周课时数排序（课时多的在前）
  return teachersInfo.sort((a, b) => b.weeklyHours - a.weeklyHours)
}

/**
 * 检查教师在指定时段是否空闲
 *
 * @param teacherId - 教师ID
 * @param dayOfWeek - 星期几 (1-5)
 * @param period - 第几节 (1-8)
 * @param allCells - 所有课表单元格
 * @returns 教师是否在该时段空闲
 */
export function isTeacherAvailableAtSlot(
  teacherId: string,
  dayOfWeek: number,
  period: number,
  allCells: Array<{ teacherId: string; dayOfWeek: number; period: number }>
): boolean {
  return !allCells.some(
    cell => cell.teacherId === teacherId &&
            cell.dayOfWeek === dayOfWeek &&
            cell.period === period
  )
}
