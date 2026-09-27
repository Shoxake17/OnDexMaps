package httpapi

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ═══════════════════════════════════════════════════════════════════════
// POCHTA MANZILI CLOUDFLARE TOMONIDAN BUZILMASIN
//
// Cloudflare'ning "Email Address Obfuscation" xizmati sahifadagi pochta
// manzilini `[email protected]` ga, `mailto:` havolasini esa
// `/cdn-cgi/l/email-protection#…` ga almashtiradi va ularni o'z skripti
// bilan tiklaydi.
//
// Natijada JavaScriptsiz — brauzerda o'chirilgan bo'lsa, sahifa PDF
// qilib saqlansa, yoki uni bot/arxiv o'qisa — rasmiy aloqa manzili
// o'qilmaydi va havola ochilmaydi. Oferta bilan shartlar esa
// SHARTNOMA: ulardagi aloqa manzili har qanday holatda ishlashi kerak.
//
// 2026-09-27 da bu jonli sahifalarda o'lchandi (`/oferta`, `/aloqa`,
// `/copyright` — hammasida `data-cfemail`). Yechim — Cloudflare'ning
// o'z istisno belgisi `<!--email_off-->`, u `EmailOff` komponentida.
//
// Bu test yangi sahifada o'ralmagan pochta havolasi paydo bo'lishini
// to'xtatadi: dashboard sozlamasi o'zgarishi mumkin, kod esa —
// tekshiriladigan qoida.
// ═══════════════════════════════════════════════════════════════════════

// TestConsoleEmailLinksAreProtected — `mailto:${OPERATOR.email}`
// ishlatadigan har bir sahifa `EmailOff` yoki `OperatorEmail` ni ham
// ishlatishi shart.
func TestConsoleEmailLinksAreProtected(t *testing.T) {
	const root = "../../console/src"

	// `legal-ui.tsx` — himoyaning O'ZI shu yerda yozilgan.
	const himoyaFayli = "legal-ui.tsx"

	var tekshirilgan int
	err := filepath.WalkDir(root, func(yol string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(yol, ".tsx") {
			return err
		}
		b, err := os.ReadFile(yol)
		if err != nil {
			return err
		}
		src := string(b)
		xom := strings.Contains(src, "mailto:${OPERATOR.email}")
		tayyor := strings.Contains(src, "<OperatorEmail")
		if !xom && !tayyor {
			return nil
		}
		// Pochta manzilini KO'RSATADIGAN har bir sahifa sanaladi —
		// xomini ham, tayyor komponentdan foydalanganini ham.
		tekshirilgan++
		if !xom {
			// `<OperatorEmail />` — himoya uning ichida.
			return nil
		}

		if strings.HasSuffix(yol, himoyaFayli) {
			// Komponentning o'zi — o'rovchi shu yerda yaratiladi.
			if !strings.Contains(src, "email_off") {
				t.Errorf("%s: himoya komponenti `email_off` belgisini yo'qotgan", yol)
			}
			return nil
		}

		// ⚠️ Importning mavjudligi YETARLI EMAS: sahifada bitta
		// himoyalangan havola va bitta himoyasiz havola yonma-yon
		// turishi mumkin, va import ikkalasini ham "to'g'ri" qilib
		// ko'rsatardi. Mutatsiya bilan aynan shu aniqlangan, shuning
		// uchun har bir havolaning JOYLASHUVI tekshiriladi.
		for _, at := range xomJoylar(src) {
			if !emailOffIchida(src, at) {
				t.Errorf("%s: %d-baytdagi pochta havolasi O'RALMAGAN.\n"+
					"  Cloudflare uni `/cdn-cgi/l/email-protection#…` ga aylantiradi va\n"+
					"  JavaScriptsiz havola ochilmaydi. `<EmailOff>` bilan o'rang yoki\n"+
					"  tayyor `<OperatorEmail />` komponentidan foydalaning.", yol, at)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("konsol manbasi o'qilmadi: %v", err)
	}

	// Sahifalar ko'chirilib, test jimgina bo'shab qolmasin.
	if tekshirilgan < 5 {
		t.Errorf("pochta havolasi bor sahifalar soni %d — juda kam, yo'l o'zgarganmi?",
			tekshirilgan)
	}
}

// xomJoylar — `mailto:${OPERATOR.email}` uchragan bayt o'rinlari.
func xomJoylar(src string) []int {
	const igna = "mailto:${OPERATOR.email}"
	var out []int
	for i := 0; ; {
		j := strings.Index(src[i:], igna)
		if j < 0 {
			return out
		}
		out = append(out, i+j)
		i += j + len(igna)
	}
}

// emailOffIchida — berilgan o'rin `<EmailOff>` … `</EmailOff>`
// orasidami.
//
// Tahlil oddiy: undan OLDINGI ochilish va yopilish teglarini sanaymiz.
// Ochilish ko'proq bo'lsa — hozir o'rov ichidamiz. JSX'da bu teglar
// ichma-ich qo'yilmaydi, shuning uchun sanash yetarli va to'liq
// tahlilchi kerak emas.
func emailOffIchida(src string, at int) bool {
	oldin := src[:at]
	return strings.Count(oldin, "<EmailOff>") > strings.Count(oldin, "</EmailOff>")
}

// TestConsoleEmailOffMarkersArePaired — ochilish va yopilish
// belgilarining soni teng.
//
// Yopilmagan `<!--email_off-->` sahifaning QOLGAN qismini ham
// istisnoga oladi — bu jimgina va zararsiz ko'rinadi, lekin keyin
// qo'shilgan haqiqiy pochta manzili himoyasiz qolgani sezilmaydi.
func TestConsoleEmailOffMarkersArePaired(t *testing.T) {
	b, err := os.ReadFile("../../console/src/components/legal/legal-ui.tsx")
	if err != nil {
		t.Fatalf("legal-ui.tsx o'qilmadi: %v", err)
	}
	src := string(b)

	ochilish := strings.Count(src, `"<!--email_off-->"`)
	yopilish := strings.Count(src, `"<!--/email_off-->"`)
	if ochilish == 0 {
		t.Fatal("`email_off` belgisi umuman yo'q")
	}
	if ochilish != yopilish {
		t.Errorf("belgilar juft emas: %d ochilish, %d yopilish", ochilish, yopilish)
	}
}
