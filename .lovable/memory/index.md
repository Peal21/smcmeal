Satkhira Medical College Meal Management System - design tokens, architecture, and key decisions

## Design
- Green medical theme: primary=152 55% 28%, accent=38 90% 55% (amber), info=210 80% 52%
- Fonts: Inter + Noto Sans Bengali
- Bengali UI labels throughout

## Architecture
- Tables: profiles, user_roles, meal_months, daily_meals, extra_meals, payments, member_balances
- Roles: student, meal_manager, super_admin (in user_roles table with has_role() security definer)
- Auto-profile creation on signup via trigger
- Realtime enabled on daily_meals

## Key Rules
- Meal date logic: students update TOMORROW's meal before 11 PM today
- Cutoff: 10:00 PM — 9:00-9:30 PM countdown alert, 9:30-10 PM warning theme + manager popup on update, after 10:00 PM locked. Manager can override anytime.
- Extra options: single multi-select (beef, mutton, chicken, egg variants) stored as comma-separated in lunch_extra_option
- Feast days: Monday & Friday — extra meal on feast day = 3 regular meals (internal calc only, not shown in Excel)
- Excel: chicken option shown only on feast days; no 4x multiplier display
- Excel export: Noto Sans Bengali font, year order descending (5th→1st→extra), compact A4 printable
- Excel: Boys=all years 1 page; Girls=all years 1 page + 3rd year separate
- Custom month date range: meal_months has start_date/end_date, all stats/billing/history use these
- Monthly manager rotation via handover
- Meal rate = total_expense / total_meals
