export type Locale = "en" | "tr" | "ru" | "de" | "es" | "fr";

export const LOCALES: Array<{code:Locale;label:string}> = [
  {code:"en",label:"English"},{code:"tr",label:"Türkçe"},{code:"ru",label:"Русский"},
  {code:"de",label:"Deutsch"},{code:"es",label:"Español"},{code:"fr",label:"Français"}
];

const levels = [
  {min:0,key:"rookie"},
  {min:100,key:"novice"},
  {min:300,key:"intermediate"},
  {min:700,key:"advanced"},
  {min:1500,key:"expert"},
  {min:3000,key:"master"},
  {min:6000,key:"legend"}
] as const;

const labels: Record<Locale, Record<string,string>> = {
  en:{rookie:"Rookie",novice:"Novice",intermediate:"Intermediate",advanced:"Advanced",expert:"Expert",master:"Master",legend:"Legend"},
  tr:{rookie:"Çaylak",novice:"Acemi",intermediate:"Orta Seviye",advanced:"İleri Seviye",expert:"Uzman",master:"Usta",legend:"Efsane"},
  ru:{rookie:"Новичок",novice:"Начинающий",intermediate:"Средний",advanced:"Продвинутый",expert:"Эксперт",master:"Мастер",legend:"Легенда"},
  de:{rookie:"Anfänger",novice:"Neuling",intermediate:"Fortgeschritten",advanced:"Erfahren",expert:"Experte",master:"Meister",legend:"Legende"},
  es:{rookie:"Novato",novice:"Principiante",intermediate:"Intermedio",advanced:"Avanzado",expert:"Experto",master:"Maestro",legend:"Leyenda"},
  fr:{rookie:"Débutant",novice:"Novice",intermediate:"Intermédiaire",advanced:"Avancé",expert:"Expert",master:"Maître",legend:"Légende"}
};

export function normalizeLocale(value?:string|null):Locale {
  return (LOCALES.some(l=>l.code===value) ? value : "en") as Locale;
}

export function getRank(xp:number, locale:Locale="en") {
  let current: (typeof levels)[number] = levels[0];
  for (const level of levels) if (xp >= level.min) current = level;
  const next = levels[levels.indexOf(current)+1];
  return {key:current.key,label:labels[locale][current.key],xp,xpToNext:next?.min ?? null,nextLabel:next ? labels[locale][next.key] : null};
}

export function visibilityBoost(rankPosition:number) {
  if (rankPosition === 1) return 60;
  if (rankPosition <= 3) return 45;
  if (rankPosition <= 10) return 30;
  if (rankPosition <= 25) return 15;
  return 0;
}

export function rankText(locale:Locale) {
  const t = {
    en:{leaderboard:"Leaderboard",earn:"Earn XP through approved photos and helpful lounge messages.",xp:"XP",rank:"Rank",boost:"Leaderboard visibility boost",top:"Top photographers get a visibility boost on their approved photos.",like:"likes",photo:"photo"},
    tr:{leaderboard:"Liderlik Tablosu",earn:"Onaylanan fotoğraflar ve faydalı lounge mesajlarıyla XP kazan.",xp:"XP",rank:"Seviye",boost:"Liderlik görünürlük bonusu",top:"Üst sıralardaki fotoğrafçıların onaylı fotoğrafları daha üstte gösterilir.",like:"beğeni",photo:"fotoğraf"},
    ru:{leaderboard:"Таблица лидеров",earn:"Получайте XP за одобренные фотографии и полезные сообщения в lounge.",xp:"XP",rank:"Ранг",boost:"Бонус видимости",top:"Одобренные фотографии лидеров показываются выше.",like:"лайков",photo:"фото"},
    de:{leaderboard:"Rangliste",earn:"Sammle XP mit freigegebenen Fotos und hilfreichen Lounge-Nachrichten.",xp:"XP",rank:"Rang",boost:"Sichtbarkeitsbonus",top:"Freigegebene Fotos von Spitzenfotografen werden weiter oben gezeigt.",like:"Likes",photo:"Foto"},
    es:{leaderboard:"Clasificación",earn:"Gana XP con fotos aprobadas y mensajes útiles en el lounge.",xp:"XP",rank:"Rango",boost:"Impulso de visibilidad",top:"Las fotos aprobadas de los mejores fotógrafos aparecen más arriba.",like:"me gusta",photo:"foto"},
    fr:{leaderboard:"Classement",earn:"Gagnez de l'XP avec des photos approuvées et des messages utiles.",xp:"XP",rank:"Rang",boost:"Bonus de visibilité",top:"Les photos approuvées des meilleurs photographes apparaissent plus haut.",like:"j'aime",photo:"photo"}
  };
  return t[locale];
}
