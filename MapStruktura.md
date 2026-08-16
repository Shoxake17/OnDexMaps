F:\OnDexMap/
│
├── frontend/                  # React + Vite + TypeScript (.tsx)
│   ├── public/                # Statik rasmlar va ikonalar
│   ├── src/
│   │   ├── @types/            # TypeScript interfeyslari (Type definitions)
│   │   │   └── place.ts       # Obyektlar va xarita ma'lumotlari turlari
│   │   ├── components/        # UI Komponentlari (.tsx)
                common/
                    Button.tsx
│   │   │   ├── Header.tsx     # Yuqori qidiruv va profil paneli
│   │   │   ├── SidebarLeft.tsx# Chap tomonlama kategoriyalar va yaqin joylar
│   │   │   ├── SidebarRight.tsx# O'ng tomonlama obyekt kartochkasi
│   │   │   └── MapView.jsx    # MapLibre GL xarita komponenti
│   │   ├── data/
│   │   │   └── mockPlaces.ts  # Test uchun Chust shahridagi obyektlar
│   │   ├── services/          # Backend (Go API) bilan bog'lanish xizmatlari
│   │   │   └── api.ts         # Axios orqali so'rovlar yuborish
│   │   ├── App.tsx            # Barcha komponentlarni yig'uvchiasosiy fayl
│   │   ├── main.tsx           # React kirish nuqtasi
│   │   └── index.css          # Tailwind CSS sozlamalari
│   ├── tailwind.config.js
│   ├── tsconfig.json          # TypeScript sozlamalari
│   └── package.json
│
└── backend/                   # 🚀 Kelajakdagi Go (Golang) Backend papkasi
    ├── cmd/
    │   └── server/
    │       └── main.go        # Go serverining ishga tushish nuqtasi
    ├── internal/
    │   ├── handlers/          # HTTP so'rovlarni qabul qiluvchi funksiyalar
    │   ├── models/            # Ma'lumotlar bazasi struct lari
    │   └── database/          # PostgreSQL + PostGIS ulanishi
    ├── go.mod
    └── go.sum