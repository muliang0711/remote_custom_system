可以。现在我把这个 **Function 1：Pay Rate Table** 收敛成一份 AI agent 可以直接开发的 requirement，而且只 focus 在「一个员工某一天每小时多少钱」。

这个 function 的唯一核心关系是：

```text
Hourly Rate
= Employment Type
+ Classification Level
+ Employee Age
+ Day Type
```

其中：

- `Employment Type`：Full-time / Part-time / Casual
- `Classification Level`：Level 1 / Level 2 / Level 3
- `Employee Age`：Under 17 / 17 / 18 / 19 / 20+
- `Day Type`：Weekday / Saturday / Sunday / Public Holiday

Restaurant Award 明确规定 junior employee 是未满 21 岁，但 20 岁员工按 adult minimum rate 的 100% 支付；junior percentages 分别是 Under 17 = 50%、17 = 60%、18 = 70%、19 = 85%、20 = 100%。:chatgpt-content-reference{index="0"}

## Requirement: Pay Rate Table

系统必须提供一个可视化工资表。用户选择：

```text
Employment Type
Age Group
```

之后可以直接看到该组员工 Level 1–3 在不同日期类型下的 hourly rate。

**Rate Version：Restaurant Industry Award MA000119 — Effective 01/07/2026。** :chatgpt-content-reference{index="1"}

### Full-time / Part-time — Age 20+ / Adult

Full-time 与 Part-time 使用同一组 hourly rates；区别不在这个 function 处理。:chatgpt-content-reference{index="2"}

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $26.44 | $33.05 | $39.66 | $59.49 |
| Level 2 | $27.08 | $33.85 | $40.62 | $60.93 |
| Level 3 | $27.97 | $34.96 | $41.96 | $62.93 |

### Casual — Age 20+ / Adult

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $33.05 | $39.66 | $39.66 | $66.10 |
| Level 2 | $33.85 | $40.62 | $40.62 | $67.70 |
| Level 3 | $34.96 | $41.96 | $48.95 | $69.93 |

这些 adult casual rates 来自 Pay Guide 的 Casual tables。:chatgpt-content-reference{index="3"}

### Full-time / Part-time — Age 19

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $22.48 | $28.10 | $33.72 | $50.58 |
| Level 2 | $23.02 | $28.78 | $34.53 | $51.80 |
| Level 3 | $23.78 | $29.73 | $35.67 | $53.51 |

Pay Guide 有独立的 `Junior - Full-time & part-time - 19 years of age` section。:chatgpt-content-reference{index="4"}

### Casual — Age 19

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $28.10 | $33.72 | $33.72 | $56.20 |
| Level 2 | $28.78 | $34.53 | $34.53 | $57.55 |
| Level 3 | $29.73 | $35.67 | $41.62 | $59.45 |

Pay Guide 同样有独立的 `Junior - Casual - 19 years of age` section。:chatgpt-content-reference{index="5"}

### Full-time / Part-time — Age 18

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $18.51 | $23.14 | $27.77 | $41.65 |
| Level 2 | $18.96 | $23.70 | $28.44 | $42.66 |
| Level 3 | $19.58 | $24.48 | $29.37 | $44.06 |

The Pay Guide provides a separate 18-year-old FT/PT section. :chatgpt-content-reference{index="6"}

### Casual — Age 18

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $23.14 | $27.77 | $27.77 | $46.28 |
| Level 2 | $23.70 | $28.44 | $28.44 | $47.40 |
| Level 3 | $24.48 | $29.37 | $34.27 | $48.95 |

The Pay Guide provides a separate 18-year-old Casual section. :chatgpt-content-reference{index="7"}

### Full-time / Part-time — Age 17

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $15.87 | $19.84 | $23.81 | $35.71 |
| Level 2 | $16.25 | $20.31 | $24.38 | $36.56 |
| Level 3 | $16.78 | $20.98 | $25.17 | $37.76 |

The Pay Guide provides a separate 17-year-old FT/PT section. :chatgpt-content-reference{index="8"}

### Casual — Age 17

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $19.84 | $23.81 | $23.81 | $39.68 |
| Level 2 | $20.31 | $24.38 | $24.38 | $40.63 |
| Level 3 | $20.98 | $25.17 | $29.37 | $41.95 |

The Pay Guide provides a separate 17-year-old Casual section. :chatgpt-content-reference{index="9"}

### Full-time / Part-time — Under 17

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $13.22 | $16.53 | $19.83 | $29.75 |
| Level 2 | $13.54 | $16.93 | $20.31 | $30.47 |
| Level 3 | $13.99 | $17.49 | $20.99 | $31.48 |

### Casual — Under 17

| Level | Weekday | Saturday | Sunday | Public Holiday |
|---|---:|---:|---:|---:|
| Level 1 | $16.53 | $19.83 | $19.83 | $33.05 |
| Level 2 | $16.93 | $20.31 | $20.31 | $33.85 |
| Level 3 | $17.49 | $20.99 | $24.48 | $34.98 |

The Pay Guide explicitly contains separate Under-17 FT/PT and Casual sections. :chatgpt-content-reference{index="10"} :chatgpt-content-reference{index="11"}

---

### 最终给 AI Agent 的 Requirement

> **Pay Rate Table Function**
>
> The system must provide a visual hourly pay-rate table based on the Restaurant Industry Award MA000119, effective 1 July 2026.
>
> A rate is determined by exactly four factors:
>
> `Employment Type + Classification Level + Employee Age + Day Type`.
>
> Supported employment types for this function are `Full-time/Part-time` and `Casual`. Full-time and Part-time share the same hourly rate table.
>
> Supported classifications in V1 are `Level 1`, `Level 2`, and `Level 3`.
>
> Supported age groups are `Under 17`, `17`, `18`, `19`, and `20+`. Employees aged 20 receive 100% of the adult minimum rate. :chatgpt-content-reference{index="12"}
>
> Supported day types are `Weekday (Monday-Friday)`, `Saturday`, `Sunday`, and `Public Holiday`.
>
> The user must be able to select an Employment Type and Age Group and immediately view the applicable Level 1–3 hourly rates across all four Day Types.
>
> The displayed rates must match the tables listed above.
>
> At this stage, the function does **not** calculate worked hours, weekly salary, overtime, leave, breaks, or roster assignments. Its only responsibility is to correctly return and visualize the applicable base hourly rate.

这个版本已经足够让 agent **把第一个工资表功能做正确**。下一步再建立在这个 function 上做 `employee + timetable hours → weekly/fortnight salary`，这样不会把两个问题混在一起。