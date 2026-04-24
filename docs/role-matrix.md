# Role Matrix (Starter)

## Main roles
- `super_admin`
- `admin`
- `finance_staff`
- `fo_staff`
- `hk_staff`
- `fb_staff`
- `fitness_staff`
- `department_manager`
- `member`
- `guest`

## Simplified alternative
If you want a simpler phase-1 model, use:
- `admin`
- `staff`
- `member`
- `guest`

and separate permissions with:
- `department = fo | hk | fb | fitness | admin`

## Permission overview
- Admin: full management
- Staff: operational handling by department
- Member: own card, balance, points, redeem, settings
- Guest: own temporary portal, requests, chat, redeem, settings
