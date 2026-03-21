# 排课规则引擎集成审计报告

> 审计时间：2026-03-21  
> 最后更新：2026-03-21（已按修复优先级全部修复 P0/P1，并修复调课引擎学科禁排）  
> 审计范围：`ruleStore` 所有规则类型 → `ruleAggregator.ts` → `greedyScheduler.ts` → `AdjustmentEngine`

---

## 总结一览

| 规则类型 | 规则字段 | 是否应用于排课算法 | 是否应用于调课算法 | 状态 |
| --- | --- | --- | --- | --- |
| **SubjectRule** | `weeklyHours` | ✅ 完全应用 | ➖ N/A | PASS |
| **SubjectRule** | `isConsecutive` | ✅ 完全应用 | ➖ N/A | PASS |
| **SubjectRule** | `consecutiveCount` | ✅ 完全应用 | ➖ N/A | PASS |
| **SubjectRule** | `dailyMax` | ✅ **已修复**（P1-1） | ➖ N/A | PASS |
| **SubjectRule** | `timePreference` | ✅ **已修复**（P1-2） | ➖ N/A | PASS |
| **SubjectTimeRule** | `fixed`（固定课位） | ✅ **已修复**（P0-2） | ➖ N/A | PASS |
| **SubjectTimeRule** | `must_not`（绝对禁排） | ✅ **已修复**（P0-3） | ✅ **已修复** | PASS |
| **GlobalTimeRule** | `dayOfWeek + period` | ✅ 完全应用（转化为 avoidTimeSlots） | ✅ 通过 avoidTimeSlots 间接应用 | PASS |
| **TeacherLoadRule** | `defaultMaxWeeklyHours` | ✅ 完全应用（设置 weeklyHoursLimit） | ✅ 代课时检查 weeklyHoursLimit | PASS |
| **TeacherTimeRule** | `must_not` | ✅ **已修复**（P0-1） | ✅ 通过 avoidTimeSlots 间接应用 | PASS |
| **TeacherTimeRule** | `prefer_not` | ❌ **未应用**（仅存于 store，从未传递给算法） | ❌ 未应用 | **GAP** |

---

## 详细分析

### ✅ 已正确集成的规则

#### 1. SubjectRule — weeklyHours / isConsecutive / consecutiveCount

- **应用路径**：`ruleAggregator.ts` → 为每个 `CurriculumItem` 注入对应学科的这三个字段。
- **算法支持**：`greedyScheduler.ts` `placeConsecutiveCourse()` 和 `placeRegularCourse()` 完全使用这些字段。
- **结论**：✅ 完全正确

#### 2. SubjectRule — dailyMax（单日最大课时数）【P1-1 已修复】

- **修复内容**：`runGreedyScheduler` 构建 `subjectDailyMax` Map；`findBestRegularSlot` 和 `findBestConsecutiveSlot` 中增加硬截止：当日已排数 `>= dailyMax` 则跳过整天。
- **结论**：✅ 已修复

#### 3. SubjectRule — timePreference（上午/下午偏好）【P1-2 已修复】

- **修复内容**：`runGreedyScheduler` 构建 `subjectTimePreference` Map；slot 评分函数中对偏好节次加分 `-50`（降竞争分），非偏好节次加惩罚 `+100`。
- **结论**：✅ 已修复

#### 4. SubjectTimeRule — fixed（固定课位）【P0-2 已修复】

- **修复内容**：`ruleAggregator.ts` 中从 `subjectTimeRules` 筛选 `type === 'fixed'` 的规则，注入到 `CurriculumItem.fixedSlots`；有固定课位的课程优先级自动提升。
- **结论**：✅ 已修复

#### 5. SubjectTimeRule — must_not（绝对禁排）【P0-3 已修复 + 调课已修复】

- **排课修复**：`runGreedyScheduler` 构建 `subjectForbiddenSlots` Map；`canPlaceCourse()` 第三层检查命中则返回 `false`。
- **调课修复**：`AdjustmentEngine` 构造时从 ruleStore 读取并构建 `subjectForbiddenSlots`；P0（同日互换）和 P1（跨日互换）互换验证时，检查两科调入的新时段是否命中禁排，命中则过滤候选。
- **结论**：✅ 完全修复（排课 + 调课均生效）

#### 6. GlobalTimeRule — dayOfWeek + period

- **应用路径**：`ruleAggregator.ts` → 将所有全局禁排时段映射为每一个 `Teacher.avoidTimeSlots`。
- **算法支持**：`canPlaceCourse()` → `isSlotInAvoidList()` 阻断排课。P2代课 `p2Substitute.ts` 同样检查该列表。
- **结论**：✅ 完全正确（通过统一的 avoidTimeSlots 机制生效）

#### 7. TeacherLoadRule — defaultMaxWeeklyHours

- **结论**：✅ 代课场景完全正确；排课场景无显式上限截止（低风险）

#### 8. TeacherTimeRule — must_not【P0-1 已修复】

- **修复内容**：`ruleAggregator.ts` 为每位教师单独筛选 `teacherId === name && type === 'must_not'` 的规则，与全局禁排合并（去重）后注入 `Teacher.avoidTimeSlots`，`canPlaceCourse()` 的现有检查自动生效。
- **结论**：✅ 已修复

---

### ❌ 仍未集成的规则（P2 留待后续）

#### 9. TeacherTimeRule — prefer_not

- **预期行为**：软性偏好，尽量不排但不强制禁止。
- **当前现状**：`prefer_not` 仅存于 store，排课和调课算法均未读取，效果与无设置相同。
- **计划修复**：在 slot scoring 函数中，命中 `prefer_not` 时段的候选加大惩罚分数（排序靠后），不做硬拦截。
- **结论**：❌ 未应用（P2 优先级）

---

## 调课引擎（AdjustmentEngine）独立审计

| 规则约束 | 调课引擎状态 |
| --- | --- |
| TeacherTimeRule must_not | ✅ 通过 avoidTimeSlots 间接保护（ruleAggregator 已注入） |
| TeacherTimeRule prefer_not | ❌ 软权重未纳入评分 |
| SubjectTimeRule must_not | ✅ **已修复**（P0/P1 互换验证时阻断违规目标时段） |
| GlobalTimeRule | ✅ 通过 avoidTimeSlots 间接保护 |
| TeacherLoadRule weeklyHoursLimit | ✅ P2代课时检查 |

---

## 修复优先级建议

| 优先级 | 规则 | 修复复杂度 | 状态 |
| --- | --- | --- | --- |
| 🔴 P0（立刻修复） | TeacherTimeRule → avoidTimeSlots | 低 | ✅ 已完成 |
| 🔴 P0（立刻修复） | SubjectTimeRule fixed → CurriculumItem.fixedSlots | 低 | ✅ 已完成 |
| 🔴 P0（立刻修复） | SubjectTimeRule must_not → 排课禁排 | 中 | ✅ 已完成 |
| 🔴 P0（立刻修复） | SubjectTimeRule must_not → 调课禁排 | 中 | ✅ 已完成 |
| 🟡 P1（近期修复） | SubjectRule dailyMax → 每日硬截止 | 中 | ✅ 已完成 |
| 🟡 P1（近期修复） | SubjectRule timePreference → 时段权重 | 中 | ✅ 已完成 |
| 🟢 P2（未来优化） | TeacherTimeRule prefer_not → 软权重 | 中 | ❌ 待实现 |
| 🟢 P2（未来优化） | AdjustmentEngine TeacherTimeRule prefer_not 评分 | 中 | ❌ 待实现 |

---

## 文件引用索引

| 文件 | 作用 |
| --- | --- |
| `src/types/rule.types.ts` | 所有规则类型定义 |
| `src/stores/ruleStore.ts` | 规则状态存储与 CRUD |
| `src/services/ruleAggregator.ts` | 规则 + Excel数据 → 排课实体（**P0-1、P0-2 修复点**） |
| `src/algorithms/scheduler/greedyScheduler.ts` | 贪心排课算法（**P0-3、P1-1、P1-2 修复点**） |
| `src/algorithms/adjustment/index.ts` | 调课引擎主入口（**调课学科禁排修复点**） |
| `src/algorithms/adjustment/p0SameDaySwap.ts` | P0同日互换策略（**已集成 subjectForbiddenSlots 检查**） |
| `src/algorithms/adjustment/p1CrossDaySwap.ts` | P1跨日互换策略（**已集成 subjectForbiddenSlots 检查**） |
| `src/algorithms/adjustment/p2Substitute.ts` | P2代课策略（已应用 weeklyHoursLimit 和 avoidTimeSlots） |
