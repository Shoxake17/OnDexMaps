package devplatform

import "time"

// Tarif rejalari. Narx va chegaralar BIR JOYDA (kodda), sozlanadigan qismi cmd/api konfiguratsiyasidan keladi.
//
// Qoida (docs/developer-platform.md):
//   - ekotizim (OnDexSuperApp va h.k.): BEPUL va oylik chegarasiz (texnik xavfsizlik tezlik chegarasi bilan)
//   - obuna (flag = true, to'langan):   oyiga 50 000 so'm QAT'IY, yuqori tezlik, oylik chegarasiz
//   - bepul (flag = false):             adolatli foydalanish: 10 so'rov/s, oyiga 200 000

// PlanID — tarif rejasi belgisi.
type PlanID string

const (
	PlanFree      PlanID = "free"
	PlanPaid      PlanID = "paid"
	PlanEcosystem PlanID = "ecosystem"
)

// SubscriptionPriceUZS — obunaning oylik narxi (so'm). QAT'IY: ishlatilgan so'rov soniga bog'liq emas.
const SubscriptionPriceUZS int64 = 50_000

// OverdueGrace — to'lanmagan hisob-faktura shuncha o'tgach obuna limitlari bepulga tushadi
// (hisob BLOKLANMAYDI; to'langach darhol tiklanadi).
const OverdueGrace = 7 * 24 * time.Hour

// Plan — bitta tarifning chegaralari.
type Plan struct {
	ID PlanID
	// RPS/Burst — kalit bo'yicha tezlik (token bucket).
	RPS, Burst float64
	// MonthlyCap — HISOB bo'yicha oylik hisoblanadigan so'rovlar chegarasi. 0 = chegarasiz.
	MonthlyCap int64
}

// Plans — uchala reja.
type Plans struct{ Free, Paid, Ecosystem Plan }

// DefaultPlans — kelishilgan standart chegaralar.
func DefaultPlans() Plans {
	return Plans{
		Free:      Plan{ID: PlanFree, RPS: 10, Burst: 20, MonthlyCap: 200_000},
		Paid:      Plan{ID: PlanPaid, RPS: 100, Burst: 200, MonthlyCap: 0},
		Ecosystem: Plan{ID: PlanEcosystem, RPS: 500, Burst: 1000, MonthlyCap: 0},
	}
}

// AccountState — reja tanlash uchun hisobning kerakli holati.
type AccountState struct {
	ID           string
	Suspended    bool
	Subscription bool // OBUNA FLAGI (staff belgilaydi)
	Ecosystem    bool // OnDex ekotizimi hisobi (staff belgilaydi)
	// Overdue — to'lanmagan hisob-faktura OverdueGrace dan ortiq muddati o'tgan.
	Overdue bool
}

// For — hisobga tegishli reja.
//
// Tartib: ekotizim → obuna (agar muddati o'tgan qarz bo'lmasa) → bepul.
// Qarzdor obuna bepul limitlarga tushadi, lekin hisob va kalitlar ishlashda davom etadi.
func (p Plans) For(a AccountState) Plan {
	switch {
	case a.Ecosystem:
		return p.Ecosystem
	case a.Subscription && !a.Overdue:
		return p.Paid
	default:
		return p.Free
	}
}
